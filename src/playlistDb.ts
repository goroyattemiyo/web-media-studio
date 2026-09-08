import { openAppDatabase, PLAYLIST_STORE, waitForTransaction } from './appDb'

export type LocalPlaylistEntry = {
  kind: 'local'
  mediaId: string
}

export type YouTubePlaylistEntry = {
  kind: 'youtube'
  videoId: string
  url: string
  title: string
}

export type StoredPlaylistEntry = LocalPlaylistEntry | YouTubePlaylistEntry

export type StoredPlaylist = {
  id: string
  name: string
  mediaIds: string[]
  entries?: StoredPlaylistEntry[]
  createdAt: number
  updatedAt: number
}

export function playlistEntries(playlist: StoredPlaylist): StoredPlaylistEntry[] {
  if (Array.isArray(playlist.entries)) return playlist.entries
  return playlist.mediaIds.map((mediaId) => ({ kind: 'local' as const, mediaId }))
}

export function playlistWithEntries(playlist: StoredPlaylist, entries: StoredPlaylistEntry[]): StoredPlaylist {
  return {
    ...playlist,
    entries,
    mediaIds: entries.filter((entry): entry is LocalPlaylistEntry => entry.kind === 'local').map((entry) => entry.mediaId),
  }
}

function normalizePlaylistForSave(playlist: StoredPlaylist): StoredPlaylist {
  if (!Array.isArray(playlist.entries)) return playlist

  const youtubeEntries = playlist.entries.filter((entry): entry is YouTubePlaylistEntry => entry.kind === 'youtube')
  const localEntries: LocalPlaylistEntry[] = playlist.mediaIds.map((mediaId) => ({ kind: 'local', mediaId }))
  return {
    ...playlist,
    entries: [...localEntries, ...youtubeEntries],
  }
}

export async function listPlaylists(): Promise<StoredPlaylist[]> {
  const database = await openAppDatabase()
  try {
    const transaction = database.transaction(PLAYLIST_STORE, 'readonly')
    const request = transaction.objectStore(PLAYLIST_STORE).getAll()

    const records = await new Promise<StoredPlaylist[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as StoredPlaylist[])
      request.onerror = () => reject(request.error ?? new Error('Playlists could not be read.'))
    })

    await waitForTransaction(transaction)
    return records.sort((a, b) => b.updatedAt - a.updatedAt)
  } finally {
    database.close()
  }
}

export async function savePlaylist(playlist: StoredPlaylist): Promise<void> {
  const database = await openAppDatabase()
  try {
    const transaction = database.transaction(PLAYLIST_STORE, 'readwrite')
    transaction.objectStore(PLAYLIST_STORE).put(normalizePlaylistForSave(playlist))
    await waitForTransaction(transaction)
  } finally {
    database.close()
  }
}

export async function deletePlaylist(id: string): Promise<void> {
  const database = await openAppDatabase()
  try {
    const transaction = database.transaction(PLAYLIST_STORE, 'readwrite')
    transaction.objectStore(PLAYLIST_STORE).delete(id)
    await waitForTransaction(transaction)
  } finally {
    database.close()
  }
}

export async function removeMediaFromPlaylists(mediaId: string): Promise<void> {
  const playlists = await listPlaylists()
  const affected = playlists.filter((playlist) => (
    playlist.mediaIds.includes(mediaId)
    || playlistEntries(playlist).some((entry) => entry.kind === 'local' && entry.mediaId === mediaId)
  ))
  if (!affected.length) return

  const database = await openAppDatabase()
  try {
    const transaction = database.transaction(PLAYLIST_STORE, 'readwrite')
    const store = transaction.objectStore(PLAYLIST_STORE)
    const updatedAt = Date.now()

    affected.forEach((playlist, index) => {
      const entries = playlistEntries(playlist).filter((entry) => entry.kind !== 'local' || entry.mediaId !== mediaId)
      store.put({
        ...playlistWithEntries(playlist, entries),
        updatedAt: updatedAt + index,
      })
    })

    await waitForTransaction(transaction)
  } finally {
    database.close()
  }
}
