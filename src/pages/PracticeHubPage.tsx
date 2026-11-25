import { BookOpen, Flame, Layers, Mic, Sparkles, Volume2, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GrammarStudio } from '../components/grammar/GrammarStudio'
import { PronunciationLab } from '../components/practice/PronunciationLab'
import { SpeedChallengeLab } from '../components/practice/SpeedChallengeLab'
import { useAuth } from '../hooks/AuthContext'
import { useLms } from '../hooks/LmsContext'
import type { DictEntry } from '../types/vocab'
import FlashcardPage from './FlashcardPage'
import LabPage from './LabPage'
import QuizPage from './QuizPage'

type PracticeTab = 'grammar' | 'flashcards' | 'quiz' | 'audio' | 'speed' | 'speech'

const TABS: { k: PracticeTab; label: string; icon: typeof Layers }[] = [
  { k: 'grammar', label: 'Ngữ pháp', icon: BookOpen },
  { k: 'flashcards', label: 'Thẻ từ', icon: Layers },
  { k: 'quiz', label: 'Quiz nhanh', icon: Zap },
  { k: 'audio', label: 'Nghe & Viết', icon: Volume2 },
  { k: 'speed', label: 'Thử thách 60s', icon: Flame },
  { k: 'speech', label: 'Phát âm', icon: Mic },
]

export default function PracticeHubPage() {
  const [params, setParams] = useSearchParams()
  const { profile } = useAuth()
  const { settings, profiles, loadLevelVocab, rateWord, recordQuizOutcome, recordStudySession } = useLms()

  const liveProfile = profiles.find((p) => p.id === profile?.id) ?? profile
  const activeLevel = Math.max(1, liveProfile?.current_hsk_level || 1)
  const initialTab = (params.get('tab') as PracticeTab) || 'grammar'
  const grammarIdParam = params.get('grammarId') ?? undefined
  const [tab, setTab] = useState<PracticeTab>(TABS.some((t) => t.k === initialTab) ? initialTab : 'grammar')
  const [pool, setPool] = useState<DictEntry[]>([])

  useEffect(() => {
    void loadLevelVocab(activeLevel).then(setPool).catch(() => setPool([]))
  }, [activeLevel, loadLevelVocab])

  useEffect(() => {
    const pTab = params.get('tab') as PracticeTab | null
    if (pTab && TABS.some((t) => t.k === pTab)) setTab(pTab)
  }, [params])

  const selectTab = (k: PracticeTab) => {
    setTab(k)
    setParams({ tab: k })
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-ink">Luyện tập Chặng HSK {activeLevel >= 7 ? '7–9' : activeLevel}</h1>
            <p className="text-xs text-muted">
              Ngữ pháp HSK 1–3, thẻ từ vựng, nghe thanh điệu, phản xạ 60s và luyện phát âm tiếng Trung
            </p>
          </div>
          <Link to="/vocab?topic=slang" className="glass-pill-btn !min-h-9 !px-3 text-xs !bg-ochre-soft !text-ochre">
            <Sparkles size={13} /> Gói Từ lóng mạng
          </Link>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map(({ k, label, icon: Icon }) => (
            <button
              key={k}
              type="button"
              onClick={() => selectTab(k)}
              className={`glass-pill-btn !min-h-10 !px-3.5 text-xs shrink-0 whitespace-nowrap ${
                tab === k ? 'glass-primary-btn' : ''
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'grammar' && (
        <GrammarStudio
          initialLevel={Math.min(3, activeLevel)}
          initialGrammarId={grammarIdParam}
          ttsRate={settings.ttsRate}
          ttsVoiceURI={settings.ttsVoiceURI}
          approvedIds={settings.approvedContentIds}
          overrides={settings.contentOverrides}
          onExerciseWrong={(gid, lvl) => rateWord(`gram:${gid}`, lvl, 'again')}
          onExerciseCorrect={(gid, lvl) => rateWord(`gram:${gid}`, lvl, 'good')}
        />
      )}

      {tab === 'flashcards' && <FlashcardPage />}
      {tab === 'quiz' && <QuizPage />}
      {tab === 'audio' && <LabPage />}

      {tab === 'speed' && (
        <SpeedChallengeLab
          pool={pool}
          leaderboardOptIn={Boolean(settings.leaderboardOptIn)}
          currentUserId={liveProfile?.id}
          profiles={profiles}
          onFinishRound={(_score, acc, items) => {
            recordStudySession('quiz', activeLevel, 60, items, acc)
          }}
        />
      )}

      {tab === 'speech' && (
        <PronunciationLab
          pool={pool}
          ttsRate={settings.ttsRate}
          ttsVoiceURI={settings.ttsVoiceURI}
          onResult={(word, ok) => recordQuizOutcome(word.id, word.hskNum, ok)}
        />
      )}
    </div>
  )
}
