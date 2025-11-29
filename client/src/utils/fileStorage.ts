const DB_NAME = 'side-by-side-file-storage'
const STORE_NAME = 'dropped-files'
const KEY = 'pending-files'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

export async function saveFilesToStorage(files: File[]): Promise<void> {
  try {
    const fileData = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer()
        return {
          name: file.name,
          type: file.type,
          lastModified: file.lastModified,
          size: file.size,
          data: arrayBuffer,
        }
      })
    )

    const db = await openDB()
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.put(fileData, KEY)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      transaction.onerror = () => reject(transaction.error)
    })
  } catch (error) {
    console.error('[fileStorage] Error saving files:', error)
    throw error
  }
}

export async function loadFilesFromStorage(): Promise<File[] | null> {
  try {
    const db = await openDB()
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.get(KEY)
      request.onsuccess = () => {
        const fileData = request.result
        if (!fileData || !Array.isArray(fileData) || fileData.length === 0) {
          resolve(null)
          return
        }

        const files = fileData.map(
          (data: {
            name: string
            type: string
            lastModified: number
            size: number
            data: ArrayBuffer
          }) => {
            const blob = new Blob([data.data], { type: data.type })
            return new File([blob], data.name, {
              type: data.type,
              lastModified: data.lastModified,
            })
          }
        )

        resolve(files)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('[fileStorage] Error loading files:', error)
    return null
  }
}

export async function clearFilesFromStorage(): Promise<void> {
  try {
    const db = await openDB()
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.delete(KEY)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('[fileStorage] Error clearing files:', error)
    // Не пробрасываем ошибку, так как очистка не критична
  }
}

