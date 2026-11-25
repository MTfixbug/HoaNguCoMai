export type TtsEngine = 'google' | 'baidu' | 'webspeech' | 'none'

export interface SpeakOptions {
  rate?: number
  voiceURI?: string
  preferWebSpeech?: boolean
  onEnd?: () => void
  onEngine?: (engine: TtsEngine) => void
}

const CACHE_LIMIT = 100
const PROVIDER_TIMEOUT_MS = 3500
const MAX_CHUNK_LEN = 120
const audioUrlCache = new Map<string, string>()

let activeAudio: HTMLAudioElement | null = null
let activeSeqToken = 0

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export function getAvailableChineseVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return []
  const voices = window.speechSynthesis.getVoices()
  const zh = voices.filter((v) => {
    const l = v.lang.toLowerCase().replace('_', '-')
    return l.startsWith('zh') || l.startsWith('cmn')
  })
  const score = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase()
    const l = v.lang.toLowerCase().replace('_', '-')
    let s = 0
    if (l === 'zh-cn') s += 40
    else if (l.startsWith('zh-cn')) s += 30
    else if (l.startsWith('zh-tw')) s += 20
    if (n.includes('xiaoxiao') || n.includes('yunxi') || n.includes('natural')) s += 50
    if (n.includes('google') && n.includes('普通话')) s += 45
    if (n.includes('ting-ting') || n.includes('tingting')) s += 35
    if (n.includes('microsoft')) s += 25
    if (!v.localService) s += 5
    return s
  }
  return zh.sort((a, b) => score(b) - score(a))
}

export function findChineseVoice(voiceURI?: string): SpeechSynthesisVoice | null {
  const list = getAvailableChineseVoices()
  if (!list.length) return null
  if (voiceURI) {
    const m = list.find((v) => v.voiceURI === voiceURI || v.name === voiceURI)
    if (m) return m
  }
  return list[0]
}

export function hasChineseVoice(): boolean {
  return getAvailableChineseVoices().length > 0
}

function getProviderUrl(provider: 'google' | 'baidu', text: string): string {
  const key = `${provider}:${text}`
  const hit = audioUrlCache.get(key)
  if (hit) {
    audioUrlCache.delete(key)
    audioUrlCache.set(key, hit)
    return hit
  }
  const q = encodeURIComponent(text)
  const url =
    provider === 'google'
      ? `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=zh-CN&q=${q}`
      : `https://fanyi.baidu.com/gettts?lan=zh&text=${q}&spd=4&source=web`
  if (audioUrlCache.size >= CACHE_LIMIT) {
    const oldest = audioUrlCache.keys().next().value
    if (oldest !== undefined) audioUrlCache.delete(oldest)
  }
  audioUrlCache.set(key, url)
  return url
}

export function stopSpeaking() {
  activeSeqToken++
  if (activeAudio) {
    try {
      activeAudio.pause()
      activeAudio.src = ''
    } catch {
      // ignore cleanup
    }
    activeAudio = null
  }
  if (ttsSupported()) {
    try {
      window.speechSynthesis.cancel()
    } catch {
      // ignore cancel
    }
  }
}

export function speakViaWebSpeech(text: string, opts: SpeakOptions = {}): boolean {
  if (!ttsSupported() || !text) {
    opts.onEngine?.('none')
    opts.onEnd?.()
    return false
  }
  try {
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const v = findChineseVoice(opts.voiceURI)
    u.lang = v?.lang || 'zh-CN'
    u.rate = opts.rate ?? 0.85
    if (v) u.voice = v
    u.onend = () => opts.onEnd?.()
    u.onerror = () => opts.onEnd?.()
    opts.onEngine?.('webspeech')
    synth.speak(u)
    return true
  } catch {
    opts.onEngine?.('none')
    opts.onEnd?.()
    return false
  }
}

function ensureNoReferrerMeta() {
  if (typeof document === 'undefined' || !document.head) return
  let meta = document.querySelector('meta[name="referrer"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'referrer')
    document.head.appendChild(meta)
  }
  if (meta.getAttribute('content') !== 'no-referrer') {
    meta.setAttribute('content', 'no-referrer')
  }
}

function tryPlayProvider(
  provider: 'google' | 'baidu',
  text: string,
  opts: SpeakOptions,
  token: number,
  onDone: () => void,
  onFail: () => void,
) {
  if (typeof Audio === 'undefined' || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    onFail()
    return
  }

  ensureNoReferrerMeta()
  let settled = false
  const audio = new Audio()
  audio.setAttribute('referrerpolicy', 'no-referrer')
  audio.src = getProviderUrl(provider, text)
  audio.playbackRate = Math.min(2, Math.max(0.5, opts.rate ?? 0.85))
  activeAudio = audio

  const fail = () => {
    if (settled) return
    settled = true
    window.clearTimeout(timer)
    if (activeAudio === audio) activeAudio = null
    try {
      audio.pause()
      audio.src = ''
    } catch {
      // ignore
    }
    if (token !== activeSeqToken) return
    onFail()
  }

  const timer = window.setTimeout(fail, PROVIDER_TIMEOUT_MS)

  audio.onplaying = () => {
    if (settled) return
    window.clearTimeout(timer)
    opts.onEngine?.(provider)
  }
  audio.onended = () => {
    if (settled) return
    settled = true
    window.clearTimeout(timer)
    if (activeAudio === audio) activeAudio = null
    if (token === activeSeqToken) onDone()
  }
  audio.onerror = fail

  const playPromise = audio.play()
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(fail)
  }
}

function playSingleChunk(text: string, opts: SpeakOptions, token: number, onDone: () => void) {
  if (opts.preferWebSpeech && hasChineseVoice()) {
    speakViaWebSpeech(text, { ...opts, onEnd: onDone })
    return
  }

  tryPlayProvider('google', text, opts, token, onDone, () => {
    if (token !== activeSeqToken) return
    tryPlayProvider('baidu', text, opts, token, onDone, () => {
      if (token !== activeSeqToken) return
      speakViaWebSpeech(text, { ...opts, onEnd: onDone })
    })
  })
}

export function chunkChineseText(text: string, maxLen = MAX_CHUNK_LEN): string[] {
  const clean = text.trim()
  if (!clean) return []
  if (clean.length <= maxLen) return [clean]

  const sentences = clean.split(/(?<=[。！？；\n])/).map((s) => s.trim()).filter(Boolean)
  const pieces: string[] = []
  for (const s of sentences) {
    if (s.length <= maxLen) {
      pieces.push(s)
    } else {
      const sub = s.split(/(?<=[，、：])/).map((c) => c.trim()).filter(Boolean)
      for (const c of sub) {
        if (c.length <= maxLen) pieces.push(c)
        else {
          for (let i = 0; i < c.length; i += maxLen) pieces.push(c.slice(i, i + maxLen))
        }
      }
    }
  }

  const merged: string[] = []
  for (const p of pieces) {
    if (merged.length > 0 && merged[merged.length - 1].length + p.length <= maxLen) {
      merged[merged.length - 1] += p
    } else {
      merged.push(p)
    }
  }
  return merged
}

function playSegmentsInternal(
  segments: Array<{ index: number; text: string }>,
  opts: Omit<SpeakOptions, 'onEnd'> & {
    onIndex?: (index: number) => void
    onComplete?: () => void
  },
  token: number,
  gapMs: number,
) {
  let cursor = 0
  const playNext = () => {
    if (token !== activeSeqToken) return
    if (cursor >= segments.length) {
      opts.onIndex?.(-1)
      opts.onComplete?.()
      return
    }
    const { index, text } = segments[cursor]
    opts.onIndex?.(index)
    cursor++
    playSingleChunk(text, opts, token, () => {
      if (token !== activeSeqToken) return
      if (gapMs > 0) window.setTimeout(playNext, gapMs)
      else playNext()
    })
  }
  playNext()
}

export function speak(text: string, rateOrOpts: number | SpeakOptions = 0.85, onEnd?: () => void): boolean {
  const clean = text.trim()
  if (!clean) return false
  const opts: SpeakOptions = typeof rateOrOpts === 'number' ? { rate: rateOrOpts, onEnd } : { ...rateOrOpts }

  stopSpeaking()
  const token = activeSeqToken
  const chunks = chunkChineseText(clean, MAX_CHUNK_LEN)
  if (!chunks.length) return false

  if (chunks.length === 1) {
    playSingleChunk(chunks[0], opts, token, () => opts.onEnd?.())
  } else {
    playSegmentsInternal(
      chunks.map((c, i) => ({ index: i, text: c })),
      { ...opts, onComplete: opts.onEnd },
      token,
      60,
    )
  }
  return true
}

export function speakSequence(
  segments: string[],
  opts: Omit<SpeakOptions, 'onEnd'> & {
    onIndex?: (index: number) => void
    onComplete?: () => void
  } = {},
) {
  stopSpeaking()
  const myToken = activeSeqToken
  const expanded = segments.flatMap((s, segIdx) =>
    chunkChineseText(s, MAX_CHUNK_LEN).map((chunk) => ({ index: segIdx, text: chunk })),
  )
  if (!expanded.length) {
    opts.onComplete?.()
    return
  }
  playSegmentsInternal(expanded, opts, myToken, 180)
}
