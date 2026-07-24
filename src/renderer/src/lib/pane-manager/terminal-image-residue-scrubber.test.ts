import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createTerminalImageResidueScrubber,
  scrubInactiveImageTilesFromLine
} from './terminal-image-residue-scrubber'

const HAS_EXTENDED_ATTRS = 0x10000000

function createLine(
  attrs: Record<
    number,
    {
      imageId?: number
      tileId?: number
      underlineStyle?: number
      urlId?: number
      isEmpty?: () => boolean
    }
  >,
  extendedColumns: number[]
): { _data: Uint32Array; _extendedAttrs: typeof attrs } {
  const data = new Uint32Array(12)
  for (const column of extendedColumns) {
    data[column * 3 + 2] |= HAS_EXTENDED_ATTRS
  }
  return { _data: data, _extendedAttrs: attrs }
}

describe('scrubInactiveImageTilesFromLine', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preserves active top-layer image tiles after text clears HAS_EXTENDED', () => {
    const line = createLine({ 1: { imageId: 7, tileId: 2 } }, [])

    expect(scrubInactiveImageTilesFromLine(line, (imageId) => imageId === 7)).toBe(0)
    expect(line._extendedAttrs[1]).toEqual({ imageId: 7, tileId: 2 })
  })

  it('deletes inactive image-only attrs and clears the cell flag', () => {
    const line = createLine({ 1: { imageId: 7, tileId: 2, isEmpty: vi.fn(() => true) } }, [1])

    expect(scrubInactiveImageTilesFromLine(line, () => false)).toBe(1)
    expect(line._extendedAttrs[1]).toBeUndefined()
    expect(line._data[5] & HAS_EXTENDED_ATTRS).toBe(0)
  })

  it('keeps underline and hyperlink attrs after removing an inactive image', () => {
    const attrs = {
      imageId: 7,
      tileId: 2,
      underlineStyle: 1,
      urlId: 4,
      isEmpty: vi.fn(() => false)
    }
    const line = createLine({ 1: attrs }, [1])

    expect(scrubInactiveImageTilesFromLine(line, () => false)).toBe(1)
    expect(line._extendedAttrs[1]).toBe(attrs)
    expect(attrs.imageId).toBe(-1)
    expect(attrs.tileId).toBe(-1)
    expect(line._data[5] & HAS_EXTENDED_ATTRS).toBe(HAS_EXTENDED_ATTRS)
  })

  it('drops all stale attrs when the cell no longer points at extended data', () => {
    const line = createLine({ 1: { imageId: 7, tileId: 2, underlineStyle: 1, urlId: 4 } }, [])

    expect(scrubInactiveImageTilesFromLine(line, () => false)).toBe(1)
    expect(line._extendedAttrs[1]).toBeUndefined()
  })

  it('scans xterm private normal and alternate buffers in idle slices', () => {
    let idleCallback!: (deadline: IdleDeadline) => void
    vi.stubGlobal(
      'requestIdleCallback',
      vi.fn((callback: (deadline: IdleDeadline) => void) => {
        idleCallback = callback
        return 1
      })
    )
    vi.stubGlobal('cancelIdleCallback', vi.fn())
    const activeLine = createLine({ 0: { imageId: 2, tileId: 0 } }, [0])
    const staleLine = createLine({ 0: { imageId: 3, tileId: 0 } }, [0])
    const lines = (line: ReturnType<typeof createLine>) => ({
      length: 1,
      get: () => line
    })
    const terminal = {
      _core: {
        _bufferService: {
          buffers: {
            normal: { lines: lines(activeLine) },
            alt: { lines: lines(staleLine) }
          }
        }
      }
    }
    const imageAddon = { _storage: { _images: new Map([[2, {}]]) } }
    const scrubber = createTerminalImageResidueScrubber(terminal as never, imageAddon as never)

    scrubber.schedule()
    expect(idleCallback).not.toBeNull()
    idleCallback({
      didTimeout: false,
      timeRemaining: () => 10
    })

    expect(activeLine._extendedAttrs[0]?.imageId).toBe(2)
    expect(staleLine._extendedAttrs[0]).toBeUndefined()
    scrubber.dispose()
  })
})
