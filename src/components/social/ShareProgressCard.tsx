import { Download, Share2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PET_CATALOG, getRankForXp } from '../../lib/gamification'
import type { PetType } from '../../types/lms'

interface ShareProgressCardProps {
  studentName: string
  streakDays: number
  xpPoints: number
  learnedCount: number
  todayDone: number
  currentLevel: number
  targetLevel: number
  petType?: PetType
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function ShareProgressCard({
  studentName,
  streakDays,
  xpPoints,
  learnedCount,
  todayDone,
  currentLevel,
  targetLevel,
  petType = 'cat',
}: ShareProgressCardProps) {
  const [busy, setBusy] = useState(false)

  const renderCardBlob = async (): Promise<Blob> => {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1350
    const ctx = canvas.getContext('2d')!

    const grad = ctx.createLinearGradient(0, 0, 1080, 1350)
    grad.addColorStop(0, '#E9F4EF')
    grad.addColorStop(0.55, '#F8F6EE')
    grad.addColorStop(1, '#F1E6DB')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 1080, 1350)

    // Soft card surface
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    roundRect(ctx, 72, 84, 936, 1182, 48)
    ctx.fill()
    ctx.strokeStyle = 'rgba(43,107,92,0.16)'
    ctx.lineWidth = 4
    ctx.stroke()

    // Header badge
    ctx.fillStyle = '#2B6B5C'
    roundRect(ctx, 132, 148, 360, 64, 32)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 28px sans-serif'
    ctx.fillText('HOA NGỮ CÔ MAI · HSK 3.0', 162, 190)

    // Student name & rank
    const rank = getRankForXp(xpPoints)
    const pet = PET_CATALOG.find((p) => p.id === petType) ?? PET_CATALOG[0]
    ctx.fillStyle = '#1D2B27'
    ctx.font = 'bold 58px sans-serif'
    ctx.fillText(studentName, 132, 310)
    ctx.fillStyle = '#5B6D68'
    ctx.font = '32px sans-serif'
    ctx.fillText(`Hành trình HSK ${Math.max(1, currentLevel)} → HSK ${targetLevel} · ${rank.title}`, 132, 366)

    // Big streak & hanzi centerpiece
    ctx.fillStyle = '#FFF5E8'
    roundRect(ctx, 132, 430, 816, 280, 36)
    ctx.fill()
    ctx.fillStyle = '#C97B2B'
    ctx.font = 'bold 124px sans-serif'
    ctx.fillText(`${streakDays}`, 182, 590)
    ctx.font = 'bold 42px sans-serif'
    ctx.fillText('NGÀY LIÊN TIẾP', 182, 650)
    ctx.fillStyle = '#2B6B5C'
    ctx.font = 'bold 116px serif'
    ctx.fillText('加油!', 610, 600)

    // 3 metrics boxes
    const metrics = [
      { label: 'Thẻ hôm nay', value: `${todayDone}`, color: '#2B6B5C' },
      { label: 'Từ đã học', value: `${learnedCount}`, color: '#455A88' },
      { label: 'Điểm tích lũy', value: `${xpPoints} XP`, color: '#B46528' },
    ]
    metrics.forEach((m, i) => {
      const bx = 132 + i * 282
      ctx.fillStyle = '#F4F7F5'
      roundRect(ctx, bx, 760, 252, 220, 28)
      ctx.fill()
      ctx.fillStyle = m.color
      ctx.font = 'bold 54px sans-serif'
      ctx.fillText(m.value, bx + 28, 865)
      ctx.fillStyle = '#5B6D68'
      ctx.font = '26px sans-serif'
      ctx.fillText(m.label, bx + 28, 922)
    })

    // Footer note
    ctx.fillStyle = '#1D2B27'
    ctx.font = 'bold 34px sans-serif'
    ctx.fillText(`Bạn đồng hành: ${pet.nameVi}`, 132, 1086)
    ctx.fillStyle = '#5B6D68'
    ctx.font = '28px sans-serif'
    ctx.fillText('Mỗi ngày 10–15 phút · Ghi nhớ bền vững cùng SM-2 & Lộ trình cá nhân', 132, 1142)
    ctx.fillStyle = '#2B6B5C'
    ctx.font = 'bold 26px sans-serif'
    ctx.fillText(`Ngày ${new Date().toLocaleDateString('vi-VN')}`, 132, 1205)

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không tạo được ảnh chia sẻ'))), 'image/png')
    })
  }

  const handleShareOrDownload = async (preferNativeShare: boolean) => {
    setBusy(true)
    try {
      const blob = await renderCardBlob()
      const file = new File([blob], `hoangucoMai-hsk-${new Date().toISOString().slice(0, 10)}.png`, { type: 'image/png' })
      if (preferNativeShare && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Chuỗi ${streakDays} ngày học tiếng Trung cùng Hoa Ngữ Cô Mai`,
          text: `Hôm nay mình đã hoàn thành ${todayDone} thẻ và tích lũy ${xpPoints} XP!`,
          files: [file],
        })
        toast.success('Đã mở bảng chia sẻ thành tích')
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Đã tải ảnh thành tích (1080×1350 PNG)')
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        toast.error('Không thể xuất ảnh thành tích trên trình duyệt này.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleShareOrDownload(true)}
        className="glass-pill-btn glass-primary-btn text-xs min-h-11 px-4"
      >
        <Share2 size={15} /> {busy ? 'Đang tạo ảnh...' : 'Chia sẻ thành tích'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleShareOrDownload(false)}
        className="glass-pill-btn text-xs min-h-11 px-4"
      >
        <Download size={15} /> Tải thẻ PNG
      </button>
    </div>
  )
}
