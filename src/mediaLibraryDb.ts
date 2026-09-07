import { MEDIA_LIBRARY_STORE, openAppDatabase, waitForTransaction } from './appDb'

export type StoredMediaLibraryItem = {
  id: string
  name: string
  kind: 'audio' | 'video'
  mimeType: string
  relativePath: string | null
  savedAt: number
  size: number
  blob: Blob
}

export const MEDIA_LIBRARY_SOFT_LIMIT_BYTES = 500 * 1024 * 1024
export const MEDIA_LIBRARY_MAX_ITEM_BYTES = 250 * 1024 * 1024

export async function listMediaLibraryItems(): Promise<StoredMediaLibraryItem[]> {
  const database = await openAppDatabase()
  try {
    const transaction = database.transaction(MEDIA_LIBRARY_STORE, 'readonly')
    const request = transaction.objectStore(MEDIA_LIBRARY_STORE).getAll()

    const records = await new Promise<StoredMediaLibraryItem[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as StoredMediaLibraryItem[])
      request.onerror = () => reject(request.error ?? new Error('Saved media could not be read.'))
    })

    await waitForTransaction(transaction)
    return records.sort((a, b) => a.savedAt - b.savedAt)
  } finally {
    database.close()
  }
}

export async function saveMediaLibraryItems(items: StoredMediaLibraryItem[]): Promise<void> {
  if (!items.length) return

  const database = await openAppDatabase()
  try {
    const transaction = database.transaction(MEDIA_LIBRARY_STORE, 'readwrite')
    const store = transaction.objectStore(MEDIA_LIBRARY_STORE)
    items.forEach((item) => store.put(item))
    await waitForTransaction(transaction)
  } finally {
    database.close()
  }
}

export async function saveMediaLibraryOrder(orderedIds: string[]): Promise<void> {
  if (!orderedIds.length) return

  const database = await openAppDatabase()
  try {
    const transaction = database.transaction(MEDIA_LIBRARY_STORE, 'readwrite')
    const store = transaction.objectStore(MEDIA_LIBRARY_STORE)
    const request = store.getAll()

    const records = await new Promise<StoredMediaLibraryItem[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as StoredMediaLibraryItem[])
      request.onerror = () => reject(request.error ?? new Error('Saved media order could not be read.'))
    })

    const rank = new Map(orderedIds.map((id, index) => [id, index]))
    const base = Date.now()
    records.forEach((record) => {
      const index = rank.get(record.id)
      if (index !== undefined) store.put({ ...record, savedAt: base + index })
    })

    await waitForTransaction(transaction)
  } finally {
    database.close()
  }
}

export async function deleteMediaLibraryItem(id: string): Promise<void> {
  const database = await openAppDatabase()
  try {
    const transaction = database.transaction(MEDIA_LIBRARY_STORE, 'readwrite')
    transaction.objectStore(MEDIA_LIBRARY_STORE).delete(id)
    await waitForTransaction(transaction)
  } finally {
    database.close()
  }
}

export async function getMediaLibraryBytes(): Promise<number> {
  const items = await listMediaLibraryItems()
  return items.reduce((total, item) => total + item.size, 0)
}
