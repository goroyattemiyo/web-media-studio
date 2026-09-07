export type YouTubeVideoInput = {
  videoId: string
  startSeconds: number
}

export type YouTubePlayerState = -1 | 0 | 1 | 2 | 3 | 5

export type YouTubeVideoData = {
  title?: string
  author?: string
  video_id?: string
}

export type YouTubePlayer = {
  destroy(): void
  cueVideoById(videoId: string, startSeconds?: number): void
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): YouTubePlayerState
  getVolume(): number
  setVolume(volume: number): void
  getPlaybackRate(): number
  setPlaybackRate(rate: number): void
  getAvailablePlaybackRates(): number[]
  getVideoData(): YouTubeVideoData
  getIframe(): HTMLIFrameElement
}

type YouTubePlayerEvent = {
  target: YouTubePlayer
  data?: number
}

type YouTubePlayerOptions = {
  width?: string | number
  height?: string | number
  videoId?: string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (event: YouTubePlayerEvent) => void
    onStateChange?: (event: YouTubePlayerEvent) => void
    onError?: (event: YouTubePlayerEvent) => void
    onPlaybackRateChange?: (event: YouTubePlayerEvent) => void
    onAutoplayBlocked?: (event: YouTubePlayerEvent) => void
  }
}

type YouTubeNamespace = {
  Player: new (element: HTMLElement | string, options: YouTubePlayerOptions) => YouTubePlayer
  PlayerState: {
    UNSTARTED: -1
    ENDED: 0
    PLAYING: 1
    PAUSED: 2
    BUFFERING: 3
    CUED: 5
  }
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YouTubeNamespace> | null = null

function validVideoId(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  return /^[A-Za-z0-9_-]{11}$/.test(trimmed) ? trimmed : null
}

function parseStartSeconds(value: string | null) {
  if (!value) return 0
  if (/^\d+$/.test(value)) return Number(value)

  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i)
  if (!match) return 0
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
}

export function parseYouTubeInput(input: string): YouTubeVideoInput | null {
  const trimmed = input.trim()
  const directId = validVideoId(trimmed)
  if (directId) return { videoId: directId, startSeconds: 0 }

  try {
    const url = new URL(trimmed)
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')
    let videoId: string | null = null

    if (host === 'youtu.be') {
      videoId = validVideoId(url.pathname.split('/').filter(Boolean)[0])
    } else if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
      videoId = validVideoId(url.searchParams.get('v'))
      if (!videoId) {
        const parts = url.pathname.split('/').filter(Boolean)
        if (['shorts', 'embed', 'live'].includes(parts[0] ?? '')) videoId = validVideoId(parts[1])
      }
    }

    if (!videoId) return null
    const startSeconds = parseStartSeconds(url.searchParams.get('t') ?? url.searchParams.get('start'))
    return { videoId, startSeconds }
  } catch {
    return null
  }
}

export function youtubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
}

export function youtubeErrorMessage(code: number) {
  switch (code) {
    case 2:
      return '動画IDまたはURLを確認してください。'
    case 5:
      return 'この動画はHTML5埋め込みプレーヤーで再生できません。'
    case 100:
      return '動画が見つからないか、削除・非公開になっています。'
    case 101:
    case 150:
      return '投稿者が埋め込み再生を許可していません。'
    case 153:
      return 'YouTube側で埋め込み元を確認できませんでした。ページを再読み込みして再試行してください。'
    default:
      return `YouTubeプレーヤーエラー (${code})`
  }
}

export function youtubeStateLabel(state: number) {
  switch (state) {
    case -1:
      return 'Ready'
    case 0:
      return 'Ended'
    case 1:
      return 'Playing'
    case 2:
      return 'Paused'
    case 3:
      return 'Buffering'
    case 5:
      return 'Cued'
    default:
      return 'Unknown'
  }
}

export function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady
    let timeoutId = 0

    const finish = () => {
      if (!window.YT?.Player) return
      window.clearTimeout(timeoutId)
      resolve(window.YT)
    }

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      finish()
    }

    const existing = document.getElementById('youtube-iframe-api') as HTMLScriptElement | null
    if (!existing) {
      const script = document.createElement('script')
      script.id = 'youtube-iframe-api'
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => {
        apiPromise = null
        reject(new Error('YouTube IFrame Player APIを読み込めませんでした。通信状態を確認してください。'))
      }
      document.head.appendChild(script)
    }

    timeoutId = window.setTimeout(() => {
      if (window.YT?.Player) finish()
      else {
        apiPromise = null
        reject(new Error('YouTube IFrame Player APIの読み込みがタイムアウトしました。'))
      }
    }, 15000)
  })

  return apiPromise
}
