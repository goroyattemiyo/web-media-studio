import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { addYouTubeToPlayQueue } from './playQueueBridge'
import { parseYouTubeInput, youtubeWatchUrl } from './providers/youtube'

const LAST_YOUTUBE_URL_KEY = 'wms-youtube-last-url'

function currentYouTubeSource() {
  const input = document.querySelector<HTMLInputElement>(
    '#youtube-provider-panel input[aria-label="YouTube URL または動画ID"]',
  )
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
  const [status, setStatus] = useState('')

  useEffect(() => {
    const resolveTarget = () => {
      const next = document.querySelector('#youtube-provider-panel .youtube-source-actions')
      setTarget((current) => current === next ? current : next)
    }
    resolveTarget()
    const observer = new MutationObserver(resolveTarget)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  if (!target) return null

  return createPortal(
    <>
      <button
        type="button"
        className="youtube-queue-button"
        onClick={() => {
          const source = currentYouTubeSource()
          if (!source) {
            setStatus('先にYouTube URLを入力してください。')
            return
          }
          addYouTubeToPlayQueue(source)
          setStatus(`${source.title} をPlay Queueへ追加しました。`)
        }}
      >
        ＋ Queue
      </button>
      {status && <span className="youtube-queue-status" role="status">{status}</span>}
    </>,
    target,
  )
}

export default YouTubeQueueActions
