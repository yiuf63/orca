import type { IDecoration, IDisposable, IMarker, Terminal } from '@xterm/xterm'

const MAX_TRACKED_COMMANDS = 1000

export type TerminalCommandMarkerState = 'prompt' | 'running' | 'succeeded' | 'failed' | 'completed'

type TrackedCommand = {
  id: number
  marker: IMarker
  decoration: IDecoration | null
  markerDisposable: IDisposable
  renderDisposable: IDisposable | null
  state: TerminalCommandMarkerState
  promptComplete: boolean
  commandStarted: boolean
  exitCode: number | null
  removing: boolean
}

export type TerminalCommandMarkerSnapshot = {
  line: number
  state: TerminalCommandMarkerState
  promptComplete: boolean
  commandStarted: boolean
  exitCode: number | null
}

export type TerminalOsc133CommandTracker = IDisposable & {
  handleSequence: (payload: string) => void
  navigate: (direction: 'previous' | 'next') => boolean
  getCommands: () => TerminalCommandMarkerSnapshot[]
}

function parseExitCode(value: string | undefined): number | null {
  if (!value) {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function stateForExitCode(exitCode: number | null): TerminalCommandMarkerState {
  if (exitCode === null) {
    return 'completed'
  }
  return exitCode === 0 ? 'succeeded' : 'failed'
}

function applyDecorationState(command: TrackedCommand, element: HTMLElement): void {
  element.classList.add('xterm-command-marker')
  element.dataset.commandState = command.state
  element.setAttribute('aria-hidden', 'true')
}

export function createTerminalOsc133CommandTracker(
  terminal: Terminal
): TerminalOsc133CommandTracker {
  let disposed = false
  let nextId = 1
  let openCommand: TrackedCommand | null = null
  let navigationCommandId: number | null = null
  const commands: TrackedCommand[] = []

  const removeCommand = (command: TrackedCommand, disposeMarker: boolean): void => {
    if (command.removing) {
      return
    }
    command.removing = true
    const index = commands.indexOf(command)
    if (index !== -1) {
      commands.splice(index, 1)
    }
    if (openCommand === command) {
      openCommand = null
    }
    if (navigationCommandId === command.id) {
      navigationCommandId = null
    }
    command.renderDisposable?.dispose()
    command.decoration?.dispose()
    command.markerDisposable.dispose()
    if (disposeMarker && !command.marker.isDisposed) {
      command.marker.dispose()
    }
  }

  const trimCommands = (): void => {
    while (commands.length > MAX_TRACKED_COMMANDS) {
      removeCommand(commands[0], true)
    }
  }

  const createCommand = (): TrackedCommand | null => {
    let marker: IMarker
    try {
      marker = terminal.registerMarker(0)
    } catch {
      return null
    }
    if (!marker || marker.isDisposed || marker.line < 0) {
      return null
    }

    const command: TrackedCommand = {
      id: nextId++,
      marker,
      decoration: null,
      markerDisposable: { dispose: () => undefined },
      renderDisposable: null,
      state: 'prompt',
      promptComplete: false,
      commandStarted: false,
      exitCode: null,
      removing: false
    }
    command.markerDisposable = marker.onDispose(() => removeCommand(command, false))
    try {
      command.decoration =
        terminal.registerDecoration({
          marker,
          x: 0,
          width: 1,
          layer: 'top'
        }) ?? null
      command.renderDisposable =
        command.decoration?.onRender((element) => applyDecorationState(command, element)) ?? null
    } catch {
      command.decoration = null
      command.renderDisposable = null
    }
    commands.push(command)
    trimCommands()
    return command
  }

  const updateCommandState = (command: TrackedCommand, state: TerminalCommandMarkerState): void => {
    command.state = state
    if (command.decoration?.element) {
      applyDecorationState(command, command.decoration.element)
    }
  }

  const beginPrompt = (): void => {
    navigationCommandId = null
    if (openCommand && !openCommand.commandStarted) {
      const cursorLine = terminal.buffer.active.baseY + terminal.buffer.active.cursorY
      if (openCommand.marker.line === cursorLine) {
        return
      }
      removeCommand(openCommand, true)
    }
    if (openCommand?.state === 'running') {
      openCommand.exitCode = null
      updateCommandState(openCommand, 'completed')
    }
    openCommand = createCommand()
  }

  const finishPrompt = (): void => {
    if (openCommand) {
      openCommand.promptComplete = true
    }
  }

  const startCommand = (): void => {
    navigationCommandId = null
    if (openCommand?.state === 'running') {
      return
    }
    if (!openCommand) {
      openCommand = createCommand()
    }
    if (!openCommand) {
      return
    }
    openCommand.promptComplete = true
    openCommand.commandStarted = true
    updateCommandState(openCommand, 'running')
  }

  const finishCommand = (exitCode: number | null): void => {
    navigationCommandId = null
    if (!openCommand) {
      return
    }
    openCommand.promptComplete = true
    openCommand.commandStarted = true
    openCommand.exitCode = exitCode
    updateCommandState(openCommand, stateForExitCode(exitCode))
    openCommand = null
  }

  const navigableCommands = (): TrackedCommand[] =>
    commands.filter(
      (command) => command.commandStarted && !command.marker.isDisposed && command.marker.line >= 0
    )

  const navigate = (direction: 'previous' | 'next'): boolean => {
    const available = navigableCommands()
    if (available.length === 0) {
      return false
    }

    const currentIndex =
      navigationCommandId === null
        ? -1
        : available.findIndex((command) => command.id === navigationCommandId)
    let targetIndex = -1
    if (direction === 'previous') {
      if (currentIndex > 0) {
        targetIndex = currentIndex - 1
      } else if (currentIndex === -1) {
        const cursorLine = terminal.buffer.active.baseY + terminal.buffer.active.cursorY
        for (let index = available.length - 1; index >= 0; index -= 1) {
          if (available[index].marker.line < cursorLine) {
            targetIndex = index
            break
          }
        }
      }
    } else if (currentIndex !== -1) {
      if (currentIndex === available.length - 1) {
        navigationCommandId = null
        terminal.scrollToBottom()
        return true
      }
      targetIndex = currentIndex + 1
    } else {
      const viewportLine = terminal.buffer.active.viewportY
      targetIndex = available.findIndex((command) => command.marker.line > viewportLine)
    }

    const target = available[targetIndex]
    if (!target) {
      return false
    }
    navigationCommandId = target.id
    terminal.scrollToLine(target.marker.line)
    return true
  }

  return {
    handleSequence(payload) {
      if (disposed) {
        return
      }
      const [sequence, value] = payload.split(';')
      if (sequence === 'A') {
        beginPrompt()
      } else if (sequence === 'B') {
        finishPrompt()
      } else if (sequence === 'C') {
        startCommand()
      } else if (sequence === 'D') {
        finishCommand(parseExitCode(value))
      }
    },
    navigate,
    getCommands() {
      return commands.map((command) => ({
        line: command.marker.line,
        state: command.state,
        promptComplete: command.promptComplete,
        commandStarted: command.commandStarted,
        exitCode: command.exitCode
      }))
    },
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      while (commands.length > 0) {
        removeCommand(commands[0], true)
      }
      openCommand = null
      navigationCommandId = null
    }
  }
}
