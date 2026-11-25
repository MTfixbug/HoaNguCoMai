import { Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLms } from '../../hooks/LmsContext'
import { speak, stopSpeaking } from '../../lib/tts'

export default function SpeakButton({
  text,
  label = 'Nghe phát âm tiếng Trung',
  size = 16,
  withText,
  className = '',
}: {
  text: string
  label?: string
  size?: number
  withText?: string
  className?: string
}) {
  const { settings } = useLms()
  const [playing, setPlaying] = useState(false)

  useEffect(() => () => { if (playing) stopSpeaking() }, [playing])

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (playing) {
      stopSpeaking()
      setPlaying(false)
      return
    }
    const ok = speak(text, {
      rate: settings.ttsRate,
      voiceURI: settings.ttsVoiceURI,
      onEnd: () => setPlaying(false),
    })
    if (ok) setPlaying(true)
  }

  return (
    <button
      type="button"
      className={`glass-pill-btn !min-h-9 !px-2.5 ${playing ? '!border-jade !bg-jade-soft !text-jade' : ''} ${className}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Volume2 size={size} />
      {withText && <span className="text-xs">{withText}</span>}
    </button>
  )
}
