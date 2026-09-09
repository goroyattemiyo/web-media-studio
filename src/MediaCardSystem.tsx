import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type Language = 'ja' | 'en'
type BusyMode = 'play-now' | 'play-next' | null

function loadLanguage(): Language {
  try {
    return window.localStorage.getItem('wms-language') === 'en' ? 'en' : 'ja'
  } catch {
    return 'ja'
  }
}

function emitSystem(text: string, level: 'info' | 'success' | 'error' = 'info') {
  window.dispatchEvent(new CustomEvent('wms:system-message', {
    detail: { text, source: 'Library', level },
  }))
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}

function queueRows() {
  return Array.from(document.querySelectorAll<HTMLElement>('#library-panel .playlist-row'))
}

function rowTitle(row: HTMLElement) {
  return row.querySelector<HTMLElement>('.playlist-name')?.textContent?.trim() || 'Local media'
}

async function placeAsNext(row: HTMLElement) {
  const token = `media-card-${Date.now()}-${Math.random().toString(36).slice(2)}`
  row.dataset.wmsMediaCardToken = token

  for (let attempt = 0; attempt < 96; attempt += 1) {
    const rows = queueRows()
    const marked = document.querySelector<HTMLElement>(`#library-panel .playlist-row[data-wms-media-card-token="${token}"]`)
    if (!marked) return 'missing' as const

    const markedIndex = rows.indexOf(marked)
    const currentIndex = rows.findIndex((candidate) => Boolean(candidate.querySelector('.playlist-item.is-current')))
    if (markedIndex < 0) return 'missing' as const
    if (currentIndex === markedIndex) return 'current' as const

    const targetIndex = currentIndex >= 0 ? currentIndex + 1 : 0
    if (markedIndex === targetIndex) return 'placed' as const

    const buttons = marked.querySelectorAll<HTMLButtonElement>('.queue-order-actions button')
    const moveButton = markedIndex > targetIndex ? buttons[0] : buttons[1]
    if (!moveButton || moveButton.disabled) return 'blocked' as const
    moveButton.click()
    await wait(28)
  }

  return 'timeout' as const
}

function LocalMediaCardActions({ row, language }: { row: HTMLElement; language: Language }) {
  const [busy, setBusy] = useState<BusyMode>(null)
  const title = rowTitle(row)

  const playNow = async () => {
    if (busy) return
    setBusy('play-now')
    try {
      const selectButton = row.querySelector<HTMLButtonElement>('.playlist-item')
      if (!selectButton) throw new Error('ROW_SELECT_UNAVAILABLE')
      selectButton.click()
      await wait(90)

      const playButton = document.querySelector<HTMLButtonElement>('#player-panel .play-button')
      if (!playButton) throw new Error('PLAYER_UNAVAILABLE')
      if (playButton.textContent?.includes('▶')) playButton.click()

      emitSystem(
        language === 'ja' ? `${title} を再生します。` : `Playing ${title}.`,
        'success',
      )
    } catch {
      emitSystem(
        language === 'ja' ? 'この曲をPlayerで再生できませんでした。' : 'Could not play this item in Player.',
        'error',
      )
    } finally {
      setBusy(null)
    }
  }

  const playNext = async () => {
    if (busy) return
    setBusy('play-next')
    try {
      const result = await placeAsNext(row)
      if (result === 'current') {
        emitSystem(language === 'ja' ? `${title} は現在再生中です。` : `${title} is already playing.`)
      } else if (result === 'placed') {
        emitSystem(
          language === 'ja' ? `${title} を次に再生へ移動しました。` : `Moved ${title} to Play Next.`,
          'success',
        )
      } else {
        throw new Error(result)
      }
    } catch {
      emitSystem(
        language === 'ja' ? '再生キューの順番を変更できませんでした。' : 'Could not update the play queue.',
        'error',
      )
    } finally {
      delete row.dataset.wmsMediaCardToken
      setBusy(null)
    }
  }

  return createPortal(
    <div className="wms-media-card-actions common-source-actions" aria-label={language === 'ja' ? 'メディア再生操作' : 'Media playback actions'}>
      <button type="button" className="common-source-play" disabled={busy !== null} onClick={() => void playNow()}>
        {busy === 'play-now' ? '…' : language === 'ja' ? '▶ 今すぐ再生' : '▶ Play now'}
      </button>
      <button type="button" className="common-source-queue" disabled={busy !== null} onClick={() => void playNext()}>
        {busy === 'play-next' ? '…' : language === 'ja' ? '＋ 次に再生' : '＋ Play next'}
      </button>
    </div>,
    row,
  )
}

function sameElements(a: HTMLElement[], b: HTMLElement[]) {
  return a.length === b.length && a.every((element, index) => element === b[index])
}

function applyCardClass(selector: string, source: string) {
  document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    element.classList.add('wms-media-card')
    element.dataset.wmsMediaSource = source
  })
}

export default function MediaCardSystem() {
  const [localRows, setLocalRows] = useState<HTMLElement[]>([])
  const [language, setLanguage] = useState<Language>(loadLanguage)

  useEffect(() => {
    let frame = 0

    const scan = () => {
      frame = 0
      applyCardClass('#library-panel .playlist-row', 'local')
      applyCardClass('#youtube-provider-panel .youtube-track-info', 'youtube')
      applyCardClass('#recorder-panel .take-card', 'recording')
      applyCardClass('#ffmpeg-tools-panel .ffmpeg-result', 'ffmpeg')

      const nextRows = Array.from(document.querySelectorAll<HTMLElement>('#library-panel .playlist-row'))
      setLocalRows((current) => sameElements(current, nextRows) ? current : nextRows)
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(scan)
    }

    scan()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
      document.querySelectorAll<HTMLElement>('.wms-media-card').forEach((element) => {
        element.classList.remove('wms-media-card')
        delete element.dataset.wmsMediaSource
      })
    }
  }, [])

  useEffect(() => {
    const handleLanguage = (event: Event) => {
      const next = (event as CustomEvent<{ language?: Language }>).detail?.language
      if (next === 'ja' || next === 'en') setLanguage(next)
    }
    window.addEventListener('wms:language-change', handleLanguage)
    return () => window.removeEventListener('wms:language-change', handleLanguage)
  }, [])

  return <>{localRows.map((row) => (
    <LocalMediaCardActions key={row.querySelector('.playlist-name')?.textContent ?? String(localRows.indexOf(row))} row={row} language={language} />
  ))}</>
}
