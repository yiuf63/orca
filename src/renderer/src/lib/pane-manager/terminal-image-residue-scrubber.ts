import type { IDisposable, Terminal } from '@xterm/xterm'
import type { ImageAddon } from '@xterm/addon-image'

const CELL_SIZE = 3
const CELL_BG_OFFSET = 2
const HAS_EXTENDED_ATTRS = 0x10000000
const LINES_PER_IDLE_SLICE = 200

type ImageExtendedAttrs = {
  imageId?: number
  tileId?: number
  underlineStyle?: number
  urlId?: number
  isEmpty?: () => boolean
}

type ImageBufferLine = {
  _data: Uint32Array
  _extendedAttrs: Record<number, ImageExtendedAttrs | undefined>
}

type ImageBufferLines = {
  length: number
  get: (index: number) => ImageBufferLine | undefined
}

type ImageBuffer = {
  lines?: ImageBufferLines
}

type TerminalImagePrivates = {
  _core?: {
    _bufferService?: {
      buffers?: {
        normal?: ImageBuffer
        alt?: ImageBuffer
        alternate?: ImageBuffer
      }
    }
    buffers?: {
      normal?: ImageBuffer
      alt?: ImageBuffer
      alternate?: ImageBuffer
    }
  }
}

type ImageAddonPrivates = {
  _storage?: {
    _images?: {
      has: (imageId: number) => boolean
    }
  }
}

type ScheduledIdleWork =
  | { kind: 'idle'; handle: number }
  | { kind: 'timeout'; handle: ReturnType<typeof setTimeout> }

function resolveBufferLines(terminal: Terminal): ImageBufferLines[] {
  const core = (terminal as unknown as TerminalImagePrivates)._core
  const buffers = core?._bufferService?.buffers ?? core?.buffers
  const candidates = [buffers?.normal?.lines, buffers?.alt?.lines, buffers?.alternate?.lines]
  const unique = new Set<ImageBufferLines>()
  for (const lines of candidates) {
    if (lines && typeof lines.get === 'function') {
      unique.add(lines)
    }
  }
  return [...unique]
}

function resolveActiveImages(imageAddon: ImageAddon): ImageAddonPrivates['_storage'] | null {
  const storage = (imageAddon as unknown as ImageAddonPrivates)._storage
  return storage?._images && typeof storage._images.has === 'function' ? storage : null
}

function imageAttrsAreOtherwiseEmpty(attrs: ImageExtendedAttrs): boolean {
  if (typeof attrs.isEmpty === 'function') {
    try {
      return attrs.isEmpty()
    } catch {
      return false
    }
  }
  return (attrs.underlineStyle ?? 0) === 0 && (attrs.urlId ?? 0) === 0
}

export function scrubInactiveImageTilesFromLine(
  line: ImageBufferLine,
  isImageActive: (imageId: number) => boolean
): number {
  let removed = 0
  for (const key of Object.keys(line._extendedAttrs)) {
    const column = Number(key)
    const attrs = line._extendedAttrs[column]
    const imageId = attrs?.imageId
    // Why: Kitty top-layer images remain visible after text clears the cell flag.
    if (!attrs || imageId === undefined || imageId === -1 || isImageActive(imageId)) {
      continue
    }

    const bgIndex = column * CELL_SIZE + CELL_BG_OFFSET
    const hasExtendedBit = (line._data[bgIndex] & HAS_EXTENDED_ATTRS) !== 0
    if (!hasExtendedBit) {
      delete line._extendedAttrs[column]
      removed += 1
      continue
    }

    attrs.imageId = -1
    attrs.tileId = -1
    if (imageAttrsAreOtherwiseEmpty(attrs)) {
      delete line._extendedAttrs[column]
      line._data[bgIndex] &= ~HAS_EXTENDED_ATTRS
    }
    removed += 1
  }
  return removed
}

function requestIdleWork(callback: (deadline: IdleDeadline) => void): ScheduledIdleWork {
  if (typeof globalThis.requestIdleCallback === 'function') {
    return { kind: 'idle', handle: globalThis.requestIdleCallback(callback, { timeout: 250 }) }
  }
  return {
    kind: 'timeout',
    handle: globalThis.setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 0 }), 0)
  }
}

function cancelIdleWork(work: ScheduledIdleWork): void {
  if (work.kind === 'idle' && typeof globalThis.cancelIdleCallback === 'function') {
    globalThis.cancelIdleCallback(work.handle)
    return
  }
  if (work.kind === 'timeout') {
    globalThis.clearTimeout(work.handle)
  }
}

export type TerminalImageResidueScrubber = IDisposable & {
  schedule: () => void
}

export function createTerminalImageResidueScrubber(
  terminal: Terminal,
  imageAddon: ImageAddon
): TerminalImageResidueScrubber {
  let disposed = false
  let scheduled: ScheduledIdleWork | null = null
  let restartRequested = false
  let rescanRequested = false
  let lineGroups: ImageBufferLines[] = []
  let groupIndex = 0
  let lineIndex = 0

  const scheduleSlice = (): void => {
    if (!disposed && !scheduled) {
      scheduled = requestIdleWork(runSlice)
    }
  }

  const runSlice = (deadline: IdleDeadline): void => {
    scheduled = null
    if (disposed) {
      return
    }
    if (restartRequested) {
      restartRequested = false
      lineGroups = resolveBufferLines(terminal)
      groupIndex = 0
      lineIndex = 0
    }

    const storage = resolveActiveImages(imageAddon)
    if (!storage?._images || lineGroups.length === 0) {
      return
    }

    let scannedLines = 0
    while (groupIndex < lineGroups.length && scannedLines < LINES_PER_IDLE_SLICE) {
      if (scannedLines > 0 && !deadline.didTimeout && deadline.timeRemaining() <= 1) {
        break
      }
      const lines = lineGroups[groupIndex]
      if (lineIndex >= lines.length) {
        groupIndex += 1
        lineIndex = 0
        continue
      }
      const line = lines.get(lineIndex)
      lineIndex += 1
      scannedLines += 1
      if (line?._extendedAttrs && line._data) {
        scrubInactiveImageTilesFromLine(line, (imageId) => storage._images!.has(imageId))
      }
    }

    if (groupIndex < lineGroups.length) {
      scheduleSlice()
      return
    }
    lineGroups = []
    groupIndex = 0
    lineIndex = 0
    if (rescanRequested) {
      rescanRequested = false
      restartRequested = true
      scheduleSlice()
    }
  }

  return {
    schedule() {
      if (disposed) {
        return
      }
      if (scheduled || groupIndex < lineGroups.length) {
        rescanRequested = true
      } else {
        restartRequested = true
      }
      scheduleSlice()
    },
    dispose() {
      disposed = true
      if (scheduled) {
        cancelIdleWork(scheduled)
        scheduled = null
      }
      lineGroups = []
      rescanRequested = false
    }
  }
}
