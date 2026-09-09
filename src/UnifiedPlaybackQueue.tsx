import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { onPlaylistChanged, requestLoadYouTubeSource } from './mediaSourceBridge'
import { listPlaylists, playlistEntries, type YouTubePlaylistEntry } from './playlistDb'
import { onAddYouTubeToPlayQueue, onClearYouTubePlayQueue, type QueueYouTubeSource } from './playQueueBridge'

const YOUTUBE_QUEUE_KEY = 'wms-unified-youtube-queue-v1'

type LocalQueueItem = {
  index: number
  name: string
  source: string
  current: boolean
}

type YouTubeQueueItem = QueueYouTubeSource & {
  origin: 'queue' | 'playlist'
}

function loadYouTubeQueue(): QueueYouTubeSource[] {
  try {
    const raw = window.localStorage.getItem(YOUTUBE_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as QueueYouTubeSource[]
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.videoId === 'string' && typeof item.url === 'string' && typeof item.title === 'string')
      : []
  } catch {
    return []
  }
}

function saveYouTubeQueue(items: QueueYouTubeSource[]) {
  try {
    window.localStorage.setItem(YOUTUBE_QUEUE_KEY, JSON.stringify(items))
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

function UnifiedPlaybackQueue() {
  const [target, setTarget] = useState<Element | null>(null)
  const [locals, setLocals] = useState<LocalQueueItem[]>([])
  const [manualYouTube, setManualYouTube] = useState<QueueYouTubeSource[]>(loadYouTubeQueue)
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
    const removeAddListener = onAddYouTubeToPlayQueue((detail) => {
      setManualYouTube((current) => {
        if (current.some((item) => item.videoId === detail.videoId)) {
          setStatus(`${detail.title} はすでにPlay Queueにあります。`)
          return current
        }
        const next = [...current, detail]
        saveYouTubeQueue(next)
        setStatus(`${detail.title} をPlay Queueへ追加しました。`)
        return next
      })
    })
    const removeClearListener = onClearYouTubePlayQueue(() => {
      setManualYouTube([])
      saveYouTubeQueue([])
    })
    return () => {
      removeAddListener()
      removeClearListener()
    }
  }, [])

  const youtubeItems = useMemo<YouTubeQueueItem[]>(() => {
    const seen = new Set<string>()
    const result: YouTubeQueueItem[] = []

    for (const item of manualYouTube) {
      if (seen.has(item.videoId)) continue
      seen.add(item.videoId)
      result.push({ ...item, origin: 'queue' })
    }
    for (const item of playlistYouTube) {
      if (seen.has(item.videoId)) continue
      seen.add(item.videoId)
      result.push({ ...item, origin: 'playlist' })
    }
    return result
  }, [manualYouTube, playlistYouTube])

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

  const playYouTube = (item: YouTubeQueueItem) => {
    requestLoadYouTubeSource(item)
    setStatus(`${item.title} をYouTube公式Playerへ送りました。`)

    let attempts = 0
    const tryPlay = () => {
      attempts += 1
      const play = document.querySelector<HTMLButtonElement>('#youtube-provider-panel .youtube-transport .primary')
      if (play && !play.disabled) {
        play.click()
        return
      }
      if (attempts < 24) window.setTimeout(tryPlay, 160)
    }
    window.setTimeout(tryPlay, 100)
  }

  const moveYouTube = (videoId: string, direction: -1 | 1) => {
    setManualYouTube((current) => {
      const index = current.findIndex((item) => item.videoId === videoId)
      const targetIndex = index + direction
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(targetIndex, 0, moved)
      saveYouTubeQueue(next)
      return next
    })
  }

  const removeYouTube = (videoId: string) => {
    setManualYouTube((current) => {
      const next = current.filter((item) => item.videoId !== videoId)
      saveYouTubeQueue(next)
      return next
    })
  }

  if (!target) return null

  const total = locals.length + youtubeItems.length

  return createPortal(
    <section className="unified-play-queue" aria-label="現在の再生キュー">
      <div className="unified-play-queue-heading">
        <div>
          <p className="eyebrow">PLAY QUEUE</p>
          <h3>次に再生</h3>
          <span>{playlistName ? `Saved Playlist · ${playlistName}` : 'Local / YouTube をここに集約'}</span>
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

          {youtubeItems.map((item, youtubeIndex) => {
            const manualIndex = manualYouTube.findIndex((candidate) => candidate.videoId === item.videoId)
            const globalIndex = locals.length + youtubeIndex
            return (
              <div className="unified-play-queue-row is-youtube" key={`youtube-${item.videoId}`}>
                <button type="button" className="unified-play-queue-main" onClick={() => playYouTube(item)}>
                  <span className="unified-play-queue-index">{String(globalIndex + 1).padStart(2, '0')}</span>
                  <span className="unified-play-queue-copy"><strong>{item.title}</strong><small>{item.origin === 'playlist' ? 'Saved Playlistから追加' : 'YouTube Queue'}</small></span>
                  <span className="source-chip">youtube</span>
                </button>
                <div className="unified-play-queue-actions">
                  {item.origin === 'queue' ? (
                    <>
                      <button type="button" disabled={manualIndex <= 0} onClick={() => moveYouTube(item.videoId, -1)}>↑</button>
                      <button type="button" disabled={manualIndex < 0 || manualIndex === manualYouTube.length - 1} onClick={() => moveYouTube(item.videoId, 1)}>↓</button>
                      <button type="button" onClick={() => removeYouTube(item.videoId)}>×</button>
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
          <span>Library・YouTube・録音などで選んだメディアがここに集まります。</span>
        </div>
      )}
    </section>,
    target,
  )
}

export default UnifiedPlaybackQueue
