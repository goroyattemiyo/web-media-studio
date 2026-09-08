export type PlaybackSource = 'local' | 'youtube'
export type PlaybackTool = 'player' | 'library' | 'youtube' | 'localize' | 'record' | 'tools' | 'device'

type PlaybackClaimDetail = {
  source: PlaybackSource
}

const PLAYBACK_CLAIM_EVENT = 'wms:playback-claim'
const ACTIVE_SOURCE_EVENT = 'wms:active-playback-source'
const playbackBus = new EventTarget()
let activePlaybackSource: PlaybackSource | null = null

export function getActivePlaybackSource() {
  return activePlaybackSource
}

export function onActivePlaybackSourceChange(listener: (source: PlaybackSource) => void) {
  const handle = (event: Event) => {
    const detail = (event as CustomEvent<PlaybackClaimDetail>).detail
    listener(detail.source)
  }
  playbackBus.addEventListener(ACTIVE_SOURCE_EVENT, handle)
  return () => playbackBus.removeEventListener(ACTIVE_SOURCE_EVENT, handle)
}

export function claimPlayback(source: PlaybackSource) {
  activePlaybackSource = source
  playbackBus.dispatchEvent(new CustomEvent<PlaybackClaimDetail>(ACTIVE_SOURCE_EVENT, {
    detail: { source },
  }))
  playbackBus.dispatchEvent(new CustomEvent<PlaybackClaimDetail>(PLAYBACK_CLAIM_EVENT, {
    detail: { source },
  }))
}

export function registerPlaybackSource(source: PlaybackSource, pause: () => void) {
  const handleClaim = (event: Event) => {
    const claim = event as CustomEvent<PlaybackClaimDetail>
    if (claim.detail.source !== source) pause()
  }

  playbackBus.addEventListener(PLAYBACK_CLAIM_EVENT, handleClaim)
  return () => playbackBus.removeEventListener(PLAYBACK_CLAIM_EVENT, handleClaim)
}

/**
 * WMS tool/page navigation must never claim a playback source.
 * Playback arbitration is driven only by an actual play action/event.
 * This keeps Local or YouTube audio running while the user browses Library,
 * Recorder, Tools, Settings, or another WMS card.
 */
export function setActivePlaybackTool(_tool: PlaybackTool) {
  // Intentionally navigation-only. Keep for ToolDeck compatibility.
}

export function installPlaybackArbitration() {
  const unregisterLocal = registerPlaybackSource('local', () => {
    document.querySelectorAll<HTMLMediaElement>('#player-panel audio, #player-panel video').forEach((media) => {
      if (!media.paused) media.pause()
    })
  })

  const handleLocalPlay = (event: Event) => {
    const target = event.target
    if (!(target instanceof HTMLMediaElement)) return
    if (!target.closest('#player-panel')) return
    claimPlayback('local')
  }

  document.addEventListener('play', handleLocalPlay, true)

  return () => {
    document.removeEventListener('play', handleLocalPlay, true)
    unregisterLocal()
  }
}
