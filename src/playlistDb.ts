import { openAppDatabase, PLAYLIST_STORE, waitForTransaction } from './appDb'

export type StoredPlaylist = {
  id: string
  name: string
  mediaIds: string[]
  createdAt: number
  updatedAt: number
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
    transaction.objectStore(PLAYLIST_STORE).put(playlist)
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
  const affected = playlists.filter((playlist) => playlist.mediaIds.includes(mediaId))
  if (!affected.length) return

  const database = await openAppDatabase()
  try {
    const transaction = database.transaction(PLAYLIST_STORE, 'readwrite')
    const store = transaction.objectStore(PLAYLIST_STORE)
    const updatedAt = Date.now()

    affected.forEach((playlist, index) => {
      store.put({
        ...playlist,
        mediaIds: playlist.mediaIds.filter((id) => id !== mediaId),
        updatedAt: updatedAt + index,
      })
    })

    await waitForTransaction(transaction)
  } finally {
    database.close()
  }
}
