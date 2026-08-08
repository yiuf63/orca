import type { IDisposable, IParser, Terminal } from '@xterm/xterm'
import { guardParserHandler } from './terminal-parser-handler-guard'

type TerminalPrivates = {
  _core?: {
    _renderService?: {
      pause?: () => void
      resume?: () => void
    }
  }
}

// Why: DECSET 2026 (?2026h / ?2026l) batches screen updates to eliminate TUI screen tearing.
export function installTerminalSynchronousOutputHandler(
  terminal: Terminal,
  parser: Pick<IParser, 'registerCsiHandler'>,
  fallbackTimeoutMs: number = 50
): IDisposable {
  const core = (terminal as unknown as TerminalPrivates)._core
  let isSyncActive = false
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = (): void => {
    if (fallbackTimer !== null) {
      clearTimeout(fallbackTimer)
      fallbackTimer = null
    }
  }

  const flush = (): void => {
    clearTimer()
    if (isSyncActive) {
      isSyncActive = false
      core?._renderService?.resume?.()
    }
  }

  const pause = (): void => {
    clearTimer()
    if (!isSyncActive) {
      isSyncActive = true
      core?._renderService?.pause?.()
    }
    fallbackTimer = setTimeout(flush, fallbackTimeoutMs)
  }

  const csiEnableDisposable = parser.registerCsiHandler(
    { prefix: '?', final: 'h' },
    guardParserHandler('csi-2026-sync-enable', (params) => {
      if (params.length === 1 && params[0] === 2026) {
        pause()
        return true
      }
      return false
    })
  )

  const csiDisableDisposable = parser.registerCsiHandler(
    { prefix: '?', final: 'l' },
    guardParserHandler('csi-2026-sync-disable', (params) => {
      if (params.length === 1 && params[0] === 2026) {
        flush()
        return true
      }
      return false
    })
  )

  return {
    dispose: () => {
      flush()
      csiEnableDisposable.dispose()
      csiDisableDisposable.dispose()
    }
  }
}
