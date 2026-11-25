import HanziWriter from 'hanzi-writer'
import { Eye, EyeOff, PenTool, Play, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

export default function StrokeWriterStudio({ word }: { word: string }) {
  const chars = Array.from(word).filter((ch) => /[\u4e00-\u9fff]/.test(ch))
  const [charIdx, setCharIdx] = useState(0)
  const [showOutline, setShowOutline] = useState(true)
  const [quizActive, setQuizActive] = useState(false)
  const [status, setStatus] = useState<string>('Sẵn sàng — Xem mẫu hoặc bắt đầu tập viết')
  const [loadErr, setLoadErr] = useState(false)

  const targetRef = useRef<HTMLDivElement>(null)
  const writerRef = useRef<HanziWriter | null>(null)

  const activeChar = chars[charIdx] ?? chars[0] ?? '汉'

  useEffect(() => {
    setCharIdx(0)
  }, [word])

  useEffect(() => {
    const el = targetRef.current
    if (!el || !activeChar) return
    el.innerHTML = ''
    setLoadErr(false)
    setQuizActive(false)
    setStatus(`Tập viết chữ: ${activeChar}`)

    let cancelled = false
    const writer = HanziWriter.create(el, activeChar, {
      width: 220,
      height: 220,
      padding: 18,
      showOutline,
      strokeAnimationSpeed: 1.1,
      delayBetweenStrokes: 160,
      strokeColor: '#4B8B7B',
      radicalColor: '#C27D6B',
      outlineColor: 'rgba(120, 134, 150, 0.25)',
      drawingColor: '#2F3A45',
      charDataLoader: (char, onLoad, onError) => {
        fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${encodeURIComponent(char)}.json`)
          .then((res) => {
            if (!res.ok) throw new Error('Không tải được dữ liệu nét viết')
            return res.json()
          })
          .then((data) => {
            if (!cancelled) onLoad(data)
          })
          .catch((err) => {
            if (!cancelled) {
              setLoadErr(true)
              setStatus('Chưa tải được dữ liệu nét chữ (cần kết nối mạng).')
              onError(err)
            }
          })
      },
    })
    writerRef.current = writer

    return () => {
      cancelled = true
      writerRef.current = null
      el.innerHTML = ''
    }
  }, [activeChar])

  useEffect(() => {
    if (!writerRef.current) return
    if (showOutline) writerRef.current.showOutline()
    else writerRef.current.hideOutline()
  }, [showOutline])

  const handleAnimate = () => {
    if (!writerRef.current || loadErr) return
    setQuizActive(false)
    setStatus(`Đang minh họa thứ tự nét chữ “${activeChar}”...`)
    writerRef.current.animateCharacter({
      onComplete: () => setStatus(`Đã minh họa xong chữ “${activeChar}”. Bấm Tập viết để thử!`),
    })
  }

  const handleStartQuiz = () => {
    if (!writerRef.current || loadErr) return
    setQuizActive(true)
    setStatus(`Viết nét thứ 1 của chữ “${activeChar}”...`)
    writerRef.current.quiz({
      onCorrectStroke: (data) => {
        setStatus(`Chính xác! Nét ${data.strokeNum + 1} · Còn ${data.strokesRemaining} nét`)
      },
      onMistake: (data) => {
        setStatus(`Lệch nét số ${data.strokeNum + 1} (thử ${data.mistakesOnStroke} lần)`)
      },
      onComplete: (summary) => {
        setQuizActive(false)
        setStatus(`Hoàn thành chữ “${activeChar}” (${summary.totalMistakes} lần sai nét)`)
        toast.success(`Hoàn thành chữ “${activeChar}” (${summary.totalMistakes} lỗi)!`)
      },
    })
  }

  if (!chars.length) return null

  return (
    <div className="glass-panel p-4 space-y-3" data-testid="stroke-writer-studio">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">Bảng tập viết thứ tự nét chữ Hán</h3>
          <p className="text-xs text-muted">{status}</p>
        </div>
        {chars.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {chars.map((c, idx) => (
              <button
                key={`${c}-${idx}`}
                type="button"
                onClick={() => setCharIdx(idx)}
                className={`glass-pill-btn !min-h-8 !px-3 hanzi text-sm ${
                  idx === charIdx ? 'glass-primary-btn' : ''
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative mx-auto flex h-[228px] w-[228px] items-center justify-center rounded-3xl border border-line bg-glass-subtle overflow-hidden">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-25" viewBox="0 0 220 220" aria-hidden="true">
          <line x1="110" y1="0" x2="110" y2="220" stroke="currentColor" strokeDasharray="4 4" />
          <line x1="0" y1="110" x2="220" y2="110" stroke="currentColor" strokeDasharray="4 4" />
          <line x1="0" y1="0" x2="220" y2="220" stroke="currentColor" strokeDasharray="4 4" />
          <line x1="220" y1="0" x2="0" y2="220" stroke="currentColor" strokeDasharray="4 4" />
        </svg>
        <div ref={targetRef} className="relative z-10 touch-none" />
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="glass-pill-btn !min-h-9 !px-3 text-xs" onClick={handleAnimate} disabled={loadErr}>
          <Play size={14} /> Xem nét mẫu
        </button>
        <button
          type="button"
          className={`glass-pill-btn !min-h-9 !px-3 text-xs ${quizActive ? 'glass-primary-btn' : ''}`}
          onClick={handleStartQuiz}
          disabled={loadErr}
        >
          <PenTool size={14} /> {quizActive ? 'Viết lại' : 'Tập viết'}
        </button>
        <button type="button" className="glass-pill-btn !min-h-9 !px-3 text-xs" onClick={() => setShowOutline((v) => !v)}>
          {showOutline ? <Eye size={14} /> : <EyeOff size={14} />} Khung mờ
        </button>
        <button
          type="button"
          className="glass-pill-btn !min-h-9 !px-3 text-xs"
          onClick={() => {
            writerRef.current?.cancelQuiz()
            setQuizActive(false)
            handleAnimate()
          }}
        >
          <RotateCcw size={14} /> Làm lại
        </button>
      </div>
    </div>
  )
}
