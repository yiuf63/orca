import React, { useEffect, useState } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, X, Copy, Download } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'

type MediaLightboxModalProps = {
  isOpen: boolean
  title?: string
  imageSrc?: string
  svgHtml?: string
  onClose: () => void
}

export default function MediaLightboxModal({
  isOpen,
  title,
  imageSrc,
  svgHtml,
  onClose
}: MediaLightboxModalProps): React.JSX.Element | null {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = React.useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (isOpen) {
      setScale(1.2)
      setPosition({ x: 0, y: 0 })
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  const handleZoomIn = (): void => setScale((prev) => Math.min(prev + 0.3, 5))
  const handleZoomOut = (): void => setScale((prev) => Math.max(prev - 0.3, 0.4))
  const handleReset = (): void => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleWheel = (e: React.WheelEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY < 0 ? 0.15 : -0.15
    setScale((prev) => Math.min(Math.max(prev + delta, 0.4), 5))
  }

  const handleMouseDown = (e: React.MouseEvent): void => {
    if (e.button !== 0) {
      return
    }
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y }
  }

  const handleMouseMove = (e: React.MouseEvent): void => {
    if (!isDragging) {
      return
    }
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    })
  }

  const handleMouseUp = (): void => {
    setIsDragging(false)
  }

  const handleCopy = async (): Promise<void> => {
    try {
      if (svgHtml) {
        await window.api.ui.writeClipboardText(svgHtml)
        toast.success(
          translate('auto.components.editor.MediaLightboxModal.copied', 'Copied SVG to clipboard')
        )
      } else if (imageSrc) {
        await window.api.ui.writeClipboardText(imageSrc)
        toast.success(
          translate(
            'auto.components.editor.MediaLightboxModal.copiedImg',
            'Copied image path to clipboard'
          )
        )
      }
    } catch {
      toast.error(
        translate('auto.components.editor.MediaLightboxModal.copyFailed', 'Failed to copy')
      )
    }
  }

  const handleDownload = (): void => {
    if (svgHtml) {
      const blob = new Blob([svgHtml], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title || 'diagram'}.svg`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(
        translate('auto.components.editor.MediaLightboxModal.downloaded', 'Downloaded SVG')
      )
    } else if (imageSrc) {
      const a = document.createElement('a')
      a.href = imageSrc
      a.download = `${title || 'image'}.png`
      a.click()
      toast.success(
        translate('auto.components.editor.MediaLightboxModal.downloadedImg', 'Downloaded image')
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/85 backdrop-blur-md transition-all select-none"
      onClick={onClose}
    >
      <div
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-3 px-5 py-2.5 bg-black/85 text-white rounded-full shadow-2xl border border-white/20 backdrop-blur-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-medium text-white/90 truncate max-w-[180px] border-r border-white/20 pr-3">
          {title || translate('auto.components.editor.MediaLightboxModal.title', 'Diagram preview')}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            onClick={handleCopy}
            title={translate(
              'auto.components.editor.MediaLightboxModal.copy',
              'Copy Diagram/Image'
            )}
          >
            <Copy size={16} />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            onClick={handleDownload}
            title={translate(
              'auto.components.editor.MediaLightboxModal.download',
              'Download Diagram/Image'
            )}
          >
            <Download size={16} />
          </button>
          <div className="h-4 w-px bg-white/20 mx-1" />
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            onClick={handleZoomIn}
            title={translate('auto.components.editor.MediaLightboxModal.zoomIn', 'Zoom In')}
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            onClick={handleZoomOut}
            title={translate('auto.components.editor.MediaLightboxModal.zoomOut', 'Zoom Out')}
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors text-xs font-mono"
            onClick={handleReset}
            title={translate('auto.components.editor.MediaLightboxModal.reset', 'Reset')}
          >
            <RotateCcw size={15} />
          </button>
          <div className="h-4 w-px bg-white/20 mx-1" />
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-red-500/80 text-white/90 transition-colors"
            onClick={onClose}
            title={translate('auto.components.editor.MediaLightboxModal.close', 'Close')}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div
        className="flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing p-6"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out'
          }}
          className="flex items-center justify-center max-w-full max-h-full"
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={translate('auto.components.editor.MediaLightboxModal.alt', 'Lightbox')}
              className="max-w-none max-h-none object-contain shadow-2xl rounded"
              draggable={false}
            />
          ) : svgHtml ? (
            <div
              className="bg-white/95 text-black p-6 rounded-lg shadow-2xl overflow-visible [&_svg]:max-w-none [&_svg]:h-auto min-w-[300px]"
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
