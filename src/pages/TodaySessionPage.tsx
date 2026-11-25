import { ArrowRight, CheckCircle2, Sparkles, Volume2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import FlashcardDeck, { type FlashcardEntry } from '../components/flashcard/FlashcardDeck'
import { ShareProgressCard } from '../components/social/ShareProgressCard'
import { useAuth } from '../hooks/AuthContext'
import { useLms } from '../hooks/LmsContext'
import { buildClozeQuestion, type ClozeQuestion } from '../lib/cloze'
import { levelToChunkKey, loadExamplesChunk, loadGrammarLevel } from '../lib/dataLoader'
import { buildTodayQueue } from '../lib/todayQueue'
import { speak } from '../lib/tts'
import type { GrammarPoint } from '../types/grammar'
import type { DictEntry, ExampleSentence } from '../types/vocab'

type Stage = 'loading' | 'cards' | 'cloze' | 'grammar' | 'done'

export default function TodaySessionPage() {
  const { profile } = useAuth()
  const { settings, profiles, loadLevelVocab, progressMap, rateWord, recordStudySession } = useLms()

  const liveProfile = profiles.find((p) => p.id === profile?.id) ?? profile
  const activeLevel = Math.max(1, liveProfile?.current_hsk_level || 1)
  const targetLevel = Math.max(activeLevel, liveProfile?.target_hsk_level || activeLevel)
  const dailyNewLimit = settings.dailyNewLimit ?? 10

  const [pool, setPool] = useState<DictEntry[]>([])
  const [examplesMap, setExamplesMap] = useState<Record<string, ExampleSentence>>({})
  const [grammarPool, setGrammarPool] = useState<GrammarPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [stage, setStage] = useState<Stage>('loading')
  const [sessionCardsDone, setSessionCardsDone] = useState(0)

  // Cloze step state
  const [clozeList, setClozeList] = useState<ClozeQuestion[]>([])
  const [clozeIdx, setClozeIdx] = useState(0)
  const [clozePicked, setClozePicked] = useState<number | null>(null)

  // Grammar daily check state
  const [gramAnswer, setGramAnswer] = useState<string>('')
  const [gramChecked, setGramChecked] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const gramLevel = Math.min(3, Math.max(1, activeLevel))
    const chunkKey = levelToChunkKey(activeLevel)
    Promise.all([loadLevelVocab(activeLevel), loadExamplesChunk(chunkKey), loadGrammarLevel(gramLevel)])
      .then(([words, examples, grams]) => {
        if (!alive) return
        setPool(words)
        const exByWord: Record<string, ExampleSentence> = {}
        for (const ex of examples) exByWord[ex.wordId] = ex
        setExamplesMap(exByWord)
        setGrammarPool(grams)
        setLoading(false)
      })
      .catch(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [activeLevel, loadLevelVocab])

  const plan = useMemo(
    () =>
      buildTodayQueue({
        pool,
        progressMap,
        dailyNewLimit,
        grammarPool,
      }),
    [pool, progressMap, dailyNewLimit, grammarPool],
  )

  const combinedCards = useMemo<FlashcardEntry[]>(() => {
    const ordered = [...plan.dueWords, ...plan.newWords]
    return ordered.map((e) => ({
      id: e.id,
      hanzi: e.hanzi,
      pinyin: e.pinyin,
      hanViet: e.hanViet,
      pos: e.pos,
      meaningVi: e.meaningVi,
      hskNum: e.hskNum,
      hskLevel: e.hskLevel,
      source: e.source,
      topic: e.topic,
      reviewed: e.reviewed,
      exampleZh: examplesMap[e.id]?.zh ?? e.exampleZh,
      exampleVi: examplesMap[e.id]?.vi ?? e.exampleVi,
      audioUrl: examplesMap[e.id]?.audioUrl,
    }))
  }, [plan, examplesMap])

  useEffect(() => {
    if (loading) return
    if (stage !== 'loading') return
    if (combinedCards.length > 0) {
      // Build up to 3 cloze cards interleaved after flashcards
      const builtCloze: ClozeQuestion[] = []
      for (const c of [...plan.dueWords, ...plan.newWords]) {
        const q = buildClozeQuestion(c, pool, examplesMap[c.id])
        if (q) builtCloze.push(q)
        if (builtCloze.length >= 3) break
      }
      setClozeList(builtCloze)
      setStage('cards')
    } else if (plan.dailyGrammar) {
      setStage('grammar')
    } else {
      setStage('done')
    }
  }, [loading, stage, combinedCards.length, plan.dueWords, plan.newWords, plan.dailyGrammar, pool, examplesMap])

  const approvedSet = useMemo(() => new Set(settings.approvedContentIds ?? []), [settings.approvedContentIds])

  if (loading || stage === 'loading') {
    return (
      <div className="glass-panel mx-auto max-w-xl p-10 text-center text-sm text-muted">
        Đang chuẩn bị lộ trình học hôm nay...
      </div>
    )
  }

  if (stage === 'cards') {
    return (
      <div className="mx-auto max-w-xl space-y-3">
        <div className="glass-panel px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-bold text-ink">
            Bước 1/3 · {plan.dueWords.length} thẻ ôn đến hạn + {plan.newWords.length} từ mới
          </div>
          {plan.overdueOverflowCount > 0 && (
            <span className="text-ochre font-semibold">
              Còn {plan.overdueOverflowCount} thẻ ôn quá hạn sẽ dời sang ngày mai (giới hạn 100 thẻ/ngày)
            </span>
          )}
        </div>

        <FlashcardDeck
          cards={combinedCards}
          scopeLevel={activeLevel}
          requeueAgain
          onCompleteSession={({ count }) => {
            setSessionCardsDone(count)
            if (clozeList.length > 0) setStage('cloze')
            else if (plan.dailyGrammar) setStage('grammar')
            else setStage('done')
          }}
          onRestart={() => setStage('loading')}
        />
      </div>
    )
  }

  if (stage === 'cloze' && clozeList[clozeIdx]) {
    const q = clozeList[clozeIdx]
    const nextCloze = () => {
      setClozePicked(null)
      if (clozeIdx + 1 < clozeList.length) setClozeIdx((i) => i + 1)
      else if (plan.dailyGrammar) setStage('grammar')
      else setStage('done')
    }

    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div className="glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-jade">
              Bước 2/3 · Điền từ trong câu ví dụ ({clozeIdx + 1}/{clozeList.length})
            </span>
            <button
              type="button"
              onClick={() => speak(q.sentenceZh, { rate: settings.ttsRate, voiceURI: settings.ttsVoiceURI, audioUrl: q.audioUrl })}
              className="glass-pill-btn !min-h-9 !px-3 text-xs"
            >
              <Volume2 size={14} /> Nghe cả câu
            </button>
          </div>

          <div className="glass-subtle rounded-2xl p-5 space-y-2 text-center">
            <div className="hanzi text-2xl font-bold text-ink">{q.sentenceMasked}</div>
            {q.sentenceVi && <div className="text-xs text-muted">{q.sentenceVi}</div>}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {q.options.map((opt, oi) => {
              const chosen = clozePicked === oi
              const right = oi === q.correctIndex
              return (
                <button
                  key={`${opt}-${oi}`}
                  type="button"
                  disabled={clozePicked !== null}
                  onClick={() => {
                    setClozePicked(oi)
                    rateWord(q.word.id, q.word.hskNum, right ? 'good' : 'again')
                  }}
                  className={`glass-pill-btn min-h-12 hanzi text-lg font-bold ${
                    clozePicked !== null
                      ? right
                        ? '!border-jade !bg-jade-soft text-jade'
                        : chosen
                          ? '!border-crimson !bg-crimson/10 text-crimson'
                          : ''
                      : ''
                  }`}
                >
                  {opt}
                </button>
              )
            })}
          </div>

          {clozePicked !== null && (
            <div className="space-y-3">
              <div className="rounded-xl bg-jade/10 p-3 text-xs text-ink">
                Đáp án: <strong className="hanzi">{q.word.hanzi}</strong> ({q.word.pinyin}) — {q.sentenceZh}
              </div>
              <button type="button" onClick={nextCloze} className="glass-pill-btn glass-primary-btn w-full min-h-11 text-xs">
                Tiếp tục <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (stage === 'grammar' && plan.dailyGrammar) {
    const g = plan.dailyGrammar
    const ex = g.exercises[0]
    const gApproved = g.reviewed || approvedSet.has(g.id)
    const finishGrammar = () => {
      if (ex && gramAnswer) {
        const ok = gramAnswer.replace(/\s+/g, '') === ex.answer.replace(/\s+/g, '')
        rateWord(`gram:${g.id}`, g.hskLevel, ok ? 'good' : 'again')
        recordStudySession('grammar', g.hskLevel, 60, 1, ok ? 100 : 0)
      }
      setStage('done')
    }

    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div className="glass-panel p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-jade">Bước 3/3 · 1 Điểm ngữ pháp trong ngày (HSK {g.hskLevel})</span>
            {!gApproved && (
              <span className="soft-chip !bg-ochre-soft !text-ochre text-[10px]">Đang chờ cô duyệt</span>
            )}
          </div>

          <div>
            <h1 className="text-lg font-bold text-ink">{g.title}</h1>
            <div className="mt-2 rounded-xl bg-jade/10 px-3 py-2 text-xs font-bold text-jade">
              Công thức: {g.formula}
            </div>
          </div>

          <p className="text-sm text-ink leading-relaxed">{g.explanationVi}</p>
          <p className="text-xs text-muted glass-subtle rounded-xl p-3">{g.viComparison}</p>

          {g.examples[0] && (
            <div className="glass-subtle rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="text-xs">
                <div className="hanzi text-base font-bold text-ink">{g.examples[0].zh}</div>
                <div className="text-jade">{g.examples[0].pinyin}</div>
                <div className="text-muted">{g.examples[0].vi}</div>
              </div>
              <button
                type="button"
                onClick={() => speak(g.examples[0].zh, { rate: settings.ttsRate, voiceURI: settings.ttsVoiceURI })}
                className="glass-pill-btn !min-h-9 !px-2.5"
              >
                <Volume2 size={14} />
              </button>
            </div>
          )}

          {ex && ex.options?.length ? (
            <div className="border-t border-line pt-3 space-y-2.5">
              <div className="text-xs font-bold text-ink">Kiểm tra nhanh: {ex.prompt}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ex.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setGramAnswer(opt)
                      setGramChecked(true)
                    }}
                    className={`glass-pill-btn min-h-11 justify-start text-left px-3 text-xs ${
                      gramChecked && gramAnswer === opt
                        ? opt === ex.answer
                          ? '!border-jade !bg-jade-soft text-jade'
                          : '!border-crimson !bg-crimson/10 text-crimson'
                        : ''
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {gramChecked && <div className="text-xs text-muted">{ex.explanation}</div>}
            </div>
          ) : null}

          <button type="button" onClick={finishGrammar} className="glass-pill-btn glass-primary-btn w-full min-h-12 text-sm">
            Hoàn tất bài hôm nay <CheckCircle2 size={16} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl glass-panel p-6 sm:p-8 text-center space-y-5" data-testid="today-done-screen">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-jade-soft text-jade">
        <Sparkles size={32} />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-ink">Xong hôm nay rồi! 🎉</h1>
        <p className="text-sm text-muted">
          Bạn vừa hoàn thành trọn vẹn phiên học HSK {activeLevel} hôm nay. Giữ nhịp 10–15 phút mỗi ngày nhé!
        </p>
      </div>

      <div className="flex justify-center">
        <ShareProgressCard
          studentName={liveProfile?.full_name ?? 'Học viên'}
          streakDays={liveProfile?.streak_days ?? 0}
          xpPoints={liveProfile?.xp_points ?? 0}
          learnedCount={Object.keys(progressMap).length}
          todayDone={sessionCardsDone || plan.dueWords.length + plan.newWords.length}
          currentLevel={activeLevel}
          targetLevel={targetLevel}
          petType={liveProfile?.pet_type ?? settings.petType}
        />
      </div>

      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Link to="/" className="glass-pill-btn min-h-11 px-5 text-xs">
          Về Tổng quan Hôm nay
        </Link>
        <Link to="/practice" className="glass-pill-btn glass-primary-btn min-h-11 px-5 text-xs">
          Luyện tập thêm
        </Link>
      </div>
    </div>
  )
}
