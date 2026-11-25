import { AlertCircle, Bookmark, ChevronLeft, ChevronRight, Layers, PenTool, Search, Sparkles, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SpeakButton from '../components/common/SpeakButton'
import StrokeWriterStudio from '../components/flashcard/StrokeWriterStudio'
import { useAuth } from '../hooks/AuthContext'
import { useLms } from '../hooks/LmsContext'

const PAGE_SIZE = 40
type VocabScopeFilter = 'all' | 'core' | 'extra' | 'slang'

export default function VocabVaultPage() {
  const [params] = useSearchParams()
  const { profile } = useAuth()
  const { settings, searchIndex, indexLoading, ensureSearchIndex, progressMap, toggleHardWord } = useLms()

  const activeLevel = Math.max(1, profile?.current_hsk_level || 1)
  const targetLevel = Math.max(activeLevel, profile?.target_hsk_level || activeLevel)
  const hskStandard = settings.hskStandard ?? '3.0'
  const approvedSet = useMemo(() => new Set(settings.approvedContentIds ?? []), [settings.approvedContentIds])

  const [tab, setTab] = useState<'dict' | 'mistakes'>(() => (params.get('tab') === 'mistakes' ? 'mistakes' : 'dict'))
  const [scopeOnlyRoadmap, setScopeOnlyRoadmap] = useState(true)
  const [sourceFilter, setSourceFilter] = useState<VocabScopeFilter>(() =>
    params.get('topic') === 'slang' ? 'slang' : 'all',
  )
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})
  const [writerWord, setWriterWord] = useState<string | null>(null)

  useEffect(() => {
    void ensureSearchIndex()
  }, [ensureSearchIndex])

  useEffect(() => {
    setPage(1)
  }, [tab, scopeOnlyRoadmap, sourceFilter, query])

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
      if (sourceFilter === 'core' && e.source === 'extra') return false
      if (sourceFilter === 'extra' && e.source !== 'extra') return false
      if (sourceFilter === 'slang' && e.topic !== 'Từ lóng mạng') return false

      if (scopeOnlyRoadmap && tab === 'dict' && sourceFilter !== 'extra' && sourceFilter !== 'slang') {
        const effectiveLvl = hskStandard === '2.0' ? e.hsk2Level ?? 9 : e.hsk3Level ?? e.hskNum
        if (e.source === 'extra' || effectiveLvl <= 0 || effectiveLvl > targetLevel) return false
      }
      if (!q) return true
      return (
        e.hanzi.includes(q) ||
        e.pinyin.toLowerCase().includes(q) ||
        e.pinyinPlain.includes(q.replace(/\s+/g, '')) ||
        e.hanViet.toLowerCase().includes(q) ||
        e.meaningVi.toLowerCase().includes(q) ||
        (e.topic?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [searchIndex, tab, mistakeIds, scopeOnlyRoadmap, sourceFilter, targetLevel, hskStandard, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="glass-panel p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-ink">
              {tab === 'mistakes' ? 'Sổ tay Từ khó & Hay sai' : `Kho từ vựng HSK (${hskStandard})`}
            </h1>
            <p className="text-xs text-muted">
              Tìm theo Chữ Hán, Pinyin, Hán-Việt hoặc nghĩa Việt · Phân tách rõ Trong đề &amp; Mở rộng
            </p>
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setTab('dict')}
              className={`glass-pill-btn !min-h-10 !px-3.5 text-xs ${tab === 'dict' ? 'glass-primary-btn' : ''}`}
            >
              Từ điển
            </button>
            <button
              type="button"
              onClick={() => setTab('mistakes')}
              className={`glass-pill-btn !min-h-10 !px-3.5 text-xs ${tab === 'mistakes' ? 'glass-primary-btn' : ''}`}
            >
              <AlertCircle size={13} /> Từ khó ({mistakeIds.size})
            </button>
          </div>
        </div>

        <div className="glass-subtle flex items-center gap-2 px-3">
          <Search size={16} className="text-muted shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nhập chữ Hán (神奇), Pinyin (shenqi), Hán-Việt hoặc nghĩa Việt..."
            className="w-full bg-transparent py-2.5 text-sm text-ink outline-none"
            aria-label="Tìm kiếm từ điển HSK"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', 'Tất cả'],
                ['core', 'Trong đề'],
                ['extra', 'Mở rộng thực dụng'],
                ['slang', 'Từ lóng mạng'],
              ] as [VocabScopeFilter, string][]
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSourceFilter(k)}
                className={`glass-pill-btn !min-h-9 !px-3 text-xs ${sourceFilter === k ? 'glass-primary-btn' : ''}`}
              >
                {k === 'slang' && <Sparkles size={12} />} {lbl}
              </button>
            ))}

            {sourceFilter !== 'extra' && sourceFilter !== 'slang' && (
              <button
                type="button"
                onClick={() => setScopeOnlyRoadmap((v) => !v)}
                className={`glass-pill-btn !min-h-9 !px-3 text-xs ${scopeOnlyRoadmap ? '!border-jade !text-jade' : ''}`}
              >
                {scopeOnlyRoadmap ? `Chỉ trong HSK 1–${targetLevel}` : 'Toàn bộ HSK 1–9'}
              </button>
            )}
          </div>

          {tab === 'mistakes' && mistakeIds.size > 0 && (
            <div className="flex gap-2">
              <Link to="/flashcards?filter=hard" className="glass-pill-btn glass-primary-btn !min-h-9 !px-3 text-xs">
                <Layers size={13} /> Ôn lại nhóm từ khó
              </Link>
              <Link to="/quiz" className="glass-pill-btn !min-h-9 !px-3 text-xs">
                <Zap size={13} /> Làm Quiz
              </Link>
            </div>
          )}
        </div>
      </div>

      {writerWord && (
        <div className="glass-panel p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink">Luyện viết nét từ khó: {writerWord}</span>
            <button type="button" onClick={() => setWriterWord(null)} className="glass-pill-btn !min-h-8 !px-3 text-xs">
              Đóng
            </button>
          </div>
          <StrokeWriterStudio word={writerWord} />
        </div>
      )}

      {indexLoading && searchIndex.length === 0 ? (
        <div className="glass-panel p-10 text-center text-sm text-muted">Đang tải từ điển 14.579 từ...</div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-muted px-1">
            <span>Tìm thấy {filtered.length.toLocaleString('vi-VN')} từ</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="glass-pill-btn !min-h-9 !px-2.5"
                aria-label="Trang trước"
              >
                <ChevronLeft size={14} />
              </button>
              <span>{safePage}/{totalPages}</span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="glass-pill-btn !min-h-9 !px-2.5"
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
              const wrongCnt = rec?.wrong_count ?? 0
              const meaning = settings.contentOverrides?.[item.id]?.meaningVi ?? item.meaningVi
              const isExpanded = Boolean(expandedIds[item.id])
              const isLong = meaning.length > 85
              const waitingReview = item.reviewed === false && !approvedSet.has(item.id)

              return (
                <li key={item.id} className="glass-panel p-3.5 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="hanzi text-lg font-bold text-ink">{item.hanzi}</span>
                      <span className="text-xs font-semibold text-jade">{item.pinyin}</span>
                      {item.hanViet && (
                        <span className="rounded-md bg-ochre-soft px-1.5 py-0.5 text-[11px] font-bold uppercase text-ochre">
                          {item.hanViet}
                        </span>
                      )}
                      <span className="soft-chip text-[11px]">
                        {item.source === 'extra'
                          ? item.topic ?? 'Mở rộng'
                          : hskStandard === '2.0' && item.hsk2Level
                            ? `HSK2.0-${item.hsk2Level}`
                            : item.hskLevel}
                      </span>
                      <span
                        className={`soft-chip text-[10px] ${
                          item.source === 'extra' ? '!bg-ochre-soft !text-ochre' : '!bg-jade-soft !text-jade'
                        }`}
                      >
                        {item.source === 'extra' ? 'Mở rộng' : 'Trong đề'}
                      </span>
                      {wrongCnt >= 8 && (
                        <span className="soft-chip !bg-terracotta-soft !text-terracotta text-[10px]">
                          Sai {wrongCnt} lần
                        </span>
                      )}
                      {waitingReview && (
                        <span className="soft-chip !bg-ochre-soft !text-ochre text-[10px]">Đang chờ cô duyệt</span>
                      )}
                      {item.pos && (
                        <span className="soft-chip !bg-glass-subtle !text-muted border border-line text-[11px]">
                          {item.pos}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-ink">
                      {isLong && !isExpanded ? `${meaning.slice(0, 82)}…` : meaning}
                      {isLong && (
                        <button
                          type="button"
                          onClick={() => setExpandedIds((prev) => ({ ...prev, [item.id]: !isExpanded }))}
                          className="ml-1.5 text-xs font-semibold text-jade hover:underline"
                        >
                          {isExpanded ? 'Thu gọn' : 'Xem thêm'}
                        </button>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <SpeakButton text={item.hanzi} size={15} />
                    <button
                      type="button"
                      onClick={() => setWriterWord((w) => (w === item.hanzi ? null : item.hanzi))}
                      className={`glass-pill-btn !min-h-10 !px-2.5 ${writerWord === item.hanzi ? '!border-jade !text-jade' : ''}`}
                      aria-label="Luyện viết nét"
                    >
                      <PenTool size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleHardWord(item.id, item.hskNum)}
                      className={`glass-pill-btn !min-h-10 !px-2.5 ${pinned ? '!border-terracotta !bg-terracotta-soft !text-terracotta' : ''}`}
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
