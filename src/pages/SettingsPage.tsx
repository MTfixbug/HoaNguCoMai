import { Download, LogOut, PawPrint, RotateCcw, Sparkles, Upload, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import ClayPetAvatar from '../components/gamification/ClayPetAvatar'
import { useAuth } from '../hooks/AuthContext'
import { useLms } from '../hooks/LmsContext'
import { useTheme, type ThemePreference } from '../hooks/ThemeContext'
import { PET_CATALOG } from '../lib/gamification'
import { getAvailableChineseVoices, speak, ttsSupported, type TtsEngine } from '../lib/tts'

export default function SettingsPage() {
  const { configured, profile, signOut } = useAuth()
  const { settings, updateSettings, updatePetPreferences, exportAllJson, importAllJson, resetDemoProgress } = useLms()
  const { preference, resolvedTheme, setTheme } = useTheme()

  const fileRef = useRef<HTMLInputElement>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [ttsStatus, setTtsStatus] = useState('')

  useEffect(() => {
    if (!ttsSupported()) return
    const load = () => setVoices(getAvailableChineseVoices())
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  const runTtsDiagnostic = (txt: string) => {
    setTtsStatus('Đang tải âm thanh...')
    let engine: TtsEngine = 'none'
    speak(txt, {
      rate: settings.ttsRate,
      voiceURI: settings.ttsVoiceURI,
      onEngine: (e) => {
        engine = e
        setTtsStatus(`Đang phát (${e.toUpperCase()})...`)
      },
      onEnd: () => {
        setTtsStatus(engine === 'none' ? 'Thiết bị chưa hỗ trợ phát âm.' : `✓ Đã phát xong (${engine.toUpperCase()})`)
      },
    })
  }

  const handleExport = () => {
    const blob = new Blob([exportAllJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hoangucomai-saoluu-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Đã xuất file sao lưu JSON')
  }

  const handleImport = async (file?: File) => {
    if (!file) return
    const res = importAllJson(await file.text())
    if (res.ok) toast.success('Đã khôi phục dữ liệu thành công')
    else toast.error(res.error ?? 'Nhập dữ liệu thất bại')
    if (fileRef.current) fileRef.current.value = ''
  }

  const activeLevel = Math.max(1, profile?.current_hsk_level || 1)
  const targetLevel = Math.max(activeLevel, profile?.target_hsk_level || activeLevel)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold text-ink">Hồ sơ &amp; Cài đặt</h1>

      <section className="glass-panel p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs sm:text-sm">
            <div className="font-bold text-ink">{profile?.full_name ?? 'Học viên'}</div>
            <div className="text-muted">{profile?.email}</div>
          </div>
          {configured && (
            <button type="button" onClick={() => void signOut()} className="glass-pill-btn">
              <LogOut size={15} /> Đăng xuất
            </button>
          )}
        </div>

        <div className="glass-subtle p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <span className="text-muted">Lộ trình hiện tại: </span>
            <strong className="text-jade">Chặng HSK {activeLevel} → Mục tiêu HSK {targetLevel}</strong>
          </div>
          <span className="text-muted">Mục tiêu {profile?.daily_goal_minutes ?? 20} phút/ngày · Quản lý bởi Cô Mai</span>
        </div>
      </section>

      <section className="glass-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-ink flex items-center gap-1.5">
              <PawPrint size={16} className="text-jade" /> Bạn đồng hành 3D &amp; Sticker khen thưởng
            </h2>
            <p className="text-xs text-muted">Chọn 1 trong 7 linh vật đi cùng khi luyện tập (có thể tắt bất cứ lúc nào)</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void updatePetPreferences(settings.petType, !settings.petEnabled)}
              className={`glass-pill-btn !min-h-8 !px-3 text-xs ${settings.petEnabled ? 'glass-primary-btn' : ''}`}
            >
              {settings.petEnabled ? 'Đang bật thú cưng' : 'Đã tắt thú cưng'}
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ stickersEnabled: !settings.stickersEnabled })}
              className={`glass-pill-btn !min-h-8 !px-3 text-xs ${settings.stickersEnabled ? '!border-jade !bg-jade-soft !text-jade' : ''}`}
            >
              <Sparkles size={13} /> {settings.stickersEnabled ? 'Sticker: Bật' : 'Sticker: Tắt'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {PET_CATALOG.map((pet) => {
            const active = settings.petType === pet.id
            return (
              <button
                key={pet.id}
                type="button"
                onClick={() => {
                  void updatePetPreferences(pet.id, true)
                  toast.success(`Đã chọn ${pet.nameVi} (${pet.nameZh}) đồng hành!`)
                }}
                className={`rounded-2xl border p-3 text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                  active ? 'border-jade bg-jade-soft' : 'border-line bg-glass-subtle hover:border-jade'
                }`}
              >
                <ClayPetAvatar pet={pet.id} size={46} />
                <div className="text-xs font-bold text-ink mt-1">{pet.nameVi}</div>
                <div className="hanzi text-[11px] text-jade">{pet.nameZh}</div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="glass-panel p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-ink mb-2">Giao diện Sáng / Tối</h2>
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

        <div className="border-t border-line pt-4 space-y-2.5">
          <div className="text-xs font-bold text-ink">Tốc độ &amp; Giọng đọc tiếng Trung ({settings.ttsRate}×)</div>
          <div className="grid grid-cols-4 gap-2">
            {[0.65, 0.85, 1.0, 1.2].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => updateSettings({ ttsRate: r })}
                className={`glass-pill-btn !min-h-9 !px-2 text-xs ${Math.abs(settings.ttsRate - r) < 0.03 ? 'glass-primary-btn' : ''}`}
              >
                {r}×
              </button>
            ))}
          </div>

          <select
            aria-label="Giọng đọc trên trình duyệt"
            value={settings.ttsVoiceURI}
            onChange={(e) => updateSettings({ ttsVoiceURI: e.target.value })}
            className="glass-subtle w-full px-3 py-2 text-xs outline-none"
          >
            <option value="">Tự động chọn giọng tiếng Trung tốt nhất ({voices.length} giọng có sẵn)</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => runTtsDiagnostic('认识你很高兴')} className="glass-pill-btn !min-h-9 !px-3 text-xs">
              <Volume2 size={14} /> Nghe thử từ ngắn
            </button>
            <button
              type="button"
              onClick={() => runTtsDiagnostic('欢迎来到汉语水平考试学习平台。')}
              className="glass-pill-btn !min-h-9 !px-3 text-xs"
            >
              <Volume2 size={14} /> Nghe thử cả câu
            </button>
          </div>
          {ttsStatus && <p className="text-xs font-semibold text-jade">{ttsStatus}</p>}
        </div>
      </section>

      <section className="glass-panel p-5 space-y-3">
        <h2 className="text-sm font-bold text-ink">Sao lưu dữ liệu cá nhân</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={handleExport} className="glass-pill-btn">
            <Download size={15} /> Xuất file JSON
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="glass-pill-btn">
            <Upload size={15} /> Nhập file JSON
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void handleImport(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => {
            resetDemoProgress()
            toast.info('Đã làm mới bộ nhớ tạm trình duyệt')
          }}
          className="glass-pill-btn w-full !border-terracotta/50 !text-terracotta"
        >
          <RotateCcw size={15} /> Xóa bộ nhớ tạm trình duyệt
        </button>
      </section>
    </div>
  )
}
