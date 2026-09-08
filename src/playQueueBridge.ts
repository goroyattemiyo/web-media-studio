export type QueueYouTubeSource = {
  videoId: string
  url: string
  title: string
}

const ADD_YOUTUBE_QUEUE_EVENT = 'wms:add-youtube-to-play-queue'
const CLEAR_YOUTUBE_QUEUE_EVENT = 'wms:clear-youtube-play-queue'

export function addYouTubeToPlayQueue(detail: QueueYouTubeSource) {
  window.dispatchEvent(new CustomEvent<QueueYouTubeSource>(ADD_YOUTUBE_QUEUE_EVENT, { detail }))
}

export function onAddYouTubeToPlayQueue(handler: (detail: QueueYouTubeSource) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<QueueYouTubeSource>).detail)
  window.addEventListener(ADD_YOUTUBE_QUEUE_EVENT, listener)
  return () => window.removeEventListener(ADD_YOUTUBE_QUEUE_EVENT, listener)
}

export function clearYouTubePlayQueue() {
  window.dispatchEvent(new Event(CLEAR_YOUTUBE_QUEUE_EVENT))
}

export function onClearYouTubePlayQueue(handler: () => void) {
  window.addEventListener(CLEAR_YOUTUBE_QUEUE_EVENT, handler)
  return () => window.removeEventListener(CLEAR_YOUTUBE_QUEUE_EVENT, handler)
}
