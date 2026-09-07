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
  const playerHostRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YouTubePlayer | null>(null)

  useEffect(() => {
    setPortalTarget(document.querySelector('.side-stack'))
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
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [])

  const createPlayer = async (nextVideoId: string, startSeconds: number) => {
    const host = playerHostRef.current
    if (!host) return

    setError(null)
    setStatus('YouTube公式プレーヤーを読み込んでいます…')
    setReady(false)

    try {
      const yt = await loadYouTubeIframeApi()

      if (playerRef.current) {
        playerRef.current.cueVideoById(nextVideoId, startSeconds)
        setVideoId(nextVideoId)
        setCurrentTime(startSeconds)
        setDuration(0)
        setStatus('動画を読み込みました。再生ボタンを押してください。')
        return
      }

      playerRef.current = new yt.Player(host, {
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
            setPlayerState(youtubeStateLabel(event.data ?? -1))
            const data = event.target.getVideoData()
            if (data.title) setTitle(data.title)
            if ((event.data ?? -1) === 0) setCurrentTime(0)
          },
          onPlaybackRateChange: (event) => {
            setPlaybackRate(event.target.getPlaybackRate())
          },
          onAutoplayBlocked: () => {
            setStatus('ブラウザが自動再生を止めました。再生ボタンを押してください。')
          },
          onError: (event) => {
            const code = event.data ?? -1
            setError(youtubeErrorMessage(code))
            setStatus('再生できませんでした。')
          },
        },
      })
    } catch (loadError) {
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
    playerRef.current?.destroy()
    playerRef.current = null
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
          type="url"
          inputMode="url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={urlInput}
          onChange={(event) => setUrlInput(event.target.value)}
          aria-label="YouTube URL"
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
            <a href={youtubeWatchUrl(videoId)} target="_blank" rel="noreferrer">YouTubeで開く ↗</a>
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
        <span><strong>Background</strong> 端末依存</span>
      </div>
      <p className="youtube-policy-note">動画の保存・音声抽出は行いません。埋め込み不可・非公開などの動画はYouTube側の制限に従います。</p>
    </section>,
    portalTarget,
  )
}

export default YouTubeProviderPanel
