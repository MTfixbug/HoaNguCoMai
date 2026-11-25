import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthGate from './components/auth/AuthGate'
import AppShell from './components/layout/AppShell'
import { AuthProvider, useAuth } from './hooks/AuthContext'
import { LmsProvider } from './hooks/LmsContext'
import { PetReactionProvider } from './hooks/PetReactionContext'
import { ThemeProvider } from './hooks/ThemeContext'
import DashboardPage from './pages/DashboardPage'

const FlashcardPage = lazy(() => import('./pages/FlashcardPage'))
const QuizPage = lazy(() => import('./pages/QuizPage'))
const LabPage = lazy(() => import('./pages/LabPage'))
const LessonDetailPage = lazy(() => import('./pages/LessonDetailPage'))
const ExamCenterPage = lazy(() => import('./pages/ExamCenterPage'))
const VocabVaultPage = lazy(() => import('./pages/VocabVaultPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

const Fallback = (
  <div className="min-h-dvh flex items-center justify-center p-4">
    <div className="glass-panel p-8 text-center text-sm text-muted">Đang tải không gian làm việc...</div>
  </div>
)

function RoleRouter() {
  const { profile } = useAuth()

  if (profile?.role === 'admin') {
    return (
      <Routes>
        <Route path="lessons/:id" element={<AdminPage />} />
        <Route path="*" element={<AdminPage />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="flashcards" element={<FlashcardPage />} />
        <Route path="quiz" element={<QuizPage />} />
        <Route path="lab" element={<LabPage />} />
        <Route path="lessons/:id" element={<LessonDetailPage />} />
        <Route path="exams" element={<ExamCenterPage />} />
        <Route path="vocab" element={<VocabVaultPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LmsProvider>
          <PetReactionProvider>
            <AuthGate>
              <HashRouter>
                <Suspense fallback={Fallback}>
                  <RoleRouter />
                </Suspense>
              </HashRouter>
            </AuthGate>
          </PetReactionProvider>
        </LmsProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
