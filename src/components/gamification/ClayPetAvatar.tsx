import type { PetType } from '../../types/lms'

export type PetMood = 'idle' | 'happy' | 'combo' | 'wrong' | 'curious' | 'kudos'

const PALETTE: Record<
  PetType,
  { bodyA: string; bodyB: string; earInner: string; belly: string; cheek: string; detail: string }
> = {
  cat: {
    bodyA: '#FFF8EC',
    bodyB: '#FDE6C4',
    earInner: '#FDA4AF',
    belly: '#FFFFFF',
    cheek: '#FB7185',
    detail: '#F59E0B',
  },
  shiba: {
    bodyA: '#FDBA74',
    bodyB: '#EA580C',
    earInner: '#FEF3C7',
    belly: '#FFF7ED',
    cheek: '#F43F5E',
    detail: '#7C2D12',
  },
  panda: {
    bodyA: '#FFFFFF',
    bodyB: '#E2E8F0',
    earInner: '#1E293B',
    belly: '#F8FAFC',
    cheek: '#FDA4AF',
    detail: '#0F172A',
  },
  rabbit: {
    bodyA: '#FFF1F2',
    bodyB: '#FBCFE8',
    earInner: '#F472B6',
    belly: '#FFFFFF',
    cheek: '#FB7185',
    detail: '#EC4899',
  },
  fox: {
    bodyA: '#FB7185',
    bodyB: '#E11D48',
    earInner: '#FFF1F2',
    belly: '#FFF7ED',
    cheek: '#FDE047',
    detail: '#881337',
  },
  dragon: {
    bodyA: '#5EEAD4',
    bodyB: '#0D9488',
    earInner: '#FDE68A',
    belly: '#CCFBF1',
    cheek: '#F472B6',
    detail: '#0F766E',
  },
  baozi: {
    bodyA: '#FFFBEB',
    bodyB: '#FDE68A',
    earInner: '#FCA5A5',
    belly: '#FFFFFF',
    cheek: '#FB7185',
    detail: '#D97706',
  },
}

/**
 * Linh vật 3D phong cách đất sét bóng mịn (SVG nhẹ, tải tức thì, phản hồi biểu cảm)
 */
export default function ClayPetAvatar({
  pet,
  mood = 'idle',
  size = 56,
}: {
  pet: PetType
  mood?: PetMood
  size?: number
}) {
  const c = PALETTE[pet] ?? PALETTE.cat
  const gid = `clay-${pet}-${size}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 6px 10px rgba(15, 23, 42, 0.16))' }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${gid}-body`} cx="35%" cy="28%" r="70%">
          <stop offset="0%" stopColor={c.bodyA} />
          <stop offset="68%" stopColor={c.bodyB} />
          <stop offset="100%" stopColor={c.bodyB} />
        </radialGradient>
        <radialGradient id={`${gid}-shine`} cx="35%" cy="25%" r="55%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.82" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Bóng tiếp đất */}
      <ellipse cx="50" cy="91" rx="28" ry="6" fill="#0F172A" fillOpacity="0.12" />

      {/* Tai theo loài */}
      {pet === 'rabbit' ? (
        <>
          <ellipse cx="35" cy="24" rx="9" ry="20" transform="rotate(-12 35 24)" fill={`url(#${gid}-body)`} />
          <ellipse cx="35" cy="25" rx="4.8" ry="13" transform="rotate(-12 35 25)" fill={c.earInner} />
          <ellipse cx="65" cy="24" rx="9" ry="20" transform="rotate(12 65 24)" fill={`url(#${gid}-body)`} />
          <ellipse cx="65" cy="25" rx="4.8" ry="13" transform="rotate(12 65 25)" fill={c.earInner} />
        </>
      ) : pet === 'panda' ? (
        <>
          <circle cx="26" cy="26" r="12" fill={c.detail} />
          <circle cx="74" cy="26" r="12" fill={c.detail} />
        </>
      ) : pet === 'dragon' ? (
        <>
          <path d="M28 30 L21 12 L37 22 Z" fill="#FBBF24" />
          <path d="M72 30 L79 12 L63 22 Z" fill="#FBBF24" />
          <path d="M22 36 Q14 31 18 25" stroke={c.detail} strokeWidth="5" strokeLinecap="round" />
          <path d="M78 36 Q86 31 82 25" stroke={c.detail} strokeWidth="5" strokeLinecap="round" />
        </>
      ) : pet === 'baozi' ? (
        <>
          <path d="M41 18 Q50 11 59 18" stroke={c.detail} strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M45 14 L50 10 L55 14" stroke={c.detail} strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M22 42 L24 14 L46 28 Z" fill={`url(#${gid}-body)`} />
          <path d="M26 36 L27 20 L40 28 Z" fill={c.earInner} />
          <path d="M78 42 L76 14 L54 28 Z" fill={`url(#${gid}-body)`} />
          <path d="M74 36 L73 20 L60 28 Z" fill={c.earInner} />
        </>
      )}

      {/* Thân cầu 3D đất sét */}
      <ellipse cx="50" cy="56" rx="34" ry="31" fill={`url(#${gid}-body)`} />
      <ellipse cx="50" cy="68" rx="22" ry="15" fill={c.belly} fillOpacity="0.88" />
      <ellipse cx="38" cy="39" rx="18" ry="10" fill={`url(#${gid}-shine)`} />

      {/* Họa tiết đặc trưng từng loài */}
      {pet === 'panda' && (
        <>
          <ellipse cx="36" cy="49" rx="8.5" ry="7" transform="rotate(-18 36 49)" fill={c.detail} />
          <ellipse cx="64" cy="49" rx="8.5" ry="7" transform="rotate(18 64 49)" fill={c.detail} />
        </>
      )}
      {pet === 'cat' && (
        <>
          <ellipse cx="50" cy="70" rx="6" ry="5" fill="#FBBF24" />
          <text x="50" y="72.5" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#78350F">福</text>
        </>
      )}
      {pet === 'shiba' && (
        <>
          <circle cx="38" cy="41" r="2.6" fill="#FFFBEB" />
          <circle cx="62" cy="41" r="2.6" fill="#FFFBEB" />
        </>
      )}
      {pet === 'fox' && (
        <path d="M22 57 Q50 47 78 57 Q74 80 50 84 Q26 80 22 57 Z" fill="#FFF7ED" fillOpacity="0.92" />
      )}

      {/* Má hồng */}
      <ellipse cx="29" cy="59" rx="5.5" ry="3.2" fill={c.cheek} fillOpacity="0.55" />
      <ellipse cx="71" cy="59" rx="5.5" ry="3.2" fill={c.cheek} fillOpacity="0.55" />

      {/* Mắt & biểu cảm */}
      {mood === 'happy' || mood === 'combo' || mood === 'kudos' ? (
        <>
          <path d="M32 50 Q36 44 41 50" stroke={pet === 'panda' ? '#FFFFFF' : '#1E293B'} strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <path d="M59 50 Q64 44 68 50" stroke={pet === 'panda' ? '#FFFFFF' : '#1E293B'} strokeWidth="3.2" strokeLinecap="round" fill="none" />
        </>
      ) : mood === 'wrong' ? (
        <>
          <path d="M33 48 L40 52 M40 48 L33 52" stroke={pet === 'panda' ? '#FFFFFF' : '#1E293B'} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M60 48 L67 52 M67 48 L60 52" stroke={pet === 'panda' ? '#FFFFFF' : '#1E293B'} strokeWidth="2.6" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="36" cy="49" r="4.3" fill={pet === 'panda' ? '#FFFFFF' : '#1E293B'} />
          <circle cx="64" cy="49" r="4.3" fill={pet === 'panda' ? '#FFFFFF' : '#1E293B'} />
          <circle cx="34.5" cy="47.5" r="1.5" fill="#FFFFFF" />
          <circle cx="62.5" cy="47.5" r="1.5" fill="#FFFFFF" />
        </>
      )}

      {/* Mũi & miệng */}
      <ellipse cx="50" cy="56" rx="3" ry="2" fill="#0F172A" />
      {mood === 'happy' || mood === 'combo' || mood === 'kudos' ? (
        <path d="M44 60 Q50 67 56 60 Z" fill="#FB7185" />
      ) : mood === 'wrong' ? (
        <path d="M45 63 Q50 59 55 63" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      ) : mood === 'curious' ? (
        <circle cx="50" cy="62" r="2.6" fill="#FB7185" />
      ) : (
        <path d="M45 60 Q48 63 50 60 Q52 63 55 60" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      )}

      {/* Chân nhỏ 3D */}
      <ellipse cx="36" cy="84" rx="7" ry="4.5" fill={`url(#${gid}-body)`} />
      <ellipse cx="64" cy="84" rx="7" ry="4.5" fill={`url(#${gid}-body)`} />

      {/* Vương miện mini khi combo */}
      {(mood === 'combo' || mood === 'kudos') && (
        <path d="M39 20 L43 10 L50 16 L57 10 L61 20 Z" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5" strokeLinejoin="round" />
      )}
    </svg>
  )
}
