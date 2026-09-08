import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { announcePlaylistChanged, onPlaylistChanged, requestLoadYouTubeSource } from './mediaSourceBridge'
import {
  listPlaylists,
  playlistEntries,
  playlistWithEntries,
  savePlaylist,
  type StoredPlaylist,
  type YouTubePlaylistEntry,
} from './playlistDb'

function UnifiedPlaylistSources() {
  const [portalTarget, setPortalTarget] = useState<Element | null>(null)
  const [playlists, setPlaylists] = useState<StoredPlaylist[]>([])
  const [status, setStatus] = useState('YouTube URLも同じ名前付きプレイリストへ追加できます。')

  const refresh = async () => {
    try {
      setPlaylists(await listPlaylists())
    } catch (error) {
      setStatus(error instanceof Error ? `プレイリストを読み込めませんでした: ${error.message}` : 'プレイリストを読み込めませんでした。')
    }
  }

  useEffect(() => {
    const resolveTarget = () => {
      const next = document.querySelector('.named-playlists-card')
      setPortalTarget((current) => current === next ? current : next)
    }
    resolveTarget()
    const observer = new MutationObserver(resolveTarget)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    void refresh()
    const unsubscribe = onPlaylistChanged(() => void refresh())
    const interval = window.setInterval(() => void refresh(), 2000)
    const handleFocus = () => void refresh()
    window.addEventListener('focus', handleFocus)
    return () => {
      unsubscribe()
      window.clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  const mixed = useMemo(() => playlists
    .map((playlist) => ({
      playlist,
      entries: playlistEntries(playlist),
    }))
    .map(({ playlist, entries }) => ({
      playlist,
      localCount: entries.filter((entry) => entry.kind === 'local').length,
      youtube: entries.filter((entry): entry is YouTubePlaylistEntry => entry.kind === 'youtube'),
    }))
    .filter((item) => item.youtube.length > 0), [playlists])

  const removeYouTube = async (playlist: StoredPlaylist, videoId: string) => {
    try {
      const entries = playlistEntries(playlist).filter((entry) => entry.kind !== 'youtube' || entry.videoId !== videoId)
      await savePlaylist({ ...playlistWithEntries(playlist, entries), updatedAt: Date.now() })
      setStatus('YouTube URLをプレイリストから外しました。')
      announcePlaylistChanged()
      await refresh()
    } catch (error) {
      setStatus(error instanceof Error ? `削除できませんでした: ${error.message}` : '削除できませんでした。')
    }
  }

  if (!portalTarget) return null

  return createPortal(
    <div className="mixed-playlist-sources">
      <div className="mixed-playlist-heading">
        <div>
          <p className="eyebrow">MIXED SOURCES</p>
          <strong>Local + YouTube</strong>
        </div>
        <span>{mixed.reduce((sum, item) => sum + item.youtube.length, 0)} YouTube</span>
      </div>
      <p className="mixed-playlist-status">{status}</p>

      {mixed.length > 0 ? (
        <div className="mixed-playlist-groups">
          {mixed.map(({ playlist, localCount, youtube }) => (
            <div className="mixed-playlist-group" key={playlist.id}>
              <div className="mixed-playlist-group-title">
                <strong>{playlist.name}</strong>
                <span>{localCount} local + {youtube.length} YouTube</span>
              </div>
              <div className="mixed-youtube-list">
                {youtube.map((entry) => (
                  <div className="mixed-youtube-row" key={`${playlist.id}-${entry.videoId}`}>
                    <button
                      type="button"
                      className="mixed-youtube-main"
                      onClick={() => {
                        requestLoadYouTubeSource(entry)
                        window.setTimeout(() => document.getElementById('youtube-provider-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
                      }}
                    >
                      <span className="source-chip">youtube</span>
                      <span>
                        <strong>{entry.title || entry.videoId}</strong>
                        <small>{entry.url}</small>
                      </span>
                    </button>
                    <button type="button" className="mixed-youtube-delete" onClick={() => void removeYouTube(playlist, entry.videoId)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mixed-playlist-empty">YouTubeパネルから名前付きプレイリストへURLを追加すると、ここに表示されます。</p>
      )}
    </div>,
    portalTarget,
  )
}

export default UnifiedPlaylistSources
