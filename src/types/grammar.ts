export interface ConfusablePair {
  pair: string
  distinction: string
}

export interface GrammarExample {
  zh: string
  pinyin: string
  vi: string
}

export type GrammarExerciseType = 'mcq' | 'fill' | 'order'

export interface GrammarExercise {
  id: string
  type: GrammarExerciseType
  prompt: string
  options?: string[]
  tokens?: string[]
  answer: string
  explanation: string
}

export interface GrammarPoint {
  id: string
  hskLevel: 1 | 2 | 3
  category: string
  topic: string
  title: string
  formula: string
  explanationVi: string
  viComparison: string
  confusablePairs: ConfusablePair[]
  examples: GrammarExample[]
  exercises: GrammarExercise[]
  reviewed: boolean
}

export interface GrammarMeta {
  version: number
  counts: Record<'hsk-1' | 'hsk-2' | 'hsk-3', number>
  totalExercises: number
}
