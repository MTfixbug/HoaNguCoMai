import type { VocabProgressRecord } from '../types/lms'

const OFFLINE_QUEUE_KEY = 'hsk_offline_queue_v1'

export type OfflineMutation =
  | { id: string; kind: 'progress'; payload: VocabProgressRecord; createdAt: string }
  | { id: string; kind: 'xp'; payload: { userId: string; xpDelta: number; streakDays: number; longestStreak: number; lastStudyDate: string }; createdAt: string }
  | { id: string; kind: 'session'; payload: Record<string, unknown>; createdAt: string }

function parseTimeMs(iso?: string | null): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

/**
 * Merge local and remote SRS records keeping the newer `updated_at` timestamp.
 * If timestamps tie, keep the record with higher total reviews (reps + correct + wrong).
 */
export function mergeProgressMaps(
  localMap: Record<string, VocabProgressRecord>,
  remoteMap: Record<string, VocabProgressRecord>,
): Record<string, VocabProgressRecord> {
  const merged: Record<string, VocabProgressRecord> = { ...remoteMap }
  for (const [wordId, localRec] of Object.entries(localMap)) {
    const remoteRec = merged[wordId]
    if (!remoteRec) {
      merged[wordId] = localRec
      continue
    }
    const localTs = parseTimeMs(localRec.updated_at)
    const remoteTs = parseTimeMs(remoteRec.updated_at)
    if (localTs > remoteTs) {
      merged[wordId] = localRec
    } else if (localTs === remoteTs) {
      const localActivity = localRec.repetitions + localRec.correct_count + localRec.wrong_count
      const remoteActivity = remoteRec.repetitions + remoteRec.correct_count + remoteRec.wrong_count
      if (localActivity >= remoteActivity) merged[wordId] = localRec
    }
  }
  return merged
}

export function loadOfflineQueue(): OfflineMutation[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as OfflineMutation[]) : []
  } catch {
    return []
  }
}

export function saveOfflineQueue(items: OfflineMutation[]) {
  if (typeof localStorage === 'undefined') return
  try {
    if (items.length === 0) localStorage.removeItem(OFFLINE_QUEUE_KEY)
    else localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items))
  } catch {
    // ignore storage quota errors
  }
}

export function enqueueOfflineMutation(item: Omit<OfflineMutation, 'id' | 'createdAt'>) {
  const q = loadOfflineQueue()
  const entry = {
    ...item,
    id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  } as OfflineMutation

  // Coalesce repeated progress mutations for the same word_id to keep latest state
  const filtered =
    entry.kind === 'progress'
      ? q.filter((x) => !(x.kind === 'progress' && x.payload.word_id === entry.payload.word_id))
      : q
  filtered.push(entry)
  saveOfflineQueue(filtered)
}
