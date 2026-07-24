// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../shared/constants'
import { LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'
import type {
  GlobalWindowsRuntimeDefault,
  LocalWindowsRuntimePreference
} from '../../../shared/project-execution-runtime'
import { resetWindowsTerminalCapabilitiesForTests } from '@/lib/windows-terminal-capabilities'
import { useAppStore } from '@/store'
import { useActiveProjectSkillRuntime } from './useActiveProjectSkillRuntime'

type StubbedWindowsApi = {
  wslIsAvailable: ReturnType<typeof vi.fn>
  wslListDistros: ReturnType<typeof vi.fn>
  pwshIsAvailable: ReturnType<typeof vi.fn>
  gitBashIsAvailable: ReturnType<typeof vi.fn>
  runtimeGetStatus: ReturnType<typeof vi.fn>
}

const roots: Root[] = []
let latestRuntime: ReturnType<typeof useActiveProjectSkillRuntime> | null = null

function stubWindowsApi(): StubbedWindowsApi {
  const wslIsAvailable = vi.fn().mockResolvedValue(true)
  const wslListDistros = vi.fn().mockResolvedValue(['Ubuntu'])
  const pwshIsAvailable = vi.fn().mockResolvedValue(true)
  const gitBashIsAvailable = vi.fn().mockResolvedValue(true)
  const runtimeGetStatus = vi.fn().mockResolvedValue({ hostPlatform: 'win32' })

  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      platform: { get: () => ({ platform: 'win32' }) },
      wsl: { isAvailable: wslIsAvailable, listDistros: wslListDistros },
      pwsh: { isAvailable: pwshIsAvailable },
      gitBash: { isAvailable: gitBashIsAvailable },
      runtime: { getStatus: runtimeGetStatus }
    }
  })

  return {
    wslIsAvailable,
    wslListDistros,
    pwshIsAvailable,
    gitBashIsAvailable,
    runtimeGetStatus
  }
}

function seedActiveWindowsProject(
  args: {
    projectRuntimePreference?: LocalWindowsRuntimePreference
    localWindowsRuntimeDefault?: GlobalWindowsRuntimeDefault
  } = {}
): void {
  useAppStore.setState({
    activeRepoId: 'repo-1',
    activeWorktreeId: 'worktree-1',
    settings: {
      ...getDefaultSettings('D:\\workspaces'),
      localWindowsRuntimeDefault: args.localWindowsRuntimeDefault ?? { kind: 'windows-host' }
    },
    projects: [
      {
        id: 'project-1',
        sourceRepoIds: ['repo-1'],
        localWindowsRuntimePreference: args.projectRuntimePreference
      }
    ],
    repos: [
      {
        id: 'repo-1',
        path: 'D:\\Code\\orca',
        connectionId: null,
        executionHostId: LOCAL_EXECUTION_HOST_ID
      }
    ],
    worktreesByRepo: {
      'repo-1': [
        {
          id: 'worktree-1',
          repoId: 'repo-1',
          projectId: 'project-1',
          path: 'D:\\Code\\orca',
          hostId: LOCAL_EXECUTION_HOST_ID
        }
      ]
    }
  } as unknown as Partial<ReturnType<typeof useAppStore.getState>>)
}

function Probe(): null {
  latestRuntime = useActiveProjectSkillRuntime()
  return null
}

async function renderProbe(): Promise<void> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)

  await act(async () => {
    root.render(createElement(Probe))
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useActiveProjectSkillRuntime', () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount())
    }
    latestRuntime = null
    useAppStore.setState(useAppStore.getInitialState(), true)
    resetWindowsTerminalCapabilitiesForTests()
    Reflect.deleteProperty(window, 'api')
  })

  it('does not probe WSL for active Windows host projects', async () => {
    const api = stubWindowsApi()
    seedActiveWindowsProject({ projectRuntimePreference: { kind: 'windows-host' } })

    await renderProbe()

    expect(api.wslIsAvailable).not.toHaveBeenCalled()
    expect(api.wslListDistros).not.toHaveBeenCalled()
    expect(api.pwshIsAvailable).toHaveBeenCalledTimes(1)
    expect(api.gitBashIsAvailable).toHaveBeenCalledTimes(1)
    expect(latestRuntime?.projectRuntime).toMatchObject({
      status: 'resolved',
      runtime: { kind: 'windows-host' }
    })
  })

  it('probes WSL when the active project is configured for WSL', async () => {
    const api = stubWindowsApi()
    seedActiveWindowsProject({
      projectRuntimePreference: { kind: 'wsl', distro: 'Ubuntu' }
    })

    await renderProbe()

    expect(api.wslIsAvailable).toHaveBeenCalledTimes(1)
    expect(api.wslListDistros).toHaveBeenCalledTimes(1)
    expect(latestRuntime?.projectRuntime).toMatchObject({
      status: 'resolved',
      runtime: { kind: 'wsl', distro: 'Ubuntu' }
    })
  })
})
