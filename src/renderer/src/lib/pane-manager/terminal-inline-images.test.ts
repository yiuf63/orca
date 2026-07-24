import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ManagedPaneInternal } from './pane-manager-types'
import {
  attachTerminalInlineImages,
  disposeTerminalInlineImages,
  TERMINAL_INLINE_IMAGE_OPTIONS
} from './terminal-inline-images'

const imageAddonMock = vi.hoisted(() => ({
  constructorOptions: null as Record<string, unknown> | null,
  imageAdded: null as (() => void) | null,
  dispose: vi.fn()
}))

vi.mock('@xterm/addon-image', () => ({
  ImageAddon: vi.fn().mockImplementation(function ImageAddon(options: Record<string, unknown>) {
    imageAddonMock.constructorOptions = options
    return {
      _storage: { _images: new Map() },
      onImageAdded: (listener: () => void) => {
        imageAddonMock.imageAdded = listener
        return { dispose: vi.fn() }
      },
      dispose: imageAddonMock.dispose
    }
  })
}))

function createPane(): ManagedPaneInternal {
  const event = vi.fn(() => ({ dispose: vi.fn() }))
  return {
    id: 1,
    terminal: {
      loadAddon: vi.fn(),
      onWriteParsed: event,
      onResize: event,
      buffer: { onBufferChange: event }
    },
    imageAddon: null,
    imageResidueScrubberDisposable: null,
    hasInlineImages: false
  } as unknown as ManagedPaneInternal
}

describe('terminal inline images', () => {
  beforeEach(() => {
    imageAddonMock.constructorOptions = null
    imageAddonMock.imageAdded = null
    imageAddonMock.dispose.mockClear()
  })

  it('loads SIXEL, iTerm2, and Kitty support with bounded memory', () => {
    const pane = createPane()

    attachTerminalInlineImages(pane)

    expect(pane.terminal.loadAddon).toHaveBeenCalledWith(pane.imageAddon)
    expect(imageAddonMock.constructorOptions).toEqual(TERMINAL_INLINE_IMAGE_OPTIONS)
    expect(imageAddonMock.constructorOptions).toMatchObject({
      enableSizeReports: false,
      pixelLimit: 2048 * 2048,
      storageLimit: 32,
      showPlaceholder: false
    })
  })

  it('marks the pane after its first image and releases addon resources', () => {
    const pane = createPane()
    attachTerminalInlineImages(pane)

    imageAddonMock.imageAdded?.()
    expect(pane.hasInlineImages).toBe(true)

    disposeTerminalInlineImages(pane)
    expect(imageAddonMock.dispose).toHaveBeenCalledOnce()
    expect(pane.imageAddon).toBeNull()
    expect(pane.imageResidueScrubberDisposable).toBeNull()
    expect(pane.hasInlineImages).toBe(false)
  })
})
