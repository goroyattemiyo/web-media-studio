import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

type ThemeId =
  | 'midnight-neon'
  | 'obsidian'
  | 'studio-light'
  | 'analog-warm'
  | 'cyber-blue'
  | 'aurora-purple'
  | 'emerald-night'
  | 'crimson-noir'
  | 'sunset-glow'
  | 'sakura'

type VisualMode = 'emblem' | 'pulse' | 'orbit' | 'bars' | 'wave' | 'minimal'

type Option<T extends string> = {
  id: T
  label: string
}

const THEME_STORAGE_KEY = 'wms-theme-v2'
const VISUAL_STORAGE_KEY = 'wms-player-visual-v2'

const themes: Array<Option<ThemeId>> = [
  { id: 'midnight-neon', label: 'Midnight Neon' },
  { id: 'obsidian', label: 'Obsidian' },
  { id: 'studio-light', label: 'Studio Light' },
  { id: 'analog-warm', label: 'Analog Warm' },
  { id: 'cyber-blue', label: 'Cyber Blue' },
  { id: 'aurora-purple', label: 'Aurora Purple' },
  { id: 'emerald-night', label: 'Emerald Night' },
  { id: 'crimson-noir', label: 'Crimson Noir' },
  { id: 'sunset-glow', label: 'Sunset Glow' },
  { id: 'sakura', label: 'Sakura' },
]

const visualModes: Array<Option<VisualMode>> = [
  { id: 'emblem', label: 'Emblem Spin' },
  { id: 'pulse', label: 'Pulse Rings' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'bars', label: 'Neon Bars' },
  { id: 'wave', label: 'Wave Grid' },
  { id: 'minimal', label: 'Minimal' },
]

function storedOption<T extends string>(key: string, options: Array<Option<T>>, fallback: T) {
  try {
    const saved = window.localStorage.getItem(key)
    if (saved && options.some((option) => option.id === saved)) return saved as T
  } catch {
    // Storage is optional for appearance preferences.
  }
  return fallback
}

function SkinVisualEnhancer() {
  const [theme, setTheme] = useState<ThemeId>(() => storedOption(THEME_STORAGE_KEY, themes, 'midnight-neon'))
  const [visualMode, setVisualMode] = useState<VisualMode>(() => storedOption(VISUAL_STORAGE_KEY, visualModes, 'emblem'))
  const [topbarTarget, setTopbarTarget] = useState<Element | null>(null)
  const [visualTarget, setVisualTarget] = useState<HTMLElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [videoActive, setVideoActive] = useState(false)

  const visualClassNames = useMemo(
    () => visualModes.map((mode) => `wms-visual-mode-${mode.id}`),
    [],
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Keep the current-session skin when localStorage is unavailable.
    }
  }, [theme])

  useEffect(() => {
    try {
      window.localStorage.setItem(VISUAL_STORAGE_KEY, visualMode)
    } catch {
      // Keep the current-session visual when localStorage is unavailable.
    }
  }, [visualMode])

  useEffect(() => {
    let frame = 0

    const discoverTargets = () => {
      frame = 0
      const nextTopbar = document.querySelector('.topbar')
      const nextVisual = document.querySelector<HTMLElement>('.player-visual')
      setTopbarTarget((current) => current === nextTopbar ? current : nextTopbar)
      setVisualTarget((current) => current === nextVisual ? current : nextVisual)
      setVideoActive(Boolean(nextVisual?.querySelector('video')))

      const media = nextVisual?.querySelector<HTMLMediaElement>('audio, video')
      if (media) setPlaying(!media.paused && !media.ended)
      else setPlaying(false)
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(discoverTargets)
    }

    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    discoverTargets()

    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    const handlePlay = (event: Event) => {
      if (event.target instanceof HTMLMediaElement && event.target.closest('.player-visual')) setPlaying(true)
    }
    const handlePause = (event: Event) => {
      if (event.target instanceof HTMLMediaElement && event.target.closest('.player-visual')) setPlaying(false)
    }

    document.addEventListener('play', handlePlay, true)
    document.addEventListener('pause', handlePause, true)
    document.addEventListener('ended', handlePause, true)
    return () => {
      document.removeEventListener('play', handlePlay, true)
      document.removeEventListener('pause', handlePause, true)
      document.removeEventListener('ended', handlePause, true)
    }
  }, [])

  useEffect(() => {
    if (!visualTarget) return
    visualTarget.classList.add('wms-visual-enhanced')
    visualTarget.classList.remove(...visualClassNames)
    visualTarget.classList.add(`wms-visual-mode-${visualMode}`)
    visualTarget.classList.toggle('wms-is-playing', playing)

    return () => {
      visualTarget.classList.remove('wms-visual-enhanced', 'wms-is-playing', ...visualClassNames)
    }
  }, [playing, visualClassNames, visualMode, visualTarget])

  const themePicker = topbarTarget
    ? createPortal(
        <label className="theme-picker wms-theme-picker">
          <span>Skin</span>
          <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeId)} aria-label="Skin color theme">
            {themes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>,
        topbarTarget,
      )
    : null

  const visualControls = visualTarget && !videoActive
    ? createPortal(
        <>
          <label className="player-visual-toolbar wms-player-visual-toolbar">
            <span>Visual</span>
            <select value={visualMode} onChange={(event) => setVisualMode(event.target.value as VisualMode)} aria-label="Player visual">
              {visualModes.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
            </select>
          </label>

          <div className={`wms-visualizer-layer ${playing ? 'is-playing' : ''}`} aria-hidden="true">
            <div className="wms-pulse-rings"><i /><i /><i /></div>
            <div className="wms-orbit-system"><i /><i /><i /><b /></div>
            <div className="wms-neon-bars">
              {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ animationDelay: `${-(index % 6) * 0.11}s` }} />)}
            </div>
            <div className="wms-wave-grid">
              {Array.from({ length: 11 }, (_, index) => <i key={index} style={{ animationDelay: `${-index * 0.08}s` }} />)}
            </div>
          </div>
        </>,
        visualTarget,
      )
    : null

  return <>{themePicker}{visualControls}</>
}

export default SkinVisualEnhancer
