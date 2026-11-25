import { Mic, MicOff, Volume2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { speak } from '../../lib/tts'
import type { DictEntry } from '../../types/vocab'

interface PronunciationLabProps {
  pool: DictEntry[]
  ttsRate: number
  ttsVoiceURI: string
  onResult?: (word: DictEntry, correct: boolean) => void
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function getSpeechCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function normalizeZh(s: string): string {
  return s.replace(/[^\u4e00-\u9fff]/g, '')
}

export function PronunciationLab({ pool, ttsRate, ttsVoiceURI, onResult }: PronunciationLabProps) {
  const sampleWords = useMemo(() => pool.filter((w) => w.source !== 'extra').slice(0, 40), [pool])
  const [cursor, setCursor] = useState(0)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState<'idle' | 'pass' | 'retry' | 'unsupported'>('idle')

  const speechCtor = useMemo(() => getSpeechCtor(), [])
  const current = sampleWords[cursor % Math.max(1, sampleWords.length)]

  const startListening = () => {
    if (!current) return
    if (!speechCtor) {
      setStatus('unsupported')
      return
    }
    try {
      const rec = new speechCtor()
      rec.lang = 'zh-CN'
      rec.interimResults = false
      rec.maxAlternatives = 3
      setListening(true)
      setTranscript('')
      setStatus('idle')

      rec.onresult = (ev) => {
        const heardList: string[] = []
        const first = ev.results?.[0]
        if (first) {
          for (let i = 0; i < first.length; i++) heardList.push(first[i].transcript)
        }
        const joined = heardList.join(' / ')
        setTranscript(joined)
        const targetNorm = normalizeZh(current.hanzi)
        const matched = heardList.some((h) => {
          const norm = normalizeZh(h)
          return norm === targetNorm || (targetNorm.length > 0 && norm.includes(targetNorm))
        })
        setStatus(matched ? 'pass' : 'retry')
        onResult?.(current, matched)
      }
      rec.onerror = () => {
        setListening(false)
        setStatus('retry')
      }
      rec.onend = () => setListening(false)
      rec.start()
    } catch {
      setListening(false)
      setStatus('unsupported')
    }
  }

  if (!current) return null

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-ink">Luyện phát âm tiếng Trung (zh-CN)</h2>
          <p className="text-xs text-muted">Nghe mẫu rồi đọc to từ/cụm từ vào micro để kiểm tra độ chuẩn.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCursor((c) => c + 1)
            setTranscript('')
            setStatus('idle')
          }}
          className="glass-pill-btn text-xs min-h-10 px-3"
        >
          Từ tiếp theo →
        </button>
      </div>

      {!speechCtor && (
        <div className="rounded-xl border border-ochre/30 bg-ochre/10 p-3 text-xs text-ink">
          Trình duyệt này chưa hỗ trợ nhận diện giọng nói (SpeechRecognition). Bạn vẫn có thể bấm nghe mẫu và tự luyện đọc theo.
        </div>
      )}

      <div className="glass-subtle rounded-2xl p-6 text-center space-y-2">
        <div className="hanzi text-4xl font-bold text-ink">{current.hanzi}</div>
        <div className="text-base font-semibold text-jade">{current.pinyin}</div>
        <div className="text-xs text-muted">Hán-Việt: {current.hanViet} · {current.meaningVi.split(';')[0]}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => speak(current.hanzi, { rate: ttsRate, voiceURI: ttsVoiceURI })}
          className="glass-pill-btn min-h-12 text-xs"
        >
          <Volume2 size={16} /> Nghe mẫu
        </button>
        <button
          type="button"
          disabled={listening}
          onClick={startListening}
          className="glass-pill-btn glass-primary-btn min-h-12 text-xs"
        >
          {listening ? <MicOff size={16} /> : <Mic size={16} />}
          {listening ? 'Đang nghe...' : 'Bấm để nói'}
        </button>
      </div>

      {transcript && (
        <div
          className={`rounded-xl p-3 text-xs font-medium ${
            status === 'pass' ? 'bg-jade/15 text-jade' : 'bg-crimson/10 text-crimson'
          }`}
        >
          {status === 'pass' ? 'Chuẩn xác!' : 'Gần đúng rồi, thử phát âm lại chậm hơn:'} Hệ thống nghe được: “{transcript}”
        </div>
      )}
    </div>
  )
}
