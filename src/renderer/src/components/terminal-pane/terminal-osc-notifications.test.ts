import { describe, expect, it } from 'vitest'
import {
  createOscNotificationThrottler,
  parseOsc777Notification,
  parseOsc9Notification
} from './terminal-osc-notifications'

describe('terminal-osc-notifications', () => {
  it('parses single-part OSC 9 notification', () => {
    expect(parseOsc9Notification('Build finished', 'My App')).toEqual({
      title: 'My App',
      body: 'Build finished'
    })
  })

  it('parses title and body OSC 9 notification', () => {
    expect(parseOsc9Notification('Build System;Compilation succeeded', 'My App')).toEqual({
      title: 'Build System',
      body: 'Compilation succeeded'
    })
  })

  it('returns null for empty OSC 9 payload', () => {
    expect(parseOsc9Notification('  ', 'My App')).toBeNull()
  })

  it('parses OSC 777 notify;title;body', () => {
    expect(parseOsc777Notification('notify;Cargo;Tests passed', 'Terminal')).toEqual({
      title: 'Cargo',
      body: 'Tests passed'
    })
  })

  it('parses OSC 777 notify;body', () => {
    expect(parseOsc777Notification('notify;Tests passed', 'Terminal')).toEqual({
      title: 'Terminal',
      body: 'Tests passed'
    })
  })

  it('rejects non-notify OSC 777 action', () => {
    expect(parseOsc777Notification('other;Cargo;Tests passed', 'Terminal')).toBeNull()
  })

  it('throttles notifications within cooldown window', () => {
    const shouldFire = createOscNotificationThrottler(1000)
    expect(shouldFire('msg')).toBe(true)
    expect(shouldFire('msg')).toBe(false)
  })
})
