import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { parseYouTubeInput, youtubeWatchUrl } from './providers/youtube'

const COMPANION_SESSION_KEY = 'wms-colab-companion-session-url'
const COMPANION_NOTEBOOK_URL =
  'https://colab.research.google.com/github/goroyattemiyo/web-media-studio/blob/main/colab/WMS_Colab_Companion_v2.ipynb'
const LEGACY_LOCALIZER_URL =
  'https://colab.research.google.com/github/goroyattemiyo/web-media-studio/blob/main/colab/WMS_Colab_Localizer.ipynb'

type CompanionState = 'offline' | 'connecting' | 'ready' | 'expired'
type CompanionFormat = 'mp3' | 'm4a' | 'wav'

type CompanionHandoff = {
  source: string
  title: string
  provider: string
  format: CompanionFormat
}

function normalizeCompanionUrl(raw: string) {
  const value = raw.trim()
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    if (!url.hostname.endsWith('.gradio.live')) return null
    if (url.username || url.password) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
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

function preparedCompanionUrl(baseUrl: string, handoff: CompanionHandoff | null) {
  if (!handoff) return baseUrl
  const url = new URL(baseUrl)
  url.searchParams.set('wms_source', handoff.source)
  url.searchParams.set('wms_title', handoff.title.slice(0, 240))
  url.searchParams.set('wms_provider', handoff.provider.slice(0, 64))
  url.searchParams.set('wms_format', handoff.format)
  return url.toString()
}

function loadSessionUrl() {
  try {
    const stored = window.sessionStorage.getItem(COMPANION_SESSION_KEY) ?? ''
    return normalizeCompanionUrl(stored)
  } catch {
    return null
  }
}

function persistSessionUrl(value: string | null) {
  try {
    if (value) window.sessionStorage.setItem(COMPANION_SESSION_KEY, value)
    else window.sessionStorage.removeItem(COMPANION_SESSION_KEY)
  } catch {
    // The current page session can still use the Companion when sessionStorage is unavailable.
  }
}

function emitSystem(text: string, level: 'info' | 'success' | 'error' = 'info') {
  window.dispatchEvent(new CustomEvent('wms:system-message', {
    detail: { text, source: 'Colab Companion', level },
  }))
}

function statusCopy(state: CompanionState, handoff: CompanionHandoff | null) {
  const label = handoff?.title || 'Download対象'
  if (state === 'connecting') return handoff ? `${label} をCompanionへ送っています…` : 'WMS内へ読み込んでいます…'
  if (state === 'ready') return handoff ? `${label} をCompanionへ渡しました。権利確認後にLocalizeできます。` : 'WMS内への読み込みが完了しました。'
  if (state === 'expired') return handoff ? `${label} は保持しています。Colab / Gradio セッションを再接続してください。` : 'Colab / Gradio セッションを再接続してください。'
  if (handoff) return `${label} を保持しました。Companionを起動してgradio.live URLを登録してください。`
  return 'ColabでCompanionを起動し、gradio.live URLを登録してください。'
}

export default function ColabCompanionShell() {
  const initialSessionUrl = loadSessionUrl()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [inputUrl, setInputUrl] = useState(initialSessionUrl ?? '')
  const [sessionUrl, setSessionUrl] = useState<string | null>(initialSessionUrl)
  const [frameUrl, setFrameUrl] = useState<string | null>(initialSessionUrl)
  const [pendingHandoff, setPendingHandoff] = useState<CompanionHandoff | null>(null)
  const [state, setState] = useState<CompanionState>(initialSessionUrl ? 'connecting' : 'offline')
  const [validationError, setValidationError] = useState('')
  const [frameVersion, setFrameVersion] = useState(0)

  useEffect(() => {
    let mount: HTMLDivElement | null = null
    let observer: MutationObserver | null = null
    let frame = 0

    const attach = () => {
      frame = 0
      if (mount?.isConnected) return
      const panel = document.querySelector<HTMLElement>('#youtube-provider-panel')
      const sourceActions = panel?.querySelector<HTMLElement>('.youtube-source-actions')
      if (!panel || !sourceActions) return

      mount = document.createElement('div')
      mount.className = 'colab-companion-shell-slot'
      sourceActions.insertAdjacentElement('afterend', mount)
      setTarget(mount)
      observer?.disconnect()
      observer = null
    }

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(attach)
    }

    attach()
    if (!mount) {
      observer = new MutationObserver(schedule)
      observer.observe(document.body, { childList: true, subtree: true })
    }

    return () => {
      observer?.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
      mount?.remove()
    }
  }, [])

  const scrollToCompanion = useCallback(() => {
    window.setTimeout(() => {
      document.querySelector<HTMLElement>('.colab-companion-shell')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      })
    }, 30)
  }, [])

  const acceptHandoff = useCallback((handoff: CompanionHandoff) => {
    setPendingHandoff(handoff)
    setValidationError('')

    if (sessionUrl && state !== 'expired') {
      setFrameUrl(preparedCompanionUrl(sessionUrl, handoff))
      setState('connecting')
      setFrameVersion((value) => value + 1)
      emitSystem(`${handoff.title} をColab Companionへ送ります。`, 'success')
    } else {
      emitSystem(`${handoff.title} をDownload対象として保持しました。Companionを接続してください。`, 'info')
    }
    scrollToCompanion()
  }, [scrollToCompanion, sessionUrl, state])

  useEffect(() => {
    const interceptDownload = (event: MouseEvent) => {
      const eventTarget = event.target
      if (!(eventTarget instanceof Element)) return

      const youtubeDownload = eventTarget.closest<HTMLAnchorElement>('#youtube-provider-panel .youtube-download-button')
      if (youtubeDownload) {
        const input = document.querySelector<HTMLInputElement>('#youtube-provider-panel .youtube-url-form input')
        const parsed = parseYouTubeInput(input?.value ?? '')
        if (!parsed) return

        const title = document.querySelector<HTMLElement>('#youtube-provider-panel .youtube-track-info strong')?.textContent?.trim() || 'YouTube video'
        event.preventDefault()
        event.stopPropagation()
        acceptHandoff({
          source: youtubeWatchUrl(parsed.videoId),
          title,
          provider: 'youtube',
          format: 'mp3',
        })
        return
      }

      const resultDownload = eventTarget.closest<HTMLAnchorElement>('.video-search-result .video-search-actions a[href*="WMS_Colab_Localizer.ipynb"]')
      if (!resultDownload) return

      const article = resultDownload.closest<HTMLElement>('.video-search-result')
      if (!article) return
      const sourceLink = Array.from(article.querySelectorAll<HTMLAnchorElement>('.video-search-actions a')).find((link) => {
        if (link === resultDownload || link.href.includes('WMS_Colab_Localizer.ipynb')) return false
        return Boolean(normalizeSourceUrl(link.href))
      })
      const source = sourceLink ? normalizeSourceUrl(sourceLink.href) : null
      if (!source) return

      const title = article.querySelector<HTMLElement>('.video-search-copy > strong')?.textContent?.trim() || 'Video'
      const provider = article.querySelector<HTMLElement>('.video-provider-badge')?.textContent?.trim().toLowerCase() || 'unknown'
      event.preventDefault()
      event.stopPropagation()
      acceptHandoff({ source, title, provider, format: 'mp3' })
    }

    document.addEventListener('click', interceptDownload, true)
    return () => document.removeEventListener('click', interceptDownload, true)
  }, [acceptHandoff])

  const connect = () => {
    const normalized = normalizeCompanionUrl(inputUrl)
    if (!normalized) {
      setValidationError('https://xxxxx.gradio.live のURLを入力してください。')
      return
    }

    setValidationError('')
    setInputUrl(normalized)
    setSessionUrl(normalized)
    persistSessionUrl(normalized)
    setFrameUrl(preparedCompanionUrl(normalized, pendingHandoff))
    setState('connecting')
    setFrameVersion((value) => value + 1)
  }

  const reconnect = () => {
    if (!sessionUrl) {
      connect()
      return
    }
    setValidationError('')
    setFrameUrl(preparedCompanionUrl(sessionUrl, pendingHandoff))
    setState('connecting')
    setFrameVersion((value) => value + 1)
  }

  const disconnect = () => {
    persistSessionUrl(null)
    setSessionUrl(null)
    setFrameUrl(null)
    setState('offline')
    setValidationError('')
    setFrameVersion((value) => value + 1)
  }

  const markExpired = () => {
    if (!sessionUrl) return
    setState('expired')
  }

  if (!target) return null

  const externalCompanionUrl = frameUrl ?? sessionUrl

  return createPortal(
    <section className="colab-companion-shell" aria-label="WMS Colab Companion">
      <div className="colab-companion-heading">
        <div>
          <span className="colab-companion-eyebrow">LOCALIZE</span>
          <strong>Colab Companion</strong>
        </div>
        <span className={`colab-companion-state is-${state}`}>{state.toUpperCase()}</span>
      </div>

      <p className="colab-companion-status">{statusCopy(state, pendingHandoff)}</p>

      {pendingHandoff && (
        <div className="colab-companion-handoff">
          <span>DOWNLOAD TARGET</span>
          <strong>{pendingHandoff.title}</strong>
          <small>{pendingHandoff.provider} · {pendingHandoff.format.toUpperCase()}</small>
        </div>
      )}

      <div className="colab-companion-connect-row">
        <input
          type="url"
          value={inputUrl}
          placeholder="https://xxxxx.gradio.live"
          aria-label="Gradio share URL"
          onChange={(event) => {
            setInputUrl(event.target.value)
            setValidationError('')
          }}
        />
        <button type="button" onClick={connect}>接続</button>
      </div>
      {validationError && <p className="colab-companion-error">{validationError}</p>}

      <div className="colab-companion-actions">
        <a href={COMPANION_NOTEBOOK_URL} target="_blank" rel="noreferrer">Companionを起動 ↗</a>
        {sessionUrl && <button type="button" onClick={reconnect}>再接続</button>}
        {externalCompanionUrl && <a href={externalCompanionUrl} target="_blank" rel="noreferrer">別タブで開く ↗</a>}
        {sessionUrl && <button type="button" onClick={markExpired}>期限切れ</button>}
        {sessionUrl && <button type="button" onClick={disconnect}>切断</button>}
      </div>

      {frameUrl && state !== 'expired' && (
        <div className="colab-companion-frame-shell" data-state={state}>
          <iframe
            key={`${frameUrl}:${frameVersion}`}
            src={frameUrl}
            title="WMS Colab Companion"
            allow="clipboard-read; clipboard-write; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setState('ready')}
            onError={() => setState('expired')}
          />
        </div>
      )}

      {state === 'expired' && sessionUrl && (
        <div className="colab-companion-expired">
          <strong>セッションの再起動が必要です。</strong>
          <span>Download対象は保持しています。ColabでCompanionを起動し直し、新しい gradio.live URLを登録してください。</span>
        </div>
      )}

      <div className="colab-companion-fallback">
        <span>従来方式も残しています。</span>
        <a href={LEGACY_LOCALIZER_URL} target="_blank" rel="noreferrer">旧1セル Localizer ↗</a>
      </div>

      <p className="colab-companion-note">
        WMSはSource URL・Title・Provider・FormatだけをCompanionへ渡します。権利確認は自動送信せず、毎回Companion側で明示確認します。
      </p>
    </section>,
    target,
  )
}
