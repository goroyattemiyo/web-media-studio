import { openAppDatabase, RECORDING_STORE, waitForTransaction } from './appDb'

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

export async function listRecordingTakes(): Promise<StoredRecordingTake[]> {
  const database = await openAppDatabase()
  try {
    const transaction = database.transaction(RECORDING_STORE, 'readonly')
    const store = transaction.objectStore(RECORDING_STORE)
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
  const database = await openAppDatabase()
  try {
    const transaction = database.transaction(RECORDING_STORE, 'readwrite')
    transaction.objectStore(RECORDING_STORE).put(take)
    await waitForTransaction(transaction)
  } finally {
    database.close()
  }
}

export async function deleteRecordingTake(id: string): Promise<void> {
  const database = await openAppDatabase()
  try {
    const transaction = database.transaction(RECORDING_STORE, 'readwrite')
    transaction.objectStore(RECORDING_STORE).delete(id)
    await waitForTransaction(transaction)
  } finally {
    database.close()
  }
}
