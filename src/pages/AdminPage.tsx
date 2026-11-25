import {
  BarChart3,
  BookPlus,
  ClipboardCheck,
  Download,
  ListChecks,
  LogOut,
  Settings,
  UserCheck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Toaster } from 'sonner'
import { AssignmentManager } from '../components/admin/AssignmentManager'
import { CohortOverview } from '../components/admin/CohortOverview'
import { ContentReviewPanel } from '../components/admin/ContentReviewPanel'
import { LessonBuilder } from '../components/admin/LessonBuilder'
import { StudentApprovalPanel } from '../components/admin/StudentApprovalPanel'
import { StudentDrawer } from '../components/admin/StudentDrawer'
import ThemeToggle from '../components/common/ThemeToggle'
import { useAuth } from '../hooks/AuthContext'
import { useLms } from '../hooks/LmsContext'
import { useTheme, type ThemePreference } from '../hooks/ThemeContext'
import type { UserProfile } from '../types/lms'

type AdminTab = 'cohort' | 'students' | 'assignments' | 'lessons' | 'review' | 'settings'

export default function AdminPage() {
  const { profile, signOut } = useAuth()
  const { preference, resolvedTheme, setTheme } = useTheme()
  const {
    settings,
    updateSettings,
    profiles,
    customLessons,
    sessions,
    events,
    examAttempts,
    assignments,
    submissions,
    allStudentProgress,
    kudos,
    searchIndex,
    ensureSearchIndex,
    createAssignment,
    gradeSubmission,
    reviewExamAttempt,
    sendTeacherKudos,
    adminCreateStudent,
    adminResetStudentPassword,
    setStudentAccountStatus,
    adminUpdateStudentProfile,
    deleteStudentProfile,
    createCustomLesson,
    toggleLessonPublished,
    deleteCustomLesson,
    exportAllJson,
  } = useLms()

  const [activeTab, setActiveTab] = useState<AdminTab>('students')
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null)

  useEffect(() => {
    if (activeTab === 'cohort' && searchIndex.length === 0) {
      void ensureSearchIndex()
    }
  }, [activeTab, searchIndex.length, ensureSearchIndex])

  const handleQuickAssignReview = async (student: UserProfile) => {
    const level = Math.max(1, student.current_hsk_level || 1)
    const due = new Date()
    due.setDate(due.getDate() + 3)
    due.setHours(23, 59, 0, 0)
    await createAssignment({
      title: `Ôn tập củng cố HSK ${level} (${student.full_name})`,
      description: 'Bài ôn nhanh 15 từ vựng trọng tâm giúp giữ chuỗi học tập và củng cố trí nhớ SM-2.',
      target_type: 'quiz',
      config: { hskLevel: level, itemCount: 15, quizMode: 'mix' },
      assigned_to: [student.id],
      due_at: due.toISOString(),
      pass_score: 80,
    })
  }

  const pendingCount = useMemo(
    () => profiles.filter((p) => p.role === 'student' && p.account_status === 'pending').length,
    [profiles],
  )

  const navItems: { k: AdminTab; label: string; badge?: number; icon: typeof UserCheck }[] = [
    { k: 'students', label: 'Học viên & Lộ trình', badge: pendingCount, icon: UserCheck },
    { k: 'cohort', label: 'Phân tích Lớp học', icon: BarChart3 },
    { k: 'assignments', label: 'Giao bài & Điểm', icon: ClipboardCheck },
    { k: 'lessons', label: 'Kho Bài học', icon: BookPlus },
    { k: 'review', label: 'Duyệt nội dung', icon: ListChecks },
    { k: 'settings', label: 'Cài đặt Quản trị', icon: Settings },
  ]

  const handleExport = () => {
    const blob = new Blob([exportAllJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hsk-lms-quan-tri-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Đã xuất bản sao lưu dữ liệu lớp học')
  }

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-canvas">
      {/* Sidebar Quản trị tách biệt hoàn toàn trên Desktop */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col border-r border-line bg-glass p-4 justify-between">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 px-2">
            <span className="hanzi flex h-10 w-10 items-center justify-center rounded-2xl bg-jade text-base font-bold text-white shadow-sm">
              华
            </span>
            <div>
              <div className="text-sm font-bold text-ink">Hoa Ngữ Cô Mai</div>
              <div className="text-xs text-muted">Quản trị · {profile?.full_name ?? 'Giáo viên'}</div>
            </div>
          </div>

          <nav className="space-y-1" aria-label="Điều hướng quản trị">
            {navItems.map(({ k, label, badge, icon: Icon }) => (
              <button
                key={k}
                type="button"
                onClick={() => setActiveTab(k)}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer ${
                  activeTab === k ? 'bg-jade text-white shadow-sm' : 'text-muted hover:bg-glass-subtle hover:text-ink'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon size={16} />
                  {label}
                </span>
                {badge !== undefined && badge > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      activeTab === k ? 'bg-white/25 text-white' : 'bg-ochre-soft text-ochre'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="space-y-2 border-t border-line pt-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted">Giao diện</span>
            <ThemeToggle />
          </div>
          <button type="button" onClick={() => void signOut()} className="glass-pill-btn w-full text-xs">
            <LogOut size={14} /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Thanh trên di động */}
      <header className="lg:hidden border-b border-line bg-glass px-3 py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="hanzi flex h-9 w-9 items-center justify-center rounded-xl bg-jade text-sm font-bold text-white">
              华
            </span>
            <div>
              <div className="text-sm font-bold text-ink">Hoa Ngữ Cô Mai</div>
              <div className="text-[11px] text-muted">Quản trị · {profile?.full_name ?? 'Giáo viên'}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <button type="button" onClick={() => void signOut()} className="glass-pill-btn !min-h-9 !px-2.5" aria-label="Đăng xuất">
              <LogOut size={15} />
            </button>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {navItems.map(({ k, label, badge }) => (
            <button
              key={k}
              type="button"
              onClick={() => setActiveTab(k)}
              className={`glass-pill-btn !min-h-8 !px-3 text-xs shrink-0 whitespace-nowrap ${
                activeTab === k ? 'glass-primary-btn' : ''
              }`}
            >
              {label} {badge ? `(${badge})` : ''}
            </button>
          ))}
        </div>
      </header>

      {/* Nội dung chính Quản trị */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-6xl space-y-6">
        {activeTab === 'students' && (
          <StudentApprovalPanel
            profiles={profiles}
            onUpdateStatus={setStudentAccountStatus}
            onUpdateRoadmap={adminUpdateStudentProfile}
            onCreateStudent={adminCreateStudent}
            onResetPassword={adminResetStudentPassword}
            onDeleteStudent={deleteStudentProfile}
            onInspectStudent={setSelectedStudent}
          />
        )}

        {activeTab === 'cohort' && (
          <CohortOverview
            profiles={profiles}
            sessions={sessions}
            events={events}
            examAttempts={examAttempts}
            submissions={submissions}
            allStudentProgress={allStudentProgress}
            searchIndex={searchIndex}
            onSelectStudent={setSelectedStudent}
            onQuickAssignReview={handleQuickAssignReview}
          />
        )}

        {activeTab === 'assignments' && (
          <AssignmentManager
            profiles={profiles}
            customLessons={customLessons}
            assignments={assignments}
            submissions={submissions}
            onCreateAssignment={createAssignment}
            onGradeSubmission={gradeSubmission}
          />
        )}

        {activeTab === 'lessons' && (
          <LessonBuilder
            lessons={customLessons}
            onCreateLesson={createCustomLesson}
            onTogglePublished={toggleLessonPublished}
            onDeleteLesson={deleteCustomLesson}
          />
        )}

        {activeTab === 'review' && (
          <ContentReviewPanel settings={settings} onUpdateSettings={updateSettings} />
        )}

        {activeTab === 'settings' && (
          <div className="max-w-xl space-y-4">
            <div className="glass-panel p-5 space-y-4">
              <h1 className="text-lg font-bold">Cài đặt Quản trị · {profile?.full_name}</h1>
              <div>
                <div className="text-xs font-semibold text-muted mb-2">Chế độ hiển thị</div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['system', `Hệ thống (${resolvedTheme === 'dark' ? 'Tối' : 'Sáng'})`],
                      ['light', 'Sáng'],
                      ['dark', 'Tối'],
                    ] as [ThemePreference, string][]
                  ).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTheme(k)}
                      className={`glass-pill-btn text-xs ${preference === k ? 'glass-primary-btn' : ''}`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-line pt-4">
                <button type="button" onClick={handleExport} className="glass-pill-btn text-xs">
                  <Download size={14} /> Xuất sao lưu JSON toàn lớp
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <StudentDrawer
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
        allStudentProgress={allStudentProgress}
        sessions={sessions}
        examAttempts={examAttempts}
        kudos={kudos}
        searchIndex={searchIndex}
        onEnsureSearchIndex={ensureSearchIndex}
        onReviewExamAttempt={reviewExamAttempt}
        onSendKudos={sendTeacherKudos}
        onResetPassword={adminResetStudentPassword}
      />
      <Toaster position="top-center" richColors />
    </div>
  )
}
