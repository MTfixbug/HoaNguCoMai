import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateAll } from '../scripts/validate-data.mjs'

describe('Tính toàn vẹn dữ liệu HSK 1-9 (ZHWeb)', () => {
  it('xác nhận toàn bộ 9 tệp dữ liệu từ vựng chuẩn HSK 1-9 hợp lệ với 0 lỗi', () => {
    const dataDir = join(process.cwd(), 'public', 'data')
    const results = validateAll(dataDir)
    const failures = results.filter((r) => r.errors.length > 0)
    expect(failures).toEqual([])
    expect(results.length).toBe(9)

    const meta = JSON.parse(readFileSync(join(dataDir, 'vocab', 'vocab-meta.json'), 'utf8'))
    expect(meta.total).toBeGreaterThanOrEqual(11000)
  })
})
