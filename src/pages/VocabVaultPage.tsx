import { AlertCircle, Bookmark, ChevronLeft, ChevronRight, Layers, Search, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SpeakButton from '../components/common/SpeakButton'
import { useAuth } from '../hooks/AuthContext'
import { useLms } from '../hooks/LmsContext'

const PAGE_SIZE = 40

export default function VocabVaultPage() {
  const [params] = useSearchParams()
  const { profile } = useAuth()
  const { searchIndex, indexLoading, ensureSearchIndex, progressMap, toggleHardWord } = useLms()

  const activeLevel = Math.max(1, profile?.current_hsk_level || 1)
  const targetLevel = Math.max(activeLevel, profile?.target_hsk_level || activeLevel)

  const [tab, setTab] = useState<'dict' | 'mistakes'>(() => (params.get('tab') === 'mistakes' ? 'mistakes' : 'dict'))
  const [scopeOnlyRoadmap, setScopeOnlyRoadmap] = useState(true)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    void ensureSearchIndex()
  }, [ensureSearchIndex])

  useEffect(() => {
    setPage(1)
  }, [tab, scopeOnlyRoadmap, query])

  const mistakeIds = useMemo(
    () =>
      new Set(
        Object.values(progressMap)
          .filter((r) => r.wrong_count > 0 || r.is_flagged_hard)
          .map((r) => r.word_id),
      ),
    [progressMap],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return searchIndex.filter((e) => {
      if (tab === 'mistakes' && !mistakeIds.has(e.id)) return false
      if (scopeOnlyRoadmap && e.hskNum > targetLevel) return false
      if (!q) return true
      return (
        e.hanzi.includes(q) ||
        e.pinyin.toLowerCase().includes(q) ||
        e.pinyinPlain.includes(q.replace(/\s+/g, '')) ||
        e.hanViet.toLowerCase().includes(q) ||
        e.meaningVi.toLowerCase().includes(q)
      )
    })
  }, [searchIndex, tab, mistakeIds, scopeOnlyRoadmap, targetLevel, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="glass-panel p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-ink">
              {tab === 'mistakes' ? 'Sổ tay Từ hay sai' : 'Từ điển Tra cứu'}
            </h1>
            <p className="text-xs text-muted">
              Tìm bằng Chữ Hán, Pinyin, âm Hán-Việt hoặc nghĩa tiếng Việt
            </p>
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setTab('dict')}
              className={`glass-pill-btn !min-h-9 !px-3 text-xs ${tab === 'dict' ? 'glass-primary-btn' : ''}`}
            >
              Từ điển
            </button>
            <button
              type="button"
              onClick={() => setTab('mistakes')}
              className={`glass-pill-btn !min-h-9 !px-3 text-xs ${tab === 'mistakes' ? 'glass-primary-btn' : ''}`}
            >
              <AlertCircle size={13} /> Từ hay sai ({mistakeIds.size})
            </button>
          </div>
        </div>

        <div className="glass-subtle flex items-center gap-2 px-3">
          <Search size={16} className="text-muted shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nhập chữ Hán (神奇), Pinyin (shenqi), Hán-Việt (thần kỳ) hoặc nghĩa Việt..."
            className="w-full bg-transparent py-2.5 text-sm text-ink outline-none"
            aria-label="Tìm kiếm từ điển HSK"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setScopeOnlyRoadmap(true)}
              className={`glass-pill-btn !min-h-8 !px-3 text-xs ${scopeOnlyRoadmap ? '!border-jade !bg-jade-soft !text-jade' : ''}`}
            >
              Trong lộ trình (tới HSK {targetLevel})
            </button>
            <button
              type="button"
              onClick={() => setScopeOnlyRoadmap(false)}
              className={`glass-pill-btn !min-h-8 !px-3 text-xs ${!scopeOnlyRoadmap ? '!border-jade !bg-jade-soft !text-jade' : ''}`}
            >
              Toàn bộ từ điển HSK 1–9
            </button>
          </div>

          {tab === 'mistakes' && mistakeIds.size > 0 && (
            <div className="flex gap-2">
              <Link to="/flashcards?filter=hard" className="glass-pill-btn glass-primary-btn !min-h-8 !px-3 text-xs">
                <Layers size={13} /> Ôn thẻ các từ sai
              </Link>
              <Link to="/quiz" className="glass-pill-btn !min-h-8 !px-3 text-xs">
                <Zap size={13} /> Làm trắc nghiệm
              </Link>
            </div>
          )}
        </div>
      </div>

      {indexLoading ? (
        <div className="glass-panel p-8 text-center text-sm text-muted">Đang tải dữ liệu từ điển...</div>
      ) : slice.length === 0 ? (
        <div className="glass-panel p-8 text-center text-sm text-muted">Không tìm thấy từ vựng phù hợp.</div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-muted px-1">
            <span>Hiển thị {slice.length} / {filtered.length.toLocaleString()} kết quả</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="glass-pill-btn !min-h-8 !px-2"
                aria-label="Trang trước"
              >
                <ChevronLeft size={14} />
              </button>
              <span>{safePage}/{totalPages}</span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="glass-pill-btn !min-h-8 !px-2"
                aria-label="Trang sau"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <ul className="space-y-2" data-testid="vocab-list">
            {slice.map((item) => {
              const rec = progressMap[item.id]
              const pinned = Boolean(rec?.is_flagged_hard)
              return (
                <li key={item.id} className="glass-panel p-3.5 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="hanzi text-lg font-bold text-ink">{item.hanzi}</span>
                      <span className="text-xs font-semibold text-jade">{item.pinyin}</span>
                      {item.hanViet && <span className="text-[11px] uppercase text-muted">[{item.hanViet}]</span>}
                      <span className="soft-chip text-[11px]">{item.hskLevel}</span>
                      {item.pos && <span className="soft-chip !bg-glass-subtle !text-muted border border-line text-[11px]">{item.pos}</span>}
                    </div>
                    <p className="text-xs sm:text-sm text-ink">{item.meaningVi}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <SpeakButton text={item.hanzi} size={15} />
                    <button
                      type="button"
                      onClick={() => toggleHardWord(item.id, item.hskNum)}
                      className={`glass-pill-btn !min-h-9 !px-2.5 ${pinned ? '!border-terracotta !bg-terracotta-soft !text-terracotta' : ''}`}
                      aria-label="Ghim từ khó"
                    >
                      <Bookmark size={14} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
