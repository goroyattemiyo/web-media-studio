export type StoredRecordingTake = {
  id: string
  name: string
  mimeType: string
  durationMs: number
  sourceName: string | null
  sourcePosition: number
  createdAt: number
  blob: Blob
}

const DB_NAME = 'web-media-studio'
const DB_VERSION = 1
const STORE_NAME = 'recording-takes'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened.'))
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another tab.'))
  })
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'))
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
  })
}

export async function listRecordingTakes(): Promise<StoredRecordingTake[]> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    const records = await new Promise<StoredRecordingTake[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as StoredRecordingTake[])
      request.onerror = () => reject(request.error ?? new Error('Saved takes could not be read.'))
    })

    await waitForTransaction(transaction)
    return records.sort((a, b) => b.createdAt - a.createdAt)
  } finally {
    database.close()
  }
}

export async function saveRecordingTake(take: StoredRecordingTake): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(take)
    await waitForTransaction(transaction)
  } finally {
    database.close()
  }
}

export async function deleteRecordingTake(id: string): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(id)
    await waitForTransaction(transaction)
  } finally {
    database.close()
  }
}
