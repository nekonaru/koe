export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  language: string
  model: string
  task: 'transcribe' | 'translate'
  format: string
  displayMode: 'lines' | 'karaoke'
  segments: Array<{ startMs: number; endMs: number; text: string; speaker?: number }>
  words?: Array<{ startMs: number; endMs: number; text: string }>
  notes: string
  favorite: boolean
  durationSec: number | null
  sizeBytes: number
  keepAudio: boolean
  translations?: string[]
  translationLang?: string
  glossary?: string
  detectedLanguage?: string
}

const DB_NAME = 'koe-projects'
const DB_VERSION = 1
const PROJECT_STORE = 'projects'
const AUDIO_STORE = 'audio'

let dbPromise: Promise<IDBDatabase | null> | null = null

function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = (async () => {
    if (!hasIndexedDb()) return null
    try {
      return await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(PROJECT_STORE)) {
            const store = db.createObjectStore(PROJECT_STORE, { keyPath: 'id' })
            store.createIndex('updatedAt', 'updatedAt')
          }
          if (!db.objectStoreNames.contains(AUDIO_STORE)) {
            db.createObjectStore(AUDIO_STORE, { keyPath: 'id' })
          }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        request.onblocked = () => reject(request.error)
      })
    } catch {
      return null
    }
  })()
  return dbPromise
}

async function readRequest<T>(
  storeName: string,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly')
      const request = action(tx.objectStore(storeName))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      tx.onerror = () => resolve(null)
      tx.onabort = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function writeRequest<T>(storeName: string, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite')
      action(tx.objectStore(storeName))
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function listProjects(): Promise<Project[]> {
  try {
    const result = await readRequest<Project[]>('projects', (store) => store.index('updatedAt').getAll() as IDBRequest<Project[]>)
    if (!Array.isArray(result)) return []
    return result
      .filter((project) => project !== null && typeof project === 'object' && typeof project.id === 'string')
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  } catch {
    return []
  }
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    if (typeof id !== 'string' || id.length === 0) return null
    const result = await readRequest<Project | undefined>('projects', (store) => store.get(id) as IDBRequest<Project | undefined>)
    return result && typeof result === 'object' ? result : null
  } catch {
    return null
  }
}

export async function saveProject(project: Project): Promise<void> {
  try {
    if (!project || typeof project.id !== 'string' || project.id.length === 0) return
    await writeRequest('projects', (store) => store.put(project))
  } catch {
    // Storage failures are non-fatal.
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    if (typeof id !== 'string' || id.length === 0) return
    await writeRequest('projects', (store) => store.delete(id))
  } catch {
    // Storage failures are non-fatal.
  }
}

interface AudioRecord {
  id: string
  blob: Blob
}

export async function putAudio(id: string, blob: Blob): Promise<void> {
  try {
    if (typeof id !== 'string' || id.length === 0 || !blob) return
    await writeRequest('audio', (store) => store.put({ id, blob } satisfies AudioRecord))
  } catch {
    // Storage failures are non-fatal.
  }
}

export async function getAudio(id: string): Promise<Blob | null> {
  try {
    if (typeof id !== 'string' || id.length === 0) return null
    const record = await readRequest<AudioRecord | undefined>('audio', (store) => store.get(id) as IDBRequest<AudioRecord | undefined>)
    const blob = record?.blob
    if (!blob || typeof blob.arrayBuffer !== 'function') return null
    return blob
  } catch {
    return null
  }
}

export async function deleteAudio(id: string): Promise<void> {
  try {
    if (typeof id !== 'string' || id.length === 0) return
    await writeRequest('audio', (store) => store.delete(id))
  } catch {
    // Storage failures are non-fatal.
  }
}

export async function estimateStorage(): Promise<{ usage: number; quota: number }> {
  const fallback = { usage: 0, quota: 0 }
  try {
    if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.estimate !== 'function') {
      return fallback
    }
    const result = await navigator.storage.estimate()
    return {
      usage: Number.isFinite(result.usage) ? result.usage ?? 0 : 0,
      quota: Number.isFinite(result.quota) ? result.quota ?? 0 : 0,
    }
  } catch {
    return fallback
  }
}
