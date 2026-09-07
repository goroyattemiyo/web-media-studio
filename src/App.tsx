import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import RecorderPanel from './RecorderPanel'
import FFmpegToolsPanel from './FFmpegToolsPanel'

type ThemeId = 'midnight-neon' | 'obsidian' | 'studio-light' | 'analog-warm' | 'cyber-blue'
type RepeatMode = 'off' | 'all' | 'one'

type MediaItem = {
  id: string
  name: string
  kind: 'audio' | 'video'
  url: string
  mimeType: string
  relativePath: string | null
  source: 'files' | 'folder'
}

const themes: Array<{ id: ThemeId; label: string }> = [
  { id: 'midnight-neon', label: 'Midnight Neon' },
  { id: 'obsidian', label: 'Obsidian' },
  { id: 'studio-light', label: 'Studio Light' },
  { id: 'analog-warm', label: 'Analog Warm' },
  { id: 'cyber-blue', label: 'Cyber Blue' },
]

const speedPresets = [0.5, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 2]

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '00:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function mediaPath(file: File) {
  return file.webkitRelativePath || file.name
}

function App() {
  const [theme, setTheme] = useState<ThemeId>(() => {
    const saved = window.localStorage.getItem('wms-theme') as ThemeId | null
    return themes.some((item) => item.id === saved) ? saved! : 'midnight-neon'
  })
  const [items, setItems] = useState<MediaItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.9)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off')
  const [shuffle, setShuffle] = useState(false)
  const [aPoint, setAPoint] = useState<number | null>(null)
  const [bPoint, setBPoint] = useState<number | null>(null)
  const [recordingActive, setRecordingActive] = useState(false)
  const [folderRoots, setFolderRoots] = useState<string[]>([])

  const mediaRef = useRef<HTMLMediaElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const objectUrlsRef = useRef<string[]>([])
  const autoPlayOnLoadRef = useRef(false)
  const currentItem = items[currentIndex] ?? null

  const capabilities = useMemo(
    () => [
      { label: 'Service Worker', ok: 'serviceWorker' in navigator },
      { label: 'Media Session', ok: 'mediaSession' in navigator },
      { label: 'Media Recorder', ok: 'MediaRecorder' in window },
      { label: 'Web Audio', ok: 'AudioContext' in window || 'webkitAudioContext' in window },
    ],
    [],
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('wms-theme', theme)
  }, [theme])

  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '')
    folderInputRef.current?.setAttribute('directory', '')
  }, [])

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  useEffect(() => {
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)
    setAPoint(null)
    setBPoint(null)

    if (currentItem && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentItem.name,
        artist: currentItem.relativePath ? 'Folder media' : 'Local media',
        album: 'Web Media Studio',
      })
    }
  }, [currentItem])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    const seekBy = (seconds: number) => {
      const media = mediaRef.current
      if (!media) return
      media.currentTime = Math.max(0, Math.min(media.duration || 0, media.currentTime + seconds))
    }

    const previous = () => {
      if (!items.length) return
      autoPlayOnLoadRef.current = true
      setCurrentIndex((index) => (index <= 0 ? items.length - 1 : index - 1))
    }

    const next = () => {
      if (!items.length) return
      autoPlayOnLoadRef.current = true
      setCurrentIndex((index) => (index >= items.length - 1 ? 0 : index + 1))
    }

    try {
      navigator.mediaSession.setActionHandler('play', () => void mediaRef.current?.play())
      navigator.mediaSession.setActionHandler('pause', () => mediaRef.current?.pause())
      navigator.mediaSession.setActionHandler('seekbackward', () => seekBy(-10))
      navigator.mediaSession.setActionHandler('seekforward', () => seekBy(10))
      navigator.mediaSession.setActionHandler('previoustrack', previous)
      navigator.mediaSession.setActionHandler('nexttrack', next)
    } catch {
      // Some browsers expose Media Session but not every action.
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null)
        navigator.mediaSession.setActionHandler('pause', null)
        navigator.mediaSession.setActionHandler('seekbackward', null)
        navigator.mediaSession.setActionHandler('seekforward', null)
        navigator.mediaSession.setActionHandler('previoustrack', null)
        navigator.mediaSession.setActionHandler('nexttrack', null)
      } catch {
        // Ignore partial implementations.
      }
    }
  }, [items.length])

  const attachMedia = (node: HTMLMediaElement | null) => {
    mediaRef.current = node
  }

  const appendFiles = (files: File[], source: MediaItem['source']) => {
    const sorted = [...files]
      .filter((file) => file.type.startsWith('audio/') || file.type.startsWith('video/'))
      .sort((a, b) => mediaPath(a).localeCompare(mediaPath(b), undefined, { numeric: true, sensitivity: 'base' }))

    if (!sorted.length) return 0

    const imported = sorted.map<MediaItem>((file) => {
      const url = URL.createObjectURL(file)
      objectUrlsRef.current.push(url)
      return {
        id: `${mediaPath(file)}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        kind: file.type.startsWith('video/') ? 'video' : 'audio',
        url,
        mimeType: file.type,
        relativePath: source === 'folder' ? mediaPath(file) : null,
        source,
      }
    })

    setItems((previous) => [...previous, ...imported])
    setCurrentIndex((index) => (index < 0 ? 0 : index))
    return imported.length
  }

  const importFiles = (event: ChangeEvent<HTMLInputElement>) => {
    appendFiles(Array.from(event.target.files ?? []), 'files')
    event.target.value = ''
  }

  const importFolder = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    const count = appendFiles(files, 'folder')

    if (count > 0) {
      const roots = Array.from(new Set(
        files
          .map((file) => mediaPath(file).split('/')[0])
          .filter(Boolean),
      ))
      setFolderRoots((previous) => Array.from(new Set([...previous, ...roots])))
    }

    event.target.value = ''
  }

  const clearPlaylist = () => {
    mediaRef.current?.pause()
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
    setItems([])
    setCurrentIndex(-1)
    setFolderRoots([])
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)
  }

  const togglePlayback = async () => {
    const media = mediaRef.current
    if (!media) return
    if (media.paused) await media.play()
    else media.pause()
  }

  const startCurrentPlayback = async () => {
    const media = mediaRef.current
    if (media && media.paused) await media.play()
  }

  const skipBy = (seconds: number) => {
    const media = mediaRef.current
    if (!media) return
    media.currentTime = Math.max(0, Math.min(media.duration || 0, media.currentTime + seconds))
  }

  const goPrevious = () => {
    if (!items.length) return
    autoPlayOnLoadRef.current = Boolean(mediaRef.current && !mediaRef.current.paused)
    setCurrentIndex((index) => (index <= 0 ? items.length - 1 : index - 1))
  }

  const goNext = (fromEnded = false) => {
    if (!items.length) return

    const shouldContinue = fromEnded || Boolean(mediaRef.current && !mediaRef.current.paused)

    if (shuffle && items.length > 1) {
      let next = currentIndex
      while (next === currentIndex) next = Math.floor(Math.random() * items.length)
      autoPlayOnLoadRef.current = shouldContinue
      setCurrentIndex(next)
      return
    }

    if (currentIndex < items.length - 1) {
      autoPlayOnLoadRef.current = shouldContinue
      setCurrentIndex(currentIndex + 1)
      return
    }

    if (!fromEnded || repeatMode === 'all') {
      autoPlayOnLoadRef.current = shouldContinue
      setCurrentIndex(0)
    }
  }

  const handleEnded = () => {
    const media = mediaRef.current
    if (repeatMode === 'one' && media) {
      media.currentTime = 0
      void media.play()
      return
    }
    goNext(true)
  }

  const handleTimeUpdate = (media: HTMLMediaElement) => {
    if (aPoint !== null && bPoint !== null && media.currentTime >= bPoint) media.currentTime = aPoint
    setCurrentTime(media.currentTime)

    if ('mediaSession' in navigator && Number.isFinite(media.duration) && media.duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: media.duration,
          playbackRate: media.playbackRate,
          position: Math.min(media.currentTime, media.duration),
        })
      } catch {
        // Position state is a progressive enhancement.
      }
    }
  }

  const setRate = (rate: number) => {
    setPlaybackRate(rate)
    if (mediaRef.current) mediaRef.current.playbackRate = rate
  }

  const setMediaVolume = (nextVolume: number) => {
    setVolume(nextVolume)
    if (mediaRef.current) mediaRef.current.volume = nextVolume
  }

  const cycleRepeat = () => {
    setRepeatMode((mode) => (mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'))
  }

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const mediaEvents = {
    onLoadedMetadata: (media: HTMLMediaElement) => {
      setDuration(Number.isFinite(media.duration) ? media.duration : 0)
      media.volume = volume
      media.playbackRate = playbackRate
      if (autoPlayOnLoadRef.current) {
        autoPlayOnLoadRef.current = false
        void media.play().catch(() => {
          // Autoplay may still be blocked by the browser in some contexts.
        })
      }
    },
    onTimeUpdate: (media: HTMLMediaElement) => handleTimeUpdate(media),
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">WM</div>
          <div>
            <p className="eyebrow">WEB MEDIA STUDIO</p>
            <h1>Player Lab</h1>
          </div>
        </div>
        <label className="theme-picker">
          <span>Skin</span>
          <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeId)}>
            {themes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
      </header>

      <main className="content-grid">
        <section id="player-panel" className="player-panel glass-panel">
          <div className="player-visual">
            {currentItem?.kind === 'video' ? (
              <video
                key={currentItem.id}
                ref={attachMedia}
                src={currentItem.url}
                playsInline
                preload="metadata"
                onLoadedMetadata={(event) => mediaEvents.onLoadedMetadata(event.currentTarget)}
                onTimeUpdate={(event) => mediaEvents.onTimeUpdate(event.currentTarget)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={handleEnded}
              />
            ) : currentItem ? (
              <>
                <div className="artwork-placeholder" aria-hidden="true">
                  <div className="vinyl-ring" />
                  <span>WMS</span>
                </div>
                <audio
                  key={currentItem.id}
                  ref={attachMedia}
                  src={currentItem.url}
                  preload="metadata"
                  onLoadedMetadata={(event) => mediaEvents.onLoadedMetadata(event.currentTarget)}
                  onTimeUpdate={(event) => mediaEvents.onTimeUpdate(event.currentTarget)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={handleEnded}
                />
              </>
            ) : (
              <div className="empty-visual">
                <div className="empty-icon" aria-hidden="true">♪</div>
                <strong>Media ready.</strong>
                <span>端末の音声・動画を読み込んで実機再生を確認できます。</span>
              </div>
            )}
          </div>

          <div className="track-heading">
            <div>
              <p className="source-label">{currentItem?.source === 'folder' ? 'FOLDER MEDIA' : currentItem ? 'LOCAL MEDIA' : 'NO SOURCE'}</p>
              <h2>{currentItem?.name ?? 'Choose a file to begin'}</h2>
              {currentItem?.relativePath && <p className="track-path">{currentItem.relativePath}</p>}
            </div>
            <span className="track-count">{items.length ? `${currentIndex + 1} / ${items.length}` : '0 / 0'}</span>
          </div>

          <div className="timeline-block">
            <input
              className="seek-slider"
              aria-label="再生位置"
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              disabled={!currentItem}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (mediaRef.current) mediaRef.current.currentTime = next
                setCurrentTime(next)
              }}
            />
            <div className="time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
          </div>

          <div className="transport" aria-label="Playback controls">
            <button type="button" onClick={goPrevious} disabled={!items.length} aria-label="前の曲">⏮</button>
            <button type="button" onClick={() => skipBy(-10)} disabled={!currentItem} aria-label="10秒戻る">−10</button>
            <button type="button" className="play-button" onClick={() => void togglePlayback()} disabled={!currentItem} aria-label={isPlaying ? '一時停止' : '再生'}>{isPlaying ? 'Ⅱ' : '▶'}</button>
            <button type="button" onClick={() => skipBy(10)} disabled={!currentItem} aria-label="10秒進む">+10</button>
            <button type="button" onClick={() => goNext()} disabled={!items.length} aria-label="次の曲">⏭</button>
          </div>

          <div className="quick-controls">
            <button type="button" className={shuffle ? 'is-active' : ''} onClick={() => setShuffle((value) => !value)} disabled={!items.length}>Shuffle</button>
            <button type="button" className={repeatMode !== 'off' ? 'is-active' : ''} onClick={cycleRepeat} disabled={!items.length}>Repeat {repeatMode === 'off' ? 'Off' : repeatMode === 'all' ? 'All' : '1'}</button>
            <button type="button" className={aPoint !== null ? 'is-active' : ''} onClick={() => setAPoint(mediaRef.current?.currentTime ?? null)} disabled={!currentItem}>A {aPoint === null ? 'Set' : formatTime(aPoint)}</button>
            <button
              type="button"
              className={bPoint !== null ? 'is-active' : ''}
              onClick={() => {
                const point = mediaRef.current?.currentTime ?? null
                if (point !== null && aPoint !== null && point > aPoint) setBPoint(point)
              }}
              disabled={!currentItem || aPoint === null}
            >B {bPoint === null ? 'Set' : formatTime(bPoint)}</button>
            <button type="button" onClick={() => { setAPoint(null); setBPoint(null) }} disabled={aPoint === null && bPoint === null}>Clear A-B</button>
          </div>

          <div className="mix-controls">
            <label>
              <span>Speed</span>
              <select value={playbackRate} onChange={(event) => setRate(Number(event.target.value))}>
                {speedPresets.map((rate) => <option key={rate} value={rate}>{rate.toFixed(rate === 1 ? 1 : 2).replace(/0$/, '')}×</option>)}
              </select>
            </label>
            <label className="volume-control">
              <span>Volume {Math.round(volume * 100)}%</span>
              <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setMediaVolume(Number(event.target.value))} />
            </label>
          </div>
        </section>

        <aside className="side-stack">
          <section id="library-panel" className="glass-panel library-panel">
            <div className="section-heading library-heading">
              <div><p className="eyebrow">LOCAL LIBRARY</p><h2>Folder playlist</h2></div>
              <div className="library-actions">
                <label className="import-button">＋ Files<input type="file" accept="audio/*,video/*" multiple onChange={importFiles} /></label>
                <label className="import-button folder-button">▣ Folder<input ref={folderInputRef} type="file" multiple onChange={importFolder} /></label>
                {items.length > 0 && <button className="clear-library-button" type="button" onClick={clearPlaylist}>Clear</button>}
              </div>
            </div>

            {folderRoots.length > 0 && (
              <div className="folder-root-list" aria-label="Loaded folders">
                {folderRoots.map((folder) => <span key={folder}>▣ {folder}</span>)}
              </div>
            )}

            <div className="playlist-list">
              {items.length ? items.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  className={`playlist-item ${index === currentIndex ? 'is-current' : ''}`}
                  onClick={() => {
                    autoPlayOnLoadRef.current = Boolean(mediaRef.current && !mediaRef.current.paused)
                    setCurrentIndex(index)
                  }}
                >
                  <span className="playlist-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="playlist-copy">
                    <span className="playlist-name">{item.name}</span>
                    {item.relativePath && <small>{item.relativePath}</small>}
                  </span>
                  <span className="source-chip">{item.source === 'folder' ? 'folder' : item.kind}</span>
                </button>
              )) : (
                <div className="playlist-empty"><strong>まだ曲がありません</strong><span>「Folder」でフォルダ全体を読み込むと、音声・動画だけを自然順でプレイリスト化します。</span></div>
              )}
            </div>
            {items.length > 0 && <p className="playlist-note">{items.length} items · 曲終了時は次の項目へ連続再生します。フォルダの実ファイル自体はサーバーへ送信しません。</p>}
          </section>

          <section className="glass-panel device-panel">
            <div className="section-heading compact">
              <div><p className="eyebrow">REAL DEVICE CHECK</p><h2>Browser capabilities</h2></div>
              <span className="live-badge">LIVE</span>
            </div>
            <div className="capability-grid">
              {capabilities.map((item) => (
                <div className="capability-row" key={item.label}>
                  <span>{item.label}</span>
                  <strong className={item.ok ? 'supported' : 'unsupported'}>{item.ok ? 'Detected' : 'Unavailable'}</strong>
                </div>
              ))}
            </div>
            <p className="device-note">Media Session が Detected でも、画面OFF継続はOS・ブラウザごとの実機確認が必要です。</p>
          </section>

          <RecorderPanel
            sourceName={currentItem?.name ?? null}
            getSourcePosition={() => mediaRef.current?.currentTime ?? 0}
            startSourcePlayback={startCurrentPlayback}
            onRecordingChange={setRecordingActive}
          />

          <FFmpegToolsPanel />
        </aside>
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        <button type="button" className="is-current" onClick={() => scrollTo('player-panel')}><span>▶</span>Player</button>
        <button type="button" onClick={() => scrollTo('library-panel')}><span>≡</span>Playlist</button>
        <button type="button" className={recordingActive ? 'is-recording' : ''} onClick={() => scrollTo('recorder-panel')}><span>●</span>Record{recordingActive && <small>REC</small>}</button>
        <button type="button" onClick={() => scrollTo('ffmpeg-tools-panel')}><span>✦</span>Tools<small>FFmpeg</small></button>
        <button type="button" onClick={() => scrollTo('library-panel')}><span>▣</span>Library</button>
      </nav>
    </div>
  )
}

export default App
