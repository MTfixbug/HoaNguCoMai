export type VocabChunkKey = 'hsk-1' | 'hsk-2' | 'hsk-3' | 'hsk-4' | 'hsk-5' | 'hsk-6' | 'hsk-7-9' | 'extra'

export type HskStandard = '3.0' | '2.0'

export interface DictEntry {
  id: string
  hanzi: string
  pinyin: string
  pinyinPlain: string
  hanViet: string
  meaningVi: string
  meaningEn: string
  pos: string
  hskNum: number
  hskLevel: string
  hsk3Level?: number
  hsk2Level?: number
  source?: 'core' | 'extra'
  topic?: string
  reviewed?: boolean
  bookLesson?: number
  exampleZh?: string
  exampleVi?: string
}

export type VocabIndexRow = [
  id: string,
  hanzi: string,
  pinyin: string,
  pinyinPlain: string,
  hanViet: string,
  meaningVi: string,
  hskNum: number,
  hskLevel: string,
  pos: string,
  bookLesson: number,
  source?: 'core' | 'extra',
  hsk2Level?: number,
  topic?: string,
  reviewed?: number,
]

export function rowToEntry(r: VocabIndexRow): DictEntry {
  const source = r[10] ?? 'core'
  const hsk2 = r[11] && r[11] > 0 ? r[11] : undefined
  const topic = r[12] || undefined
  const reviewed = r[13] === undefined ? true : r[13] !== 0
  return {
    id: r[0],
    hanzi: r[1],
    pinyin: r[2],
    pinyinPlain: r[3],
    hanViet: r[4],
    meaningVi: r[5],
    meaningEn: '',
    pos: r[8],
    hskNum: r[6],
    hskLevel: r[7],
    ...(r[6] >= 1 && r[6] <= 7 && source === 'core' ? { hsk3Level: r[6] } : {}),
    ...(hsk2 ? { hsk2Level: hsk2 } : {}),
    source,
    ...(topic ? { topic } : {}),
    reviewed,
    ...(r[9] > 0 ? { bookLesson: r[9] } : {}),
  }
}

export interface VocabMeta {
  version: number
  standard?: string
  total: number
  coreTotal?: number
  extraTotal?: number
  slangTotal?: number
  chunks: Record<VocabChunkKey, number>
  hsk3CoreCumulative?: Record<string, number>
  hsk2Counts?: Record<string, number>
}

export interface ExampleSentence {
  id: string
  wordId: string
  hanzi: string
  hskNum: number
  zh: string
  pinyin: string
  vi: string
  en?: string
  source: 'tatoeba-vi' | 'tatoeba-en-vi'
  tatoebaId: string
  audioUrl?: string
  reviewed?: boolean
}
