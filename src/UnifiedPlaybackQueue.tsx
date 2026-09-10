import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { onPlaylistChanged } from './mediaSourceBridge'
import { listPlaylists, playlistEntries, type YouTubePlaylistEntry } from './playlistDb'
import {
  onAddRemoteToPlayQueue,
  onClearRemotePlayQueue,
  requestRemotePlayback,
  type QueueRemoteSource,
  type QueueYouTubeSource,
  type RemoteProviderId,
} from './playQueueBridge'

const REMOTE_QUEUE_KEY = 'wms-unified-remote-queue-v1'
const LEGACY_YOUTUBE_QUEUE_KEY = 'wms-unified-youtube-queue-v1'

type LocalQueueItem = {
  index: number
  name: string
  source: string
  current: boolean
}

type RemoteQueueItem = QueueRemoteSource & {
  origin: 'queue' | 'playlist'
}

function isRemoteQueueSource(value: unknown): value is QueueRemoteSource {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<QueueRemoteSource>
  return (
    (item.provider === 'youtube' || item.provider === 'vimeo' || item.provider === 'google_web')
    && typeof item.sourceId === 'string'
    && Boolean(item.sourceId)
    && typeof item.url === 'string'
    && typeof item.title === 'string'
    && (item.playback === 'youtube' || item.playback === 'iframe' || item.playback === 'external')
  )
}

function loadLegacyYouTubeQueue(): QueueRemoteSource[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_YOUTUBE_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as QueueYouTubeSource[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item.videoId === 'string' && typeof item.url === 'string' && typeof item.title === 'string')
      .map((item) => ({
        provider: 'youtube' as const,
        sourceId: item.videoId,
        url: item.url,
        title: item.title,
        playback: 'youtube' as const,
      }))
  } catch {
    return []
  }
}

function loadRemoteQueue(): QueueRemoteSource[] {
  try {
    const raw = window.localStorage.getItem(REMOTE_QUEUE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown[]
      if (Array.isArray(parsed)) return parsed.filter(isRemoteQueueSource)
    }
  } catch {
    // Try the legacy queue below.
  }
  return loadLegacyYouTubeQueue()
}

function saveRemoteQueue(items: QueueRemoteSource[]) {
  try {
    window.localStorage.setItem(REMOTE_QUEUE_KEY, JSON.stringify(items))
    const legacyYouTube: QueueYouTubeSource[] = items
      .filter((item) => item.provider === 'youtube')
      .map((item) => ({ videoId: item.sourceId, url: item.url, title: item.title }))
    window.localStorage.setItem(LEGACY_YOUTUBE_QUEUE_KEY, JSON.stringify(legacyYouTube))
  } catch {
    // Queue remains available for the current session if storage is unavailable.
  }
}

function localRowsSnapshot(): LocalQueueItem[] {
  return Array.from(document.querySelectorAll<HTMLElement>('#library-panel .playlist-row')).map((row, index) => ({
    index,
    name: row.querySelector<HTMLElement>('.playlist-name')?.textContent?.trim() || `Local ${index + 1}`,
    source: row.querySelector<HTMLElement>('.source-chip')?.textContent?.trim() || 'local',
    current: row.querySelector('.playlist-item')?.classList.contains('is-current') ?? false,
  }))
}

function activePlaylistName() {
  const label = document.querySelector<HTMLElement>('#player-panel .source-label')?.textContent?.trim() || ''
  const marker = 'PLAYLIST · '
  return label.startsWith(marker) ? label.slice(marker.length).trim() : ''
}

function playlistYouTubeToRemote(item: YouTubePlaylistEntry): QueueRemoteSource {
  return {
    provider: 'youtube',
    sourceId: item.videoId,
    url: item.url,
    title: item.title,
    playback: 'youtube',
  }
}

function remoteKey(item: Pick<QueueRemoteSource, 'provider' | 'sourceId'>) {
  return `${item.provider}:${item.sourceId}`
}

function UnifiedPlaybackQueue() {
  const [target, setTarget] = useState<Element | null>(null)
  const [locals, setLocals] = useState<LocalQueueItem[]>([])
  const [manualRemote, setManualRemote] = useState<QueueRemoteSource[]>(loadRemoteQueue)
  const [playlistYouTube, setPlaylistYouTube] = useState<YouTubePlaylistEntry[]>([])
  const [playlistName, setPlaylistName] = useState('')
  const [status, setStatus] = useState('各カードで選んだメディアをここから再生できます。')

  useEffect(() => {
    let frame = 0
    const resolveTarget = () => {
      frame = 0
      const next = document.querySelector('#player-panel')
      setTarget((current) => current === next ? current : next)
    }
    const scheduleResolve = () => {
      if (frame) return
      frame = window.requestAnimationFrame(resolveTarget)
    }

    resolveTarget()
    const observer = new MutationObserver(scheduleResolve)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    const refreshLocal = () => setLocals(localRowsSnapshot())
    refreshLocal()

    const library = document.querySelector('#library-panel .playlist-list')
    const observer = new MutationObserver(refreshLocal)
    if (library) observer.observe(library, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false

    const refreshPlaylistYouTube = async () => {
      const name = activePlaylistName()
      setPlaylistName(name)
      if (!name) {
        setPlaylistYouTube([])
        return
      }

      try {
        const playlists = await listPlaylists()
        if (cancelled) return
        const playlist = playlists.find((item) => item.name === name)
        if (!playlist) {
          setPlaylistYouTube([])
          return
        }
        setPlaylistYouTube(
          playlistEntries(playlist).filter((entry): entry is YouTubePlaylistEntry => entry.kind === 'youtube'),
        )
      } catch {
        if (!cancelled) setPlaylistYouTube([])
      }
    }

    void refreshPlaylistYouTube()
    const removePlaylistListener = onPlaylistChanged(() => void refreshPlaylistYouTube())

    const sourceLabel = document.querySelector('#player-panel .source-label')
    const labelObserver = new MutationObserver(() => void refreshPlaylistYouTube())
    if (sourceLabel) labelObserver.observe(sourceLabel, { childList: true, subtree: true, characterData: true })

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshPlaylistYouTube()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      removePlaylistListener()
      labelObserver.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => {
    const removeAddListener = onAddRemoteToPlayQueue((detail) => {
      setManualRemote((current) => {
        if (current.some((item) => remoteKey(item) === remoteKey(detail))) {
          setStatus(`${detail.title} はすでにPlay Queueにあります。`)
          return current
        }
        const next = [...current, detail]
        saveRemoteQueue(next)
        setStatus(`${detail.title} をPlay Queueへ追加しました。`)
        return next
      })
    })
    const removeClearListener = onClearRemotePlayQueue((provider) => {
      setManualRemote((current) => {
        const next = provider ? current.filter((item) => item.provider !== provider) : []
        saveRemoteQueue(next)
        return next
      })
    })
    return () => {
      removeAddListener()
      removeClearListener()
    }
  }, [])

  const remoteItems = useMemo<RemoteQueueItem[]>(() => {
    const seen = new Set<string>()
    const result: RemoteQueueItem[] = []

    for (const item of manualRemote) {
      const key = remoteKey(item)
      if (seen.has(key)) continue
      seen.add(key)
      result.push({ ...item, origin: 'queue' })
    }
    for (const playlistItem of playlistYouTube) {
      const item = playlistYouTubeToRemote(playlistItem)
      const key = remoteKey(item)
      if (seen.has(key)) continue
      seen.add(key)
      result.push({ ...item, origin: 'playlist' })
    }
    return result
  }, [manualRemote, playlistYouTube])

  const playLocal = (index: number) => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('#library-panel .playlist-row'))
    const button = rows[index]?.querySelector<HTMLButtonElement>('.playlist-item')
    if (!button) return
    button.click()
    setStatus(`${locals[index]?.name ?? 'Local media'} をPlayerへ送りました。`)

    window.setTimeout(() => {
      const playButton = document.querySelector<HTMLButtonElement>('#player-panel .play-button')
      if (playButton && playButton.textContent?.includes('▶')) playButton.click()
    }, 90)
  }

  const moveLocal = (index: number, direction: -1 | 1) => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('#library-panel .playlist-row'))
    const buttons = rows[index]?.querySelectorAll<HTMLButtonElement>('.queue-order-actions button')
    const button = direction < 0 ? buttons?.[0] : buttons?.[1]
    button?.click()
  }

  const removeLocal = (index: number) => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('#library-panel .playlist-row'))
    rows[index]?.querySelectorAll<HTMLButtonElement>('.queue-order-actions button')?.[2]?.click()
  }

  const playRemote = (item: RemoteQueueItem) => {
    requestRemotePlayback(item)
    setStatus(`${item.title} を${item.provider === 'youtube' ? 'YouTube公式Player' : `${item.provider} Player`}へ送りました。`)
  }

  const moveRemote = (provider: RemoteProviderId, sourceId: string, direction: -1 | 1) => {
    setManualRemote((current) => {
      const index = current.findIndex((item) => item.provider === provider && item.sourceId === sourceId)
      const targetIndex = index + direction
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(targetIndex, 0, moved)
      saveRemoteQueue(next)
      return next
    })
  }

  const removeRemote = (provider: RemoteProviderId, sourceId: string) => {
    setManualRemote((current) => {
      const next = current.filter((item) => item.provider !== provider || item.sourceId !== sourceId)
      saveRemoteQueue(next)
      return next
    })
  }

  if (!target) return null

  const total = locals.length + remoteItems.length

  return createPortal(
    <section className="unified-play-queue" aria-label="現在の再生キュー">
      <div className="unified-play-queue-heading">
        <div>
          <p className="eyebrow">PLAY QUEUE</p>
          <h3>次に再生</h3>
          <span>{playlistName ? `Saved Playlist · ${playlistName}` : 'Local / Video をここに集約'}</span>
        </div>
        <b>{total} items</b>
      </div>

      <p className="unified-play-queue-status">{status}</p>

      {total ? (
        <div className="unified-play-queue-list">
          {locals.map((item, index) => (
            <div className={`unified-play-queue-row ${item.current ? 'is-current' : ''}`} key={`local-${item.index}-${item.name}`}>
              <button type="button" className="unified-play-queue-main" onClick={() => playLocal(item.index)}>
                <span className="unified-play-queue-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="unified-play-queue-copy"><strong>{item.name}</strong><small>{item.current ? '再生中 / 選択中' : 'Local media'}</small></span>
                <span className="source-chip">{item.source}</span>
              </button>
              <div className="unified-play-queue-actions">
                <button type="button" disabled={item.index === 0} onClick={() => moveLocal(item.index, -1)}>↑</button>
                <button type="button" disabled={item.index === locals.length - 1} onClick={() => moveLocal(item.index, 1)}>↓</button>
                <button type="button" onClick={() => removeLocal(item.index)}>×</button>
              </div>
            </div>
          ))}

          {remoteItems.map((item, remoteIndex) => {
            const manualIndex = manualRemote.findIndex((candidate) => remoteKey(candidate) === remoteKey(item))
            const globalIndex = locals.length + remoteIndex
            return (
              <div className={`unified-play-queue-row is-remote is-${item.provider}`} key={remoteKey(item)}>
                <button type="button" className="unified-play-queue-main" onClick={() => playRemote(item)}>
                  <span className="unified-play-queue-index">{String(globalIndex + 1).padStart(2, '0')}</span>
                  <span className="unified-play-queue-copy"><strong>{item.title}</strong><small>{item.origin === 'playlist' ? 'Saved Playlistから追加' : `${item.provider} Queue`}</small></span>
                  <span className="source-chip">{item.provider}</span>
                </button>
                <div className="unified-play-queue-actions">
                  {item.origin === 'queue' ? (
                    <>
                      <button type="button" disabled={manualIndex <= 0} onClick={() => moveRemote(item.provider, item.sourceId, -1)}>↑</button>
                      <button type="button" disabled={manualIndex < 0 || manualIndex === manualRemote.length - 1} onClick={() => moveRemote(item.provider, item.sourceId, 1)}>↓</button>
                      <button type="button" onClick={() => removeRemote(item.provider, item.sourceId)}>×</button>
                    </>
                  ) : <span className="unified-play-queue-saved">saved</span>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="unified-play-queue-empty">
          <strong>Queue is empty.</strong>
          <span>Library・Video Search・録音などで選んだメディアがここに集まります。</span>
        </div>
      )}
    </section>,
    target,
  )
}

export default UnifiedPlaybackQueue
