import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { addYouTubeToPlayQueue } from './playQueueBridge'
import { parseYouTubeInput, youtubeWatchUrl } from './providers/youtube'

const LAST_YOUTUBE_URL_KEY = 'wms-youtube-last-url'

function emitSystem(text: string, level: 'info' | 'success' | 'error' = 'info') {
  window.dispatchEvent(new CustomEvent('wms:system-message', {
    detail: { text, source: 'YouTube', level },
  }))
}

function currentYouTubeSource() {
  const input = document.querySelector<HTMLInputElement>('#youtube-provider-panel .youtube-url-form input')
  const raw = input?.value.trim() || window.localStorage.getItem(LAST_YOUTUBE_URL_KEY)?.trim() || ''
  const parsed = parseYouTubeInput(raw)
  if (!parsed) return null

  const title = document.querySelector<HTMLElement>('#youtube-provider-panel .youtube-track-info strong')?.textContent?.trim()
  return {
    videoId: parsed.videoId,
    url: youtubeWatchUrl(parsed.videoId),
    title: title || `YouTube ${parsed.videoId}`,
  }
}

function YouTubeQueueActions() {
  const [target, setTarget] = useState<Element | null>(null)
  const [busyPlay, setBusyPlay] = useState(false)

  useEffect(() => {
    const resolveTarget = () => {
      const next = document.querySelector('#youtube-provider-panel .youtube-track-info')
        ?? document.querySelector('#youtube-provider-panel .youtube-source-actions')
      setTarget((current) => current === next ? current : next)
    }
    resolveTarget()
    const observer = new MutationObserver(resolveTarget)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  const playNow = () => {
    const source = currentYouTubeSource()
    if (!source) {
      emitSystem('先にYouTube URLを貼り付けてください。')
      return
    }

    const play = document.querySelector<HTMLButtonElement>('#youtube-provider-panel .youtube-transport .primary')
    if (play && !play.disabled) {
      play.click()
      emitSystem(`${source.title} を再生します。`, 'success')
      return
    }

    const form = document.querySelector<HTMLFormElement>('#youtube-provider-panel .youtube-url-form')
    if (!form) return
    setBusyPlay(true)
    form.requestSubmit()
    emitSystem(`${source.title} を読み込んでいます。`)

    let attempts = 0
    const tryPlay = () => {
      attempts += 1
      const nextPlay = document.querySelector<HTMLButtonElement>('#youtube-provider-panel .youtube-transport .primary')
      if (nextPlay && !nextPlay.disabled) {
        nextPlay.click()
        setBusyPlay(false)
        emitSystem(`${source.title} を再生します。`, 'success')
        return
      }
      if (attempts < 28) window.setTimeout(tryPlay, 150)
      else setBusyPlay(false)
    }
    window.setTimeout(tryPlay, 120)
  }

  const addNext = () => {
    const source = currentYouTubeSource()
    if (!source) {
      emitSystem('先にYouTube URLを貼り付けてください。')
      return
    }
    addYouTubeToPlayQueue(source)
    emitSystem(`${source.title} を再生キューへ追加しました。`, 'success')
  }

  if (!target) return null

  return createPortal(
    <div className="common-source-actions" aria-label="YouTube再生操作">
      <button type="button" className="common-source-play" disabled={busyPlay} onClick={playNow}>
        {busyPlay ? '読み込み中…' : '▶ 今すぐ再生'}
      </button>
      <button type="button" className="common-source-queue" onClick={addNext}>
        ＋ 次に再生
      </button>
    </div>,
    target,
  )
}

export default YouTubeQueueActions
