import { Bookmark } from 'lucide-react'
import { useLms } from '../../hooks/LmsContext'
import type { VocabItem } from '../../types/lesson'
import ExpansionView, { hasExpansion } from './ExpansionView'
import GlassDialog from './GlassDialog'
import SpeakButton from './SpeakButton'

export default function VocabModal({
  vocab,
  hskLevel = 4,
  onClose,
}: {
  vocab: VocabItem | null
  hskLevel?: number
  onClose: () => void
}) {
  const { progressMap, toggleHardWord } = useLms()
  const rec = vocab ? progressMap[vocab.id] : undefined
  const isPinned = Boolean(rec?.is_flagged_hard)

  return (
    <GlassDialog
      open={Boolean(vocab)}
      onClose={onClose}
      title={vocab ? `${vocab.hanzi} · ${vocab.pinyin}` : 'Chi tiết từ vựng'}
      subtitle={vocab?.hanViet ? `Hán-Việt: ${vocab.hanViet.toUpperCase()}` : undefined}
    >
      {vocab && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {vocab.pos && <span className="soft-chip">{vocab.pos}</span>}
              {vocab.register === 'formal' && <span className="soft-chip !bg-periwinkle-soft !text-periwinkle">书面语 Văn viết</span>}
              {vocab.register === 'spoken' && <span className="soft-chip !bg-ochre-soft !text-ochre">口语 Khẩu ngữ</span>}
              {vocab.isExtra && <span className="soft-chip">Từ mở rộng</span>}
            </div>
            <div className="flex gap-2">
              <SpeakButton text={vocab.hanzi} withText="Nghe" />
              <button
                type="button"
                onClick={() => toggleHardWord(vocab.id, hskLevel)}
                className={`glass-pill-btn !min-h-9 !px-3 text-xs ${isPinned ? '!border-terracotta !bg-terracotta-soft !text-terracotta' : ''}`}
              >
                <Bookmark size={14} /> {isPinned ? 'Đã ghim khó' : 'Ghim từ khó'}
              </button>
            </div>
          </div>

          <div className="glass-subtle p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Nghĩa tiếng Việt</div>
            <p className="mt-1 text-base font-semibold">{vocab.meaningVi}</p>
          </div>

          {hasExpansion(vocab.expansion) && <ExpansionView e={vocab.expansion} />}
        </div>
      )}
    </GlassDialog>
  )
}
