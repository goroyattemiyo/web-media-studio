export type RemoteProviderId = 'youtube' | 'vimeo' | 'google_web'
export type RemotePlaybackMode = 'youtube' | 'iframe' | 'external'

export type QueueRemoteSource = {
  provider: RemoteProviderId
  sourceId: string
  url: string
  title: string
  playback: RemotePlaybackMode
  embedUrl?: string | null
}

export type QueueYouTubeSource = {
  videoId: string
  url: string
  title: string
}

type ClearRemoteQueueDetail = {
  provider?: RemoteProviderId
}

const ADD_REMOTE_QUEUE_EVENT = 'wms:add-remote-to-play-queue'
const CLEAR_REMOTE_QUEUE_EVENT = 'wms:clear-remote-play-queue'
const REQUEST_REMOTE_PLAYBACK_EVENT = 'wms:request-remote-playback'

export function addRemoteToPlayQueue(detail: QueueRemoteSource) {
  window.dispatchEvent(new CustomEvent<QueueRemoteSource>(ADD_REMOTE_QUEUE_EVENT, { detail }))
}

export function onAddRemoteToPlayQueue(handler: (detail: QueueRemoteSource) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<QueueRemoteSource>).detail)
  window.addEventListener(ADD_REMOTE_QUEUE_EVENT, listener)
  return () => window.removeEventListener(ADD_REMOTE_QUEUE_EVENT, listener)
}

export function clearRemotePlayQueue(provider?: RemoteProviderId) {
  window.dispatchEvent(new CustomEvent<ClearRemoteQueueDetail>(CLEAR_REMOTE_QUEUE_EVENT, {
    detail: provider ? { provider } : {},
  }))
}

export function onClearRemotePlayQueue(handler: (provider?: RemoteProviderId) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<ClearRemoteQueueDetail>).detail?.provider)
  window.addEventListener(CLEAR_REMOTE_QUEUE_EVENT, listener)
  return () => window.removeEventListener(CLEAR_REMOTE_QUEUE_EVENT, listener)
}

export function requestRemotePlayback(detail: QueueRemoteSource) {
  window.dispatchEvent(new CustomEvent<QueueRemoteSource>(REQUEST_REMOTE_PLAYBACK_EVENT, { detail }))
}

export function onRequestRemotePlayback(handler: (detail: QueueRemoteSource) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<QueueRemoteSource>).detail)
  window.addEventListener(REQUEST_REMOTE_PLAYBACK_EVENT, listener)
  return () => window.removeEventListener(REQUEST_REMOTE_PLAYBACK_EVENT, listener)
}

// Compatibility helpers for existing YouTube-only callers while the rest of WMS migrates.
export function addYouTubeToPlayQueue(detail: QueueYouTubeSource) {
  addRemoteToPlayQueue({
    provider: 'youtube',
    sourceId: detail.videoId,
    url: detail.url,
    title: detail.title,
    playback: 'youtube',
  })
}

export function onAddYouTubeToPlayQueue(handler: (detail: QueueYouTubeSource) => void) {
  return onAddRemoteToPlayQueue((detail) => {
    if (detail.provider !== 'youtube') return
    handler({ videoId: detail.sourceId, url: detail.url, title: detail.title })
  })
}

export function clearYouTubePlayQueue() {
  clearRemotePlayQueue('youtube')
}

export function onClearYouTubePlayQueue(handler: () => void) {
  return onClearRemotePlayQueue((provider) => {
    if (provider === 'youtube') handler()
  })
}
