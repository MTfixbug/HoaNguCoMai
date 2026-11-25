import { AlertCircle, CheckCircle2, ChevronRight, Search, Volume2, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { loadGrammarLevel } from '../../lib/dataLoader'
import { speak } from '../../lib/tts'
import type { GrammarPoint } from '../../types/grammar'

interface GrammarStudioProps {
  initialLevel?: number
  initialGrammarId?: string
  ttsRate?: number
  ttsVoiceURI?: string
  approvedIds?: string[]
  overrides?: Record<string, { title?: string; explanationVi?: string }>
  onExerciseWrong?: (grammarId: string, hskLevel: number) => void
  onExerciseCorrect?: (grammarId: string, hskLevel: number) => void
}

export function GrammarStudio({
  initialLevel = 1,
  initialGrammarId,
  ttsRate = 0.85,
  ttsVoiceURI = '',
  approvedIds = [],
  overrides = {},
  onExerciseWrong,
  onExerciseCorrect,
}: GrammarStudioProps) {
  const [level, setLevel] = useState<1 | 2 | 3>(
    (initialLevel <= 1 ? 1 : initialLevel === 2 ? 2 : 3) as 1 | 2 | 3,
  )
  const [items, setItems] = useState<GrammarPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string>(initialGrammarId ?? '')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [orderPick, setOrderPick] = useState<Record<string, string[]>>({})
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let alive = true
    setLoading(true)
    loadGrammarLevel(level)
      .then((list) => {
        if (!alive) return
        setItems(list)
        if (initialGrammarId && list.some((g) => g.id === initialGrammarId)) {
          setSelectedId(initialGrammarId)
        } else if (list.length > 0 && !list.some((g) => g.id === selectedId)) {
          setSelectedId(list[0].id)
        }
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [level, initialGrammarId])

  const categories = useMemo(
    () => Array.from(new Set(items.map((x) => x.category))).filter(Boolean),
    [items],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((g) => {
      if (categoryFilter !== 'all' && g.category !== categoryFilter) return false
      if (!q) return true
      return (
        g.title.toLowerCase().includes(q) ||
        g.formula.toLowerCase().includes(q) ||
        g.explanationVi.toLowerCase().includes(q) ||
        g.topic.toLowerCase().includes(q)
      )
    })
  }, [items, query, categoryFilter])

  const selected = useMemo(
    () => filtered.find((g) => g.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  )

  const displayTitle = selected ? overrides[selected.id]?.title ?? selected.title : ''
  const displayExplanation = selected ? overrides[selected.id]?.explanationVi ?? selected.explanationVi : ''
  const isReviewed = selected ? selected.reviewed || approvedIds.includes(selected.id) : true

  const submitAnswer = (exId: string, expected: string, actual: string) => {
    if (!selected) return
    setAnswers((prev) => ({ ...prev, [exId]: actual }))
    setCheckedMap((prev) => ({ ...prev, [exId]: true }))
    const normalize = (s: string) => s.replace(/\s+/g, '').trim()
    const ok = normalize(actual) === normalize(expected)
    if (ok) onExerciseCorrect?.(selected.id, selected.hskLevel)
    else onExerciseWrong?.(selected.id, selected.hskLevel)
  }

  return (
    <div className="space-y-4">
      {/* Bộ lọc cấp & từ khóa */}
      <div className="glass-panel p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {([1, 2, 3] as const).map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => {
                  setLevel(lv)
                  setCategoryFilter('all')
                }}
                className={`glass-pill-btn min-h-10 px-4 text-xs ${level === lv ? 'glass-primary-btn' : ''}`}
              >
                HSK {lv}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm cấu trúc ngữ pháp (VD: 把, 比, 了)..."
              className="w-full rounded-xl border border-line bg-glass pl-9 pr-3 py-2 text-xs text-ink outline-none focus:border-jade"
            />
          </div>
        </div>

        {categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`glass-pill-btn !min-h-8 !px-3 text-[11px] shrink-0 ${
                categoryFilter === 'all' ? 'glass-primary-btn' : ''
              }`}
            >
              Tất cả ({items.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`glass-pill-btn !min-h-8 !px-3 text-[11px] shrink-0 ${
                  categoryFilter === cat ? 'glass-primary-btn' : ''
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="glass-panel p-8 text-center text-sm text-muted">Đang tải điểm ngữ pháp HSK {level}...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel p-8 text-center text-sm text-muted">Không tìm thấy điểm ngữ pháp phù hợp.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Danh sách điểm ngữ pháp */}
          <div className="lg:col-span-5 space-y-2 max-h-[420px] lg:max-h-[680px] overflow-y-auto pr-1">
            {filtered.map((g) => {
              const gReviewed = g.reviewed || approvedIds.includes(g.id)
              const active = selected?.id === g.id
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedId(g.id)}
                  className={`w-full text-left rounded-2xl border p-3.5 transition flex items-center justify-between gap-2 cursor-pointer ${
                    active ? 'border-jade bg-jade/10' : 'border-line bg-glass hover:border-jade/40'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-jade">
                        HSK {g.hskLevel} · {g.category}
                      </span>
                      {!gReviewed && (
                        <span className="rounded-full bg-ochre/15 px-2 py-0.5 text-[10px] font-semibold text-ochre">
                          Đang chờ cô duyệt
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-ink truncate">{overrides[g.id]?.title ?? g.title}</div>
                    <div className="text-xs text-muted truncate">{g.formula}</div>
                  </div>
                  <ChevronRight size={16} className="text-muted shrink-0" />
                </button>
              )
            })}
          </div>

          {/* Chi tiết + Bài tập tự chấm */}
          {selected && (
            <div className="lg:col-span-7 space-y-4">
              <div className="glass-panel p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-jade/15 px-2.5 py-1 text-[11px] font-bold text-jade">
                        HSK {selected.hskLevel} · {selected.topic}
                      </span>
                      {!isReviewed && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-ochre/15 px-2.5 py-1 text-[11px] font-semibold text-ochre">
                          <AlertCircle size={12} /> Đang chờ cô duyệt
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-ink">{displayTitle}</h2>
                  </div>
                </div>

                <div className="rounded-2xl border border-jade/25 bg-jade/8 px-4 py-3 text-sm font-bold text-jade">
                  Công thức: {selected.formula}
                </div>

                <p className="text-sm leading-relaxed text-ink">{displayExplanation}</p>

                <div className="glass-subtle rounded-2xl p-3.5 text-xs leading-relaxed text-ink space-y-1">
                  <div className="font-bold text-ochre">So sánh trật tự câu với tiếng Việt:</div>
                  <p>{selected.viComparison}</p>
                </div>

                {selected.confusablePairs.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-muted">Cặp dễ nhầm:</div>
                    {selected.confusablePairs.map((cp, idx) => (
                      <div key={idx} className="rounded-xl border border-line bg-glass p-3 text-xs">
                        <strong className="text-ink">{cp.pair}:</strong>{' '}
                        <span className="text-muted">{cp.distinction}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-xs font-bold text-muted">Ví dụ minh họa:</div>
                  {selected.examples.map((ex, i) => (
                    <div key={i} className="glass-subtle rounded-xl p-3 flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="hanzi text-base font-bold text-ink">{ex.zh}</div>
                        <div className="text-xs text-jade">{ex.pinyin}</div>
                        <div className="text-xs text-muted">{ex.vi}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => speak(ex.zh, { rate: ttsRate, voiceURI: ttsVoiceURI })}
                        className="glass-pill-btn !min-h-9 !px-2.5 shrink-0"
                        aria-label="Nghe câu ví dụ"
                      >
                        <Volume2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bài tập tự chấm */}
              <div className="glass-panel p-5 space-y-4">
                <div className="text-sm font-bold text-ink">
                  Bài tập tự chấm ({selected.exercises.length} câu · câu sai tự động thêm vào ôn hôm nay)
                </div>

                <div className="space-y-4">
                  {selected.exercises.map((ex, idx) => {
                    const checked = Boolean(checkedMap[ex.id])
                    const chosen = answers[ex.id] ?? ''
                    const normalize = (s: string) => s.replace(/\s+/g, '').trim()
                    const isRight = checked && normalize(chosen) === normalize(ex.answer)

                    if (ex.type === 'order' && ex.tokens?.length) {
                      const picked = orderPick[ex.id] ?? []
                      const remaining = ex.tokens.filter(
                        (tok, ti) => picked.filter((p) => p === `${tok}#${ti}`).length === 0,
                      )
                      const previewText = picked.map((p) => p.split('#')[0]).join('')
                      return (
                        <div key={ex.id} className="rounded-2xl border border-line bg-glass-subtle p-4 space-y-3">
                          <div className="text-xs font-bold text-ink">
                            Câu {idx + 1} (Sắp xếp câu): {ex.prompt}
                          </div>
                          <div className="min-h-11 rounded-xl border border-dashed border-jade/40 bg-glass px-3 py-2 flex flex-wrap gap-1.5 items-center">
                            {picked.length === 0 ? (
                              <span className="text-xs text-muted">Chạm vào từng từ bên dưới theo đúng thứ tự...</span>
                            ) : (
                              picked.map((tokenKey, pi) => (
                                <button
                                  key={`${tokenKey}-${pi}`}
                                  type="button"
                                  onClick={() =>
                                    setOrderPick((prev) => ({
                                      ...prev,
                                      [ex.id]: (prev[ex.id] ?? []).filter((x) => x !== tokenKey),
                                    }))
                                  }
                                  className="rounded-lg bg-jade/15 px-2.5 py-1 text-sm font-semibold text-jade"
                                >
                                  {tokenKey.split('#')[0]}
                                </button>
                              ))
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ex.tokens.map((tok, ti) => {
                              const tokenKey = `${tok}#${ti}`
                              const used = picked.includes(tokenKey)
                              if (used && remaining.length >= 0) return null
                              return (
                                <button
                                  key={tokenKey}
                                  type="button"
                                  onClick={() =>
                                    setOrderPick((prev) => ({
                                      ...prev,
                                      [ex.id]: [...(prev[ex.id] ?? []), tokenKey],
                                    }))
                                  }
                                  className="glass-pill-btn !min-h-9 !px-3 text-sm"
                                >
                                  {tok}
                                </button>
                              )
                            })}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={!previewText}
                              onClick={() => submitAnswer(ex.id, ex.answer, previewText)}
                              className="glass-pill-btn glass-primary-btn !min-h-9 !px-4 text-xs"
                            >
                              Kiểm tra câu {idx + 1}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOrderPick((prev) => ({ ...prev, [ex.id]: [] }))
                                setCheckedMap((prev) => ({ ...prev, [ex.id]: false }))
                              }}
                              className="glass-pill-btn !min-h-9 !px-3 text-xs"
                            >
                              Xếp lại
                            </button>
                          </div>
                          {checked && (
                            <div
                              className={`rounded-xl p-2.5 text-xs ${
                                isRight ? 'bg-jade/15 text-jade' : 'bg-crimson/10 text-crimson'
                              }`}
                            >
                              {isRight ? 'Chính xác! ' : `Chưa đúng (Đáp án: ${ex.answer}). `}
                              {ex.explanation}
                            </div>
                          )}
                        </div>
                      )
                    }

                    return (
                      <div key={ex.id} className="rounded-2xl border border-line bg-glass-subtle p-4 space-y-2.5">
                        <div className="text-xs font-bold text-ink">
                          Câu {idx + 1}: {ex.prompt}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(ex.options ?? []).map((opt) => {
                            const selectedOpt = chosen === opt
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => submitAnswer(ex.id, ex.answer, opt)}
                                className={`glass-pill-btn min-h-11 justify-start text-left px-3.5 py-2 text-xs ${
                                  selectedOpt
                                    ? normalize(opt) === normalize(ex.answer)
                                      ? '!border-jade !bg-jade/15 text-jade'
                                      : '!border-crimson !bg-crimson/10 text-crimson'
                                    : ''
                                }`}
                              >
                                {opt}
                              </button>
                            )
                          })}
                        </div>
                        {checked && (
                          <div
                            className={`rounded-xl p-2.5 text-xs flex items-start gap-2 ${
                              isRight ? 'bg-jade/15 text-jade' : 'bg-crimson/10 text-crimson'
                            }`}
                          >
                            {isRight ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <XCircle size={15} className="shrink-0 mt-0.5" />}
                            <span>
                              {isRight ? 'Đúng rồi! ' : `Đáp án đúng: ${ex.answer}. `}
                              {ex.explanation}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
