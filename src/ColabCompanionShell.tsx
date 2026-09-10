import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const COMPANION_SESSION_KEY = 'wms-colab-companion-session-url'
const COMPANION_NOTEBOOK_URL =
  'https://colab.research.google.com/github/goroyattemiyo/web-media-studio/blob/main/colab/WMS_Colab_Companion_v2.ipynb'
const LEGACY_LOCALIZER_URL =
  'https://colab.research.google.com/github/goroyattemiyo/web-media-studio/blob/main/colab/WMS_Colab_Localizer.ipynb'

type CompanionState = 'offline' | 'connecting' | 'ready' | 'expired'

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

function statusCopy(state: CompanionState) {
  if (state === 'connecting') return 'WMS内へ読み込んでいます…'
  if (state === 'ready') return 'WMS内への読み込みが完了しました。'
  if (state === 'expired') return 'Colab / Gradio セッションを再接続してください。'
  return 'ColabでCompanionを起動し、gradio.live URLを登録してください。'
}

export default function ColabCompanionShell() {
  const initialSessionUrl = loadSessionUrl()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [inputUrl, setInputUrl] = useState(initialSessionUrl ?? '')
  const [sessionUrl, setSessionUrl] = useState<string | null>(initialSessionUrl)
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
    setState('connecting')
    setFrameVersion((value) => value + 1)
  }

  const reconnect = () => {
    if (!sessionUrl) {
      connect()
      return
    }
    setValidationError('')
    setState('connecting')
    setFrameVersion((value) => value + 1)
  }

  const disconnect = () => {
    persistSessionUrl(null)
    setSessionUrl(null)
    setState('offline')
    setValidationError('')
    setFrameVersion((value) => value + 1)
  }

  const markExpired = () => {
    if (!sessionUrl) return
    setState('expired')
  }

  if (!target) return null

  return createPortal(
    <section className="colab-companion-shell" aria-label="WMS Colab Companion">
      <div className="colab-companion-heading">
        <div>
          <span className="colab-companion-eyebrow">LOCALIZE</span>
          <strong>Colab Companion</strong>
        </div>
        <span className={`colab-companion-state is-${state}`}>{state.toUpperCase()}</span>
      </div>

      <p className="colab-companion-status">{statusCopy(state)}</p>

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
        {sessionUrl && <a href={sessionUrl} target="_blank" rel="noreferrer">別タブで開く ↗</a>}
        {sessionUrl && <button type="button" onClick={markExpired}>期限切れ</button>}
        {sessionUrl && <button type="button" onClick={disconnect}>切断</button>}
      </div>

      {sessionUrl && state !== 'expired' && (
        <div className="colab-companion-frame-shell" data-state={state}>
          <iframe
            key={`${sessionUrl}:${frameVersion}`}
            src={sessionUrl}
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
          <span>ColabでCompanionを起動し直し、新しい gradio.live URLを登録してください。</span>
        </div>
      )}

      <div className="colab-companion-fallback">
        <span>従来方式も残しています。</span>
        <a href={LEGACY_LOCALIZER_URL} target="_blank" rel="noreferrer">旧1セル Localizer ↗</a>
      </div>

      <p className="colab-companion-note">
        gradio.live はColab実行中だけ使える一時URLです。READYはWMS内へのiframe読込完了を示し、Colabの稼働保証ではありません。
      </p>
    </section>,
    target,
  )
}
