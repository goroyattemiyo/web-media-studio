import { useEffect, useMemo, useState } from 'react'
import { getActivePlaybackSource, onActivePlaybackSourceChange, type PlaybackSource } from './playbackArbiter'

type MiniState = {
  source: PlaybackSource | null
  title: string
  playing: boolean
  canPrevious: boolean
  canNext: boolean
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
  if (source === 'youtube') return { source, ...readYouTubeState() }
  if (source === 'local') return { source, ...readLocalState() }
  const local = readLocalState()
  if (local.title !== 'Local Player') return { source: 'local', ...local }
  return { source: null, title: '再生する曲を選んでください', playing: false, canPrevious: false, canNext: false }
}

function click(selector: string) {
  document.querySelector<HTMLButtonElement>(selector)?.click()
}

export default function FloatingMiniPlayer() {
  const [source, setSource] = useState<PlaybackSource | null>(() => getActivePlaybackSource())
  const [state, setState] = useState<MiniState>(() => snapshot(getActivePlaybackSource()))
  const [hiddenOnPlayer, setHiddenOnPlayer] = useState(false)

  useEffect(() => onActivePlaybackSourceChange(setSource), [])

  useEffect(() => {
    const refresh = () => setState(snapshot(source))
    refresh()
    const timer = window.setInterval(refresh, 350)
    document.addEventListener('play', refresh, true)
    document.addEventListener('pause', refresh, true)
    document.addEventListener('ended', refresh, true)
    window.addEventListener('wms:language-change', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('play', refresh, true)
      document.removeEventListener('pause', refresh, true)
      document.removeEventListener('ended', refresh, true)
      window.removeEventListener('wms:language-change', refresh)
    }
  }, [source])

  useEffect(() => {
    const player = document.querySelector<HTMLElement>('#player-panel')
    const container = document.querySelector<HTMLElement>('.content-grid')
    if (!player || !container) return
    const update = () => {
      const playerRect = player.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const overlap = Math.max(0, Math.min(playerRect.right, containerRect.right) - Math.max(playerRect.left, containerRect.left))
      setHiddenOnPlayer(overlap > Math.min(playerRect.width, containerRect.width) * 0.58)
    }
    update()
    container.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      container.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const isEnglish = useMemo(() => document.documentElement.dataset.language === 'en', [state.title])
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
    document.querySelector<HTMLElement>('.unified-play-queue')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
