import { describe, expect, it } from 'vitest'
import {
  resolveTerminalShortcutAction,
  type TerminalShortcutEvent
} from './terminal-shortcut-policy'

function event(overrides: Partial<TerminalShortcutEvent>): TerminalShortcutEvent {
  return {
    key: '',
    code: '',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    ...overrides
  }
}

describe('OSC 133 command navigation shortcuts', () => {
  it('uses Cmd+Option+Arrow on macOS', () => {
    expect(
      resolveTerminalShortcutAction(
        event({ key: 'ArrowUp', code: 'ArrowUp', metaKey: true, altKey: true }),
        true
      )
    ).toEqual({ type: 'navigateCommand', direction: 'previous' })
    expect(
      resolveTerminalShortcutAction(
        event({ key: 'ArrowDown', code: 'ArrowDown', metaKey: true, altKey: true }),
        true
      )
    ).toEqual({ type: 'navigateCommand', direction: 'next' })
  })

  it('uses Ctrl+Shift+Arrow on Windows and Linux', () => {
    expect(
      resolveTerminalShortcutAction(
        event({ key: 'ArrowUp', code: 'ArrowUp', ctrlKey: true, shiftKey: true }),
        false
      )
    ).toEqual({ type: 'navigateCommand', direction: 'previous' })
    expect(
      resolveTerminalShortcutAction(
        event({ key: 'ArrowDown', code: 'ArrowDown', ctrlKey: true, shiftKey: true }),
        false
      )
    ).toEqual({ type: 'navigateCommand', direction: 'next' })
  })
})
