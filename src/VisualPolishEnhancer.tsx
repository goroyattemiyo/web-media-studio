import { useEffect } from 'react'

const FALLBACK_VISUAL = 'rainbow-ring'

export default function VisualPolishEnhancer() {
  useEffect(() => {
    let frame = 0

    const apply = () => {
      frame = 0
      const select = document.querySelector<HTMLSelectElement>('.wms-player-visual-toolbar select')
      if (!select) return

      const logoOption = select.querySelector<HTMLOptionElement>('option[value="emblem"]')
      const wasLogoMode = select.value === 'emblem'
      if (logoOption) logoOption.remove()

      if (wasLogoMode) {
        select.value = FALLBACK_VISUAL
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply)
    }

    apply()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
