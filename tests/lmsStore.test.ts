import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildGradebookCsv,
  DEMO_ADMIN_ID,
  DEMO_STUDENT_ID,
  loadLocalStore,
  resetLocalStore,
  saveLocalStore,
} from '../src/lib/lmsStore'

function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => Array.from(map.keys())[index] ?? null,
    removeItem: (key) => {
      map.delete(key)
    },
    setItem: (key, value) => {
      map.set(key, String(value))
    },
  }
}

describe('lmsStore lưu trữ cục bộ & xuất CSV tiếng Việt', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
  })

  it('tải đúng dữ liệu mẫu gồm Admin Khánh Mai và lưu được thay đổi', () => {
    const store = loadLocalStore()
    expect(store.profiles.some((p) => p.id === DEMO_STUDENT_ID && p.role === 'student')).toBe(true)
    expect(store.profiles.some((p) => p.id === DEMO_ADMIN_ID && p.role === 'admin' && p.full_name === 'Khánh Mai')).toBe(true)
    expect(store.assignments.length).toBeGreaterThanOrEqual(1)

    store.demoRole = 'admin'
    saveLocalStore(store)
    expect(loadLocalStore().demoRole).toBe('admin')

    resetLocalStore()
    expect(loadLocalStore().demoRole).toBe('student')
  })

  it('xuất bảng điểm CSV tiếng Việt kèm escape dấu ngoặc kép', () => {
    const store = loadLocalStore()
    store.assignments[0].title = 'Bộ đề "HSK 4"'
    const csv = buildGradebookCsv(store.profiles, store.assignments, store.submissions)
    const lines = csv.split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(2)
    expect(lines[0]).toContain('"Họ tên"')
    expect(lines[0]).toContain('"Bộ đề ""HSK 4"" (Trạng thái)"')
    expect(lines.some((line) => line.includes('Minh Anh'))).toBe(true)
  })
})
