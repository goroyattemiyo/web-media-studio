import { FormEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  loadYouTubeIframeApi,
  parseYouTubeInput,
  YouTubePlayer,
  youtubeErrorMessage,
  youtubeStateLabel,
  youtubeWatchUrl,
} from './providers/youtube'

const LAST_YOUTUBE_URL_KEY = 'wms-youtube-last-url'
const YOUTUBE_REPEAT_ONE_KEY = 'wms-youtube-repeat-one'
const YOUTUBE_KEEP_AWAKE_KEY = 'wms-youtube-keep-awake'

type WakeLockSentinelLike = {
  released: boolean
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void, options?: AddEventListenerOptions): void
}

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>
  }
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '00:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function YouTubeProviderPanel() {
  const [portalTarget, setPortalTarget] = useState<Element | null>(null)
  const [urlInput, setUrlInput] = useState(() => window.localStorage.getItem(LAST_YOUTUBE_URL_KEY) ?? '')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [status, setStatus] = useState('YouTube URLを入力してください。')
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [playerState, setPlayerState] = useState('Idle')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(80)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [availableRates, setAvailableRates] = useState<number[]>([1])
  const [title, setTitle] = useState('YouTube video')
  const [repeatOne, setRepeatOne] = useState(() => window.localStorage.getItem(YOUTUBE_REPEAT_ONE_KEY) === '1')
  const [keepAwakeEnabled, setKeepAwakeEnabled] = useState(() => window.localStorage.getItem(YOUTUBE_KEEP_AWAKE_KEY) === '1')
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [wakeLockStatus, setWakeLockStatus] = useState('')
  const playerHostRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YouTubePlayer | null>(null)
  const readyRef = useRef(false)
  const playingRef = useRef(false)
  const repeatOneRef = useRef(repeatOne)
  const keepAwakeRef = useRef(keepAwakeEnabled)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)
  const wakeLockSupported = Boolean((navigator as WakeLockNavigator).wakeLock)

  const releaseWakeLock = async () => {
    const sentinel = wakeLockRef.current
    wakeLockRef.current = null
    setWakeLockActive(false)
    if (!sentinel || sentinel.released) return

    try {
      await sentinel.release()
    } catch {
      // The browser can revoke a wake lock by itself; release failures are non-fatal.
    }
  }

  const requestWakeLock = async () => {
    const wakeLock = (navigator as WakeLockNavigator).wakeLock
    if (!wakeLock || !keepAwakeRef.current || !readyRef.current || !playingRef.current || document.visibilityState !== 'visible') return

    const current = wakeLockRef.current
    if (current && !current.released) {
      setWakeLockActive(true)
      return
    }

    try {
      const sentinel = await wakeLock.request('screen')
      wakeLockRef.current = sentinel
      setWakeLockActive(true)
      setWakeLockStatus('再生中は画面が消えないようにしています。')
      sentinel.addEventListener('release', () => {
        if (wakeLockRef.current === sentinel) wakeLockRef.current = null
        setWakeLockActive(false)
      }, { once: true })
    } catch (wakeError) {
      setWakeLockActive(false)
      setWakeLockStatus(wakeError instanceof Error ? `画面維持を開始できませんでした: ${wakeError.message}` : '画面維持を開始できませんでした。')
    }
  }

  useEffect(() => {
    setPortalTarget(document.querySelector('.side-stack'))
  }, [])

  useEffect(() => {
    repeatOneRef.current = repeatOne
    window.localStorage.setItem(YOUTUBE_REPEAT_ONE_KEY, repeatOne ? '1' : '0')
  }, [repeatOne])

  useEffect(() => {
    keepAwakeRef.current = keepAwakeEnabled
    window.localStorage.setItem(YOUTUBE_KEEP_AWAKE_KEY, keepAwakeEnabled ? '1' : '0')

    if (!keepAwakeEnabled) {
      setWakeLockStatus('')
      void releaseWakeLock()
    } else if (playingRef.current) {
      void requestWakeLock()
    }
  }, [keepAwakeEnabled])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && keepAwakeRef.current && playingRef.current) {
        void requestWakeLock()
      } else if (document.visibilityState !== 'visible') {
        void releaseWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const player = playerRef.current
      if (!player || !ready) return

      const nextTime = player.getCurrentTime()
      const nextDuration = player.getDuration()
      if (Number.isFinite(nextTime)) setCurrentTime(nextTime)
      if (Number.isFinite(nextDuration)) setDuration(nextDuration)

      const data = player.getVideoData()
      if (data.title) setTitle(data.title)
    }, 500)

    return () => window.clearInterval(interval)
  }, [ready])

  useEffect(() => {
    return () => {
      void releaseWakeLock()
      playerRef.current?.destroy()
      playerRef.current = null
      if (playerHostRef.current) playerHostRef.current.innerHTML = ''
    }
  }, [])

  const createPlayer = async (nextVideoId: string, startSeconds: number) => {
    const hostContainer = playerHostRef.current
    if (!hostContainer) return

    setError(null)
    setStatus('YouTube公式プレーヤーを読み込んでいます…')
    readyRef.current = false
    playingRef.current = false
    setReady(false)
    setCurrentTime(startSeconds)
    setDuration(0)
    void releaseWakeLock()

    try {
      const yt = await loadYouTubeIframeApi()

      if (playerRef.current) {
        playerRef.current.cueVideoById(nextVideoId, startSeconds)
        setVideoId(nextVideoId)
        readyRef.current = true
        setReady(true)
        setStatus('動画を読み込みました。再生ボタンを押してください。')
        return
      }

      hostContainer.innerHTML = ''
      const mount = document.createElement('div')
      hostContainer.appendChild(mount)

      playerRef.current = new yt.Player(mount, {
        width: '100%',
        height: '100%',
        videoId: nextVideoId,
        playerVars: {
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
          start: startSeconds,
        },
        events: {
          onReady: (event) => {
            readyRef.current = true
            setReady(true)
            setVideoId(nextVideoId)
            setVolume(event.target.getVolume())
            setPlaybackRate(event.target.getPlaybackRate())
            const rates = event.target.getAvailablePlaybackRates()
            setAvailableRates(rates.length ? rates : [1])
            event.target.getIframe().setAttribute('title', 'YouTube player')
            setStatus('動画を読み込みました。再生ボタンを押してください。')
          },
          onStateChange: (event) => {
            const state = event.data ?? -1
            const isPlaying = state === 1
            playingRef.current = isPlaying
            setPlayerState(youtubeStateLabel(state))

            const data = event.target.getVideoData()
            if (data.title) setTitle(data.title)

            if (isPlaying) {
              if (keepAwakeRef.current) void requestWakeLock()
            } else {
              void releaseWakeLock()
            }

            if (state === 0) {
              setCurrentTime(0)
              if (repeatOneRef.current) {
                setStatus('Repeat 1: 動画を先頭から繰り返します。')
                event.target.seekTo(0, true)
                event.target.playVideo()
              } else {
                setStatus('動画が終了しました。')
              }
            }
          },
          onPlaybackRateChange: (event) => {
            setPlaybackRate(event.target.getPlaybackRate())
          },
          onAutoplayBlocked: () => {
            setStatus('ブラウザが自動再生を止めました。再生ボタンを押してください。')
          },
          onError: (event) => {
            playingRef.current = false
            void releaseWakeLock()
            const code = event.data ?? -1
            setError(youtubeErrorMessage(code))
            setStatus('再生できませんでした。')
          },
        },
      })
    } catch (loadError) {
      readyRef.current = false
      setError(loadError instanceof Error ? loadError.message : 'YouTubeプレーヤーを読み込めませんでした。')
      setStatus('再生できませんでした。')
    }
  }

  const loadFromInput = (event: FormEvent) => {
    event.preventDefault()
    const parsed = parseYouTubeInput(urlInput)
    if (!parsed) {
      setError('YouTubeの動画URL、Shorts URL、youtu.be URL、または11文字の動画IDを入力してください。')
      return
    }

    window.localStorage.setItem(LAST_YOUTUBE_URL_KEY, urlInput.trim())
    void createPlayer(parsed.videoId, parsed.startSeconds)
  }

  const clearPlayer = () => {
    playingRef.current = false
    readyRef.current = false
    void releaseWakeLock()
    playerRef.current?.destroy()
    playerRef.current = null
    if (playerHostRef.current) playerHostRef.current.innerHTML = ''
    setReady(false)
    setVideoId(null)
    setCurrentTime(0)
    setDuration(0)
    setTitle('YouTube video')
    setPlayerState('Idle')
    setError(null)
    setStatus('YouTube URLを入力してください。')
  }

  const seekBy = (seconds: number) => {
    const player = playerRef.current
    if (!player || !ready) return
    const next = Math.max(0, Math.min(player.getDuration() || 0, player.getCurrentTime() + seconds))
    player.seekTo(next, true)
    setCurrentTime(next)
  }

  const seekTo = (next: number) => {
    const player = playerRef.current
    if (!player || !ready) return
    player.seekTo(next, true)
    setCurrentTime(next)
  }

  const changeVolume = (next: number) => {
    setVolume(next)
    playerRef.current?.setVolume(next)
  }

  const changeRate = (next: number) => {
    setPlaybackRate(next)
    playerRef.current?.setPlaybackRate(next)
  }

  const toggleKeepAwake = () => {
    if (!wakeLockSupported) return
    const next = !keepAwakeRef.current
    keepAwakeRef.current = next
    setKeepAwakeEnabled(next)
    if (next && playingRef.current) void requestWakeLock()
    if (!next) void releaseWakeLock()
  }

  if (!portalTarget) return null

  return createPortal(
    <section id="youtube-provider-panel" className="glass-panel youtube-provider-panel">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">YOUTUBE</p>
          <p className="tool-description">YouTubeのURLを公式埋め込みプレーヤーで再生します。</p>
          <h2>Official player</h2>
        </div>
        <span className="youtube-official-badge">IFrame API</span>
      </div>

      <form className="youtube-url-form" onSubmit={loadFromInput}>
        <input
          type="text"
          inputMode="url"
          placeholder="YouTube URL または動画ID"
          value={urlInput}
          onChange={(event) => setUrlInput(event.target.value)}
          aria-label="YouTube URL または動画ID"
        />
        <button type="submit">Load</button>
        {videoId && <button type="button" className="secondary" onClick={clearPlayer}>Clear</button>}
      </form>

      <div className={`youtube-player-frame ${videoId ? 'has-video' : ''}`}>
        <div ref={playerHostRef} className="youtube-player-host" />
        {!videoId && (
          <div className="youtube-empty-state">
            <strong>YouTube ready.</strong>
            <span>動画URLを読み込むと、ここに公式プレーヤーを表示します。</span>
          </div>
        )}
      </div>

      {videoId && (
        <>
          <div className="youtube-track-info">
            <div>
              <span className="source-chip">youtube</span>
              <strong>{title}</strong>
            </div>
            <a href={youtubeWatchUrl(videoId)} target="_blank" rel="noreferrer">YouTubeアプリ/サイトで開く ↗</a>
          </div>

          <div className="youtube-timeline-block">
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.5"
              value={Math.min(currentTime, duration || 0)}
              disabled={!ready || duration <= 0}
              onChange={(event) => seekTo(Number(event.target.value))}
              aria-label="YouTube再生位置"
            />
            <div><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
          </div>

          <div className="youtube-transport">
            <button type="button" disabled={!ready} onClick={() => seekBy(-10)}>−10</button>
            <button type="button" className="primary" disabled={!ready} onClick={() => playerRef.current?.playVideo()}>▶ Play</button>
            <button type="button" disabled={!ready} onClick={() => playerRef.current?.pauseVideo()}>Ⅱ Pause</button>
            <button type="button" disabled={!ready} onClick={() => seekBy(10)}>+10</button>
          </div>

          <div className="youtube-playback-options">
            <button type="button" className={repeatOne ? 'is-active' : ''} onClick={() => setRepeatOne((value) => !value)}>
              Repeat {repeatOne ? '1' : 'Off'}
            </button>
            <button type="button" className={keepAwakeEnabled ? 'is-active' : ''} disabled={!wakeLockSupported} onClick={toggleKeepAwake}>
              Keep screen on {wakeLockActive ? 'Active' : keepAwakeEnabled ? 'On' : 'Off'}
            </button>
          </div>

          <div className="youtube-mix-controls">
            <label>
              <span>Speed</span>
              <select value={playbackRate} disabled={!ready} onChange={(event) => changeRate(Number(event.target.value))}>
                {availableRates.map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
              </select>
            </label>
            <label>
              <span>Volume {Math.round(volume)}%</span>
              <input type="range" min="0" max="100" step="1" value={volume} disabled={!ready} onChange={(event) => changeVolume(Number(event.target.value))} />
            </label>
          </div>

          <div className="youtube-screenoff-note">
            <strong>画面OFF対策</strong>
            <span>このAndroid実機では画面OFFで埋め込み再生が停止しました。Web側から画面OFFのまま継続させるのではなく、Keep screen on で再生中の自動消灯を防ぎます。</span>
            {wakeLockStatus && <small>{wakeLockStatus}</small>}
          </div>
        </>
      )}

      <div className="youtube-status-row">
        <span className={ready ? 'supported' : ''}>{playerState}</span>
        <small>{status}</small>
      </div>
      {error && <p className="youtube-error">{error}</p>}

      <div className="youtube-capabilities">
        <span><strong>Playback</strong> 対応</span>
        <span><strong>Download</strong> 非対応</span>
        <span><strong>Screen off</strong> 実機で停止</span>
        <span><strong>Wake lock</strong> {wakeLockSupported ? '対応' : '非対応'}</span>
      </div>
      <p className="youtube-policy-note">動画の保存・音声抽出は行いません。埋め込み不可・非公開などの動画はYouTube側の制限に従います。</p>
    </section>,
    portalTarget,
  )
}

export default YouTubeProviderPanel
