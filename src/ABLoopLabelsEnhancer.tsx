import { useEffect } from 'react'

function labelFor(button: HTMLButtonElement, kind: 'start' | 'end' | 'clear') {
  if (kind === 'clear') return '区間解除'

  const text = button.textContent?.trim() ?? ''
  const time = text.match(/\b\d{1,2}:\d{2}\b/)?.[0]

  if (kind === 'start') return time ? `開始 ${time}` : '区間開始'
  return time ? `終了 ${time}` : '区間終了'
}

function applyLabels() {
  const controls = document.querySelector<HTMLElement>('#player-panel .quick-controls')
  if (!controls) return

  const buttons = controls.querySelectorAll<HTMLButtonElement>('button')
  const start = buttons[2]
  const end = buttons[3]
  const clear = buttons[4]

  if (start) {
    start.dataset.wmsLoopControl = 'start'
    start.dataset.wmsLoopLabel = labelFor(start, 'start')
    start.setAttribute('aria-label', start.classList.contains('is-active') ? `区間リピート開始点 ${start.dataset.wmsLoopLabel.replace('開始 ', '')}` : '区間リピートの開始点を設定')
    start.title = 'ここから繰り返す開始点を設定します'
  }

  if (end) {
    end.dataset.wmsLoopControl = 'end'
    end.dataset.wmsLoopLabel = labelFor(end, 'end')
    end.setAttribute('aria-label', end.classList.contains('is-active') ? `区間リピート終了点 ${end.dataset.wmsLoopLabel.replace('終了 ', '')}` : '区間リピートの終了点を設定')
    end.title = start?.classList.contains('is-active') ? 'ここまでを繰り返す終了点を設定します' : '先に区間開始を設定してください'
  }

  if (clear) {
    clear.dataset.wmsLoopControl = 'clear'
    clear.dataset.wmsLoopLabel = labelFor(clear, 'clear')
    clear.setAttribute('aria-label', '区間リピートを解除')
    clear.title = '設定した開始点・終了点を解除します'
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

    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
