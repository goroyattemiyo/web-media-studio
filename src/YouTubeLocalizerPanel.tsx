import { FormEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getMediaLibraryBytes,
  MEDIA_LIBRARY_MAX_ITEM_BYTES,
  MEDIA_LIBRARY_SOFT_LIMIT_BYTES,
  saveMediaLibraryItems,
  StoredMediaLibraryItem,
} from './mediaLibraryDb'
import { GoogleIdentityApi, loadGoogleIdentityServices } from './googleIdentity'
import { parseYouTubeInput, youtubeWatchUrl } from './providers/youtube'

const WORKER_URL = 'https://wms-media-worker-pcdbs5armq-an.a.run.app'
const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()
const GOOGLE_ID_TOKEN_STORAGE_KEY = 'wms-google-id-token'
const LAST_YOUTUBE_URL_KEY = 'wms-youtube-last-url'

type AudioFormat = 'mp3' | 'm4a' | 'wav'
type Bitrate = '128' | '192' | '256' | '320'

type GoogleUser = {
  email: string
  name: string | null
}

type Props = {
  onMediaLocalized?: (item: StoredMediaLibraryItem) => void
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB']
  let amount = value
  let unitIndex = 0
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024
    unitIndex += 1
  }
  return `${amount.toFixed(unitIndex >= 2 && amount < 10 ? 1 : 0)} ${units[unitIndex]}`
}

function decodeWorkerTitle(value: string | null) {
  if (!value) return 'youtube-audio'
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function mediaName(title: string, format: AudioFormat) {
  const clean = title.replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').trim().replace(/[._ ]+$/g, '')
  return `${clean || 'youtube-audio'}.${format}`
}

function mediaMime(format: AudioFormat) {
  if (format === 'm4a') return 'audio/mp4'
  if (format === 'wav') return 'audio/wav'
  return 'audio/mpeg'
}

function workerItemId() {
  if ('randomUUID' in crypto) return `worker-${crypto.randomUUID()}`
  return `worker-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function responseError(response: Response) {
  try {
    const body = await response.json() as { detail?: unknown }
    if (typeof body.detail === 'string' && body.detail) return body.detail
  } catch {
    // Fall through to the HTTP status below.
  }
  return `Worker request failed (${response.status}).`
}

function storedGoogleToken() {
  try {
    return window.sessionStorage.getItem(GOOGLE_ID_TOKEN_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function rememberGoogleToken(token: string) {
  try {
    window.sessionStorage.setItem(GOOGLE_ID_TOKEN_STORAGE_KEY, token)
  } catch {
    // A private/restricted browser can reject storage; the current in-memory request still works.
  }
}

function forgetGoogleToken() {
  try {
    window.sessionStorage.removeItem(GOOGLE_ID_TOKEN_STORAGE_KEY)
  } catch {
    // Ignore unavailable session storage.
  }
}

function YouTubeLocalizerPanel({ onMediaLocalized }: Props) {
  const [portalTarget, setPortalTarget] = useState<Element | null>(null)
  const [urlInput, setUrlInput] = useState(() => window.localStorage.getItem(LAST_YOUTUBE_URL_KEY) ?? '')
  const [authUser, setAuthUser] = useState<GoogleUser | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [authStatus, setAuthStatus] = useState(GOOGLE_CLIENT_ID ? 'Googleアカウントで接続してください。' : 'Googleログインの設定待ちです。')
  const [audioFormat, setAudioFormat] = useState<AudioFormat>('mp3')
  const [bitrate, setBitrate] = useState<Bitrate>('192')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Cloud Run workerで音声化し、端末内ライブラリへ保存します。')
  const [error, setError] = useState<string | null>(null)
  const [lastSavedName, setLastSavedName] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const googleApiRef = useRef<GoogleIdentityApi | null>(null)
  const tokenRef = useRef(storedGoogleToken())

  const clearGoogleSession = (message: string) => {
    tokenRef.current = ''
    forgetGoogleToken()
    setAuthUser(null)
    setAuthStatus(message)
    googleApiRef.current?.disableAutoSelect()
  }

  const verifyGoogleToken = async (token: string) => {
    const response = await fetch(`${WORKER_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) throw new Error(await responseError(response))
    return await response.json() as GoogleUser
  }

  const acceptGoogleCredential = async (token: string) => {
    if (!token) return
    setAuthBusy(true)
    setError(null)
    setAuthStatus('Googleアカウントを確認しています…')
    try {
      const user = await verifyGoogleToken(token)
      tokenRef.current = token
      rememberGoogleToken(token)
      setAuthUser(user)
      setAuthStatus(`${user.name ?? user.email} で接続しました。`)
    } catch (authError) {
      clearGoogleSession('Googleログインを確認できませんでした。もう一度接続してください。')
      setError(authError instanceof Error ? authError.message : 'Googleログインを確認できませんでした。')
    } finally {
      setAuthBusy(false)
    }
  }

  useEffect(() => {
    setPortalTarget(document.querySelector('.side-stack'))
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!portalTarget) return
    if (!GOOGLE_CLIENT_ID) {
      setAuthReady(true)
      return
    }

    let cancelled = false

    const initializeGoogle = async () => {
      try {
        const api = await loadGoogleIdentityServices()
        if (cancelled) return
        googleApiRef.current = api
        api.initialize({
          client_id: GOOGLE_CLIENT_ID,
          auto_select: true,
          cancel_on_tap_outside: true,
          callback: (credentialResponse) => {
            void acceptGoogleCredential(credentialResponse.credential)
          },
        })

        if (googleButtonRef.current) {
          googleButtonRef.current.innerHTML = ''
          api.renderButton(googleButtonRef.current, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            width: 280,
          })
        }

        const existingToken = tokenRef.current
        if (existingToken) {
          try {
            const user = await verifyGoogleToken(existingToken)
            if (!cancelled) {
              setAuthUser(user)
              setAuthStatus(`${user.name ?? user.email} で接続済みです。`)
            }
          } catch {
            if (!cancelled) clearGoogleSession('ログイン期限が切れています。Googleで再接続してください。')
          }
        } else {
          api.prompt()
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Googleログインを準備できませんでした。')
          setAuthStatus('Googleログインを準備できませんでした。')
        }
      } finally {
        if (!cancelled) setAuthReady(true)
      }
    }

    void initializeGoogle()
    return () => {
      cancelled = true
    }
  }, [portalTarget])

  const signOut = () => {
    clearGoogleSession('このブラウザのWMSからサインアウトしました。')
    setError(null)
  }

  const useCurrentYouTubeUrl = () => {
    const current = window.localStorage.getItem(LAST_YOUTUBE_URL_KEY) ?? ''
    setUrlInput(current)
    setError(null)
    setStatus(current ? 'Official playerで最後に読み込んだURLをセットしました。' : 'Official player側に保存されたURLがありません。')
  }

  const localize = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return

    const parsed = parseYouTubeInput(urlInput)
    if (!parsed) {
      setError('YouTubeの動画URL、Shorts URL、youtu.be URL、または11文字の動画IDを入力してください。')
      return
    }

    const googleToken = tokenRef.current || storedGoogleToken()
    if (!authUser || !googleToken) {
      setError('先にGoogleアカウントで接続してください。')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setError(null)
    setLastSavedName(null)
    setStatus('Cloud Runで音声を生成しています。動画の長さによって数分かかることがあります…')

    try {
      const response = await fetch(`${WORKER_URL}/extract`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: youtubeWatchUrl(parsed.videoId),
          format: audioFormat,
          bitrate,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const message = await responseError(response)
        if (response.status === 401 || response.status === 403) {
          clearGoogleSession('Googleログインの再確認が必要です。')
        }
        throw new Error(message)
      }

      setStatus('音声を受信しました。端末内ライブラリへ保存しています…')
      const blob = await response.blob()
      if (!blob.size) throw new Error('Workerから空の音声ファイルが返されました。')
      if (blob.size > MEDIA_LIBRARY_MAX_ITEM_BYTES) {
        throw new Error(`生成ファイルが1ファイル上限 ${formatBytes(MEDIA_LIBRARY_MAX_ITEM_BYTES)} を超えています。`)
      }

      const currentBytes = await getMediaLibraryBytes()
      if (currentBytes + blob.size > MEDIA_LIBRARY_SOFT_LIMIT_BYTES) {
        throw new Error(`保存ライブラリの上限 ${formatBytes(MEDIA_LIBRARY_SOFT_LIMIT_BYTES)} を超えるため保存できません。`)
      }

      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate()
        const usage = estimate.usage ?? 0
        const quota = estimate.quota ?? 0
        if (quota > 0 && usage + blob.size > quota * 0.9) {
          throw new Error('ブラウザの保存容量が少なくなっています。不要な保存メディアを削除してから再試行してください。')
        }
      }

      if (navigator.storage?.persist) {
        try {
          await navigator.storage.persist()
        } catch {
          // Persistence is controlled by the browser. IndexedDB can still be used when denied.
        }
      }

      const title = decodeWorkerTitle(response.headers.get('X-WMS-Title'))
      const name = mediaName(title, audioFormat)
      const record: StoredMediaLibraryItem = {
        id: workerItemId(),
        name,
        kind: 'audio',
        mimeType: blob.type || mediaMime(audioFormat),
        relativePath: null,
        savedAt: Date.now(),
        size: blob.size,
        blob,
      }

      await saveMediaLibraryItems([record])
      setLastSavedName(name)
      setStatus(`${name} を端末内ライブラリへ保存しました。ローカルプレーヤーに反映しています…`)
      onMediaLocalized?.(record)
      window.setTimeout(() => document.getElementById('library-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 180)
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') {
        setStatus('音声化をキャンセルしました。')
      } else {
        setError(requestError instanceof Error ? requestError.message : '音声化に失敗しました。')
        setStatus('音声化または保存に失敗しました。')
      }
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }

  const cancel = () => abortRef.current?.abort()

  if (!portalTarget) return null

  const authLabel = !GOOGLE_CLIENT_ID ? 'SETUP' : authBusy ? 'SIGNING IN' : authUser ? 'CONNECTED' : 'SIGN IN'

  return createPortal(
    <section id="youtube-localizer-panel" className="glass-panel youtube-localizer-panel">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">YOUTUBE → LOCAL</p>
          <p className="tool-description">Cloud Run workerで音声化し、WMSの保存ライブラリへ追加します。</p>
          <h2>Localize audio</h2>
        </div>
        <span className="localizer-worker-badge">CLOUD RUN</span>
      </div>

      <div className="localizer-auth-card">
        <div className="localizer-auth-heading">
          <div>
            <strong>Google account</strong>
            <span>{authStatus}</span>
          </div>
          <b className={authUser ? 'is-connected' : ''}>{authLabel}</b>
        </div>
        <div className={`google-signin-slot ${authUser ? 'is-hidden' : ''}`} ref={googleButtonRef} />
        {authUser && (
          <div className="localizer-auth-user">
            <span>{authUser.name ?? 'Google user'}</span>
            <small>{authUser.email}</small>
            <button type="button" className="secondary" onClick={signOut} disabled={busy}>Sign out</button>
          </div>
        )}
        {!GOOGLE_CLIENT_ID && <small>Google OAuth Client ID を設定すると、APIキー入力なしで利用できます。</small>}
        {GOOGLE_CLIENT_ID && authReady && !authUser && <small>Googleで接続すると、このブラウザセッション中はAPIキー入力なしでWorkerを利用できます。</small>}
      </div>

      <form className="localizer-form" onSubmit={localize}>
        <label>
          <span>YouTube URL / video ID</span>
          <div className="localizer-url-row">
            <input
              type="text"
              inputMode="url"
              placeholder="YouTube URL または動画ID"
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              aria-label="LocalizeするYouTube URL または動画ID"
            />
            <button type="button" className="secondary" onClick={useCurrentYouTubeUrl} disabled={busy}>Use current</button>
          </div>
        </label>

        <div className="localizer-options">
          <label>
            <span>Format</span>
            <select value={audioFormat} disabled={busy} onChange={(event) => setAudioFormat(event.target.value as AudioFormat)}>
              <option value="mp3">MP3</option>
              <option value="m4a">M4A</option>
              <option value="wav">WAV</option>
            </select>
          </label>
          <label>
            <span>MP3 bitrate</span>
            <select value={bitrate} disabled={busy || audioFormat !== 'mp3'} onChange={(event) => setBitrate(event.target.value as Bitrate)}>
              <option value="128">128 kbps</option>
              <option value="192">192 kbps</option>
              <option value="256">256 kbps</option>
              <option value="320">320 kbps</option>
            </select>
          </label>
        </div>

        <div className="localizer-actions">
          <button type="submit" className="primary" disabled={busy || !urlInput.trim() || !authUser}>{busy ? 'Processing…' : 'Localize & Save'}</button>
          {busy && <button type="button" className="secondary" onClick={cancel}>Cancel</button>}
        </div>
      </form>

      <div className="localizer-status">
        <span className={lastSavedName ? 'supported' : busy ? 'working' : ''}>{lastSavedName ? 'SAVED' : busy ? 'WORKING' : 'READY'}</span>
        <small>{status}</small>
      </div>
      {error && <p className="youtube-error">{error}</p>}

      <div className="localizer-flow">
        <span>URL</span><b>→</b><span>Cloud Run</span><b>→</b><span>Audio Blob</span><b>→</b><span>IndexedDB</span><b>→</b><span>Local Player</span>
      </div>
      <p className="youtube-policy-note">自分が権利を持つ、または保存・変換の許可を得ているコンテンツだけに使用してください。開始位置付きURLでも音声化するのは動画全体です。</p>
    </section>,
    portalTarget,
  )
}

export default YouTubeLocalizerPanel
