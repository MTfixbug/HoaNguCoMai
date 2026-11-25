import { rowToEntry, type DictEntry, type VocabChunkKey, type VocabIndexRow, type VocabMeta } from '../types/vocab'

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/')
const chunkCache = new Map<VocabChunkKey, Promise<DictEntry[]>>()
let metaCache: Promise<VocabMeta> | null = null
let indexCache: Promise<DictEntry[]> | null = null

async function fetchJson<T>(relPath: string): Promise<T> {
  const url = `${BASE}data/${relPath.replace(/^\//, '')}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Không tải được ${url} (${res.status})`)
  return res.json() as Promise<T>
}

export function loadVocabMeta(): Promise<VocabMeta> {
  if (!metaCache) metaCache = fetchJson<VocabMeta>('vocab/vocab-meta.json')
  return metaCache
}

export function loadVocabChunk(key: VocabChunkKey): Promise<DictEntry[]> {
  let p = chunkCache.get(key)
  if (!p) {
    p = fetchJson<DictEntry[]>(`vocab/${key}.json`)
    chunkCache.set(key, p)
  }
  return p
}

export function loadSearchIndex(): Promise<DictEntry[]> {
  if (!indexCache) {
    indexCache = fetchJson<VocabIndexRow[]>('vocab/search-index.json').then((rows) => rows.map(rowToEntry))
  }
  return indexCache
}

export function levelToChunkKey(hskLevel: number): VocabChunkKey {
  if (hskLevel <= 1) return 'hsk-1'
  if (hskLevel === 2) return 'hsk-2'
  if (hskLevel === 3) return 'hsk-3'
  if (hskLevel === 4) return 'hsk-4'
  if (hskLevel === 5) return 'hsk-5'
  if (hskLevel === 6) return 'hsk-6'
  return 'hsk-7-9'
}
