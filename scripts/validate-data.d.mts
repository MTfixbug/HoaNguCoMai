export interface FileValidationResult {
  name: string
  errors: string[]
}

export function validateVocabBank(dataDir: string): FileValidationResult[]
export function validateAll(dataDir: string): FileValidationResult[]
