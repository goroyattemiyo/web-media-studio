import { useEffect, useMemo, useRef, useState } from 'react'
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
  | 'pixel-arcade'
  | 'led-marquee'
  | 'retro-terminal'
  | 'cassette-deck'

type VisualMode =
  | 'emblem'
  | 'pulse'
  | 'orbit'
  | 'bars'
  | 'wave'
  | 'rainbow-ring'
  | 'oscilloscope'
  | 'spectrum-city'
  | 'neon-tunnel'
  | 'kaleido'
  | 'particles'
  | 'minimal'

type Language = 'ja' | 'en'

type Option<T extends string> = {
  id: T
  label: string
  ja: string
}

type MediaGraph = {
  source: MediaElementAudioSourceNode
  analyser: AnalyserNode
}

const THEME_STORAGE_KEY = 'wms-theme-v2'
const VISUAL_STORAGE_KEY = 'wms-player-visual-v2'
const AUDIO_REACTIVE_MODES = new Set<VisualMode>(['rainbow-ring', 'oscilloscope', 'spectrum-city', 'neon-tunnel', 'kaleido', 'particles'])

const themes: Array<Option<ThemeId>> = [
  { id: 'midnight-neon', label: 'Midnight Neon', ja: '深夜ネオン' },
  { id: 'obsidian', label: 'Obsidian', ja: '黒曜石' },
  { id: 'studio-light', label: 'Studio Light', ja: 'スタジオライト' },
  { id: 'analog-warm', label: 'Analog Warm', ja: 'アナログウォーム' },
  { id: 'cyber-blue', label: 'Cyber Blue', ja: 'サイバーブルー' },
  { id: 'aurora-purple', label: 'Aurora Purple', ja: 'オーロラパープル' },
  { id: 'emerald-night', label: 'Emerald Night', ja: 'エメラルドナイト' },
  { id: 'crimson-noir', label: 'Crimson Noir', ja: 'クリムゾンノワール' },
  { id: 'sunset-glow', label: 'Sunset Glow', ja: 'サンセット' },
  { id: 'sakura', label: 'Sakura', ja: 'さくら' },
  { id: 'pixel-arcade', label: '8-bit Arcade', ja: '8-bit アーケード' },
  { id: 'led-marquee', label: 'LED Marquee', ja: '電光掲示板' },
  { id: 'retro-terminal', label: 'Retro Terminal', ja: 'レトロ端末' },
  { id: 'cassette-deck', label: 'Cassette Deck', ja: 'カセットデッキ' },
]

const visualModes: Array<Option<VisualMode>> = [
  { id: 'rainbow-ring', label: 'Rainbow Ring', ja: 'レインボーリング' },
  { id: 'oscilloscope', label: 'Oscilloscope', ja: 'オシロスコープ' },
  { id: 'spectrum-city', label: 'Spectrum City', ja: 'スペクトラムシティ' },
  { id: 'neon-tunnel', label: 'Neon Tunnel', ja: 'ネオントンネル' },
  { id: 'kaleido', label: 'Kaleido', ja: 'カレイド' },
  { id: 'particles', label: 'Particle Field', ja: 'パーティクル' },
  { id: 'pulse', label: 'Pulse Rings', ja: 'パルスリング' },
  { id: 'orbit', label: 'Orbit', ja: 'オービット' },
  { id: 'bars', label: 'Neon Bars', ja: 'ネオンバー' },
  { id: 'wave', label: 'Wave Grid', ja: 'ウェーブ' },
  { id: 'emblem', label: 'Emblem Spin', ja: 'ロゴ回転' },
  { id: 'minimal', label: 'Minimal', ja: 'ミニマル' },
]

let sharedAudioContext: AudioContext | null = null
const mediaGraphs = new WeakMap<HTMLMediaElement, MediaGraph>()
let graphFailureNotified = false

function storedOption<T extends string>(key: string, options: Array<Option<T>>, fallback: T) {
  try {
    const saved = window.localStorage.getItem(key)
    if (saved && options.some((option) => option.id === saved)) return saved as T
  } catch {
    // Storage is optional for appearance preferences.
  }
  return fallback
}

function loadLanguage(): Language {
  try {
    return window.localStorage.getItem('wms-language') === 'en' ? 'en' : 'ja'
  } catch {
    return 'ja'
  }
}

function audioContextConstructor() {
  const compatibleWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext }
  return window.AudioContext ?? compatibleWindow.webkitAudioContext ?? null
}

function ensureGraph(media: HTMLMediaElement) {
  const existing = mediaGraphs.get(media)
  if (existing) return existing

  const Constructor = audioContextConstructor()
  if (!Constructor) return null

  try {
    sharedAudioContext ??= new Constructor()
    const source = sharedAudioContext.createMediaElementSource(media)
    const analyser = sharedAudioContext.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.82
    source.connect(analyser)
    analyser.connect(sharedAudioContext.destination)
    const graph = { source, analyser }
    mediaGraphs.set(media, graph)
    return graph
  } catch {
    if (!graphFailureNotified) {
      graphFailureNotified = true
      window.dispatchEvent(new CustomEvent('wms:system-message', {
        detail: { text: 'この環境では音声解析を使えないため、ビジュアライザを軽量アニメーションで表示します。', source: 'Visual', level: 'info' },
      }))
    }
    return null
  }
}

function average(data: Uint8Array, start: number, end: number) {
  let total = 0
  const safeEnd = Math.min(data.length, end)
  for (let index = start; index < safeEnd; index += 1) total += data[index]
  return safeEnd > start ? total / (safeEnd - start) / 255 : 0
}

function fillSynthetic(freq: Uint8Array, timeData: Uint8Array, now: number, playing: boolean) {
  const energy = playing ? 1 : 0.18
  for (let index = 0; index < freq.length; index += 1) {
    const wave = (Math.sin(now * 0.0027 + index * 0.31) + Math.sin(now * 0.0013 + index * 0.11)) * 0.25 + 0.5
    freq[index] = Math.round((30 + wave * 180) * energy)
  }
  for (let index = 0; index < timeData.length; index += 1) {
    timeData[index] = Math.round(128 + Math.sin(now * 0.004 + index * 0.16) * 54 * energy)
  }
}

function prepareCanvas(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  const ratio = Math.min(2, window.devicePixelRatio || 1)
  const width = Math.max(1, Math.round(rect.width * ratio))
  const height = Math.max(1, Math.round(rect.height * ratio))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const context = canvas.getContext('2d')
  if (!context) return null
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  return { context, width: rect.width, height: rect.height }
}

function drawRainbowRing(context: CanvasRenderingContext2D, width: number, height: number, freq: Uint8Array, now: number) {
  const cx = width / 2
  const cy = height / 2
  const base = Math.min(width, height) * 0.19
  const bars = 96
  context.globalCompositeOperation = 'lighter'
  for (let index = 0; index < bars; index += 1) {
    const bin = Math.floor((index / bars) * Math.min(freq.length, 180))
    const value = freq[bin] / 255
    const angle = (index / bars) * Math.PI * 2 - Math.PI / 2
    const length = 10 + value * Math.min(width, height) * 0.22
    const x1 = cx + Math.cos(angle) * base
    const y1 = cy + Math.sin(angle) * base
    const x2 = cx + Math.cos(angle) * (base + length)
    const y2 = cy + Math.sin(angle) * (base + length)
    context.strokeStyle = `hsla(${(index * 3.75 + now * 0.035) % 360}, 96%, 64%, ${0.38 + value * 0.62})`
    context.lineWidth = 2 + value * 3.2
    context.shadowBlur = 12 + value * 18
    context.shadowColor = context.strokeStyle
    context.beginPath()
    context.moveTo(x1, y1)
    context.lineTo(x2, y2)
    context.stroke()
  }
  context.globalCompositeOperation = 'source-over'
}

function drawOscilloscope(context: CanvasRenderingContext2D, width: number, height: number, timeData: Uint8Array, now: number) {
  context.globalCompositeOperation = 'lighter'
  for (let layer = 0; layer < 3; layer += 1) {
    context.beginPath()
    const hue = (now * 0.025 + layer * 120) % 360
    context.strokeStyle = `hsla(${hue}, 95%, 66%, ${0.9 - layer * 0.18})`
    context.lineWidth = 3 - layer * 0.55
    context.shadowBlur = 18
    context.shadowColor = context.strokeStyle
    for (let index = 0; index < timeData.length; index += 2) {
      const x = (index / (timeData.length - 1)) * width
      const normalized = (timeData[index] - 128) / 128
      const y = height / 2 + normalized * height * (0.24 + layer * 0.055) + Math.sin(index * 0.04 + layer) * 2
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
    context.stroke()
  }
  context.globalCompositeOperation = 'source-over'
}

function drawSpectrumCity(context: CanvasRenderingContext2D, width: number, height: number, freq: Uint8Array, now: number) {
  const bars = 48
  const gap = 3
  const barWidth = Math.max(2, (width - gap * (bars - 1)) / bars)
  for (let index = 0; index < bars; index += 1) {
    const value = freq[Math.floor(index / bars * Math.min(freq.length, 190))] / 255
    const barHeight = Math.max(5, value * height * 0.76)
    const x = index * (barWidth + gap)
    const y = height - barHeight
    const gradient = context.createLinearGradient(0, y, 0, height)
    gradient.addColorStop(0, `hsl(${(index * 7 + now * 0.03) % 360} 100% 68%)`)
    gradient.addColorStop(1, `hsl(${(index * 7 + 90 + now * 0.03) % 360} 92% 48%)`)
    context.fillStyle = gradient
    context.shadowBlur = 10 + value * 15
    context.shadowColor = `hsla(${(index * 7 + now * 0.03) % 360},100%,60%,.7)`
    context.fillRect(x, y, barWidth, barHeight)
  }
}

function drawNeonTunnel(context: CanvasRenderingContext2D, width: number, height: number, freq: Uint8Array, now: number) {
  const bass = average(freq, 0, 28)
  const cx = width / 2
  const cy = height / 2
  context.globalCompositeOperation = 'lighter'
  for (let index = 0; index < 16; index += 1) {
    const phase = ((index / 16 + now * 0.00015) % 1)
    const radius = phase * Math.min(width, height) * 0.62
    const alpha = 1 - phase
    context.strokeStyle = `hsla(${(index * 23 + now * 0.025) % 360}, 95%, 63%, ${alpha * 0.8})`
    context.lineWidth = 1.5 + bass * 4
    context.shadowBlur = 14
    context.shadowColor = context.strokeStyle
    context.beginPath()
    context.ellipse(cx, cy, radius * (1 + bass * 0.12), radius * 0.68, now * 0.00008, 0, Math.PI * 2)
    context.stroke()
  }
  context.globalCompositeOperation = 'source-over'
}

function drawKaleido(context: CanvasRenderingContext2D, width: number, height: number, freq: Uint8Array, now: number) {
  const cx = width / 2
  const cy = height / 2
  const spokes = 18
  context.save()
  context.translate(cx, cy)
  context.rotate(now * 0.00012)
  context.globalCompositeOperation = 'lighter'
  for (let index = 0; index < spokes; index += 1) {
    const value = freq[Math.floor(index / spokes * 120)] / 255
    const angle = index / spokes * Math.PI * 2
    const radius = Math.min(width, height) * (0.12 + value * 0.34)
    context.save()
    context.rotate(angle)
    context.strokeStyle = `hsla(${(index * 360 / spokes + now * 0.02) % 360}, 98%, 65%, .78)`
    context.lineWidth = 2 + value * 3
    context.shadowBlur = 16
    context.shadowColor = context.strokeStyle
    context.beginPath()
    context.moveTo(18, 0)
    context.quadraticCurveTo(radius * 0.6, radius * 0.34, radius, 0)
    context.quadraticCurveTo(radius * 0.6, -radius * 0.34, 18, 0)
    context.stroke()
    context.restore()
  }
  context.restore()
}

function drawParticles(context: CanvasRenderingContext2D, width: number, height: number, freq: Uint8Array, now: number) {
  const bass = average(freq, 0, 28)
  const count = 86
  context.globalCompositeOperation = 'lighter'
  for (let index = 0; index < count; index += 1) {
    const seed = index * 12.9898
    const x = ((Math.sin(seed) * 43758.5453 % 1 + 1) % 1) * width
    const baseY = ((Math.sin(seed * 1.73) * 24634.6345 % 1 + 1) % 1) * height
    const speed = 0.008 + (index % 9) * 0.0012
    const y = (baseY - now * speed * (0.45 + bass * 1.6) + height * 4) % height
    const value = freq[index % Math.min(freq.length, 150)] / 255
    const radius = 1.2 + value * 5.8 + bass * 2
    context.fillStyle = `hsla(${(index * 13 + now * 0.025) % 360}, 100%, 68%, ${0.32 + value * 0.65})`
    context.shadowBlur = 12 + value * 12
    context.shadowColor = context.fillStyle
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }
  context.globalCompositeOperation = 'source-over'
}

function drawVisualizer(canvas: HTMLCanvasElement, mode: VisualMode, analyser: AnalyserNode | null, playing: boolean, now: number) {
  const prepared = prepareCanvas(canvas)
  if (!prepared) return
  const { context, width, height } = prepared
  context.clearRect(0, 0, width, height)

  const freq = new Uint8Array(analyser?.frequencyBinCount ?? 256)
  const timeData = new Uint8Array(analyser?.fftSize ?? 512)
  if (analyser) {
    analyser.getByteFrequencyData(freq)
    analyser.getByteTimeDomainData(timeData)
  } else {
    fillSynthetic(freq, timeData, now, playing)
  }

  context.save()
  context.globalAlpha = playing ? 1 : 0.5
  if (mode === 'rainbow-ring') drawRainbowRing(context, width, height, freq, now)
  if (mode === 'oscilloscope') drawOscilloscope(context, width, height, timeData, now)
  if (mode === 'spectrum-city') drawSpectrumCity(context, width, height, freq, now)
  if (mode === 'neon-tunnel') drawNeonTunnel(context, width, height, freq, now)
  if (mode === 'kaleido') drawKaleido(context, width, height, freq, now)
  if (mode === 'particles') drawParticles(context, width, height, freq, now)
  context.restore()
}

function SkinVisualEnhancer() {
  const [theme, setTheme] = useState<ThemeId>(() => {
    const legacy = storedOption('wms-theme', themes, 'midnight-neon')
    return storedOption(THEME_STORAGE_KEY, themes, legacy)
  })
  const [visualMode, setVisualMode] = useState<VisualMode>(() => {
    const legacy = storedOption('wms-player-visual', visualModes, 'emblem')
    return storedOption(VISUAL_STORAGE_KEY, visualModes, legacy)
  })
  const [language, setLanguage] = useState<Language>(loadLanguage)
  const [topbarTarget, setTopbarTarget] = useState<Element | null>(null)
  const [visualTarget, setVisualTarget] = useState<HTMLElement | null>(null)
  const [mediaTarget, setMediaTarget] = useState<HTMLMediaElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [videoActive, setVideoActive] = useState(false)
  const [visualRuntimeActive, setVisualRuntimeActive] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const visualClassNames = useMemo(
    () => visualModes.map((mode) => `wms-visual-mode-${mode.id}`),
    [],
  )

  useEffect(() => {
    const handleLanguage = (event: Event) => {
      const next = (event as CustomEvent<{ language?: Language }>).detail?.language
      if (next === 'ja' || next === 'en') setLanguage(next)
    }
    window.addEventListener('wms:language-change', handleLanguage)
    return () => window.removeEventListener('wms:language-change', handleLanguage)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Keep the current-session skin when localStorage is unavailable.
    }
  }, [theme, topbarTarget])

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
      const nextMedia = nextVisual?.querySelector<HTMLMediaElement>('audio, video') ?? null
      setTopbarTarget((current) => current === nextTopbar ? current : nextTopbar)
      setVisualTarget((current) => current === nextVisual ? current : nextVisual)
      setMediaTarget((current) => current === nextMedia ? current : nextMedia)
      setVideoActive(Boolean(nextVisual?.querySelector('video')))
      setPlaying(Boolean(nextMedia && !nextMedia.paused && !nextMedia.ended))
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
    const root = document.documentElement
    const update = () => {
      const activeTool = root.dataset.wmsActiveTool ?? 'player'
      setVisualRuntimeActive(document.visibilityState === 'visible' && activeTool === 'player')
    }

    update()
    const observer = new MutationObserver(update)
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-wms-active-tool', 'data-wms-document-visibility'],
    })
    document.addEventListener('visibilitychange', update)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  useEffect(() => {
    const resumeContext = () => {
      if (sharedAudioContext?.state === 'suspended') void sharedAudioContext.resume()
    }
    document.addEventListener('pointerdown', resumeContext, { passive: true })
    document.addEventListener('keydown', resumeContext)
    return () => {
      document.removeEventListener('pointerdown', resumeContext)
      document.removeEventListener('keydown', resumeContext)
    }
  }, [])

  useEffect(() => {
    const handlePlay = (event: Event) => {
      if (!(event.target instanceof HTMLMediaElement) || !event.target.closest('.player-visual')) return
      setMediaTarget(event.target)
      setPlaying(true)
      if (AUDIO_REACTIVE_MODES.has(visualMode)) {
        ensureGraph(event.target)
        if (sharedAudioContext?.state === 'suspended') void sharedAudioContext.resume()
      }
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
  }, [visualMode])

  useEffect(() => {
    if (!visualTarget) return
    visualTarget.classList.add('wms-visual-enhanced')
    visualTarget.classList.remove(...visualClassNames)
    visualTarget.classList.add(`wms-visual-mode-${visualMode}`)
    visualTarget.classList.toggle('wms-is-playing', playing)
    visualTarget.classList.toggle('wms-audio-reactive', AUDIO_REACTIVE_MODES.has(visualMode))

    return () => {
      visualTarget.classList.remove('wms-visual-enhanced', 'wms-is-playing', 'wms-audio-reactive', ...visualClassNames)
    }
  }, [playing, visualClassNames, visualMode, visualTarget])

  useEffect(() => {
    if (!AUDIO_REACTIVE_MODES.has(visualMode) || !canvasRef.current || !visualRuntimeActive) return
    let analyser: AnalyserNode | null = null
    if (mediaTarget && playing) {
      analyser = ensureGraph(mediaTarget)?.analyser ?? null
      if (sharedAudioContext?.state === 'suspended') void sharedAudioContext.resume()
    }

    let frame = 0
    const render = (now: number) => {
      const canvas = canvasRef.current
      if (canvas) drawVisualizer(canvas, visualMode, analyser, playing, now)
      frame = window.requestAnimationFrame(render)
    }
    frame = window.requestAnimationFrame(render)
    return () => window.cancelAnimationFrame(frame)
  }, [mediaTarget, playing, visualMode, visualRuntimeActive, visualTarget])

  const themePicker = topbarTarget
    ? createPortal(
        <label className="theme-picker wms-theme-picker">
          <span>{language === 'ja' ? 'スキン' : 'Skin'}</span>
          <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeId)} aria-label="Skin theme">
            {themes.map((item) => <option key={item.id} value={item.id}>{language === 'ja' ? item.ja : item.label}</option>)}
          </select>
        </label>,
        topbarTarget,
      )
    : null

  const visualControls = visualTarget && !videoActive
    ? createPortal(
        <>
          <label className="player-visual-toolbar wms-player-visual-toolbar">
            <span>{language === 'ja' ? 'ビジュアル' : 'Visual'}</span>
            <select value={visualMode} onChange={(event) => setVisualMode(event.target.value as VisualMode)} aria-label="Player visual">
              {visualModes.map((mode) => <option key={mode.id} value={mode.id}>{language === 'ja' ? mode.ja : mode.label}</option>)}
            </select>
          </label>

          <div className={`wms-visualizer-layer ${playing ? 'is-playing' : ''}`} aria-hidden="true">
            <canvas ref={canvasRef} className="wms-visualizer-canvas" />
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
