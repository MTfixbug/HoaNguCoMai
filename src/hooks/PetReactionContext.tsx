import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CELEBRATION_STICKERS } from '../lib/gamification'

export type PetReactionKind = 'idle' | 'correct' | 'combo' | 'wrong' | 'swipe_guard' | 'kudos'

export interface PetReactionState {
  id: number
  kind: PetReactionKind
  message: string
  sticker?: { zh: string; vi: string; emoji: string }
  xpDelta?: number
}

interface TriggerOpts {
  message?: string
  xpDelta?: number
  combo?: number
}

interface PetReactionContextValue {
  reaction: PetReactionState | null
  triggerReaction: (kind: Exclude<PetReactionKind, 'idle'>, opts?: TriggerOpts) => void
  clearReaction: () => void
}

const PetReactionCtx = createContext<PetReactionContextValue | null>(null)

export function PetReactionProvider({ children }: { children: ReactNode }) {
  const [reaction, setReaction] = useState<PetReactionState | null>(null)
  const timerRef = useRef<number | null>(null)
  const seqRef = useRef(0)

  const clearReaction = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setReaction(null)
  }, [])

  const triggerReaction = useCallback((kind: Exclude<PetReactionKind, 'idle'>, opts?: TriggerOpts) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const seq = ++seqRef.current
    const sticker =
      kind === 'correct' || kind === 'combo'
        ? CELEBRATION_STICKERS[seq % CELEBRATION_STICKERS.length]
        : kind === 'kudos'
          ? { zh: '老师表扬！', vi: 'Cô Mai khen bạn!', emoji: '🏆' }
          : undefined

    let defaultMsg = 'Cố lên nhé!'
    if (kind === 'combo') defaultMsg = `Combo x${opts?.combo ?? 3}! Siêu đỉnh!`
    else if (kind === 'correct') defaultMsg = sticker ? `${sticker.zh} ${sticker.vi}` : 'Chuẩn quá!'
    else if (kind === 'wrong') defaultMsg = 'Không sao, thử lại nhé!'
    else if (kind === 'swipe_guard') defaultMsg = 'Khoan đã, chắc nhớ chưa nè? 👀'
    else if (kind === 'kudos') defaultMsg = 'Cô Mai vừa tặng thưởng!'

    setReaction({
      id: seq,
      kind,
      message: opts?.message ?? defaultMsg,
      sticker,
      xpDelta: opts?.xpDelta,
    })

    timerRef.current = window.setTimeout(() => {
      setReaction((cur) => (cur?.id === seq ? null : cur))
    }, 2300)
  }, [])

  return (
    <PetReactionCtx.Provider value={{ reaction, triggerReaction, clearReaction }}>
      {children}
    </PetReactionCtx.Provider>
  )
}

export function usePetReaction() {
  const ctx = useContext(PetReactionCtx)
  if (!ctx) {
    return {
      reaction: null,
      triggerReaction: () => {},
      clearReaction: () => {},
    }
  }
  return ctx
}
