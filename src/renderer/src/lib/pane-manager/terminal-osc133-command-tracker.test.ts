import { describe, expect, it, vi } from 'vitest'
import type { IDecoration, IMarker, Terminal } from '@xterm/xterm'
import { createTerminalOsc133CommandTracker } from './terminal-osc133-command-tracker'

function createHarness(): {
  terminal: Terminal
  setCursorLine: (line: number) => void
  scrollToLine: ReturnType<typeof vi.fn>
  scrollToBottom: ReturnType<typeof vi.fn>
} {
  let cursorLine = 0
  let nextMarkerId = 1
  const active = { baseY: 0, cursorY: 0, viewportY: 0 }
  const scrollToLine = vi.fn((line: number) => {
    active.viewportY = line
  })
  const scrollToBottom = vi.fn()
  const terminal = {
    buffer: { active },
    registerMarker: vi.fn(() => {
      const disposeListeners = new Set<() => void>()
      let disposed = false
      const line = cursorLine
      return {
        id: nextMarkerId++,
        get line() {
          return disposed ? -1 : line
        },
        get isDisposed() {
          return disposed
        },
        onDispose: (listener: () => void) => {
          disposeListeners.add(listener)
          return { dispose: () => disposeListeners.delete(listener) }
        },
        dispose: () => {
          if (disposed) {
            return
          }
          disposed = true
          for (const listener of disposeListeners) {
            listener()
          }
        }
      } as IMarker
    }),
    registerDecoration: vi.fn(({ marker }: { marker: IMarker }) => {
      let disposed = false
      const decoration = {
        marker,
        element: undefined,
        options: {},
        get isDisposed() {
          return disposed
        },
        onDispose: () => ({ dispose: vi.fn() }),
        onRender: () => ({ dispose: vi.fn() }),
        dispose: () => {
          disposed = true
        }
      }
      return decoration as unknown as IDecoration
    }),
    scrollToLine,
    scrollToBottom
  } as unknown as Terminal

  return {
    terminal,
    setCursorLine(line) {
      cursorLine = line
      active.baseY = line
      active.cursorY = 0
    },
    scrollToLine,
    scrollToBottom
  }
}

describe('createTerminalOsc133CommandTracker', () => {
  it('tracks prompt, command, and successful completion semantics', () => {
    const harness = createHarness()
    const tracker = createTerminalOsc133CommandTracker(harness.terminal)

    harness.setCursorLine(12)
    tracker.handleSequence('A')
    tracker.handleSequence('B')
    tracker.handleSequence('C')
    tracker.handleSequence('D;0')

    expect(tracker.getCommands()).toEqual([
      {
        line: 12,
        state: 'succeeded',
        promptComplete: true,
        commandStarted: true,
        exitCode: 0
      }
    ])
  })

  it('supports C/D-only shells and non-zero exit status', () => {
    const harness = createHarness()
    const tracker = createTerminalOsc133CommandTracker(harness.terminal)

    harness.setCursorLine(4)
    tracker.handleSequence('C')
    tracker.handleSequence('C')
    tracker.handleSequence('D;130')
    tracker.handleSequence('D;130')

    expect(tracker.getCommands()).toEqual([
      expect.objectContaining({ line: 4, state: 'failed', exitCode: 130 })
    ])
  })

  it('moves an unexecuted prompt marker while deduplicating same-line integrations', () => {
    const harness = createHarness()
    const tracker = createTerminalOsc133CommandTracker(harness.terminal)

    harness.setCursorLine(3)
    tracker.handleSequence('A')
    tracker.handleSequence('A')
    expect(tracker.getCommands()).toHaveLength(1)

    harness.setCursorLine(8)
    tracker.handleSequence('A')
    expect(tracker.getCommands()).toEqual([
      expect.objectContaining({ line: 8, commandStarted: false })
    ])
  })

  it('navigates command markers in both directions and returns to the bottom', () => {
    const harness = createHarness()
    const tracker = createTerminalOsc133CommandTracker(harness.terminal)
    for (const line of [5, 20]) {
      harness.setCursorLine(line)
      tracker.handleSequence('A')
      tracker.handleSequence('B')
      tracker.handleSequence('C')
      tracker.handleSequence('D;0')
    }
    harness.setCursorLine(30)

    expect(tracker.navigate('previous')).toBe(true)
    expect(harness.scrollToLine).toHaveBeenLastCalledWith(20)
    expect(tracker.navigate('previous')).toBe(true)
    expect(harness.scrollToLine).toHaveBeenLastCalledWith(5)
    expect(tracker.navigate('next')).toBe(true)
    expect(harness.scrollToLine).toHaveBeenLastCalledWith(20)
    expect(tracker.navigate('next')).toBe(true)
    expect(harness.scrollToBottom).toHaveBeenCalledOnce()
  })

  it('drops marker state on dispose', () => {
    const harness = createHarness()
    const tracker = createTerminalOsc133CommandTracker(harness.terminal)
    tracker.handleSequence('C')

    tracker.dispose()

    expect(tracker.getCommands()).toEqual([])
    expect(tracker.navigate('previous')).toBe(false)
  })
})
