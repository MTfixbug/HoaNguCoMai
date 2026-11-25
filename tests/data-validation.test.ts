import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateAll } from '../scripts/validate-data.mjs'

describe('Tính toàn vẹn dữ liệu HSK v1.2 (Hoa Ngữ Cô Mai)', () => {
  it('xác nhận kho từ vựng, ví dụ Tatoeba, ngữ pháp HSK 1-3 và đề thi HSK 3-6 hợp lệ với 0 lỗi', () => {
    const dataDir = join(process.cwd(), 'public', 'data')
    const results = validateAll(dataDir)
    const failures = results.filter((r) => r.errors.length > 0)
    expect(failures).toEqual([])
    expect(results.length).toBeGreaterThanOrEqual(20)

    const meta = JSON.parse(readFileSync(join(dataDir, 'vocab', 'vocab-meta.json'), 'utf8'))
    expect(meta.total).toBeGreaterThanOrEqual(14000)
    expect(meta.coreTotal).toBeGreaterThanOrEqual(10800)
    expect(meta.extraTotal).toBeGreaterThanOrEqual(3000)
  })
})
