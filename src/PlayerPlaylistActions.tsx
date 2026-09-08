import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { listMediaLibraryItems } from './mediaLibraryDb'
import { announcePlaylistChanged } from './mediaSourceBridge'
import {
  listPlaylists,
  playlistEntries,
  playlistWithEntries,
  savePlaylist,
  type StoredPlaylist,
  type StoredPlaylistEntry,
} from './playlistDb'
import { parseYouTubeInput, youtubeWatchUrl } from './providers/youtube'

type ActiveKind = 'local' | 'youtube'

function emitSystem(text: string, level: 'info' | 'success' | 'error' = 'info') {
  window.dispatchEvent(new CustomEvent('wms:system-message', {
    detail: { text, source: 'Playlist', level },
  }))
}

function currentYouTubeEntry(): StoredPlaylistEntry | null {
  const input = document.querySelector<HTMLInputElement>('#youtube-provider-panel .youtube-url-form input')
  const raw = input?.value.trim() || window.localStorage.getItem('wms-youtube-last-url')?.trim() || ''
  const parsed = parseYouTubeInput(raw)
  if (!parsed) return null
  const title = document.querySelector<HTMLElement>('#youtube-provider-panel .youtube-track-info strong')?.textContent?.trim()
  return {
    kind: 'youtube',
    videoId: parsed.videoId,
    url: youtubeWatchUrl(parsed.videoId),
    title: title || `YouTube ${parsed.videoId}`,
  }
}

async function currentLocalEntry(): Promise<StoredPlaylistEntry | null> {
  const current = document.querySelector<HTMLElement>('#library-panel .playlist-row .playlist-item.is-current')
  const row = current?.closest<HTMLElement>('.playlist-row')
  const name = row?.querySelector<HTMLElement>('.playlist-name')?.textContent?.trim()
  if (!name) return null
  const relativePath = row.querySelector<HTMLElement>('.playlist-copy small')?.textContent?.trim() || null
  const records = await listMediaLibraryItems()
  const exact = records.find((item) => item.name === name && (relativePath ? item.relativePath === relativePath : true))
  return exact ? { kind: 'local', mediaId: exact.id } : null
}

function entryLabel(entry: StoredPlaylistEntry | null) {
  if (!entry) return '再生中の保存メディア'
  if (entry.kind === 'youtube') return entry.title
  const current = document.querySelector<HTMLElement>('#library-panel .playlist-row .playlist-item.is-current .playlist-name')
  return current?.textContent?.trim() || '保存済みメディア'
}

export default function PlayerPlaylistActions() {
  const [target, setTarget] = useState<Element | null>(null)
  const [open, setOpen] = useState(false)
  const [playlists, setPlaylists] = useState<StoredPlaylist[]>([])
  const [targetId, setTargetId] = useState('')
  const [activeKind, setActiveKind] = useState<ActiveKind>('local')
  const [activeEntry, setActiveEntry] = useState<StoredPlaylistEntry | null>(null)
  const [busy, setBusy] = useState(false)

  const refreshPlaylists = async () => {
    try {
      const next = await listPlaylists()
      setPlaylists(next)
      setTargetId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id ?? '')
    } catch {
      emitSystem('プレイリストを読み込めませんでした。', 'error')
    }
  }

  const refreshActive = async (kind = activeKind) => {
    if (kind === 'youtube') {
      setActiveEntry(currentYouTubeEntry())
      return
    }
    setActiveEntry(await currentLocalEntry())
  }

  useEffect(() => {
    const resolve = () => setTarget(document.querySelector('.unified-play-queue-heading'))
    resolve()
    const observer = new MutationObserver(resolve)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target : null
      if (!element) return
      if (element.closest('.unified-play-queue-row.is-youtube .unified-play-queue-main, #youtube-provider-panel .youtube-transport .primary')) {
        setActiveKind('youtube')
        window.setTimeout(() => void refreshActive('youtube'), 120)
        return
      }
      if (element.closest('.unified-play-queue-row:not(.is-youtube) .unified-play-queue-main, #library-panel .playlist-item, #player-panel .play-button')) {
        setActiveKind('local')
        window.setTimeout(() => void refreshActive('local'), 80)
      }
    }

    const handlePlay = (event: Event) => {
      if (event.target instanceof HTMLMediaElement && event.target.closest('#player-panel')) {
        setActiveKind('local')
        window.setTimeout(() => void refreshActive('local'), 40)
      }
    }

    document.addEventListener('click', handleClick, true)
    document.addEventListener('play', handlePlay, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('play', handlePlay, true)
    }
  }, [activeKind])

  useEffect(() => {
    if (!open) return
    void refreshPlaylists()
    void refreshActive()
  }, [open, activeKind])

  const addCurrent = async () => {
    if (busy) return
    const playlist = playlists.find((item) => item.id === targetId)
    if (!playlist) {
      emitSystem('先にLibraryでプレイリストを作成してください。')
      return
    }

    const entry = activeKind === 'youtube' ? currentYouTubeEntry() : await currentLocalEntry()
    if (!entry) {
      emitSystem(activeKind === 'local' ? 'プレイリストへ追加できるのは端末内に保存済みの曲です。' : '先にYouTubeを読み込んでください。')
      return
    }

    const entries = playlistEntries(playlist)
    const duplicate = entry.kind === 'youtube'
      ? entries.some((item) => item.kind === 'youtube' && item.videoId === entry.videoId)
      : entries.some((item) => item.kind === 'local' && item.mediaId === entry.mediaId)

    if (duplicate) {
      emitSystem(`${playlist.name} にはすでに追加されています。`)
      return
    }

    setBusy(true)
    try {
      const updated = {
        ...playlistWithEntries(playlist, [...entries, entry]),
        updatedAt: Date.now(),
      }
      await savePlaylist(updated)
      setPlaylists((current) => current.map((item) => item.id === updated.id ? updated : item))
      setActiveEntry(entry)
      announcePlaylistChanged()
      emitSystem(`${entryLabel(entry)} を ${playlist.name} に追加しました。`, 'success')
      setOpen(false)
    } catch (error) {
      emitSystem(error instanceof Error ? `追加できませんでした: ${error.message}` : 'プレイリストへ追加できませんでした。', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!target) return null

  return (
    <>
      {createPortal(
        <button type="button" className="player-playlist-trigger" onClick={() => setOpen(true)}>
          ♡ <span>プレイリスト</span>
        </button>,
        target,
      )}
      {open && createPortal(
        <div className="player-playlist-layer" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}>
          <section className="player-playlist-sheet" role="dialog" aria-modal="true" aria-labelledby="player-playlist-title">
            <div className="player-playlist-sheet-heading">
              <div><p className="eyebrow">PLAYLIST</p><h2 id="player-playlist-title">再生中の曲を追加</h2></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="閉じる">×</button>
            </div>
            <div className="player-playlist-current">
              <span>{activeKind === 'youtube' ? 'YouTube' : 'Player'}</span>
              <strong>{entryLabel(activeEntry)}</strong>
            </div>
            {playlists.length ? (
              <>
                <label className="player-playlist-select">
                  <span>追加先</span>
                  <select value={targetId} disabled={busy} onChange={(event) => setTargetId(event.target.value)}>
                    {playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}
                  </select>
                </label>
                <button type="button" className="player-playlist-add" disabled={busy} onClick={() => void addCurrent()}>
                  {busy ? '追加中…' : '＋ この曲を追加'}
                </button>
              </>
            ) : (
              <div className="player-playlist-empty">
                <strong>プレイリストがまだありません</strong>
                <span>Libraryで名前を付けて1つ作成すると、ここから曲を追加できます。</span>
              </div>
            )}
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}
