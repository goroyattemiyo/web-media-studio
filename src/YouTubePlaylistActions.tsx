import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { announcePlaylistChanged, onPlaylistChanged } from './mediaSourceBridge'
import {
  listPlaylists,
  playlistEntries,
  playlistWithEntries,
  savePlaylist,
  type StoredPlaylist,
  type YouTubePlaylistEntry,
} from './playlistDb'
import { parseYouTubeInput, youtubeWatchUrl } from './providers/youtube'

const LAST_YOUTUBE_URL_KEY = 'wms-youtube-last-url'

function currentYouTubeSource() {
  const input = document.querySelector<HTMLInputElement>(
    '#youtube-provider-panel input[aria-label="YouTube URL または動画ID"]',
  )
  const raw = input?.value.trim() || window.localStorage.getItem(LAST_YOUTUBE_URL_KEY)?.trim() || ''
  const parsed = parseYouTubeInput(raw)
  if (!parsed) return null

  const title = document.querySelector<HTMLElement>('#youtube-provider-panel .youtube-track-info strong')?.textContent?.trim()
  return {
    videoId: parsed.videoId,
    url: youtubeWatchUrl(parsed.videoId),
    title: title || `YouTube ${parsed.videoId}`,
  }
}

function YouTubePlaylistActions() {
  const [portalTarget, setPortalTarget] = useState<Element | null>(null)
  const [playlists, setPlaylists] = useState<StoredPlaylist[]>([])
  const [targetId, setTargetId] = useState('')
  const [status, setStatus] = useState('名前付きプレイリストへYouTube URLを追加できます。')
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    try {
      const next = await listPlaylists()
      setPlaylists(next)
      setTargetId((current) => current && next.some((playlist) => playlist.id === current) ? current : next[0]?.id ?? '')
    } catch (error) {
      setStatus(error instanceof Error ? `プレイリストを読み込めませんでした: ${error.message}` : 'プレイリストを読み込めませんでした。')
    }
  }

  useEffect(() => {
    const resolveTarget = () => {
      const next = document.querySelector('#youtube-provider-panel')
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

  const addCurrent = async () => {
    if (busy) return
    const source = currentYouTubeSource()
    if (!source) {
      setStatus('先にYouTube URLを入力してください。')
      return
    }

    const playlist = playlists.find((item) => item.id === targetId)
    if (!playlist) {
      setStatus('Libraryで名前付きプレイリストを1つ作成してください。')
      return
    }

    const entries = playlistEntries(playlist)
    if (entries.some((entry) => entry.kind === 'youtube' && entry.videoId === source.videoId)) {
      setStatus(`${playlist.name} にはこのYouTube URLがすでに入っています。`)
      return
    }

    setBusy(true)
    try {
      const youtubeEntry: YouTubePlaylistEntry = { kind: 'youtube', ...source }
      const updated = {
        ...playlistWithEntries(playlist, [...entries, youtubeEntry]),
        updatedAt: Date.now(),
      }
      await savePlaylist(updated)
      setPlaylists((previous) => previous.map((item) => item.id === updated.id ? updated : item))
      setStatus(`${source.title} を ${playlist.name} に追加しました。`)
      announcePlaylistChanged()
    } catch (error) {
      setStatus(error instanceof Error ? `追加できませんでした: ${error.message}` : '追加できませんでした。')
    } finally {
      setBusy(false)
    }
  }

  if (!portalTarget) return null

  return createPortal(
    <div className="youtube-playlist-actions">
      <div className="youtube-playlist-heading">
        <div>
          <strong>Add to playlist</strong>
          <span>Local音声とYouTube URLを同じ名前付きプレイリストへ保存</span>
        </div>
        <b>MIXED</b>
      </div>
      <div className="youtube-playlist-row">
        <select value={targetId} disabled={busy || !playlists.length} onChange={(event) => setTargetId(event.target.value)} aria-label="追加先プレイリスト">
          {playlists.length ? playlists.map((playlist) => (
            <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
          )) : <option value="">プレイリストなし</option>}
        </select>
        <button type="button" disabled={busy || !playlists.length} onClick={() => void addCurrent()}>{busy ? 'Adding…' : '＋ Add'}</button>
      </div>
      <small>{status}</small>
    </div>,
    portalTarget,
  )
}

export default YouTubePlaylistActions
