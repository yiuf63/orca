import React, { useEffect, useRef, useState } from 'react'
import type nomnomlNamespace from 'nomnoml'
import DOMPurify from 'dompurify'
import DiagramLightbox from './DiagramLightbox'
import { translate } from '@/i18n/i18n'
import { getNomnomlThemeSource } from './nomnoml-config'

type NomnomlApi = typeof nomnomlNamespace

// Why: keep the renderer out of the eager chunk; it is only needed when a
// nomnoml block actually renders.
let nomnomlModulePromise: Promise<NomnomlApi> | null = null

function loadNomnoml(): Promise<NomnomlApi> {
  if (!nomnomlModulePromise) {
    nomnomlModulePromise = import('nomnoml').then((mod) => mod.default)
  }
  return nomnomlModulePromise
}

type NomnomlBlockProps = {
  content: string
  isDark: boolean
  hideCopyButton?: boolean
}

/**
 * Renders a nomnoml UML diagram as SVG. Falls back to raw source with an
 * error banner if the syntax is invalid — never breaks the rest of the preview.
 */
export default function NomnomlBlock({
  content,
  isDark,
  hideCopyButton = false
}: NomnomlBlockProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    const render = async (): Promise<void> => {
      try {
        const nomnoml = await loadNomnoml()
        if (cancelled) {
          return
        }
        const svg = nomnoml.renderSvg(getNomnomlThemeSource(content, isDark), document)
        if (!cancelled && containerRef.current) {
          // Why: diagram output is generated markup; sanitize before inserting.
          containerRef.current.innerHTML = DOMPurify.sanitize(svg, {
            USE_PROFILES: { svg: true }
          })
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Invalid nomnoml syntax')
        }
      }
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [content, isDark])

  if (error) {
    return (
      <div className="nomnoml-block">
        <div className="nomnoml-error">
          {translate('auto.components.editor.MermaidBlock.dcc132e691', 'Diagram error:')} {error}
        </div>
        <pre>
          <code>{content}</code>
        </pre>
      </div>
    )
  }

  return (
    <div
      className="nomnoml-block group relative cursor-pointer hover:ring-1 hover:ring-primary/40 rounded transition-all"
      onClick={() => setIsLightboxOpen(true)}
    >
      <div ref={containerRef} />
      <DiagramLightbox
        svgHtml={containerRef.current?.innerHTML}
        sourceCode={content}
        isOpen={isLightboxOpen}
        onOpenChange={setIsLightboxOpen}
        hideCopyButton={hideCopyButton}
      />
    </div>
  )
}
