import { useEffect, useMemo, useState } from 'react'
import { getActivePlaybackSource, onActivePlaybackSourceChange, type PlaybackSource } from './playbackArbiter'

type MiniState = {
  source: PlaybackSource | null
  title: string
  playing: boolean
  canPrevious: boolean
  canNext: boolean
}

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
  return {
    title,
    playing: Boolean(media && !media.paused && !media.ended),
    canPrevious: Boolean(previous && !previous.disabled),
    canNext: Boolean(next && !next.disabled),
  }
}

function readYouTubeState(): Omit<MiniState, 'source'> {
  const title = document.querySelector<HTMLElement>('#youtube-provider-panel .youtube-track-info strong')?.textContent?.trim() || 'YouTube'
  const status = document.querySelector<HTMLElement>('#youtube-provider-panel .youtube-status-row > span')?.textContent?.trim().toLowerCase() || ''
  return {
    title,
    playing: status.includes('playing') || status.includes('再生中'),
    canPrevious: false,
    canNext: false,
  }
}

function snapshot(source: PlaybackSource | null): MiniState {
  if (source === 'youtube' && hasYouTubeSource()) return { source, ...readYouTubeState() }
  if (source === 'local' && hasLocalSource()) return { source, ...readLocalState() }
  if (hasLocalSource()) return { source: 'local', ...readLocalState() }
  if (hasYouTubeSource()) return { source: 'youtube', ...readYouTubeState() }
  return { source: null, title: '再生する曲を選んでください', playing: false, canPrevious: false, canNext: false }
}

function click(selector: string) {
  document.querySelector<HTMLButtonElement>(selector)?.click()
}

export default function FloatingMiniPlayer() {
  const [source, setSource] = useState<PlaybackSource | null>(() => getActivePlaybackSource())
  const [state, setState] = useState<MiniState>(() => snapshot(getActivePlaybackSource()))
  const [hiddenOnPlayer, setHiddenOnPlayer] = useState(false)
  const [languageRevision, setLanguageRevision] = useState(0)

  useEffect(() => onActivePlaybackSourceChange(setSource), [])

  useEffect(() => {
    const refresh = () => setState(snapshot(source))
    refresh()

    const mediaEvents = ['play', 'pause', 'ended', 'loadedmetadata', 'emptied', 'durationchange'] as const
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
    const player = document.querySelector<HTMLElement>('#player-panel')
    const container = document.querySelector<HTMLElement>('.content-grid')
    if (!player || !container) return

    const IntersectionObserverCtor = (globalThis as typeof globalThis & {
      IntersectionObserver?: typeof IntersectionObserver
    }).IntersectionObserver

    if (IntersectionObserverCtor) {
      const observer = new IntersectionObserverCtor((entries) => {
        const ratio = entries[0]?.intersectionRatio ?? 0
        setHiddenOnPlayer(ratio > 0.58)
      }, {
        root: container,
        threshold: [0, 0.58, 1],
      })
      observer.observe(player)
      return () => observer.disconnect()
    }

    let frame = 0
    const update = () => {
      frame = 0
      const playerRect = player.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const overlap = Math.max(0, Math.min(playerRect.right, containerRect.right) - Math.max(playerRect.left, containerRect.left))
      setHiddenOnPlayer(overlap > Math.min(playerRect.width, containerRect.width) * 0.58)
    }
    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }
    schedule()
    container.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      container.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const isEnglish = useMemo(() => document.documentElement.dataset.language === 'en', [languageRevision])
  const hasSource = state.source !== null

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
    const target = state.source === 'youtube'
      ? document.querySelector<HTMLElement>('#youtube-provider-panel')
      : document.querySelector<HTMLElement>('#player-panel')
    target?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  const openQueue = () => {
    document.querySelector<HTMLElement>('.unified-play-queue')?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
  }

  const openPlaylist = () => click('.player-playlist-trigger')

  if (hiddenOnPlayer || !hasSource) return null

  return (
    <div className={`floating-mini-player is-${state.source}`} role="region" aria-label={isEnglish ? 'Mini player' : 'ミニプレイヤー'}>
      <button type="button" className="floating-mini-title" onClick={openPlayer} aria-label={isEnglish ? 'Open current player' : '再生中のプレイヤーを開く'}>
        <span>{state.source === 'youtube' ? 'YT' : '♪'}</span>
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
