import { useEffect, useMemo, useState } from 'react'
import { getActivePlaybackSource, onActivePlaybackSourceChange, type PlaybackSource } from './playbackArbiter'
import { parseYouTubeInput } from './providers/youtube'

type ProductSurface = 'search' | 'local' | 'player' | 'more'
type PreviewKind = 'image' | 'video'

type MiniState = {
  source: PlaybackSource | null
  title: string
  playing: boolean
  canPrevious: boolean
  canNext: boolean
  previewKind: PreviewKind
  previewUrl: string
}

const WMS_ICON_URL = `${import.meta.env.BASE_URL}icons/app-icon.svg`

function hasLocalSource() {
  return Boolean(document.querySelector<HTMLMediaElement>('#player-panel audio, #player-panel video'))
}

function hasYouTubeSource() {
  return Boolean(document.querySelector('#youtube-provider-panel .youtube-track-info strong'))
}

function readLocalState(): Omit<MiniState, 'source'> {
  const media = document.querySelector<HTMLMediaElement>('#player-panel audio, #player-panel video')
  const title = document.querySelector<HTMLElement>('#player-panel .track-heading h2')?.textContent?.trim() || 'Local Player'
  const previous = document.querySelector<HTMLButtonElement>('#player-panel .transport button[aria-label="前の曲"]')
  const next = document.querySelector<HTMLButtonElement>('#player-panel .transport button[aria-label="次の曲"]')
  const isVideo = media instanceof HTMLVideoElement
  const videoUrl = isVideo ? (media.currentSrc || media.src) : ''

  return {
    title,
    playing: Boolean(media && !media.paused && !media.ended),
    canPrevious: Boolean(previous && !previous.disabled),
    canNext: Boolean(next && !next.disabled),
    previewKind: isVideo && videoUrl ? 'video' : 'image',
    previewUrl: isVideo && videoUrl ? videoUrl : WMS_ICON_URL,
  }
}

function readYouTubeState(): Omit<MiniState, 'source'> {
  const title = document.querySelector<HTMLElement>('#youtube-provider-panel .youtube-track-info strong')?.textContent?.trim() || 'YouTube'
  const status = document.querySelector<HTMLElement>('#youtube-provider-panel .youtube-status-row > span')?.textContent?.trim().toLowerCase() || ''
  const input = document.querySelector<HTMLInputElement>('#youtube-provider-panel .youtube-url-form input')
  const parsed = parseYouTubeInput(input?.value ?? '')
  const thumbnail = parsed ? `https://i.ytimg.com/vi/${parsed.videoId}/mqdefault.jpg` : WMS_ICON_URL

  return {
    title,
    playing: status.includes('playing') || status.includes('再生中'),
    canPrevious: false,
    canNext: false,
    previewKind: 'image',
    previewUrl: thumbnail,
  }
}

function snapshot(source: PlaybackSource | null): MiniState {
  if (source === 'youtube' && hasYouTubeSource()) return { source, ...readYouTubeState() }
  if (source === 'local' && hasLocalSource()) return { source, ...readLocalState() }
  if (hasLocalSource()) return { source: 'local', ...readLocalState() }
  if (hasYouTubeSource()) return { source: 'youtube', ...readYouTubeState() }
  return {
    source: null,
    title: '再生する曲を選んでください',
    playing: false,
    canPrevious: false,
    canNext: false,
    previewKind: 'image',
    previewUrl: WMS_ICON_URL,
  }
}

function click(selector: string) {
  document.querySelector<HTMLButtonElement>(selector)?.click()
}

function navigate(surface: ProductSurface) {
  window.dispatchEvent(new CustomEvent('wms:navigate', { detail: { surface } }))
}

export default function FloatingMiniPlayer() {
  const [source, setSource] = useState<PlaybackSource | null>(() => getActivePlaybackSource())
  const [state, setState] = useState<MiniState>(() => snapshot(getActivePlaybackSource()))
  const [activeSurface, setActiveSurface] = useState<ProductSurface>(() => {
    const value = document.documentElement.dataset.wmsSurface
    return value === 'local' || value === 'player' || value === 'more' ? value : 'search'
  })
  const [languageRevision, setLanguageRevision] = useState(0)

  useEffect(() => onActivePlaybackSourceChange(setSource), [])

  useEffect(() => {
    const refresh = () => setState(snapshot(source))
    refresh()

    const mediaEvents = ['play', 'pause', 'ended', 'loadedmetadata', 'loadeddata', 'emptied', 'durationchange'] as const
    mediaEvents.forEach((eventName) => document.addEventListener(eventName, refresh, true))

    const observers: MutationObserver[] = []
    const observe = (selector: string, options: MutationObserverInit) => {
      const target = document.querySelector(selector)
      if (!target) return
      const observer = new MutationObserver(refresh)
      observer.observe(target, options)
      observers.push(observer)
    }

    observe('#player-panel .track-heading', { childList: true, subtree: true, characterData: true })
    observe('#player-panel .transport', { attributes: true, subtree: true, attributeFilter: ['disabled', 'aria-label'] })
    observe('#youtube-provider-panel .youtube-track-info', { childList: true, subtree: true, characterData: true })
    observe('#youtube-provider-panel .youtube-status-row', { childList: true, subtree: true, characterData: true })
    observe('#youtube-provider-panel .youtube-url-form', { childList: true, subtree: true, attributes: true, attributeFilter: ['value'] })

    const handleLanguage = () => {
      setLanguageRevision((value) => value + 1)
      refresh()
    }
    window.addEventListener('wms:language-change', handleLanguage)

    return () => {
      mediaEvents.forEach((eventName) => document.removeEventListener(eventName, refresh, true))
      observers.forEach((observer) => observer.disconnect())
      window.removeEventListener('wms:language-change', handleLanguage)
    }
  }, [source])

  useEffect(() => {
    const handleSurface = (event: Event) => {
      const next = (event as CustomEvent<{ surface?: ProductSurface }>).detail?.surface
      if (next === 'search' || next === 'local' || next === 'player' || next === 'more') setActiveSurface(next)
    }
    window.addEventListener('wms:surface-change', handleSurface)
    return () => window.removeEventListener('wms:surface-change', handleSurface)
  }, [])

  const isEnglish = useMemo(() => document.documentElement.dataset.language === 'en', [languageRevision])
  const hasSource = state.source !== null
  const fullPlayerVisible = (state.source === 'local' && activeSurface === 'player') || (state.source === 'youtube' && activeSurface === 'search')

  const toggle = () => {
    if (state.source === 'youtube') {
      click(state.playing ? '#youtube-provider-panel .youtube-transport button:nth-child(3)' : '#youtube-provider-panel .youtube-transport .primary')
      return
    }
    click('#player-panel .play-button')
  }

  const goPrevious = () => {
    if (state.source === 'local') click('#player-panel .transport button[aria-label="前の曲"]')
  }

  const goNext = () => {
    if (state.source === 'local') click('#player-panel .transport button[aria-label="次の曲"]')
  }

  const openPlayer = () => {
    navigate(state.source === 'youtube' ? 'search' : 'player')
    window.setTimeout(() => {
      const selector = state.source === 'youtube' ? '#youtube-provider-panel' : '#player-panel'
      document.querySelector<HTMLElement>(selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  const openQueue = () => {
    navigate('player')
    window.setTimeout(() => document.querySelector<HTMLElement>('.unified-play-queue')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
  }

  const openPlaylist = () => {
    navigate('player')
    window.setTimeout(() => click('.player-playlist-trigger'), 80)
  }

  if (fullPlayerVisible || !hasSource) return null

  return (
    <div className={`floating-mini-player is-${state.source}`} role="region" aria-label={isEnglish ? 'Mini player' : 'ミニプレイヤー'}>
      <button type="button" className="floating-mini-title" onClick={openPlayer} aria-label={isEnglish ? 'Open current player' : '再生中のプレイヤーを開く'}>
        <span className="floating-mini-artwork">
          {state.previewKind === 'video'
            ? <video src={state.previewUrl} muted playsInline preload="metadata" aria-hidden="true" />
            : <img src={state.previewUrl} alt="" loading="lazy" />}
        </span>
        <strong>{state.title}</strong>
      </button>
      <div className="floating-mini-controls">
        <button type="button" onClick={goPrevious} disabled={!state.canPrevious} aria-label={isEnglish ? 'Previous' : '前の曲'}>⏮</button>
        <button type="button" className="floating-mini-play" onClick={toggle} aria-label={state.playing ? (isEnglish ? 'Pause' : '一時停止') : (isEnglish ? 'Play' : '再生')}>{state.playing ? 'Ⅱ' : '▶'}</button>
        <button type="button" onClick={goNext} disabled={!state.canNext} aria-label={isEnglish ? 'Next' : '次の曲'}>⏭</button>
        <button type="button" onClick={openQueue} aria-label={isEnglish ? 'Open queue' : '再生キューを開く'}>☷</button>
        <button type="button" onClick={openPlaylist} aria-label={isEnglish ? 'Add to playlist' : 'プレイリストへ追加'}>♡</button>
      </div>
    </div>
  )
}
