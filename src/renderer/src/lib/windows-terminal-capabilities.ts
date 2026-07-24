import { useEffect, useMemo, useState } from 'react'
import {
  readWindowsTerminalCapabilities,
  type WindowsTerminalCapabilityLoadTarget
} from './windows-terminal-capability-read'
import {
  UNAVAILABLE_CAPABILITIES,
  deletePendingWindowsTerminalCapabilities,
  getCachedWindowsTerminalCapabilities,
  getCachedWindowsTerminalCapabilityEntry,
  getPendingWindowsTerminalCapabilities,
  hasCachedWindowsTerminalCapabilities,
  isLatestWindowsTerminalCapabilityRequest,
  pruneExpiredWindowsTerminalCapabilityOwners,
  publishWindowsTerminalCapabilities,
  resetWindowsTerminalCapabilityCacheForTests,
  resolveWindowsTerminalCapabilityBaseOwnerKey,
  resolveWindowsTerminalCapabilityCacheKey,
  setLatestWindowsTerminalCapabilityRequestId,
  setPendingWindowsTerminalCapabilities,
  subscribeWindowsTerminalCapabilities
} from './windows-terminal-capability-cache'

export {
  getCachedWindowsTerminalCapabilities,
  getWindowsTerminalCapabilityOwnerKey,
  hasCachedWindowsTerminalCapabilities
} from './windows-terminal-capability-cache'

export type WindowsTerminalCapabilities = {
  wslAvailable: boolean
  wslDistros: string[]
  pwshAvailable: boolean
  gitBashAvailable: boolean
  hostPlatform: NodeJS.Platform | null
  isLoading: boolean
}

const CAPABILITY_CACHE_TTL_MS = 30_000
let nextCapabilityRequestId = 0

type WindowsTerminalCapabilityHookState = {
  ownerKey: string
  capabilities: WindowsTerminalCapabilities
}

export function loadWindowsTerminalCapabilities(
  options: {
    force?: boolean
    now?: number
    ownerKey?: string
    target?: WindowsTerminalCapabilityLoadTarget
    sshConnectionId?: string | null
    includeWsl?: boolean
  } = {}
): Promise<WindowsTerminalCapabilities> {
  const now = options.now ?? Date.now()
  const sshConnectionId = options.sshConnectionId?.trim() || null
  const target = options.target ?? { kind: 'local' }
  const includeWsl = options.includeWsl ?? true
  const baseOwnerKey = resolveWindowsTerminalCapabilityBaseOwnerKey({
    ownerKey: options.ownerKey,
    target,
    sshConnectionId
  })
  const cacheKey = resolveWindowsTerminalCapabilityCacheKey(baseOwnerKey, includeWsl)
  pruneExpiredWindowsTerminalCapabilityOwners(now)
  const cached = getCachedWindowsTerminalCapabilityEntry(baseOwnerKey, includeWsl)
  if (cached && !options.force && now - cached.loadedAt < CAPABILITY_CACHE_TTL_MS) {
    return Promise.resolve(cached.capabilities)
  }
  const pendingCapabilities = getPendingWindowsTerminalCapabilities(baseOwnerKey, includeWsl)
  if (pendingCapabilities && !options.force) {
    return pendingCapabilities
  }

  // Why: Settings, status bar, and paired web tab bars need one shared answer.
  // Separate probes can leave one surface showing stale Windows shell choices.
  const requestId = ++nextCapabilityRequestId
  setLatestWindowsTerminalCapabilityRequestId(cacheKey, requestId)
  const nextPendingCapabilities = readWindowsTerminalCapabilities(
    target,
    sshConnectionId,
    includeWsl
  )
    .then((capabilities) => {
      if (isLatestWindowsTerminalCapabilityRequest(cacheKey, requestId)) {
        deletePendingWindowsTerminalCapabilities(cacheKey)
        publishWindowsTerminalCapabilities(capabilities, cacheKey, now)
        return capabilities
      }
      return getCachedWindowsTerminalCapabilities(baseOwnerKey, includeWsl)
    })
    .catch(() => {
      if (isLatestWindowsTerminalCapabilityRequest(cacheKey, requestId)) {
        deletePendingWindowsTerminalCapabilities(cacheKey)
        publishWindowsTerminalCapabilities(UNAVAILABLE_CAPABILITIES, cacheKey, now)
        return UNAVAILABLE_CAPABILITIES
      }
      return getCachedWindowsTerminalCapabilities(baseOwnerKey, includeWsl)
    })

  setPendingWindowsTerminalCapabilities(cacheKey, nextPendingCapabilities)
  return nextPendingCapabilities
}

export function refreshWindowsTerminalCapabilities(
  ownerKey: string | undefined = undefined,
  target: WindowsTerminalCapabilityLoadTarget = { kind: 'local' },
  sshConnectionId?: string | null,
  includeWsl = true
): Promise<WindowsTerminalCapabilities> {
  return loadWindowsTerminalCapabilities({
    force: true,
    ownerKey,
    target,
    sshConnectionId,
    includeWsl
  })
}

export function selectWindowsTerminalCapabilitiesForOwner(
  state: WindowsTerminalCapabilityHookState,
  enabled: boolean,
  ownerKey: string,
  includeWsl = true
): WindowsTerminalCapabilities {
  if (!enabled) {
    return UNAVAILABLE_CAPABILITIES
  }
  const cacheKey = resolveWindowsTerminalCapabilityCacheKey(ownerKey, includeWsl)
  return state.ownerKey === cacheKey || state.ownerKey === ownerKey
    ? state.capabilities
    : getCachedWindowsTerminalCapabilities(ownerKey, includeWsl)
}

export function useWindowsTerminalCapabilities(
  enabled: boolean,
  forceRefreshOnMount = false,
  ownerKey: string | undefined = undefined,
  target: WindowsTerminalCapabilityLoadTarget = { kind: 'local' },
  sshConnectionId?: string | null,
  includeWsl = true
): WindowsTerminalCapabilities {
  const targetKind = target.kind
  const targetEnvironmentId = target.kind === 'environment' ? target.environmentId : null
  const sshConnectionIdKey = sshConnectionId?.trim() || null
  const resolvedTarget: WindowsTerminalCapabilityLoadTarget = useMemo(
    () =>
      targetKind === 'environment' && targetEnvironmentId
        ? { kind: 'environment', environmentId: targetEnvironmentId }
        : { kind: 'local' },
    [targetKind, targetEnvironmentId]
  )
  const baseOwnerKey = resolveWindowsTerminalCapabilityBaseOwnerKey({
    ownerKey,
    target: resolvedTarget,
    sshConnectionId: sshConnectionIdKey
  })
  const resolvedOwnerKey = resolveWindowsTerminalCapabilityCacheKey(baseOwnerKey, includeWsl)
  const [state, setState] = useState(() => ({
    ownerKey: resolvedOwnerKey,
    capabilities: getCachedWindowsTerminalCapabilities(baseOwnerKey, includeWsl)
  }))

  useEffect(() => {
    if (!enabled) {
      setState({ ownerKey: resolvedOwnerKey, capabilities: UNAVAILABLE_CAPABILITIES })
      return
    }
    let cancelled = false
    const cached = getCachedWindowsTerminalCapabilities(baseOwnerKey, includeWsl)
    const hasOwnerCache = hasCachedWindowsTerminalCapabilities(baseOwnerKey, includeWsl)
    setState({
      ownerKey: resolvedOwnerKey,
      capabilities: hasOwnerCache ? cached : { ...cached, isLoading: true }
    })
    const setCapabilities = (capabilities: WindowsTerminalCapabilities): void => {
      setState({ ownerKey: resolvedOwnerKey, capabilities })
    }
    const unsubscribe = subscribeWindowsTerminalCapabilities(resolvedOwnerKey, setCapabilities)
    void loadWindowsTerminalCapabilities({
      force: forceRefreshOnMount,
      ownerKey,
      target: resolvedTarget,
      sshConnectionId: sshConnectionIdKey,
      includeWsl
    }).then((nextCapabilities) => {
      if (!cancelled) {
        setState({ ownerKey: resolvedOwnerKey, capabilities: nextCapabilities })
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [
    baseOwnerKey,
    enabled,
    forceRefreshOnMount,
    includeWsl,
    ownerKey,
    resolvedOwnerKey,
    resolvedTarget,
    sshConnectionIdKey
  ])

  return selectWindowsTerminalCapabilitiesForOwner(state, enabled, baseOwnerKey, includeWsl)
}

export function resetWindowsTerminalCapabilitiesForTests(): void {
  nextCapabilityRequestId = 0
  resetWindowsTerminalCapabilityCacheForTests()
}
