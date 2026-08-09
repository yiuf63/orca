import React, { useState } from 'react'
import { Maximize2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import MediaLightboxModal from './MediaLightboxModal'
import { translate } from '@/i18n/i18n'

type DiagramLightboxProps = {
  svgHtml: string | undefined
  sourceCode: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  hideCopyButton?: boolean
}

/**
 * Hover action bar (copy source / expand) plus the fullscreen zoom/pan modal
 * shared by every diagram block renderer.
 */
export default function DiagramLightbox({
  svgHtml,
  sourceCode,
  isOpen,
  onOpenChange,
  hideCopyButton = false
}: DiagramLightboxProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const handleCopyCode = (e: React.MouseEvent): void => {
    e.stopPropagation()
    void window.api.ui
      .writeClipboardText(sourceCode)
      .then(() => {
        setCopied(true)
        toast.success(
          translate('auto.components.editor.DiagramLightbox.copied', 'Copied diagram code')
        )
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {
        // Silently swallow clipboard write failures.
      })
  }

  return (
    <>
      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 z-10 transition-opacity">
        {!hideCopyButton && (
          <button
            type="button"
            className="p-1.5 rounded-md bg-background/80 hover:bg-accent text-muted-foreground hover:text-foreground border border-border/50 shadow-sm transition-all"
            onClick={handleCopyCode}
            title={translate('auto.components.editor.CodeBlockCopyButton.1f9f4def45', 'Copy code')}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        )}
        <button
          type="button"
          className="p-1.5 rounded-md bg-background/80 hover:bg-accent text-muted-foreground hover:text-foreground border border-border/50 shadow-sm transition-all"
          onClick={(e) => {
            e.stopPropagation()
            onOpenChange(true)
          }}
          title={translate('auto.components.editor.DiagramLightbox.zoom', 'Expand & Zoom')}
        >
          <Maximize2 size={13} />
        </button>
      </div>
      <MediaLightboxModal isOpen={isOpen} svgHtml={svgHtml} onClose={() => onOpenChange(false)} />
    </>
  )
}
