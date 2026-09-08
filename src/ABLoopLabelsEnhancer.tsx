import { useEffect } from 'react'

type Language = 'ja' | 'en'

function currentLanguage(): Language {
  return document.documentElement.dataset.language === 'en' ? 'en' : 'ja'
}

function labelFor(button: HTMLButtonElement, kind: 'start' | 'end' | 'clear', language: Language) {
  const text = button.textContent?.trim() ?? ''
  const time = text.match(/\b\d{1,2}:\d{2}\b/)?.[0]

  if (kind === 'clear') return language === 'ja' ? '区間解除' : 'Clear loop'
  if (kind === 'start') return time ? (language === 'ja' ? `開始 ${time}` : `Start ${time}`) : (language === 'ja' ? '区間開始' : 'Loop start')
  return time ? (language === 'ja' ? `終了 ${time}` : `End ${time}`) : (language === 'ja' ? '区間終了' : 'Loop end')
}

function applyLabels() {
  const controls = document.querySelector<HTMLElement>('#player-panel .quick-controls')
  if (!controls) return

  const language = currentLanguage()
  const buttons = controls.querySelectorAll<HTMLButtonElement>('button')
  const start = buttons[2]
  const end = buttons[3]
  const clear = buttons[4]

  if (start) {
    start.dataset.wmsLoopControl = 'start'
    start.dataset.wmsLoopLabel = labelFor(start, 'start', language)
    start.setAttribute(
      'aria-label',
      language === 'ja'
        ? start.classList.contains('is-active') ? `区間リピート開始点 ${start.dataset.wmsLoopLabel.replace('開始 ', '')}` : '区間リピートの開始点を設定'
        : start.classList.contains('is-active') ? `Loop start ${start.dataset.wmsLoopLabel.replace('Start ', '')}` : 'Set loop start point',
    )
    start.title = language === 'ja' ? 'ここから繰り返す開始点を設定します' : 'Set where interval repeat starts'
  }

  if (end) {
    end.dataset.wmsLoopControl = 'end'
    end.dataset.wmsLoopLabel = labelFor(end, 'end', language)
    end.setAttribute(
      'aria-label',
      language === 'ja'
        ? end.classList.contains('is-active') ? `区間リピート終了点 ${end.dataset.wmsLoopLabel.replace('終了 ', '')}` : '区間リピートの終了点を設定'
        : end.classList.contains('is-active') ? `Loop end ${end.dataset.wmsLoopLabel.replace('End ', '')}` : 'Set loop end point',
    )
    end.title = language === 'ja'
      ? start?.classList.contains('is-active') ? 'ここまでを繰り返す終了点を設定します' : '先に区間開始を設定してください'
      : start?.classList.contains('is-active') ? 'Set where interval repeat ends' : 'Set the loop start first'
  }

  if (clear) {
    clear.dataset.wmsLoopControl = 'clear'
    clear.dataset.wmsLoopLabel = labelFor(clear, 'clear', language)
    clear.setAttribute('aria-label', language === 'ja' ? '区間リピートを解除' : 'Clear interval repeat')
    clear.title = language === 'ja' ? '設定した開始点・終了点を解除します' : 'Clear the loop start and end points'
  }
}

export default function ABLoopLabelsEnhancer() {
  useEffect(() => {
    let frame = 0
    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        applyLabels()
      })
    }

    applyLabels()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'disabled'] })
    window.addEventListener('wms:language-change', schedule)

    return () => {
      observer.disconnect()
      window.removeEventListener('wms:language-change', schedule)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
