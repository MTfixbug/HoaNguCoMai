import {
  rowToEntry,
  type DictEntry,
  type ExampleSentence,
  type HskStandard,
  type VocabChunkKey,
  type VocabIndexRow,
  type VocabMeta,
} from '../types/vocab'
import type { GrammarPoint } from '../types/grammar'
import type { CuratedExamPaper, ExamTrendProfile } from '../types/exam'

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/')
const chunkCache = new Map<VocabChunkKey, Promise<DictEntry[]>>()
const examplesCache = new Map<VocabChunkKey, Promise<ExampleSentence[]>>()
const grammarCache = new Map<number, Promise<GrammarPoint[]>>()
const examPapersCache = new Map<number, Promise<CuratedExamPaper[]>>()
const hsk2LevelCache = new Map<number, Promise<DictEntry[]>>()
let examTrendsCache: Promise<ExamTrendProfile[]> | null = null
let metaCache: Promise<VocabMeta> | null = null
let indexCache: Promise<DictEntry[]> | null = null

export async function fetchStaticJson<T>(relPath: string): Promise<T> {
  const url = `${BASE}data/${relPath.replace(/^\//, '')}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Không tải được ${url} (${res.status})`)
  return res.json() as Promise<T>
}

export function loadVocabMeta(): Promise<VocabMeta> {
  if (!metaCache) metaCache = fetchStaticJson<VocabMeta>('vocab/vocab-meta.json')
  return metaCache
}

export function loadVocabChunk(key: VocabChunkKey): Promise<DictEntry[]> {
  let p = chunkCache.get(key)
  if (!p) {
    p = fetchStaticJson<DictEntry[]>(`vocab/${key}.json`)
    chunkCache.set(key, p)
  }
  return p
}

export function loadSearchIndex(): Promise<DictEntry[]> {
  if (!indexCache) {
    indexCache = fetchStaticJson<VocabIndexRow[]>('vocab/search-index.json').then((rows) => rows.map(rowToEntry))
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

export function loadVocabForLevel(hskLevel: number, standard: HskStandard = '3.0'): Promise<DictEntry[]> {
  if (standard === '3.0' || hskLevel >= 7 || hskLevel <= 0) {
    return loadVocabChunk(levelToChunkKey(hskLevel))
  }
  let cached = hsk2LevelCache.get(hskLevel)
  if (!cached) {
    const keys: VocabChunkKey[] = ['hsk-1', 'hsk-2', 'hsk-3', 'hsk-4', 'hsk-5', 'hsk-6', 'hsk-7-9', 'extra']
    cached = Promise.all(keys.map((k) => loadVocabChunk(k))).then((lists) =>
      lists.flat().filter((w) => w.hsk2Level === hskLevel),
    )
    hsk2LevelCache.set(hskLevel, cached)
  }
  return cached
}

export function loadExamplesChunk(key: VocabChunkKey): Promise<ExampleSentence[]> {
  if (key === 'extra') return Promise.resolve([])
  let p = examplesCache.get(key)
  if (!p) {
    p = fetchStaticJson<ExampleSentence[]>(`examples/${key}.json`).catch(() => [])
    examplesCache.set(key, p)
  }
  return p
}

export function loadGrammarLevel(level: number): Promise<GrammarPoint[]> {
  const clamped = Math.max(1, Math.min(3, level))
  let p = grammarCache.get(clamped)
  if (!p) {
    p = fetchStaticJson<GrammarPoint[]>(`grammar/hsk-${clamped}.json`).catch(() => [])
    grammarCache.set(clamped, p)
  }
  return p
}

export function loadExamPapers(level: number): Promise<CuratedExamPaper[]> {
  const clamped = Math.max(1, Math.min(6, level))
  let p = examPapersCache.get(clamped)
  if (!p) {
    p = fetchStaticJson<CuratedExamPaper[]>(`exams/hsk-${clamped}.json`).catch(() => [])
    examPapersCache.set(clamped, p)
  }
  return p
}

export function loadExamTrends(): Promise<ExamTrendProfile[]> {
  if (!examTrendsCache) {
    examTrendsCache = fetchStaticJson<ExamTrendProfile[]>('exams/trends.json').catch(() => [])
  }
  return examTrendsCache
}
