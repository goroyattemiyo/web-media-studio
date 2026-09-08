import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type MessageLevel = 'info' | 'success' | 'error'

type SystemMessage = {
  text: string
  level: MessageLevel
  source: string
}

const SOURCE_SELECTORS: Array<{ selector: string; level: MessageLevel; source: string }> = [
  { selector: '.library-message', level: 'info', source: 'Library' },
  { selector: '.library-message.is-error', level: 'error', source: 'Library' },
  { selector: '.playlist-manager-message', level: 'info', source: 'Playlist' },
  { selector: '.playlist-manager-message.is-error', level: 'error', source: 'Playlist' },
  { selector: '.unified-play-queue-status', level: 'info', source: 'Queue' },
  { selector: '#youtube-provider-panel .youtube-download-status', level: 'success', source: 'YouTube' },
  { selector: '#youtube-provider-panel .youtube-status-row small', level: 'info', source: 'YouTube' },
  { selector: '#youtube-provider-panel .youtube-error', level: 'error', source: 'YouTube' },
  { selector: '#youtube-provider-panel .youtube-queue-status', level: 'success', source: 'Queue' },
  { selector: '#recorder-panel .record-notice', level: 'success', source: 'Record' },
  { selector: '#recorder-panel .record-error', level: 'error', source: 'Record' },
  { selector: '#ffmpeg-tools-panel .ffmpeg-message', level: 'info', source: 'FFmpeg' },
  { selector: '#ffmpeg-tools-panel .ffmpeg-error', level: 'error', source: 'FFmpeg' },
]

function cleanText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

export default function SystemMessageCenter() {
  const [target, setTarget] = useState<Element | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [message, setMessage] = useState<SystemMessage>({
    text: '準備完了。曲を選ぶか、YouTube URLを貼り付けてください。',
    level: 'info',
    source: 'WMS',
  })
  const valuesRef = useRef(new Map<Element, string>())

  useEffect(() => {
    setTarget(document.querySelector('.topbar'))

    let frame = 0
    const scan = (initial = false) => {
      frame = 0
      let next: SystemMessage | null = null

      for (const source of SOURCE_SELECTORS) {
        document.querySelectorAll<HTMLElement>(source.selector).forEach((element) => {
          const text = cleanText(element.textContent)
          if (!text) return
          const previous = valuesRef.current.get(element)
          valuesRef.current.set(element, text)
          if (!initial && previous !== undefined && previous !== text) {
            next = { text, level: source.level, source: source.source }
          }
          if (!initial && previous === undefined && source.level === 'error') {
            next = { text, level: source.level, source: source.source }
          }
        })
      }

      if (next) {
        setMessage(next)
        setExpanded(false)
      }
    }

    scan(true)
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(() => scan(false))
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    const handleCustom = (event: Event) => {
      const custom = event as CustomEvent<Partial<SystemMessage>>
      const text = cleanText(custom.detail?.text)
      if (!text) return
      setMessage({
        text,
        level: custom.detail?.level ?? 'info',
        source: custom.detail?.source ?? 'WMS',
      })
      setExpanded(false)
    }
    window.addEventListener('wms:system-message', handleCustom)

    return () => {
      observer.disconnect()
      window.removeEventListener('wms:system-message', handleCustom)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  if (!target) return null

  return createPortal(
    <button
      type="button"
      className={`system-message-center is-${message.level} ${expanded ? 'is-expanded' : ''}`}
      onClick={() => setExpanded((value) => !value)}
      aria-live={message.level === 'error' ? 'assertive' : 'polite'}
      title="タップすると全文を表示します"
    >
      <span className="system-message-dot" aria-hidden="true" />
      <b>{message.source}</b>
      <span>{message.text}</span>
    </button>,
    target,
  )
}
