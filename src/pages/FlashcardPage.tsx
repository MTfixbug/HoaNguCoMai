import { Shuffle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import FlashcardDeck, { type FlashcardEntry } from '../components/flashcard/FlashcardDeck'
import { useAuth } from '../hooks/AuthContext'
import { useLms } from '../hooks/LmsContext'
import { weightedSample } from '../lib/randomizer'
import { isDue } from '../lib/srs'
import type { DictEntry } from '../types/vocab'

type CardFilter = 'all' | 'due' | 'hard' | 'new'

export default function FlashcardPage() {
  const [params] = useSearchParams()
  const { profile } = useAuth()
  const { settings, updateSettings, customLessons, assignments, loadLevelVocab, progressMap, recentIds } = useLms()

  const assignmentId = params.get('assignment') ?? undefined
  const activeAssignment = assignmentId ? assignments.find((a) => a.id === assignmentId) : undefined

  const activeLevel = activeAssignment?.config.hskLevel ?? Math.max(1, profile?.current_hsk_level || 1)
  const targetCount = activeAssignment?.config.itemCount ?? 20

  const [sourceMode, setSourceMode] = useState<'hsk' | 'class_lessons'>(() =>
    params.get('source') === 'class_lessons' ? 'class_lessons' : 'hsk',
  )
  const [filter, setFilter] = useState<CardFilter>(() => (params.get('filter') as CardFilter) || 'all')
  const [chunkEntries, setChunkEntries] = useState<DictEntry[]>([])
  const [loadingChunk, setLoadingChunk] = useState(false)
  const [seed, setSeed] = useState(0)

  useEffect(() => {
    if (sourceMode !== 'hsk') return
    let alive = true
    setLoadingChunk(true)
    loadLevelVocab(activeLevel)
      .then((rows) => {
        if (alive) {
          setChunkEntries(rows)
          setLoadingChunk(false)
        }
      })
      .catch(() => alive && setLoadingChunk(false))
    return () => {
      alive = false
    }
  }, [activeLevel, sourceMode, loadLevelVocab])

  const stageLessons = useMemo(
    () => customLessons.filter((l) => l.is_published && l.hsk_level === activeLevel),
    [customLessons, activeLevel],
  )

  const progressRef = useRef(progressMap)
  const recentRef = useRef(recentIds)
  progressRef.current = progressMap
  recentRef.current = recentIds

  const rawPool = useMemo<FlashcardEntry[]>(() => {
    return sourceMode === 'class_lessons'
      ? stageLessons.flatMap((l) =>
          l.vocab_items.map((v) => ({
            id: v.id,
            hanzi: v.hanzi,
            pinyin: v.pinyin,
            hanViet: v.hanViet ?? '',
            pos: v.pos,
            meaningVi: v.meaningVi,
            hskNum: l.hsk_level,
            hskLevel: `HSK ${l.hsk_level}`,
            lessonTitle: l.title_zh,
            exampleZh: v.exampleZh,
            exampleVi: v.exampleVi,
          })),
        )
      : chunkEntries.map((e) => ({
          id: e.id,
          hanzi: e.hanzi,
          pinyin: e.pinyin,
          hanViet: e.hanViet,
          pos: e.pos,
          meaningVi: e.meaningVi,
          hskNum: e.hskNum,
          hskLevel: e.hskLevel,
          exampleZh: e.exampleZh,
          exampleVi: e.exampleVi,
        }))
  }, [sourceMode, stageLessons, chunkEntries])

  const filteredCount = useMemo(() => {
    const now = Date.now()
    return rawPool.filter((c) => {
      const rec = progressMap[c.id]
      if (filter === 'due') return !rec || isDue(rec, now)
      if (filter === 'hard') return Boolean(rec?.is_flagged_hard || (rec && rec.wrong_count > 0))
      if (filter === 'new') return !rec || rec.mastery_status === 'new'
      return true
    }).length
  }, [rawPool, progressMap, filter])

  const deck = useMemo(() => {
    const now = Date.now()
    const snapProgress = progressRef.current
    const snapRecent = new Set(recentRef.current)
    const pool = rawPool.filter((c) => {
      const rec = snapProgress[c.id]
      if (filter === 'due') return !rec || isDue(rec, now)
      if (filter === 'hard') return Boolean(rec?.is_flagged_hard || (rec && rec.wrong_count > 0))
      if (filter === 'new') return !rec || rec.mastery_status === 'new'
      return true
    })
    const reqSet = new Set(activeAssignment?.config.requiredWords ?? [])
    if (reqSet.size > 0) {
      const priority = pool.filter((c) => reqSet.has(c.hanzi))
      const restNeeded = Math.max(0, targetCount - priority.length)
      const rest = weightedSample(
        pool.filter((c) => !reqSet.has(c.hanzi)),
        restNeeded,
        { progressMap: snapProgress, recentIds: snapRecent },
      )
      return [...priority, ...rest].slice(0, targetCount)
    }
    return weightedSample(pool, targetCount, {
      progressMap: snapProgress,
      recentIds: snapRecent,
    })
  }, [rawPool, filter, targetCount, activeAssignment?.id, seed])

  return (
    <div className="space-y-4">
      {/* Thanh chuyển nhanh 3 chế độ luyện tập trong cùng chặng */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Link to="/flashcards" className="glass-pill-btn glass-primary-btn !min-h-8 !px-3.5 text-xs">
            Thẻ từ HSK {activeLevel}
          </Link>
          <Link to="/quiz" className="glass-pill-btn !min-h-8 !px-3.5 text-xs">
            Trắc nghiệm
          </Link>
          <Link to="/lab" className="glass-pill-btn !min-h-8 !px-3.5 text-xs">
            Ghép cặp &amp; Bài của Cô
          </Link>
        </div>
        <span className="soft-chip">Lộ trình: Chặng HSK {activeLevel}</span>
      </div>

      {activeAssignment && (
        <div className="glass-panel p-3.5 border-jade/40 bg-jade-soft flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <strong className="text-jade">Nhiệm vụ Cô giao:</strong> {activeAssignment.title} (Hoàn thành {targetCount} thẻ)
          </div>
          {activeAssignment.config.requiredWords && (
            <span className="hanzi text-ink">Từ chỉ định: {activeAssignment.config.requiredWords.join(', ')}</span>
          )}
        </div>
      )}

      <div className="glass-panel p-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {stageLessons.length > 0 && (
            <select
              aria-label="Nguồn từ vựng"
              value={sourceMode}
              onChange={(e) => setSourceMode(e.target.value as 'hsk' | 'class_lessons')}
              className="glass-subtle px-3 py-2 text-xs font-semibold outline-none"
            >
              <option value="hsk">Kho từ HSK {activeLevel}</option>
              <option value="class_lessons">Từ vựng Bài của Cô ({stageLessons.length} bài)</option>
            </select>
          )}

          <select
            aria-label="Lọc trạng thái thẻ"
            value={filter}
            onChange={(e) => setFilter(e.target.value as CardFilter)}
            className="glass-subtle px-3 py-2 text-xs font-semibold outline-none"
          >
            <option value="all">Tất cả thẻ ({filteredCount})</option>
            <option value="due">Đến hạn ôn tập</option>
            <option value="new">Chỉ thẻ mới</option>
            <option value="hard">Từ hay sai &amp; Ghim khó</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => updateSettings({ showPinyin: !settings.showPinyin })}
            className={`glass-pill-btn !min-h-8 !px-3 text-xs ${settings.showPinyin ? '!border-jade !bg-jade-soft !text-jade' : ''}`}
          >
            Pinyin
          </button>
          <button
            type="button"
            onClick={() => updateSettings({ showHanViet: !settings.showHanViet })}
            className={`glass-pill-btn !min-h-8 !px-3 text-xs ${settings.showHanViet ? '!border-jade !bg-jade-soft !text-jade' : ''}`}
          >
            Hán-Việt
          </button>
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="glass-pill-btn !min-h-8 !px-3 text-xs"
          >
            <Shuffle size={13} /> Bộ thẻ khác
          </button>
        </div>
      </div>

      {loadingChunk && sourceMode === 'hsk' ? (
        <div className="glass-panel p-8 text-center text-sm text-muted">Đang tải bộ thẻ HSK {activeLevel}...</div>
      ) : (
        <FlashcardDeck
          key={`${activeLevel}-${sourceMode}-${filter}-${seed}`}
          cards={deck}
          scopeLevel={activeLevel}
          assignmentId={assignmentId}
          onRestart={() => setSeed((s) => s + 1)}
        />
      )}
    </div>
  )
}
