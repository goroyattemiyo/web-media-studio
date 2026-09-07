import { APPEARANCE_STORE, openAppDatabase, waitForTransaction } from './appDb'

const BACKGROUND_ID = 'ui-background'

export type StoredAppearanceAsset = {
  id: string
  name: string
  mimeType: string
  size: number
  updatedAt: number
  blob: Blob
}

export async function getBackgroundAsset(): Promise<StoredAppearanceAsset | null> {
  const database = await openAppDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(APPEARANCE_STORE, 'readonly')
      const request = transaction.objectStore(APPEARANCE_STORE).get(BACKGROUND_ID)
      request.onsuccess = () => resolve((request.result as StoredAppearanceAsset | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('Background image could not be loaded.'))
    })
  } finally {
    database.close()
  }
}

export async function saveBackgroundAsset(file: File): Promise<StoredAppearanceAsset> {
  const record: StoredAppearanceAsset = {
    id: BACKGROUND_ID,
    name: file.name,
    mimeType: file.type || 'image/*',
    size: file.size,
    updatedAt: Date.now(),
    blob: file,
  }

  const database = await openAppDatabase()
  try {
    const transaction = database.transaction(APPEARANCE_STORE, 'readwrite')
    transaction.objectStore(APPEARANCE_STORE).put(record)
    await waitForTransaction(transaction)
    return record
  } finally {
    database.close()
  }
}

export async function deleteBackgroundAsset(): Promise<void> {
  const database = await openAppDatabase()
  try {
    const transaction = database.transaction(APPEARANCE_STORE, 'readwrite')
    transaction.objectStore(APPEARANCE_STORE).delete(BACKGROUND_ID)
    await waitForTransaction(transaction)
  } finally {
    database.close()
  }
}
