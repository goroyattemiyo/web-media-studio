import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { parseYouTubeInput, youtubeWatchUrl } from './providers/youtube'

const DEFAULT_MEDIA_WORKER_URL = 'https://wms-media-worker-pcdbs5armq-an.a.run.app'
const MEDIA_WORKER_URL = ((import.meta.env.VITE_WMS_MEDIA_WORKER_URL as string | undefined)?.trim() || DEFAULT_MEDIA_WORKER_URL).replace(/\/$/, '')
const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || ''
const GOOGLE_TOKEN_KEY = 'wms-google-id-token'

type AudioFormat = 'mp3' | 'm4a' | 'wav'
type AuthState = 'checking' | 'signed_out' | 'ready'

type DownloadTarget = {
  source: string
  title: string
  provider: string
}

type GoogleCredentialResponse = {
  credential?: string
}

type GoogleIdentityApi = {
  initialize(options: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }): void
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon'
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      width?: number
    },
  ): void
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleIdentityApi
      }
    }
  }
}

let googleIdentityPromise: Promise<GoogleIdentityApi> | null = null

function loadGoogleIdentity(): Promise<GoogleIdentityApi> {
  const existing = window.google?.accounts?.id
  if (existing) return Promise.resolve(existing)
  if (googleIdentityPromise) return googleIdentityPromise

  googleIdentityPromise = new Promise((resolve, reject) => {
    const current = document.querySelector<HTMLScriptElement>('script[data-wms-google-identity]')
    const script = current ?? document.createElement('script')

    const complete = () => {
      const api = window.google?.accounts?.id
      if (api) resolve(api)
      else reject(new Error('Google認証を読み込めませんでした。'))
    }

    if (current) {
      current.addEventListener('load', complete, { once: true })
      current.addEventListener('error', () => reject(new Error('Google認証を読み込めませんでした。')), { once: true })
      return
    }

    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.wmsGoogleIdentity = '1'
    script.addEventListener('load', complete, { once: true })
    script.addEventListener('error', () => reject(new Error('Google認証を読み込めませんでした。')), { once: true })
    document.head.appendChild(script)
  })

  return googleIdentityPromise
}

function loadStoredToken() {
  try {
    return window.sessionStorage.getItem(GOOGLE_TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function storeToken(token: string) {
  try {
    if (token) window.sessionStorage.setItem(GOOGLE_TOKEN_KEY, token)
    else window.sessionStorage.removeItem(GOOGLE_TOKEN_KEY)
  } catch {
    // Keep the token in component state when sessionStorage is unavailable.
  }
}

function normalizeSourceUrl(raw: string) {
  const value = raw.trim()
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

async function responseError(response: Response) {
  try {
    const payload = await response.json() as { detail?: unknown }
    if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail.trim()
  } catch {
    // Fall through to the status label.
  }
  return `Downloadに失敗しました (${response.status})。`
}

function responseFilename(response: Response, fallback: string) {
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded)
    } catch {
      // Fall back to the regular filename form.
    }
  }
  const regular = disposition.match(/filename="?([^";]+)"?/i)?.[1]
  return regular?.trim() || fallback
}

function emitSystem(text: string, level: 'info' | 'success' | 'error' = 'info') {
  window.dispatchEvent(new CustomEvent('wms:system-message', {
    detail: { text, source: 'Download', level },
  }))
}

export default function DirectCloudDownloadPanel() {
  const [mount, setMount] = useState<HTMLElement | null>(null)
  const [target, setTarget] = useState<DownloadTarget | null>(null)
  const [format, setFormat] = useState<AudioFormat>('mp3')
  const [bitrate, setBitrate] = useState('192')
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [token, setToken] = useState(loadStoredToken)
  const [authState, setAuthState] = useState<AuthState>(token ? 'checking' : 'signed_out')
  const [authLabel, setAuthLabel] = useState('')
  const authButtonRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let slot: HTMLDivElement | null = null
    let observer: MutationObserver | null = null
    let frame = 0

    const attach = () => {
      frame = 0
      if (slot?.isConnected) return
      const panel = document.querySelector<HTMLElement>('#youtube-provider-panel')
      const sourceActions = panel?.querySelector<HTMLElement>('.youtube-source-actions')
      if (!panel || !sourceActions) return

      slot = document.createElement('div')
      slot.className = 'direct-cloud-download-slot'
      sourceActions.insertAdjacentElement('afterend', slot)
      setMount(slot)

      const description = panel.querySelector<HTMLElement>('.tool-description')
      if (description) description.textContent = '同じURLから公式再生とDownloadを選べます。'
      const badge = panel.querySelector<HTMLElement>('.youtube-official-badge')
      if (badge) badge.textContent = 'IFrame + Cloud'
      const capability = Array.from(panel.querySelectorAll<HTMLElement>('.youtube-capabilities span')).find((item) => item.textContent?.includes('Download'))
      if (capability) capability.innerHTML = '<strong>Download</strong> Cloud'
      const downloadStatus = panel.querySelector<HTMLElement>('.youtube-download-status')
      if (downloadStatus?.textContent?.includes('Colab')) downloadStatus.textContent = 'DownloadはWMS内で直接処理します。'

      observer?.disconnect()
      observer = null
    }

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(attach)
    }

    attach()
    if (!slot) {
      observer = new MutationObserver(schedule)
      observer.observe(document.body, { childList: true, subtree: true })
    }

    return () => {
      observer?.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
      slot?.remove()
    }
  }, [])

  useEffect(() => {
    const handleDownload = (event: MouseEvent) => {
      const eventTarget = event.target
      if (!(eventTarget instanceof Element)) return

      const youtubeDownload = eventTarget.closest<HTMLAnchorElement>('#youtube-provider-panel .youtube-download-button')
      if (youtubeDownload) {
        event.preventDefault()
        event.stopPropagation()

        const input = document.querySelector<HTMLInputElement>('#youtube-provider-panel .youtube-url-form input')
        const parsed = parseYouTubeInput(input?.value ?? '')
        if (!parsed) {
          setError('先にYouTube URLをLoadしてください。')
          emitSystem('先にYouTube URLをLoadしてください。', 'error')
          return
        }

        const title = document.querySelector<HTMLElement>('#youtube-provider-panel .youtube-track-info strong')?.textContent?.trim() || 'YouTube video'
        setTarget({ source: youtubeWatchUrl(parsed.videoId), title, provider: 'youtube' })
        setFormat('mp3')
        setBitrate('192')
        setRightsConfirmed(false)
        setStatus('')
        setError('')
        window.setTimeout(() => document.querySelector<HTMLElement>('.direct-cloud-download-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40)
        return
      }

      const resultDownload = eventTarget.closest<HTMLAnchorElement>('.video-search-result .video-search-actions a[href*="WMS_Colab_Localizer.ipynb"]')
      if (!resultDownload) return

      event.preventDefault()
      event.stopPropagation()
      const article = resultDownload.closest<HTMLElement>('.video-search-result')
      if (!article) return

      const sourceLink = Array.from(article.querySelectorAll<HTMLAnchorElement>('.video-search-actions a')).find((link) => {
        if (link === resultDownload || link.href.includes('WMS_Colab_Localizer.ipynb')) return false
        return Boolean(normalizeSourceUrl(link.href))
      })
      const source = sourceLink ? normalizeSourceUrl(sourceLink.href) : null
      if (!source) {
        setError('動画URLを取得できませんでした。')
        return
      }

      const title = article.querySelector<HTMLElement>('.video-search-copy > strong')?.textContent?.trim() || 'Video'
      const provider = article.querySelector<HTMLElement>('.video-provider-badge')?.textContent?.trim().toLowerCase() || 'unknown'
      setTarget({ source, title, provider })
      setFormat('mp3')
      setBitrate('192')
      setRightsConfirmed(false)
      setStatus('')
      setError('')
      window.setTimeout(() => document.querySelector<HTMLElement>('.direct-cloud-download-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40)
    }

    document.addEventListener('click', handleDownload, true)
    return () => document.removeEventListener('click', handleDownload, true)
  }, [])

  useEffect(() => {
    if (!token) {
      setAuthState('signed_out')
      setAuthLabel('')
      return
    }

    let cancelled = false
    setAuthState('checking')
    void fetch(`${MEDIA_WORKER_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }).then(async (response) => {
      if (cancelled) return
      if (!response.ok) {
        storeToken('')
        setToken('')
        setAuthState('signed_out')
        return
      }
      const user = await response.json() as { email?: string; name?: string | null }
      if (cancelled) return
      setAuthState('ready')
      setAuthLabel(user.name?.trim() || user.email?.trim() || 'Google認証済み')
    }).catch(() => {
      if (!cancelled) setAuthState('signed_out')
    })

    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!target || authState === 'ready' || !authButtonRef.current) return
    if (!GOOGLE_CLIENT_ID) {
      setError('Google認証の設定が見つかりません。')
      return
    }

    let cancelled = false
    const host = authButtonRef.current
    host.innerHTML = ''

    void loadGoogleIdentity().then((api) => {
      if (cancelled) return
      api.initialize({
        client_id: GOOGLE_CLIENT_ID,
        auto_select: false,
        cancel_on_tap_outside: false,
        callback: (response) => {
          const credential = response.credential?.trim() || ''
          if (!credential) {
            setError('Google認証に失敗しました。')
            return
          }
          storeToken(credential)
          setToken(credential)
          setError('')
        },
      })
      api.renderButton(host, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 250,
      })
    }).catch((loadError) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Google認証を読み込めませんでした。')
    })

    return () => {
      cancelled = true
    }
  }, [authState, target])

  const signOut = () => {
    storeToken('')
    setToken('')
    setAuthState('signed_out')
    setAuthLabel('')
  }

  const download = async () => {
    if (!target || busy) return
    if (!rightsConfirmed) {
      setError('保存・変換する権利または許可を確認してください。')
      return
    }
    if (!token || authState !== 'ready') {
      setError('先にGoogle認証を完了してください。')
      return
    }

    setBusy(true)
    setError('')
    setStatus('Cloudで変換しています。この画面のままお待ちください…')

    try {
      const response = await fetch(`${MEDIA_WORKER_URL}/extract`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: target.source,
          format,
          bitrate,
          rights_confirmed: true,
        }),
      })

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          signOut()
          throw new Error('Google認証の有効期限が切れました。もう一度認証してください。')
        }
        throw new Error(await responseError(response))
      }

      const blob = await response.blob()
      const fallback = `wms-download.${format}`
      const filename = responseFilename(response, fallback)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)

      setRightsConfirmed(false)
      setStatus(`${filename} のDownloadを開始しました。`)
      emitSystem(`${target.title} の${format.toUpperCase()} Downloadを開始しました。`, 'success')
    } catch (downloadError) {
      const message = downloadError instanceof Error ? downloadError.message : 'Downloadに失敗しました。'
      setError(message)
      setStatus('')
      emitSystem(message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!mount || !target) return null

  return createPortal(
    <section className="direct-cloud-download-panel" aria-label="Download">
      <div className="direct-cloud-download-heading">
        <div>
          <span>DOWNLOAD</span>
          <strong>{target.title}</strong>
          <small>{target.provider}</small>
        </div>
        <button type="button" className="direct-cloud-download-close" onClick={() => { if (!busy) setTarget(null) }} aria-label="閉じる">×</button>
      </div>

      <div className="direct-cloud-download-options">
        <label>
          <span>形式</span>
          <select value={format} disabled={busy} onChange={(event) => setFormat(event.target.value as AudioFormat)}>
            <option value="mp3">MP3</option>
            <option value="m4a">M4A</option>
            <option value="wav">WAV</option>
          </select>
        </label>
        {format === 'mp3' && (
          <label>
            <span>音質</span>
            <select value={bitrate} disabled={busy} onChange={(event) => setBitrate(event.target.value)}>
              <option value="128">128 kbps</option>
              <option value="192">192 kbps</option>
              <option value="256">256 kbps</option>
              <option value="320">320 kbps</option>
            </select>
          </label>
        )}
      </div>

      <label className="direct-cloud-download-rights">
        <input
          type="checkbox"
          checked={rightsConfirmed}
          disabled={busy}
          onChange={(event) => {
            setRightsConfirmed(event.target.checked)
            setError('')
          }}
        />
        <span>このメディアを保存・変換する権利または許可があります</span>
      </label>

      <div className="direct-cloud-download-auth">
        {authState === 'ready' ? (
          <><span>✓ Google認証済み{authLabel ? ` · ${authLabel}` : ''}</span><button type="button" onClick={signOut} disabled={busy}>解除</button></>
        ) : authState === 'checking' ? (
          <span>Google認証を確認しています…</span>
        ) : (
          <><span>初回だけGoogle認証が必要です。</span><div ref={authButtonRef} className="direct-cloud-download-google" /></>
        )}
      </div>

      <button
        type="button"
        className="direct-cloud-download-submit"
        disabled={busy || !rightsConfirmed || authState !== 'ready'}
        onClick={() => void download()}
      >
        {busy ? '変換中…' : `${format.toUpperCase()}でDownload`}
      </button>

      {status && <p className="direct-cloud-download-status">{status}</p>}
      {error && <p className="direct-cloud-download-error">{error}</p>}
      <small className="direct-cloud-download-note">30分以内 / playlist無効 / account cookies・proxy・DRM回避なし</small>
    </section>,
    mount,
  )
}
