export const DB_NAME = 'web-media-studio'
export const DB_VERSION = 3
export const RECORDING_STORE = 'recording-takes'
export const MEDIA_LIBRARY_STORE = 'media-library'
export const PLAYLIST_STORE = 'saved-playlists'

export function openAppDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(RECORDING_STORE)) {
        const recordingStore = database.createObjectStore(RECORDING_STORE, { keyPath: 'id' })
        recordingStore.createIndex('createdAt', 'createdAt')
      }

      if (!database.objectStoreNames.contains(MEDIA_LIBRARY_STORE)) {
        const mediaStore = database.createObjectStore(MEDIA_LIBRARY_STORE, { keyPath: 'id' })
        mediaStore.createIndex('savedAt', 'savedAt')
        mediaStore.createIndex('name', 'name')
      }

      if (!database.objectStoreNames.contains(PLAYLIST_STORE)) {
        const playlistStore = database.createObjectStore(PLAYLIST_STORE, { keyPath: 'id' })
        playlistStore.createIndex('updatedAt', 'updatedAt')
        playlistStore.createIndex('name', 'name')
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened.'))
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another tab. Close other Web Media Studio tabs and retry.'))
  })
}

export function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'))
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
  })
}
