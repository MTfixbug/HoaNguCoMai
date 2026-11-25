import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

/**
 * Native <dialog> modal adhering to modern-web-guidance:
 * - No manual role="dialog", aria-modal, or body overflow locking
 * - Uses showModal() + ::backdrop scroll containment CSS
 * - Progressive fallback for light-dismiss when dialog.closedBy is absent
 */
export default function GlassDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = '',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  maxWidthClass?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (open) {
      if (!dlg.open) dlg.showModal()
    } else if (dlg.open) {
      dlg.close()
    }
  }, [open])

  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    const handleClose = () => onClose()
    dlg.addEventListener('close', handleClose)

    // Progressive enhancement fallback when closedBy="any" isn't supported
    let cleanupOutside: (() => void) | undefined
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      let pressedOutside = false
      const isOutside = (e: PointerEvent) => {
        const r = dlg.getBoundingClientRect()
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
      }
      const onDown = (e: PointerEvent) => {
        pressedOutside = dlg.open && isOutside(e)
      }
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && dlg.open && isOutside(e)) dlg.close()
        pressedOutside = false
      }
      dlg.addEventListener('pointerdown', onDown)
      dlg.addEventListener('pointerup', onUp)
      cleanupOutside = () => {
        dlg.removeEventListener('pointerdown', onDown)
        dlg.removeEventListener('pointerup', onUp)
      }
    }

    return () => {
      dlg.removeEventListener('close', handleClose)
      cleanupOutside?.()
    }
  }, [onClose])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      className={`glass-dialog ${maxWidthClass}`}
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-glass-strong px-5 py-4 backdrop-blur-md">
        <div>
          <h1 id={titleId} className="text-lg font-bold tracking-tight">
            {title}
          </h1>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
        <button
          type="button"
          className="glass-pill-btn !min-h-9 !px-2.5"
          onClick={() => ref.current?.close()}
          aria-label="Đóng hộp thoại"
        >
          <X size={17} />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  )
}
