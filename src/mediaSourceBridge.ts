export type YouTubeSourceDetail = {
  videoId: string
  url: string
  title: string
}

const LOAD_YOUTUBE_EVENT = 'wms:load-youtube-source'
const PLAYLIST_CHANGED_EVENT = 'wms:playlist-db-changed'

export function requestLoadYouTubeSource(detail: YouTubeSourceDetail) {
  window.dispatchEvent(new CustomEvent<YouTubeSourceDetail>(LOAD_YOUTUBE_EVENT, { detail }))
}

export function onLoadYouTubeSource(handler: (detail: YouTubeSourceDetail) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<YouTubeSourceDetail>).detail)
  window.addEventListener(LOAD_YOUTUBE_EVENT, listener)
  return () => window.removeEventListener(LOAD_YOUTUBE_EVENT, listener)
}

export function announcePlaylistChanged() {
  window.dispatchEvent(new Event(PLAYLIST_CHANGED_EVENT))
}

export function onPlaylistChanged(handler: () => void) {
  window.addEventListener(PLAYLIST_CHANGED_EVENT, handler)
  return () => window.removeEventListener(PLAYLIST_CHANGED_EVENT, handler)
}
