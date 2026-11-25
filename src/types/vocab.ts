export type VocabChunkKey = 'hsk-1' | 'hsk-2' | 'hsk-3' | 'hsk-4' | 'hsk-5' | 'hsk-6' | 'hsk-7-9'

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
]

export function rowToEntry(r: VocabIndexRow): DictEntry {
  return {
    id: r[0],
    hanzi: r[1],
    pinyin: r[2],
    pinyinPlain: r[3],
    hanViet: r[4],
    meaningVi: r[5],
    meaningEn: '',
    hskNum: r[6],
    hskLevel: r[7],
    pos: r[8],
    ...(r[9] > 0 ? { bookLesson: r[9] } : {}),
  }
}

export interface VocabMeta {
  version: number
  total: number
  chunks: Record<VocabChunkKey, number>
}
