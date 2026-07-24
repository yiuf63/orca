import { ImageAddon, type IImageAddonOptions } from '@xterm/addon-image'
import type { IDisposable, IEvent } from '@xterm/xterm'
import type { ManagedPaneInternal } from './pane-manager-types'
import { createTerminalImageResidueScrubber } from './terminal-image-residue-scrubber'

const INLINE_IMAGE_SEQUENCE_LIMIT = 16 * 1024 * 1024
const IMAGE_RESIDUE_SCRUB_INTERVAL_MS = 1000

export const TERMINAL_INLINE_IMAGE_OPTIONS = {
  // Why: Orca owns replay-safe CSI 14/16/18 replies and must avoid duplicate input.
  enableSizeReports: false,
  pixelLimit: 2048 * 2048,
  storageLimit: 32,
  showPlaceholder: false,
  sixelSizeLimit: INLINE_IMAGE_SEQUENCE_LIMIT,
  iipSizeLimit: INLINE_IMAGE_SEQUENCE_LIMIT,
  kittySizeLimit: INLINE_IMAGE_SEQUENCE_LIMIT
} satisfies Partial<IImageAddonOptions>

type OptionalTerminalEvents = {
  onResize?: IEvent<{ cols: number; rows: number }>
  buffer: {
    onBufferChange?: IEvent<unknown>
  }
}

function disposeAll(disposables: IDisposable[]): void {
  for (const disposable of disposables.splice(0)) {
    try {
      disposable.dispose()
    } catch {
      /* ignore */
    }
  }
}

export function attachTerminalInlineImages(pane: ManagedPaneInternal): void {
  if (pane.imageAddon) {
    return
  }

  const addon = new ImageAddon(TERMINAL_INLINE_IMAGE_OPTIONS)
  const scrubber = createTerminalImageResidueScrubber(pane.terminal, addon)
  const disposables: IDisposable[] = [scrubber]
  let lastScrubScheduledAt = 0
  let trailingScrubTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleScrub = (immediate = false): void => {
    if (!pane.hasInlineImages) {
      return
    }
    const elapsed = Date.now() - lastScrubScheduledAt
    if (immediate || elapsed >= IMAGE_RESIDUE_SCRUB_INTERVAL_MS) {
      if (trailingScrubTimer) {
        clearTimeout(trailingScrubTimer)
        trailingScrubTimer = null
      }
      lastScrubScheduledAt = Date.now()
      scrubber.schedule()
      return
    }
    if (!trailingScrubTimer) {
      trailingScrubTimer = setTimeout(() => {
        trailingScrubTimer = null
        lastScrubScheduledAt = Date.now()
        scrubber.schedule()
      }, IMAGE_RESIDUE_SCRUB_INTERVAL_MS - elapsed)
    }
  }
  disposables.push({
    dispose: () => {
      if (trailingScrubTimer) {
        clearTimeout(trailingScrubTimer)
        trailingScrubTimer = null
      }
    }
  })
  try {
    disposables.push(
      addon.onImageAdded(() => {
        pane.hasInlineImages = true
        scheduleScrub(true)
      })
    )
    pane.terminal.loadAddon(addon)
    disposables.push(
      pane.terminal.onWriteParsed(() => {
        scheduleScrub()
      })
    )

    const optionalEvents = pane.terminal as unknown as OptionalTerminalEvents
    const bufferChangeDisposable = optionalEvents.buffer.onBufferChange?.(() => scheduleScrub())
    if (bufferChangeDisposable) {
      disposables.push(bufferChangeDisposable)
    }
    const resizeDisposable = optionalEvents.onResize?.(() => scheduleScrub())
    if (resizeDisposable) {
      disposables.push(resizeDisposable)
    }

    pane.imageAddon = addon
    pane.imageResidueScrubberDisposable = {
      dispose: () => disposeAll(disposables)
    }
  } catch (error) {
    disposeAll(disposables)
    try {
      addon.dispose()
    } catch {
      /* ignore */
    }
    console.warn('[terminal] inline image support failed to attach for pane', pane.id, error)
  }
}

export function disposeTerminalInlineImages(pane: ManagedPaneInternal): void {
  pane.imageResidueScrubberDisposable?.dispose()
  pane.imageResidueScrubberDisposable = null
  try {
    pane.imageAddon?.dispose()
  } catch {
    /* ignore */
  }
  pane.imageAddon = null
  pane.hasInlineImages = false
}
