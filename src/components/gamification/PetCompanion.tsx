import { AnimatePresence, motion } from 'framer-motion'
import { EyeOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLms } from '../../hooks/LmsContext'
import { usePetReaction } from '../../hooks/PetReactionContext'
import { PET_CATALOG } from '../../lib/gamification'
import type { PetMotionMode, PetType } from '../../types/lms'
import ClayPetAvatar, { type PetMood } from './ClayPetAvatar'

// Stay strictly near outer corners so center CTA buttons remain unobstructed
const EDGE_ANCHORS = [3, 84]

export default function PetCompanion() {
  const { settings, updateSettings, updatePetPreferences } = useLms()
  const { reaction } = usePetReaction()
  const location = useLocation()

  const [stepIdx, setStepIdx] = useState(0)
  const [facingRight, setFacingRight] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pausedUntilRef = useRef(0)

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const mode: PetMotionMode = !settings.petEnabled
    ? 'off'
    : prefersReducedMotion
      ? 'still'
      : settings.petMotion ?? 'still'

  const hiddenOnExam = location.pathname.startsWith('/exams') || location.pathname.startsWith('/today')

  useEffect(() => {
    const pauseInteraction = () => {
      pausedUntilRef.current = Date.now() + 12_000
    }
    window.addEventListener('pointerdown', pauseInteraction, { passive: true })
    window.addEventListener('keydown', pauseInteraction, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', pauseInteraction)
      window.removeEventListener('keydown', pauseInteraction)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'slow' || hiddenOnExam) return
    // Move 3x slower with long 24s rest between calm edge shifts, pausing 12s after any user tap/type
    const timer = window.setInterval(() => {
      if (reaction || pickerOpen || Date.now() < pausedUntilRef.current) return
      setStepIdx((prev) => {
        const next = (prev + 1) % EDGE_ANCHORS.length
        setFacingRight(EDGE_ANCHORS[next] >= EDGE_ANCHORS[prev])
        return next
      })
    }, 24_000)
    return () => window.clearInterval(timer)
  }, [mode, hiddenOnExam, reaction, pickerOpen])

  if (mode === 'off' || hiddenOnExam) return null

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

  const leftPct = mode === 'still' ? EDGE_ANCHORS[0] : EDGE_ANCHORS[stepIdx]

  const handleSelectPet = (pet: PetType) => {
    void updatePetPreferences(pet, true)
    setPickerOpen(false)
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[68px] md:bottom-3 z-20 overflow-x-clip"
      data-testid="pet-companion"
    >
      <motion.div
        animate={{ left: `${leftPct}%` }}
        transition={{ duration: mode === 'still' ? 0.3 : 7.8, ease: 'easeInOut' }}
        className="relative inline-flex w-14 flex-col items-center"
        style={{ position: 'relative' }}
      >
        <AnimatePresence>
          {pickerOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.94 }}
              className="pointer-events-auto absolute bottom-full mb-2 w-64 rounded-2xl border border-line bg-glass-strong p-3 shadow-xl"
              style={{ left: leftPct > 50 ? 'auto' : 0, right: leftPct > 50 ? 0 : 'auto' }}
            >
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-ink">
                <span>Bạn đồng hành ({petInfo.nameVi})</span>
                <button
                  type="button"
                  onClick={() => {
                    updateSettings({ petMotion: 'off', petEnabled: false })
                    void updatePetPreferences(currentPet, false)
                    setPickerOpen(false)
                  }}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-muted hover:bg-glass-subtle hover:text-terracotta cursor-pointer"
                >
                  <EyeOff size={12} /> Tắt
                </button>
              </div>

              <div className="mb-2 grid grid-cols-2 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => updateSettings({ petMotion: 'still', petEnabled: true })}
                  className={`rounded-lg border px-2 py-1 font-semibold ${mode === 'still' ? 'border-jade bg-jade-soft text-jade' : 'border-line text-muted'}`}
                >
                  Đứng yên
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ petMotion: 'slow', petEnabled: true })}
                  className={`rounded-lg border px-2 py-1 font-semibold ${mode === 'slow' ? 'border-jade bg-jade-soft text-jade' : 'border-line text-muted'}`}
                >
                  Di chuyển chậm
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
                    <ClayPetAvatar pet={item.id} size={30} />
                    <span className="mt-0.5 truncate max-w-full text-[9px] font-semibold text-ink">
                      {item.nameVi.split(' ').slice(-1)[0]}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {reaction && (
            <motion.div
              key={reaction.id}
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.92 }}
              className={`absolute bottom-full mb-1 w-max max-w-[170px] rounded-2xl border px-3 py-1 text-center text-[11px] font-bold shadow-md ${
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

        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-label={`Bạn đồng hành ${petInfo.nameVi} — chạm để tùy chỉnh`}
          title={`${petInfo.nameVi} (${petInfo.nameZh})`}
          className="pointer-events-auto cursor-pointer rounded-full p-1 transition hover:scale-105 focus:outline-none opacity-90"
        >
          <motion.div
            animate={
              mood === 'happy' || mood === 'combo' || mood === 'kudos'
                ? { y: [0, -10, 0] }
                : mood === 'wrong'
                  ? { x: [0, -4, 4, 0] }
                  : mood === 'curious'
                    ? { scale: [1, 1.06, 1] }
                    : mode === 'still'
                      ? undefined
                      : { y: [0, -2, 0] }
            }
            transition={
              mood === 'idle'
                ? { duration: 4, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.6, ease: 'easeOut' }
            }
          >
            <div style={{ transform: facingRight ? undefined : 'scaleX(-1)' }}>
              <ClayPetAvatar pet={currentPet} mood={mood} size={48} />
            </div>
          </motion.div>
        </button>
      </motion.div>
    </div>
  )
}
