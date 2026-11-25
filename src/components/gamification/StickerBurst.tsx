import { AnimatePresence, motion } from 'framer-motion'
import { useLms } from '../../hooks/LmsContext'
import { usePetReaction } from '../../hooks/PetReactionContext'

/**
 * Sticker đáng yêu bật lên nhẹ ở góc trên phải khi học viên trả lời đúng / đạt Combo
 */
export default function StickerBurst() {
  const { settings } = useLms()
  const { reaction } = usePetReaction()

  if (!settings.stickersEnabled || !reaction?.sticker) return null

  return (
    <div className="pointer-events-none fixed top-16 right-4 sm:right-6 z-40" data-testid="sticker-burst">
      <AnimatePresence mode="wait">
        <motion.div
          key={reaction.id}
          initial={{ opacity: 0, scale: 0.65, y: 16, rotate: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0, rotate: 2 }}
          exit={{ opacity: 0, scale: 0.85, y: -14 }}
          transition={{ type: 'spring', stiffness: 360, damping: 20 }}
          className="flex items-center gap-2.5 rounded-2xl border border-jade/35 bg-glass-strong px-3.5 py-2 shadow-lg"
        >
          <span className="text-2xl leading-none">{reaction.sticker.emoji}</span>
          <div className="leading-tight">
            <div className="hanzi text-xs font-bold text-jade">{reaction.sticker.zh}</div>
            <div className="text-[11px] font-semibold text-ink">{reaction.sticker.vi}</div>
          </div>
          {reaction.xpDelta ? (
            <span className="rounded-full bg-ochre-soft px-2 py-0.5 text-[11px] font-bold text-ochre">
              +{reaction.xpDelta} XP
            </span>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
