import { useEffect } from 'react'

const TOOL_KEYS = ['player', 'library', 'youtube', 'record', 'tools', 'device'] as const

export default function PerformanceFoundationEnhancer() {
  useEffect(() => {
    let navObserver: MutationObserver | null = null
    let discoveryObserver: MutationObserver | null = null

    const updateActiveTool = () => {
      const buttons = Array.from(document.querySelectorAll<HTMLElement>('.tool-deck-nav > button'))
      const index = buttons.findIndex((button) => button.classList.contains('is-current') || button.getAttribute('aria-current') === 'page')
      const active = TOOL_KEYS[index] ?? 'player'
      document.documentElement.dataset.wmsActiveTool = active
    }

    const bindNav = () => {
      const nav = document.querySelector('.tool-deck-nav')
      if (!nav) return false
      updateActiveTool()
      navObserver?.disconnect()
      navObserver = new MutationObserver(updateActiveTool)
      navObserver.observe(nav, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'aria-current'],
      })
      discoveryObserver?.disconnect()
      discoveryObserver = null
      return true
    }

    if (!bindNav()) {
      discoveryObserver = new MutationObserver(() => {
        void bindNav()
      })
      discoveryObserver.observe(document.body, { childList: true, subtree: true })
    }

    const handleVisibility = () => {
      document.documentElement.dataset.wmsDocumentVisibility = document.visibilityState
    }
    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      navObserver?.disconnect()
      discoveryObserver?.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      delete document.documentElement.dataset.wmsActiveTool
      delete document.documentElement.dataset.wmsDocumentVisibility
    }
  }, [])

  return null
}
