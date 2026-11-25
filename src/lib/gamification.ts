import type {
  ExamAttemptRecord,
  KudosSticker,
  PetType,
  StudySession,
  UserProfile,
  VocabProgressRecord,
} from '../types/lms'

export interface PetCatalogItem {
  id: PetType
  nameVi: string
  nameZh: string
  tagline: string
  accent: string
}

export const PET_CATALOG: PetCatalogItem[] = [
  { id: 'cat', nameVi: 'Mèo Chiêu Tài', nameZh: '招财猫', tagline: 'Nhanh nhẹn · Yêu từ mới', accent: '#F59E0B' },
  { id: 'shiba', nameVi: 'Cún Shiba', nameZh: '柴犬', tagline: 'Trung thành · Giữ chuỗi mỗi ngày', accent: '#EA580C' },
  { id: 'panda', nameVi: 'Gấu Trúc Panda', nameZh: '熊猫', tagline: 'Điềm tĩnh · Chuyên trị HSK', accent: '#0D9488' },
  { id: 'rabbit', nameVi: 'Thỏ Ngọc', nameZh: '玉兔', tagline: 'Nhạy bén · Bậc thầy thanh điệu', accent: '#EC4899' },
  { id: 'fox', nameVi: 'Cáo Đỏ Nhỏ', nameZh: '小狐狸', tagline: 'Thông minh · Quẹt thẻ siêu tốc', accent: '#E11D48' },
  { id: 'dragon', nameVi: 'Rồng Con Xanh Ngọc', nameZh: '小龙', tagline: 'Bứt phá · Mục tiêu HSK cao', accent: '#0284C7' },
  { id: 'baozi', nameVi: 'Bé Bánh Bao', nameZh: '小包子', tagline: 'Dễ thương · Luôn cổ vũ bạn', accent: '#D97706' },
]

export const KUDOS_STICKERS: Array<{ id: KudosSticker; emoji: string; label: string; bg: string }> = [
  { id: 'star', emoji: '🌟', label: 'Ngôi sao chăm chỉ', bg: 'bg-ochre-soft text-ochre' },
  { id: 'trophy', emoji: '🏆', label: 'Cúp bứt phá', bg: 'bg-jade-soft text-jade' },
  { id: 'panda', emoji: '🐼', label: 'Panda xuất sắc', bg: 'bg-moss-soft text-moss' },
  { id: 'flower', emoji: '🌸', label: 'Hoa điểm 10', bg: 'bg-terracotta-soft text-terracotta' },
  { id: 'rocket', emoji: '🚀', label: 'Tăng tốc HSK', bg: 'bg-periwinkle-soft text-periwinkle' },
  { id: 'heart', emoji: '💚', label: 'Cô Mai tự hào', bg: 'bg-jade-soft text-jade' },
]

export const CELEBRATION_STICKERS: Array<{ zh: string; vi: string; emoji: string }> = [
  { zh: '太棒了！', vi: 'Chuẩn quá!', emoji: '🌟' },
  { zh: '加油！', vi: 'Xuất sắc!', emoji: '🔥' },
  { zh: '好厉害！', vi: 'Đỉnh thật!', emoji: '🎉' },
  { zh: '真棒！', vi: 'Giữ phong độ!', emoji: '✨' },
  { zh: '满分！', vi: 'Quá hay!', emoji: '🏅' },
  { zh: '顶呱呱！', vi: 'Tuyệt vời!', emoji: '🐼' },
]

export function getLocalDateStr(date = new Date()): string {
  return date.toLocaleDateString('en-CA')
}

export function getPreviousLocalDateStr(todayDateStr: string): string {
  const [y, m, d] = todayDateStr.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  dt.setDate(dt.getDate() - 1)
  return getLocalDateStr(dt)
}

/**
 * Tính chuỗi ngày học (Streak) dựa theo ngày YYYY-MM-DD ở múi giờ cục bộ.
 */
export function computeNextStreak(
  lastStudyDate: string | null | undefined,
  currentStreak: number,
  longestStreak: number,
  todayDateStr = getLocalDateStr(),
): { streak_days: number; longest_streak: number; last_study_date: string } {
  const safeCur = Math.max(0, currentStreak || 0)
  const safeLongest = Math.max(0, longestStreak || 0)

  let nextStreak = 1
  if (lastStudyDate === todayDateStr) {
    nextStreak = Math.max(1, safeCur)
  } else if (lastStudyDate === getPreviousLocalDateStr(todayDateStr)) {
    nextStreak = safeCur + 1
  }

  return {
    streak_days: nextStreak,
    longest_streak: Math.max(safeLongest, nextStreak),
    last_study_date: todayDateStr,
  }
}

export interface XpRankInfo {
  level: number
  title: string
  minXp: number
  nextXp: number
  progressPct: number
}

const RANK_TIERS = [
  { level: 1, title: 'Tân Binh Hán Ngữ', minXp: 0, nextXp: 150 },
  { level: 2, title: 'Mầm Non HSK', minXp: 150, nextXp: 400 },
  { level: 3, title: 'Học Giả Chăm Chỉ', minXp: 400, nextXp: 900 },
  { level: 4, title: 'Cao Thủ Thanh Điệu', minXp: 900, nextXp: 1800 },
  { level: 5, title: 'Bậc Thầy Hán Tự', minXp: 1800, nextXp: 3500 },
  { level: 6, title: 'Đại Sư Hoa Ngữ', minXp: 3500, nextXp: 7000 },
]

export function getRankForXp(xpInput = 0): XpRankInfo {
  const xp = Math.max(0, Math.round(xpInput))
  let tier = RANK_TIERS[0]
  for (const t of RANK_TIERS) {
    if (xp >= t.minXp) tier = t
  }
  const span = Math.max(1, tier.nextXp - tier.minXp)
  const pct = Math.min(100, Math.max(0, Math.round(((xp - tier.minXp) / span) * 100)))
  return {
    level: tier.level,
    title: tier.title,
    minXp: tier.minXp,
    nextXp: tier.nextXp,
    progressPct: pct,
  }
}

export interface AchievementBadge {
  id: string
  title: string
  desc: string
  emoji: string
  unlocked: boolean
}

export function computeAchievements(
  profile: UserProfile | null,
  progressMap: Record<string, VocabProgressRecord>,
  sessions: StudySession[],
  examAttempts: ExamAttemptRecord[],
): AchievementBadge[] {
  const uid = profile?.id ?? ''
  const xp = profile?.xp_points ?? 0
  const streak = Math.max(profile?.streak_days ?? 0, profile?.longest_streak ?? 0)
  const mastered = Object.values(progressMap).filter((p) => p.mastery_status === 'mastered').length
  const toneDone = sessions.some((s) => s.user_id === uid && s.mode === 'tone')
  const dictationDone = sessions.some((s) => s.user_id === uid && s.mode === 'dictation')
  const passedExam = examAttempts.some((e) => e.user_id === uid && e.passed)

  return [
    { id: 'first-streak', title: 'Giữ lửa 3 ngày', desc: 'Đạt chuỗi 3 ngày học liên tiếp', emoji: '🔥', unlocked: streak >= 3 },
    { id: 'xp-200', title: 'Thợ săn XP', desc: 'Tích lũy từ 200 XP trở lên', emoji: '⭐', unlocked: xp >= 200 },
    { id: 'vocab-20', title: 'Kho từ vững chắc', desc: 'Thành thạo 20 từ vựng SRS', emoji: '📚', unlocked: mastered >= 20 },
    { id: 'tone-master', title: 'Tai nghe chuẩn', desc: 'Hoàn thành vòng Luyện Thanh Điệu', emoji: '🎵', unlocked: toneDone },
    { id: 'dictation-pro', title: 'Gõ Pinyin nhanh', desc: 'Hoàn thành vòng Nghe – Gõ Pinyin', emoji: '⌨️', unlocked: dictationDone },
    { id: 'exam-pass', title: 'Vượt chặng HSK', desc: 'Đạt điểm chuẩn một đề thi thử', emoji: '🏆', unlocked: passedExam },
  ]
}
