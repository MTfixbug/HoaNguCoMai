import { Play, Radio, Square } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import SpeakButton from '../components/common/SpeakButton'
import { useLms } from '../hooks/LmsContext'
import { speak, speakSequence, stopSpeaking } from '../lib/tts'

const TABS = [
  { k: 'text', label: 'Bài khóa & Đọc nhẩm' },
  { k: 'vocab', label: 'Từ mới' },
  { k: 'grammar', label: 'Ngữ pháp' },
  { k: 'quiz', label: 'Luyện tập' },
] as const

export default function LessonDetailPage() {
  const { id } = useParams()
  const { customLessons, settings, updateSettings, recordQuizOutcome } = useLms()
  const [tab, setTab] = useState<(typeof TABS)[number]['k']>('text')
  const [shadowing, setShadowing] = useState(false)
  const [playingAll, setPlayingAll] = useState(false)
  const [activeSentence, setActiveSentence] = useState(-1)
  const [pickedMap, setPickedMap] = useState<Record<string, number>>({})

  const lesson = customLessons.find((l) => l.id === id)

  const allSentences = useMemo(() => {
    if (!lesson) return []
    return lesson.paragraphs.flatMap((p) =>
      p.zh
        .split(/(?<=[。！？；])/)
        .map((s) => s.trim())
        .filter(Boolean),
    )
  }, [lesson])

  if (!lesson) {
    return (
      <div className="glass-panel p-8 text-center space-y-3">
        <p className="text-sm text-muted">Không tìm thấy bài học này hoặc bài đã bị ẩn.</p>
        <Link to="/lab" className="glass-pill-btn glass-primary-btn">
          ← Quay lại Phòng luyện
        </Link>
      </div>
    )
  }

  const togglePlayAll = () => {
    if (playingAll) {
      stopSpeaking()
      setPlayingAll(false)
      setActiveSentence(-1)
      return
    }
    if (!allSentences.length) return
    setPlayingAll(true)
    speakSequence(allSentences, {
      rate: settings.ttsRate,
      voiceURI: settings.ttsVoiceURI,
      onIndex: (i) => setActiveSentence(i),
      onComplete: () => {
        setPlayingAll(false)
        setActiveSentence(-1)
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link to="/lab" className="text-xs font-semibold text-jade hover:underline">
          ← Quay lại Phòng luyện &amp; Bài lớp
        </Link>
        <Link to="/flashcards?source=class_lessons" className="glass-pill-btn glass-primary-btn !min-h-8 !px-3 text-xs">
          Ôn Thẻ nhớ bài lớp
        </Link>
      </div>

      <header className="glass-panel p-5 space-y-1">
        <div className="text-xs font-semibold text-muted">
          Cấp độ HSK {lesson.hsk_level} · {lesson.vocab_items.length} từ mới · Cô Khánh Mai biên soạn
        </div>
        <h1 className="hanzi text-2xl font-bold">{lesson.title_zh}</h1>
        {lesson.title_pinyin && <div className="text-sm font-medium text-jade">{lesson.title_pinyin}</div>}
        <div className="text-sm text-muted">{lesson.title_vi}</div>
        {lesson.summary && <p className="text-xs text-muted pt-1">{lesson.summary}</p>}
      </header>

      <div className="glass-panel p-1.5 grid grid-cols-4 gap-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.k}
            type="button"
            role="tab"
            aria-selected={tab === t.k}
            onClick={() => setTab(t.k)}
            className={`rounded-2xl py-2 text-xs font-semibold transition cursor-pointer ${
              tab === t.k ? 'bg-jade text-white shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'text' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => updateSettings({ showPinyin: !settings.showPinyin })}
              className={`glass-pill-btn !min-h-9 !px-3 text-xs ${settings.showPinyin ? '!border-jade !bg-jade-soft !text-jade' : ''}`}
            >
              Pinyin
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ showMeaning: !settings.showMeaning })}
              className={`glass-pill-btn !min-h-9 !px-3 text-xs ${settings.showMeaning ? '!border-jade !bg-jade-soft !text-jade' : ''}`}
            >
              Bản dịch Việt
            </button>
            <button
              type="button"
              onClick={() => setShadowing((v) => !v)}
              className={`glass-pill-btn !min-h-9 !px-3 text-xs ${shadowing ? '!border-jade !bg-jade-soft !text-jade' : ''}`}
            >
              <Radio size={14} /> Chế độ Từng câu
            </button>
            {allSentences.length > 0 && (
              <button
                type="button"
                onClick={togglePlayAll}
                className={`glass-pill-btn !min-h-9 !px-3 text-xs ${playingAll ? 'glass-primary-btn' : ''}`}
              >
                {playingAll ? <Square size={14} /> : <Play size={14} />} {playingAll ? 'Dừng đọc' : 'Đọc nối tiếp cả bài'}
              </button>
            )}
          </div>

          {lesson.paragraphs.length === 0 ? (
            <div className="glass-panel p-6 text-center text-sm text-muted">Bài học này chưa thêm đoạn văn hội thoại.</div>
          ) : shadowing ? (
            <div className="space-y-2">
              {allSentences.map((zh, sIdx) => (
                <div
                  key={sIdx}
                  onClick={() => {
                    setActiveSentence(sIdx)
                    speak(zh, { rate: settings.ttsRate, voiceURI: settings.ttsVoiceURI, onEnd: () => setActiveSentence(-1) })
                  }}
                  role="button"
                  tabIndex={0}
                  className={`glass-panel p-4 cursor-pointer transition ${activeSentence === sIdx ? '!border-jade !bg-jade-soft' : ''}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="soft-chip text-[11px]">Câu {sIdx + 1}</span>
                    <SpeakButton text={zh} size={14} />
                  </div>
                  <p className="hanzi hz-text">{zh}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {lesson.paragraphs.map((p) => (
                <article key={p.id} className="glass-panel p-4 space-y-2">
                  <p className="hanzi hz-text">{p.zh}</p>
                  {settings.showPinyin && p.pinyin && <p className="text-xs text-muted leading-relaxed">{p.pinyin}</p>}
                  {settings.showMeaning && p.vi && <p className="border-t border-line pt-2 text-sm">{p.vi}</p>}
                  <SpeakButton text={p.zh} withText="Nghe đọc đoạn này" />
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'vocab' && (
        <ul className="space-y-2">
          {lesson.vocab_items.map((v, i) => (
            <li key={v.id} className="glass-panel p-3.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-6 text-xs text-muted">{i + 1}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="hanzi font-bold text-lg">{v.hanzi}</span>
                    <span className="text-xs font-medium text-jade">{v.pinyin}</span>
                    {v.hanViet && <span className="text-[11px] uppercase text-muted">[{v.hanViet}]</span>}
                    {v.pos && <span className="soft-chip text-[11px]">{v.pos}</span>}
                  </div>
                  <div className="text-xs sm:text-sm text-muted">{v.meaningVi}</div>
                </div>
              </div>
              <SpeakButton text={v.hanzi} />
            </li>
          ))}
          {lesson.vocab_items.length === 0 && (
            <li className="glass-panel p-6 text-center text-sm text-muted">Chưa có danh sách từ vựng đính kèm.</li>
          )}
        </ul>
      )}

      {tab === 'grammar' && (
        <div className="space-y-4">
          {lesson.grammar_notes.map((g, i) => (
            <section key={g.id} className="glass-panel p-4 space-y-2">
              <h3 className="hanzi font-bold text-base">
                <span className="text-jade mr-2">{i + 1}.</span> {g.title}
              </h3>
              {g.pattern && <div className="soft-chip hanzi">{g.pattern}</div>}
              <p className="text-sm">{g.explanationVi}</p>
              {g.examples.length > 0 && (
                <ul className="space-y-1.5">
                  {g.examples.map((ex) => (
                    <li key={ex.zh} className="glass-subtle p-2.5 text-xs flex justify-between gap-2">
                      <div>
                        <div className="hanzi font-semibold">{ex.zh}</div>
                        <div className="text-muted">{ex.vi}</div>
                      </div>
                      <SpeakButton text={ex.zh} size={14} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          {lesson.grammar_notes.length === 0 && (
            <div className="glass-panel p-6 text-center text-sm text-muted">Bài học này chưa có mục ngữ pháp riêng.</div>
          )}
        </div>
      )}

      {tab === 'quiz' && (
        <div className="space-y-3">
          {lesson.quiz_items.map((q, qi) => {
            const picked = pickedMap[q.id]
            return (
              <div key={q.id} className="glass-panel p-4 space-y-2.5">
                <div className="soft-chip text-[11px]">Câu {qi + 1}</div>
                <p className="hanzi text-sm font-medium">{q.prompt}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      type="button"
                      disabled={picked !== undefined}
                      onClick={() => {
                        setPickedMap({ ...pickedMap, [q.id]: oi })
                        recordQuizOutcome(q.id, lesson.hsk_level, oi === q.answer)
                      }}
                      className={`glass-pill-btn !rounded-2xl !justify-start text-left hanzi text-xs ${
                        picked === undefined
                          ? ''
                          : oi === q.answer
                            ? '!border-moss !bg-moss-soft !text-moss'
                            : picked === oi
                              ? '!border-terracotta !bg-terracotta-soft !text-terracotta'
                              : ''
                      }`}
                    >
                      <span className="font-bold mr-1">{['A', 'B', 'C', 'D'][oi]}.</span> {opt}
                    </button>
                  ))}
                </div>
                {picked !== undefined && <p className="text-xs text-muted">{q.explanationVi}</p>}
              </div>
            )
          })}
          {lesson.quiz_items.length === 0 && (
            <div className="glass-panel p-6 text-center text-sm text-muted">Chưa có câu hỏi bài tập cho bài học này.</div>
          )}
        </div>
      )}
    </div>
  )
}
