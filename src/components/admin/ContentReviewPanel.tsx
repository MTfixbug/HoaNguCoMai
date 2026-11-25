import { CheckCircle2, Edit3, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { loadExamPapers, loadGrammarLevel, loadVocabChunk } from '../../lib/dataLoader'
import type { CuratedExamPaper } from '../../types/exam'
import type { GrammarPoint } from '../../types/grammar'
import type { ClientSettings } from '../../types/lms'
import type { DictEntry } from '../../types/vocab'

interface ContentReviewPanelProps {
  settings: ClientSettings
  onUpdateSettings: (patch: Partial<ClientSettings>) => void
}

type QueueSection = 'grammar' | 'exams' | 'slang'

export function ContentReviewPanel({ settings, onUpdateSettings }: ContentReviewPanelProps) {
  const [section, setSection] = useState<QueueSection>('grammar')
  const [gramLevel, setGramLevel] = useState<1 | 2 | 3>(1)
  const [examLevel, setExamLevel] = useState<3 | 4 | 5 | 6>(3)
  const [grammarList, setGrammarList] = useState<GrammarPoint[]>([])
  const [examPapers, setExamPapers] = useState<CuratedExamPaper[]>([])
  const [slangList, setSlangList] = useState<DictEntry[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftPrimary, setDraftPrimary] = useState('')
  const [draftSecondary, setDraftSecondary] = useState('')

  const approvedSet = new Set(settings.approvedContentIds ?? [])
  const overrides = settings.contentOverrides ?? {}

  useEffect(() => {
    if (section === 'grammar') {
      void loadGrammarLevel(gramLevel).then(setGrammarList)
    } else if (section === 'exams') {
      void loadExamPapers(examLevel).then(setExamPapers)
    } else {
      void loadVocabChunk('extra').then((rows) =>
        setSlangList(rows.filter((w) => w.topic === 'Từ lóng mạng' || w.reviewed === false)),
      )
    }
  }, [section, gramLevel, examLevel])

  const toggleApprove = (id: string) => {
    const next = approvedSet.has(id)
      ? (settings.approvedContentIds ?? []).filter((x) => x !== id)
      : [...(settings.approvedContentIds ?? []), id]
    onUpdateSettings({ approvedContentIds: next })
    toast.success(approvedSet.has(id) ? 'Đã chuyển về chờ duyệt' : 'Đã đánh dấu Cô đã duyệt')
  }

  const saveEdit = (id: string, kind: QueueSection) => {
    const nextOverrides = { ...overrides }
    if (kind === 'grammar') {
      nextOverrides[id] = { title: draftPrimary, explanationVi: draftSecondary }
    } else if (kind === 'slang') {
      nextOverrides[id] = { meaningVi: draftPrimary }
    } else {
      nextOverrides[id] = { trap: draftPrimary, tip: draftSecondary }
    }
    const nextApproved = approvedSet.has(id)
      ? settings.approvedContentIds ?? []
      : [...(settings.approvedContentIds ?? []), id]
    onUpdateSettings({ contentOverrides: nextOverrides, approvedContentIds: nextApproved })
    setEditingId(null)
    toast.success('Đã lưu chỉnh sửa và đánh dấu Đã duyệt')
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-ink">Hàng đợi duyệt nội dung (v1.2)</h1>
            <p className="text-xs text-muted">
              Chỉnh sửa hoặc bấm “Đã duyệt” cho ngữ pháp HSK 1–3, đề thi mẫu HSK 3–6 và từ lóng mạng để tắt nhãn “Đang chờ cô duyệt”.
            </p>
          </div>
          <div className="flex gap-1.5">
            {(
              [
                ['grammar', 'Ngữ pháp HSK 1–3'],
                ['exams', 'Đề thi & Coaching'],
                ['slang', 'Từ lóng mạng'],
              ] as [QueueSection, string][]
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setSection(k)
                  setEditingId(null)
                }}
                className={`glass-pill-btn !min-h-9 !px-3 text-xs ${section === k ? 'glass-primary-btn' : ''}`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {section === 'grammar' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {([1, 2, 3] as const).map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setGramLevel(lv)}
                className={`glass-pill-btn !min-h-8 !px-3 text-xs ${gramLevel === lv ? 'glass-primary-btn' : ''}`}
              >
                HSK {lv}
              </button>
            ))}
          </div>
          {grammarList.map((g) => {
            const approved = g.reviewed || approvedSet.has(g.id)
            const curTitle = overrides[g.id]?.title ?? g.title
            const curExp = overrides[g.id]?.explanationVi ?? g.explanationVi
            return (
              <div key={g.id} className="glass-panel p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className={`text-[11px] font-bold ${approved ? 'text-jade' : 'text-ochre'}`}>
                      {approved ? 'Đã duyệt' : 'Đang chờ cô duyệt'} · {g.formula}
                    </span>
                    <div className="text-sm font-bold text-ink">{curTitle}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(editingId === g.id ? null : g.id)
                        setDraftPrimary(curTitle)
                        setDraftSecondary(curExp)
                      }}
                      className="glass-pill-btn !min-h-8 !px-3 text-xs"
                    >
                      <Edit3 size={13} /> Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleApprove(g.id)}
                      className={`glass-pill-btn !min-h-8 !px-3 text-xs ${approved ? '' : 'glass-primary-btn'}`}
                    >
                      <CheckCircle2 size={13} /> {approved ? 'Đã duyệt' : 'Duyệt ngay'}
                    </button>
                  </div>
                </div>
                {editingId === g.id ? (
                  <div className="space-y-2 pt-2 border-t border-line">
                    <input
                      value={draftPrimary}
                      onChange={(e) => setDraftPrimary(e.target.value)}
                      className="w-full rounded-xl border border-line bg-glass px-3 py-2 text-xs text-ink"
                    />
                    <textarea
                      rows={3}
                      value={draftSecondary}
                      onChange={(e) => setDraftSecondary(e.target.value)}
                      className="w-full rounded-xl border border-line bg-glass px-3 py-2 text-xs text-ink"
                    />
                    <button type="button" onClick={() => saveEdit(g.id, 'grammar')} className="glass-pill-btn glass-primary-btn !min-h-8 !px-3 text-xs">
                      <Save size={13} /> Lưu &amp; Duyệt
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted">{curExp}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {section === 'exams' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {([3, 4, 5, 6] as const).map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setExamLevel(lv)}
                className={`glass-pill-btn !min-h-8 !px-3 text-xs ${examLevel === lv ? 'glass-primary-btn' : ''}`}
              >
                HSK {lv}
              </button>
            ))}
          </div>
          {examPapers.map((paper) => {
            const approved = paper.reviewed || approvedSet.has(paper.id)
            return (
              <div key={paper.id} className="glass-panel p-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className={`text-[11px] font-bold ${approved ? 'text-jade' : 'text-ochre'}`}>
                    {approved ? 'Đã duyệt' : 'Đang chờ cô duyệt'} · {paper.questions.length} câu (có coaching 3 lớp)
                  </div>
                  <div className="text-sm font-bold text-ink">{paper.title}</div>
                  <div className="text-xs text-muted">{paper.subtitle}</div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleApprove(paper.id)}
                  className={`glass-pill-btn !min-h-9 !px-3 text-xs ${approved ? '' : 'glass-primary-btn'}`}
                >
                  <CheckCircle2 size={14} /> {approved ? 'Đã duyệt' : 'Duyệt cả đề'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {section === 'slang' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {slangList.map((w) => {
            const approved = w.reviewed || approvedSet.has(w.id)
            const curMeaning = overrides[w.id]?.meaningVi ?? w.meaningVi
            return (
              <div key={w.id} className="glass-panel p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="hanzi text-lg font-bold text-ink">{w.hanzi}</span>
                      <span className="text-xs text-jade">{w.pinyin}</span>
                      <span className={`text-[10px] font-bold ${approved ? 'text-jade' : 'text-ochre'}`}>
                        {approved ? 'Đã duyệt' : 'Chờ duyệt'}
                      </span>
                    </div>
                    <div className="text-xs text-muted mt-1">{curMeaning}</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(editingId === w.id ? null : w.id)
                        setDraftPrimary(curMeaning)
                      }}
                      className="glass-pill-btn !min-h-8 !px-2.5 text-xs"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleApprove(w.id)}
                      className={`glass-pill-btn !min-h-8 !px-2.5 text-xs ${approved ? '' : 'glass-primary-btn'}`}
                    >
                      <CheckCircle2 size={12} />
                    </button>
                  </div>
                </div>
                {editingId === w.id && (
                  <div className="flex gap-2 pt-1">
                    <input
                      value={draftPrimary}
                      onChange={(e) => setDraftPrimary(e.target.value)}
                      className="flex-1 rounded-xl border border-line bg-glass px-3 py-1.5 text-xs text-ink"
                    />
                    <button type="button" onClick={() => saveEdit(w.id, 'slang')} className="glass-pill-btn glass-primary-btn !min-h-8 !px-3 text-xs">
                      Lưu
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
