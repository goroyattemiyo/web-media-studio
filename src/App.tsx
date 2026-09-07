import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import RecorderPanel from './RecorderPanel'
import FFmpegToolsPanel from './FFmpegToolsPanel'
import {
  deleteMediaLibraryItem,
  getMediaLibraryBytes,
  listMediaLibraryItems,
  MEDIA_LIBRARY_MAX_ITEM_BYTES,
  MEDIA_LIBRARY_SOFT_LIMIT_BYTES,
  saveMediaLibraryItems,
  saveMediaLibraryOrder,
  StoredMediaLibraryItem,
} from './mediaLibraryDb'

type ThemeId = 'midnight-neon' | 'obsidian' | 'studio-light' | 'analog-warm' | 'cyber-blue'
type RepeatMode = 'off' | 'all' | 'one'
type PlayerVisualMode = 'emblem' | 'minimal'

type MediaItem = {
  id: string
  name: string
  kind: 'audio' | 'video'
  url: string
  mimeType: string
  relativePath: string | null
  source: 'files' | 'folder' | 'library'
  blob: Blob
  persisted: boolean
  savedAt: number | null
}

type StorageEstimate = {
  usage: number
  quota: number
}

type ResumePositions = Record<string, number>

const themes: Array<{ id: ThemeId; label: string }> = [
  { id: 'midnight-neon', label: 'Midnight Neon' },
  { id: 'obsidian', label: 'Obsidian' },
  { id: 'studio-light', label: 'Studio Light' },
  { id: 'analog-warm', label: 'Analog Warm' },
  { id: 'cyber-blue', label: 'Cyber Blue' },
]

const playerVisualModes: Array<{ id: PlayerVisualMode; label: string }> = [
  { id: 'emblem', label: 'Emblem Spin' },
  { id: 'minimal', label: 'Minimal' },
]

const speedPresets = [0.5, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 2]
const RESUME_POSITIONS_KEY = 'wms-resume-positions'

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '00:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB']
  let amount = value
  let unitIndex = 0
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024
    unitIndex += 1
  }
  const digits = unitIndex >= 2 && amount < 10 ? 1 : 0
  return `${amount.toFixed(digits)} ${units[unitIndex]}`
}

function mediaPath(file: File) {
  return file.webkitRelativePath || file.name
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected local-storage error.'
}

function loadResumePositions(): ResumePositions {
  try {
    const raw = window.localStorage.getItem(RESUME_POSITIONS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] >= 0),
    )
  } catch {
    return {}
  }
}

function App() {
  const [theme, setTheme] = useState<ThemeId>(() => {
    const saved = window.localStorage.getItem('wms-theme') as ThemeId | null
    return themes.some((item) => item.id === saved) ? saved! : 'midnight-neon'
  })
  const [playerVisualMode, setPlayerVisualMode] = useState<PlayerVisualMode>(() => {
    const saved = window.localStorage.getItem('wms-player-visual') as PlayerVisualMode | null
    return playerVisualModes.some((item) => item.id === saved) ? saved! : 'emblem'
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
  const [libraryBusy, setLibraryBusy] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [libraryStatus, setLibraryStatus] = useState('保存したメディアは次回起動時に自動復元されます。')
  const [savedBytes, setSavedBytes] = useState(0)
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimate | null>(null)
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(null)

  const mediaRef = useRef<HTMLMediaElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const objectUrlsRef = useRef<string[]>([])
  const autoPlayOnLoadRef = useRef(false)
  const resumePositionsRef = useRef<ResumePositions>(loadResumePositions())
  const currentItem = items[currentIndex] ?? null
  const persistedCount = items.filter((item) => item.persisted).length
  const temporaryCount = items.length - persistedCount
  const wmsIconUrl = `${import.meta.env.BASE_URL}icons/app-icon.svg`

  const capabilities = useMemo(
    () => [
      { label: 'Service Worker', ok: 'serviceWorker' in navigator },
      { label: 'Media Session', ok: 'mediaSession' in navigator },
      { label: 'Media Recorder', ok: 'MediaRecorder' in window },
      { label: 'Web Audio', ok: 'AudioContext' in window || 'webkitAudioContext' in window },
    ],
    [],
  )

  const refreshStorageStats = async () => {
    const bytes = await getMediaLibraryBytes()
    setSavedBytes(bytes)

    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate()
      setStorageEstimate({
        usage: estimate.usage ?? 0,
        quota: estimate.quota ?? 0,
      })
    }

    if (navigator.storage?.persisted) {
      setStoragePersistent(await navigator.storage.persisted())
    }
  }

  const writeResumePositions = () => {
    try {
      window.localStorage.setItem(RESUME_POSITIONS_KEY, JSON.stringify(resumePositionsRef.current))
    } catch {
      // Resume is a convenience feature; playback should continue if localStorage is unavailable.
    }
  }

  const persistResumePosition = (item: MediaItem | null, position: number, force = false) => {
    if (!item?.persisted || !Number.isFinite(position) || position < 0) return
    const previous = resumePositionsRef.current[item.id] ?? 0
    if (!force && Math.abs(previous - position) < 5) return
    resumePositionsRef.current = { ...resumePositionsRef.current, [item.id]: position }
    writeResumePositions()
  }

  const clearResumePosition = (item: MediaItem | null) => {
    if (!item?.persisted || !(item.id in resumePositionsRef.current)) return
    const next = { ...resumePositionsRef.current }
    delete next[item.id]
    resumePositionsRef.current = next
    writeResumePositions()
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('wms-theme', theme)
  }, [theme])

  useEffect(() => {
    window.localStorage.setItem('wms-player-visual', playerVisualMode)
  }, [playerVisualMode])

  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '')
    folderInputRef.current?.setAttribute('directory', '')
  }, [])

  useEffect(() => {
    let cancelled = false

    const restoreLibrary = async () => {
      try {
        const storedItems = await listMediaLibraryItems()
        if (cancelled) return

        const restoredItems = storedItems.map<MediaItem>((record) => {
          const url = URL.createObjectURL(record.blob)
          objectUrlsRef.current.push(url)
          return {
            id: record.id,
            name: record.name,
            kind: record.kind,
            url,
            mimeType: record.mimeType,
            relativePath: record.relativePath,
            source: 'library',
            blob: record.blob,
            persisted: true,
            savedAt: record.savedAt,
          }
        })

        setItems((previous) => {
          const existingIds = new Set(previous.map((item) => item.id))
          const uniqueRestored = restoredItems.filter((item) => !existingIds.has(item.id))
          return [...previous, ...uniqueRestored]
        })
        if (restoredItems.length) setCurrentIndex((index) => (index < 0 ? 0 : index))
        setSavedBytes(storedItems.reduce((total, item) => total + item.size, 0))
        setLibraryStatus(storedItems.length ? `${storedItems.length}件の保存メディアを復元しました。` : '保存したメディアは次回起動時に自動復元されます。')
        setLibraryError(null)
        await refreshStorageStats()
      } catch (error) {
        if (!cancelled) setLibraryError(`ライブラリを復元できませんでした: ${errorMessage(error)}`)
      }
    }

    void restoreLibrary()
    return () => {
      cancelled = true
    }
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
        artist: currentItem.persisted ? 'Saved library' : currentItem.relativePath ? 'Folder media' : 'Local media',
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

  const appendFiles = (files: File[], source: 'files' | 'folder') => {
    const sorted = [...files]
      .filter((file) => file.type.startsWith('audio/') || file.type.startsWith('video/'))
      .sort((a, b) => mediaPath(a).localeCompare(mediaPath(b), undefined, { numeric: true, sensitivity: 'base' }))

    if (!sorted.length) return 0

    const imported = sorted.map<MediaItem>((file) => {
      const url = URL.createObjectURL(file)
      objectUrlsRef.current.push(url)
      return {
        id: `${mediaPath(file)}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        kind: file.type.startsWith('video/') ? 'video' : 'audio',
        url,
        mimeType: file.type,
        relativePath: source === 'folder' ? mediaPath(file) : null,
        source,
        blob: file,
        persisted: false,
        savedAt: null,
      }
    })

    setItems((previous) => [...previous, ...imported])
    setCurrentIndex((index) => (index < 0 ? 0 : index))
    setLibraryStatus(`${imported.length}件を一時プレイリストへ追加しました。残したい曲は Save してください。`)
    setLibraryError(null)
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

  const saveItemsToLibrary = async (targets: MediaItem[]) => {
    const pending = targets.filter((item) => !item.persisted)
    if (!pending.length || libraryBusy) return

    setLibraryBusy(true)
    setLibraryError(null)

    try {
      const oversized = pending.find((item) => item.blob.size > MEDIA_LIBRARY_MAX_ITEM_BYTES)
      if (oversized) {
        throw new Error(`${oversized.name} は ${formatBytes(MEDIA_LIBRARY_MAX_ITEM_BYTES)} の1ファイル上限を超えています。`)
      }

      const bytesToAdd = pending.reduce((total, item) => total + item.blob.size, 0)
      const currentBytes = await getMediaLibraryBytes()
      if (currentBytes + bytesToAdd > MEDIA_LIBRARY_SOFT_LIMIT_BYTES) {
        throw new Error(`保存ライブラリは現在 ${formatBytes(MEDIA_LIBRARY_SOFT_LIMIT_BYTES)} までに制限しています。`)
      }

      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate()
        const usage = estimate.usage ?? 0
        const quota = estimate.quota ?? 0
        if (quota > 0 && usage + bytesToAdd > quota * 0.9) {
          throw new Error('ブラウザの保存容量が少なくなっています。不要な保存メディアを削除してから再試行してください。')
        }
      }

      if (navigator.storage?.persist) {
        try {
          await navigator.storage.persist()
        } catch {
          // Persistence is a browser-controlled enhancement; IndexedDB remains usable when denied.
        }
      }

      const baseSavedAt = Date.now()
      const savedAtById = new Map<string, number>()
      const records: StoredMediaLibraryItem[] = pending.map((item, index) => {
        const savedAt = baseSavedAt + index
        savedAtById.set(item.id, savedAt)
        return {
          id: item.id,
          name: item.name,
          kind: item.kind,
          mimeType: item.mimeType,
          relativePath: item.relativePath,
          savedAt,
          size: item.blob.size,
          blob: item.blob,
        }
      })

      await saveMediaLibraryItems(records)
      setItems((previous) => previous.map((item) => {
        const savedAt = savedAtById.get(item.id)
        return savedAt === undefined ? item : { ...item, persisted: true, savedAt }
      }))
      setLibraryStatus(`${pending.length}件を端末内ライブラリへ保存しました。`)
      await refreshStorageStats()
    } catch (error) {
      setLibraryError(`保存できませんでした: ${errorMessage(error)}`)
    } finally {
      setLibraryBusy(false)
    }
  }

  const deleteSavedItem = async (item: MediaItem) => {
    if (!item.persisted || libraryBusy) return

    const removalIndex = items.findIndex((candidate) => candidate.id === item.id)
    setLibraryBusy(true)
    setLibraryError(null)

    try {
      if (removalIndex === currentIndex) mediaRef.current?.pause()
      await deleteMediaLibraryItem(item.id)
      clearResumePosition(item)
      URL.revokeObjectURL(item.url)
      objectUrlsRef.current = objectUrlsRef.current.filter((url) => url !== item.url)
      setItems((previous) => previous.filter((candidate) => candidate.id !== item.id))
      setCurrentIndex((index) => {
        const nextLength = Math.max(0, items.length - 1)
        if (!nextLength) return -1
        if (index > removalIndex) return index - 1
        if (index === removalIndex) return Math.min(removalIndex, nextLength - 1)
        return index
      })
      setLibraryStatus(`${item.name} を保存ライブラリから削除しました。`)
      await refreshStorageStats()
    } catch (error) {
      setLibraryError(`削除できませんでした: ${errorMessage(error)}`)
    } finally {
      setLibraryBusy(false)
    }
  }

  const clearTemporaryItems = () => {
    mediaRef.current?.pause()
    const temporaryUrls = new Set(items.filter((item) => !item.persisted).map((item) => item.url))
    temporaryUrls.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = objectUrlsRef.current.filter((url) => !temporaryUrls.has(url))
    const savedItems = items.filter((item) => item.persisted)
    setItems(savedItems)
    setCurrentIndex(savedItems.length ? 0 : -1)
    setFolderRoots([])
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)
    setLibraryStatus('一時追加したメディアだけをクリアしました。保存済みライブラリは残っています。')
  }

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= items.length) return

    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(targetIndex, 0, moved)
    const currentId = currentItem?.id ?? null

    setItems(next)
    if (currentId) setCurrentIndex(next.findIndex((item) => item.id === currentId))
    setLibraryStatus('曲順を変更しました。保存済み曲の順番は次回起動時にも保持されます。')

    const persistedIds = next.filter((item) => item.persisted).map((item) => item.id)
    if (persistedIds.length > 1) {
      void saveMediaLibraryOrder(persistedIds).catch((error) => {
        setLibraryError(`曲順を保存できませんでした: ${errorMessage(error)}`)
      })
    }
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
    clearResumePosition(currentItem)
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
    persistResumePosition(currentItem, media.currentTime)

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
      const mediaDuration = Number.isFinite(media.duration) ? media.duration : 0
      const shouldAutoPlay = autoPlayOnLoadRef.current
      setDuration(mediaDuration)
      media.volume = volume
      media.playbackRate = playbackRate

      if (!shouldAutoPlay && currentItem?.persisted) {
        const savedPosition = resumePositionsRef.current[currentItem.id] ?? 0
        if (savedPosition >= 5 && (!mediaDuration || savedPosition < mediaDuration - 5)) {
          media.currentTime = savedPosition
          setCurrentTime(savedPosition)
        }
      }

      if (shouldAutoPlay) {
        autoPlayOnLoadRef.current = false
        void media.play().catch(() => {
          // Autoplay may still be blocked by the browser in some contexts.
        })
      }
    },
    onTimeUpdate: (media: HTMLMediaElement) => handleTimeUpdate(media),
  }

  const libraryFillPercent = Math.min(100, (savedBytes / MEDIA_LIBRARY_SOFT_LIMIT_BYTES) * 100)
  const savedResumePosition = currentItem?.persisted ? resumePositionsRef.current[currentItem.id] ?? 0 : 0

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><img src={wmsIconUrl} alt="" /></div>
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
          <div className={`player-visual player-visual-mode-${playerVisualMode}`}>
            {currentItem?.kind !== 'video' && (
              <label className="player-visual-toolbar">
                <span>Visual</span>
                <select value={playerVisualMode} onChange={(event) => setPlayerVisualMode(event.target.value as PlayerVisualMode)}>
                  {playerVisualModes.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
                </select>
              </label>
            )}
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
                onPause={(event) => {
                  setIsPlaying(false)
                  persistResumePosition(currentItem, event.currentTarget.currentTime, true)
                }}
                onEnded={handleEnded}
              />
            ) : currentItem ? (
              <>
                <div className="artwork-placeholder" aria-hidden="true">
                  <img src={wmsIconUrl} alt="" />
                </div>
                <audio
                  key={currentItem.id}
                  ref={attachMedia}
                  src={currentItem.url}
                  preload="metadata"
                  onLoadedMetadata={(event) => mediaEvents.onLoadedMetadata(event.currentTarget)}
                  onTimeUpdate={(event) => mediaEvents.onTimeUpdate(event.currentTarget)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={(event) => {
                    setIsPlaying(false)
                    persistResumePosition(currentItem, event.currentTarget.currentTime, true)
                  }}
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
              <p className="source-label">{currentItem?.persisted ? 'SAVED LIBRARY' : currentItem?.source === 'folder' ? 'FOLDER MEDIA' : currentItem ? 'LOCAL MEDIA' : 'NO SOURCE'}</p>
              <h2>{currentItem?.name ?? 'Choose a file to begin'}</h2>
              {currentItem?.relativePath && <p className="track-path">{currentItem.relativePath}</p>}
              {currentItem?.persisted && savedResumePosition >= 5 && <span className="resume-chip">前回位置 {formatTime(savedResumePosition)} を保存中</span>}
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
              <div><p className="eyebrow">LOCAL LIBRARY</p><h2>Persistent media</h2></div>
              <div className="library-actions">
                <label className="import-button">＋ Multiple files<input type="file" accept="audio/*,video/*" multiple onChange={importFiles} /></label>
                <label className="import-button folder-button">▣ Folder<input ref={folderInputRef} type="file" multiple onChange={importFolder} /></label>
                {temporaryCount > 0 && <button className="save-library-button" type="button" disabled={libraryBusy} onClick={() => void saveItemsToLibrary(items)}>Save {temporaryCount}</button>}
                {temporaryCount > 0 && <button className="clear-library-button" type="button" disabled={libraryBusy} onClick={clearTemporaryItems}>Clear temp</button>}
              </div>
            </div>

            <div className="library-storage-card">
              <div className="library-storage-copy">
                <strong>{persistedCount} saved</strong>
                <span>{formatBytes(savedBytes)} / {formatBytes(MEDIA_LIBRARY_SOFT_LIMIT_BYTES)}</span>
              </div>
              <div className="library-storage-meter" aria-label={`Library storage ${Math.round(libraryFillPercent)} percent`}>
                <span style={{ width: `${libraryFillPercent}%` }} />
              </div>
              <div className="library-storage-meta">
                <span>{storagePersistent === true ? 'Storage protected' : storagePersistent === false ? 'Browser-managed storage' : 'Storage status checking'}</span>
                {storageEstimate && storageEstimate.quota > 0 && <span>Origin {formatBytes(storageEstimate.usage)} / {formatBytes(storageEstimate.quota)}</span>}
              </div>
              {libraryError ? <p className="library-message is-error">{libraryError}</p> : <p className="library-message">{libraryStatus}</p>}
            </div>

            {folderRoots.length > 0 && (
              <div className="folder-root-list" aria-label="Loaded folders">
                {folderRoots.map((folder) => <span key={folder}>▣ {folder}</span>)}
              </div>
            )}

            <div className="playlist-list">
              {items.length ? items.map((item, index) => (
                <div className="playlist-row" key={item.id}>
                  <button
                    type="button"
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
                    <span className="source-chip">{item.persisted ? 'saved' : item.source === 'folder' ? 'folder' : item.kind}</span>
                  </button>
                  <button
                    type="button"
                    className={`library-item-action ${item.persisted ? 'is-delete' : 'is-save'}`}
                    disabled={libraryBusy}
                    onClick={() => item.persisted ? void deleteSavedItem(item) : void saveItemsToLibrary([item])}
                  >
                    {item.persisted ? 'Delete' : 'Save'}
                  </button>
                  <div className="queue-order-actions" aria-label={`${item.name} の曲順変更`}>
                    <button type="button" disabled={index === 0} onClick={() => moveItem(index, -1)} aria-label={`${item.name}を上へ`}>↑</button>
                    <button type="button" disabled={index === items.length - 1} onClick={() => moveItem(index, 1)} aria-label={`${item.name}を下へ`}>↓</button>
                  </div>
                </div>
              )) : (
                <div className="playlist-empty"><strong>まだ曲がありません</strong><span>Androidでは「Multiple files」で複数選択するのがおすすめです。保存した曲は次回起動時にも復元されます。</span></div>
              )}
            </div>
            {items.length > 0 && <p className="playlist-note">{items.length} items · {persistedCount} saved · ↑↓で曲順変更 · 保存済み曲は前回位置から再開します。</p>}
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
