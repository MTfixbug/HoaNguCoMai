export type Register = 'formal' | 'spoken' | 'neutral'

export interface Example {
  zh: string
  pinyin: string
  vi: string
}
export interface Synonym {
  hanzi: string
  pinyin: string
  meaningVi: string
  nuanceVi: string
}
export interface WordRef {
  hanzi: string
  pinyin: string
  meaningVi: string
}
export interface Expansion {
  synonyms: Synonym[]
  antonyms: WordRef[]
  collocations: Example[]
  relatedWords: WordRef[]
  examples: Example[]
}
export interface VocabItem {
  id: string
  hanzi: string
  pinyin: string
  pos: string
  meaningVi: string
  hanViet?: string
  isExtra: boolean
  register?: Register
  expansion: Expansion
}
export interface TextParagraph {
  id: string
  zh: string
  pinyin: string
  vi: string
  vocabIdsInParagraph: string[]
}
export interface MiniPractice {
  id: string
  prompt: string
  answer: string
  explanationVi: string
}
export interface GrammarNote {
  id: string
  title: string
  pattern: string
  explanationVi: string
  examples: Example[]
  miniPractice?: MiniPractice[]
}
export interface ComparisonQuiz {
  id: string
  sentence: string
  options: string[]
  answer: number
  explanationVi: string
}
export interface WordComparison {
  id: string
  wordA: string
  wordB: string
  similarities: string[]
  differences: { pointA: string; pointB: string; examplesA?: string[]; examplesB?: string[] }[]
  miniQuiz?: ComparisonQuiz[]
}
export type ExerciseType = 'fill_blank_passage' | 'word_choice' | 'error_sentence' | 'comprehension'
export interface ExerciseItem {
  id: string
  type: ExerciseType
  instructionVi: string
  wordBank?: string[]
  passage?: string
  blanks?: { id: string; answer: string }[]
  question?: string
  sentence?: string
  options?: string[]
  answer: string | string[]
  explanationVi: string
  answerSource?: 'book' | 'derived'
}
export interface Warmup {
  promptZh: string
  promptVi: string
  scenarios: string[]
  wordGroups: { char: string; words: string[] }[]
}
export interface Lesson {
  id: string
  number: number
  titleZh: string
  titlePinyin: string
  titleVi: string
  source: string
  charCount: number
  textSource: string
  warmup: Warmup
  text: TextParagraph[]
  vocab: VocabItem[]
  grammar: GrammarNote[]
  comparisons: WordComparison[]
  exercises: ExerciseItem[]
  writingPrompt: string
}
export interface ManifestLesson {
  id: string
  number: number
  titleZh: string
  titleVi: string
  file: string
  ready: boolean
  vocabCount: number
}
export interface Manifest {
  version: number
  book: string
  lessons: ManifestLesson[]
}
