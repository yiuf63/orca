import React, { useEffect, useRef, useState } from 'react'
import type Viz from 'viz.js'
import DOMPurify from 'dompurify'
import { translate } from '@/i18n/i18n'

type VizApi = typeof Viz
type VizFullRenderModule = {
  default: {
    Module: { run(): void }
    render: (instance: unknown, src: string, options: unknown) => string
  }
}

// Why: viz.js is an asm.js Graphviz build (~900KB) only needed when a DOT
// block renders, so load it lazily and reuse one Emscripten module instance.
let vizInstancePromise: Promise<InstanceType<VizApi>> | null = null

function loadVizInstance(): Promise<InstanceType<VizApi>> {
  if (!vizInstancePromise) {
    vizInstancePromise = Promise.all([import('viz.js'), import('viz.js/full.render.js')]).then(
      ([vizModule, fullRenderModule]) => {
        const VizClass = (vizModule as { default: VizApi }).default
        const fullRender = (fullRenderModule as VizFullRenderModule).default
        return new VizClass({ Module: fullRender.Module, render: fullRender.render })
      }
    )
  }
  return vizInstancePromise
}

type DotBlockProps = {
  content: string
  isDark: boolean
}

/**
 * Renders a Graphviz DOT diagram as SVG. Falls back to raw source with an
 * error banner if the syntax is invalid — never breaks the rest of the preview.
 */
export default function DotBlock({ content, isDark }: DotBlockProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const render = async (): Promise<void> => {
      try {
        const viz = await loadVizInstance()
        if (cancelled) {
          return
        }
        const svg = await viz.renderString(content, { format: 'svg', engine: 'dot' })
        if (!cancelled && containerRef.current) {
          // Why: graphviz output can carry external references; sanitize before inserting.
          containerRef.current.innerHTML = DOMPurify.sanitize(svg, {
            USE_PROFILES: { svg: true }
          })
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Invalid graphviz syntax')
        }
      }
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [content])

  const containerClassName = isDark ? 'dot-block dot-block-dark' : 'dot-block'

  if (error) {
    return (
      <div className={containerClassName}>
        <div className="dot-error">
          {translate('auto.components.editor.MermaidBlock.dcc132e691', 'Diagram error:')} {error}
        </div>
        <pre>
          <code>{content}</code>
        </pre>
      </div>
    )
  }

  return <div className={containerClassName} ref={containerRef} />
}
