import confetti from 'canvas-confetti'
import { HeartHandshake, Sparkles } from 'lucide-react'
import { useLms } from '../../hooks/LmsContext'
import { usePetReaction } from '../../hooks/PetReactionContext'
import { KUDOS_STICKERS } from '../../lib/gamification'

export default function TeacherKudosBanner({ studentId }: { studentId: string }) {
  const { kudos, markKudosSeen } = useLms()
  const { triggerReaction } = usePetReaction()

  const unseen = kudos.filter((k) => k.student_id === studentId && !k.is_seen)
  if (!unseen.length) return null

  const latest = unseen[0]
  const stickerInfo = KUDOS_STICKERS.find((s) => s.id === latest.sticker) ?? KUDOS_STICKERS[0]

  const handleAcknowledge = () => {
    confetti({ particleCount: 55, spread: 60, origin: { y: 0.6 } })
    triggerReaction('kudos', { message: 'Cảm ơn Cô Mai!', xpDelta: latest.xp_bonus })
    void markKudosSeen(latest.id)
  }

  return (
    <section
      className="rounded-2xl border border-ochre/40 bg-ochre-soft p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3"
      data-testid="teacher-kudos-banner"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-glass-strong text-2xl shadow-sm">
          {stickerInfo.emoji}
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-ochre flex items-center gap-1">
              <Sparkles size={13} /> Lời khen từ Cô Mai
            </span>
            {latest.xp_bonus > 0 && (
              <span className="rounded-full bg-jade px-2 py-0.5 text-[11px] font-bold text-white">
                +{latest.xp_bonus} XP
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-ink">
            {latest.message || `Cô Mai gửi tặng bạn huy hiệu "${stickerInfo.label}"!`}
          </p>
        </div>
      </div>

      <button type="button" onClick={handleAcknowledge} className="glass-pill-btn glass-primary-btn text-xs">
        <HeartHandshake size={15} /> Cảm ơn Cô Mai!
      </button>
    </section>
  )
}
