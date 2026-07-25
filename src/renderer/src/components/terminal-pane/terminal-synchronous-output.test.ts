import type { IDisposable, IParser, Terminal } from '@xterm/xterm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installTerminalSynchronousOutputHandler } from './terminal-synchronous-output'

describe('installTerminalSynchronousOutputHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pauses and resumes render service on ?2026h and ?2026l', () => {
    const pause = vi.fn()
    const resume = vi.fn()
    const handlers = new Map<string, (params: (number | number[])[]) => boolean>()

    const fakeTerminal = {
      _core: {
        _renderService: { pause, resume }
      }
    } as unknown as Terminal

    const fakeParser: Pick<IParser, 'registerCsiHandler'> = {
      registerCsiHandler: (ident, handler) => {
        const key = `${ident.prefix ?? ''}${ident.final}`
        handlers.set(key, handler as (params: (number | number[])[]) => boolean)
        return { dispose: () => handlers.delete(key) } as IDisposable
      }
    }

    const handler = installTerminalSynchronousOutputHandler(fakeTerminal, fakeParser, 100)

    const enableHandler = handlers.get('?h')!
    const disableHandler = handlers.get('?l')!

    expect(enableHandler([2026])).toBe(true)
    expect(pause).toHaveBeenCalledTimes(1)

    expect(disableHandler([2026])).toBe(true)
    expect(resume).toHaveBeenCalledTimes(1)

    handler.dispose()
  })

  it('flushes on fallback timeout if disable is missing', () => {
    const pause = vi.fn()
    const resume = vi.fn()
    const handlers = new Map<string, (params: (number | number[])[]) => boolean>()

    const fakeTerminal = {
      _core: {
        _renderService: { pause, resume }
      }
    } as unknown as Terminal

    const fakeParser: Pick<IParser, 'registerCsiHandler'> = {
      registerCsiHandler: (ident, handler) => {
        const key = `${ident.prefix ?? ''}${ident.final}`
        handlers.set(key, handler as (params: (number | number[])[]) => boolean)
        return { dispose: () => handlers.delete(key) } as IDisposable
      }
    }

    const handler = installTerminalSynchronousOutputHandler(fakeTerminal, fakeParser, 100)

    const enableHandler = handlers.get('?h')!
    enableHandler([2026])
    expect(pause).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)
    expect(resume).toHaveBeenCalledTimes(1)

    handler.dispose()
  })
})
