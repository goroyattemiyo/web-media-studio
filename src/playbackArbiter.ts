export type PlaybackSource = 'local' | 'youtube'
export type PlaybackTool = 'player' | 'library' | 'youtube' | 'localize' | 'record' | 'tools' | 'device'

type PlaybackClaimDetail = {
  source: PlaybackSource
}

const PLAYBACK_CLAIM_EVENT = 'wms:playback-claim'
const playbackBus = new EventTarget()

export function claimPlayback(source: PlaybackSource) {
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

export function setActivePlaybackTool(tool: PlaybackTool) {
  if (tool === 'youtube') {
    claimPlayback('youtube')
    return
  }

  if (tool === 'player' || tool === 'library') claimPlayback('local')
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
