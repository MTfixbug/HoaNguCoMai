import { AnimatePresence, motion } from 'framer-motion'
import { EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLms } from '../../hooks/LmsContext'
import { usePetReaction } from '../../hooks/PetReactionContext'
import { PET_CATALOG } from '../../lib/gamification'
import type { PetType } from '../../types/lms'
import ClayPetAvatar, { type PetMood } from './ClayPetAvatar'

const ANCHOR_PERCENTS = [8, 20, 36, 54, 68, 44, 14]

export default function PetCompanion() {
  const { settings, updatePetPreferences } = useLms()
  const { reaction } = usePetReaction()
  const location = useLocation()

  const [stepIdx, setStepIdx] = useState(0)
  const [facingRight, setFacingRight] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)

  const hiddenOnExam = location.pathname.startsWith('/exams')

  useEffect(() => {
    if (!settings.petEnabled || hiddenOnExam) return
    const timer = window.setInterval(() => {
      if (reaction || pickerOpen) return
      setStepIdx((prev) => {
        const next = (prev + 1) % ANCHOR_PERCENTS.length
        setFacingRight(ANCHOR_PERCENTS[next] >= ANCHOR_PERCENTS[prev])
        return next
      })
    }, 7500)
    return () => window.clearInterval(timer)
  }, [settings.petEnabled, hiddenOnExam, reaction, pickerOpen])

  if (!settings.petEnabled || hiddenOnExam) return null

  const currentPet = settings.petType ?? 'cat'
  const petInfo = PET_CATALOG.find((p) => p.id === currentPet) ?? PET_CATALOG[0]

  const mood: PetMood =
    reaction?.kind === 'combo'
      ? 'combo'
      : reaction?.kind === 'correct'
        ? 'happy'
        : reaction?.kind === 'wrong'
          ? 'wrong'
          : reaction?.kind === 'swipe_guard'
            ? 'curious'
            : reaction?.kind === 'kudos'
              ? 'kudos'
              : 'idle'

  const leftPct = ANCHOR_PERCENTS[stepIdx]

  const handleSelectPet = (pet: PetType) => {
    void updatePetPreferences(pet, true)
    setPickerOpen(false)
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-16 md:bottom-3 z-20 overflow-x-clip"
      data-testid="pet-companion"
    >
      <motion.div
        animate={{ left: `${leftPct}%` }}
        transition={{ duration: 2.6, ease: 'easeInOut' }}
        className="relative inline-flex w-16 flex-col items-center"
        style={{ position: 'relative' }}
      >
        {/* Bảng chọn nhanh 7 thú cưng */}
        <AnimatePresence>
          {pickerOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.94 }}
              className="pointer-events-auto absolute bottom-full mb-2 w-60 rounded-2xl border border-line bg-glass-strong p-3 shadow-xl"
              style={{ left: leftPct > 50 ? 'auto' : 0, right: leftPct > 50 ? 0 : 'auto' }}
            >
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-ink">
                <span>Đổi bạn đồng hành ({petInfo.nameVi})</span>
                <button
                  type="button"
                  onClick={() => void updatePetPreferences(currentPet, false)}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-muted hover:bg-glass-subtle hover:text-terracotta cursor-pointer"
                >
                  <EyeOff size={12} /> Tắt
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {PET_CATALOG.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectPet(item.id)}
                    title={`${item.nameVi} (${item.nameZh})`}
                    className={`flex flex-col items-center rounded-xl border p-1.5 transition cursor-pointer ${
                      item.id === currentPet ? 'border-jade bg-jade-soft' : 'border-line hover:border-jade'
                    }`}
                  >
                    <ClayPetAvatar pet={item.id} size={32} />
                    <span className="mt-0.5 truncate max-w-full text-[9px] font-semibold text-ink">
                      {item.nameVi.split(' ').slice(-1)[0]}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bong bóng phản hồi khi trả lời đúng / sai / nhắc quẹt */}
        <AnimatePresence>
          {reaction && (
            <motion.div
              key={reaction.id}
              initial={{ opacity: 0, y: 8, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.9 }}
              className={`absolute bottom-full mb-1 w-max max-w-[180px] rounded-2xl border px-3 py-1 text-center text-[11px] font-bold shadow-md ${
                reaction.kind === 'wrong'
                  ? 'border-terracotta/40 bg-terracotta-soft text-terracotta'
                  : reaction.kind === 'swipe_guard'
                    ? 'border-ochre/50 bg-ochre-soft text-ochre'
                    : 'border-jade/40 bg-glass-strong text-jade'
              }`}
              style={{ left: leftPct > 55 ? 'auto' : 0, right: leftPct > 55 ? 0 : 'auto' }}
            >
              {reaction.message}
              {reaction.xpDelta ? ` +${reaction.xpDelta} XP` : ''}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hiệu ứng tim / sao bay khi đúng */}
        <AnimatePresence>
          {(mood === 'happy' || mood === 'combo' || mood === 'kudos') && reaction && (
            <motion.span
              key={`spark-${reaction.id}`}
              initial={{ opacity: 0, y: 4, scale: 0.6 }}
              animate={{ opacity: [0, 1, 0], y: -26, scale: 1.15 }}
              transition={{ duration: 1.1 }}
              className="pointer-events-none absolute -top-3 text-base"
            >
              {mood === 'combo' ? '✨🏆' : '💚✨'}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Linh vật 3D có thể bấm để đổi (giữ button đứng yên, chỉ animate lớp bên trong để không trượt hit-target) */}
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-label={`Bạn đồng hành ${petInfo.nameVi} — bấm để đổi hoặc ẩn`}
          title={`${petInfo.nameVi} (${petInfo.nameZh})`}
          className="pointer-events-auto cursor-pointer rounded-full p-1 transition hover:scale-110 focus:outline-none"
        >
          <motion.div
            animate={
              mood === 'happy' || mood === 'combo' || mood === 'kudos'
                ? { y: [0, -14, 0, -8, 0], rotate: [0, -6, 6, 0] }
                : mood === 'wrong'
                  ? { x: [0, -6, 6, -4, 4, 0] }
                  : mood === 'curious'
                    ? { rotate: [0, -10, 10, 0], scale: [1, 1.08, 1] }
                    : { y: [0, -3, 0] }
            }
            transition={
              mood === 'idle'
                ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.65, ease: 'easeOut' }
            }
          >
            <div style={{ transform: facingRight ? undefined : 'scaleX(-1)' }}>
              <ClayPetAvatar pet={currentPet} mood={mood} size={58} />
            </div>
          </motion.div>
        </button>
      </motion.div>
    </div>
  )
}
