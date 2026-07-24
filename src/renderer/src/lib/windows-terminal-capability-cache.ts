import type { WindowsTerminalCapabilityLoadTarget } from './windows-terminal-capability-read'
import type { WindowsTerminalCapabilities } from './windows-terminal-capabilities'

export const UNAVAILABLE_CAPABILITIES: WindowsTerminalCapabilities = {
  wslAvailable: false,
  wslDistros: [],
  pwshAvailable: false,
  gitBashAvailable: false,
  hostPlatform: null,
  isLoading: false
}

const CAPABILITY_CACHE_TTL_MS = 30_000
const CAPABILITY_OWNER_CACHE_MAX = 32

export type CapabilityCacheKey = string

const cachedCapabilitiesByCacheKey = new Map<
  CapabilityCacheKey,
  { capabilities: WindowsTerminalCapabilities; loadedAt: number }
>()
const pendingCapabilitiesByCacheKey = new Map<
  CapabilityCacheKey,
  Promise<WindowsTerminalCapabilities>
>()
const latestCapabilityRequestIdByCacheKey = new Map<CapabilityCacheKey, number>()
const subscribersByCacheKey = new Map<
  CapabilityCacheKey,
  Set<(capabilities: WindowsTerminalCapabilities) => void>
>()

export function getWindowsTerminalCapabilityOwnerKey(
  activeRuntimeEnvironmentId?: string | null,
  sshConnectionId?: string | null
): string {
  // Why: remote desktop and paired web clients can switch hosts; Git Bash/WSL
  // availability is host-owned, so a previous runtime's answer must not bleed into the next.
  const connectionId = sshConnectionId?.trim()
  const environmentId = activeRuntimeEnvironmentId?.trim()
  if (connectionId && environmentId) {
    return `runtime:${environmentId}:ssh:${connectionId}`
  }
  if (connectionId) {
    return `ssh:${connectionId}`
  }
  return environmentId ? `runtime:${environmentId}` : 'local'
}

export function resolveWindowsTerminalCapabilityBaseOwnerKey(args: {
  ownerKey?: string
  target?: WindowsTerminalCapabilityLoadTarget
  sshConnectionId?: string | null
}): string {
  const explicitOwnerKey = args.ownerKey?.trim()
  if (explicitOwnerKey) {
    return explicitOwnerKey
  }
  const environmentId = args.target?.kind === 'environment' ? args.target.environmentId : null
  return getWindowsTerminalCapabilityOwnerKey(environmentId, args.sshConnectionId)
}

export function resolveWindowsTerminalCapabilityCacheKey(
  ownerKey: string,
  includeWsl: boolean
): CapabilityCacheKey {
  return `${ownerKey}:${includeWsl ? 'full' : 'host'}`
}

export function getCachedWindowsTerminalCapabilityEntry(
  ownerKey: string,
  includeWsl: boolean
): { capabilities: WindowsTerminalCapabilities; loadedAt: number } | undefined {
  for (const cacheKey of getCapabilityCacheKeys(ownerKey, includeWsl)) {
    const cached = cachedCapabilitiesByCacheKey.get(cacheKey)
    if (cached) {
      return cached
    }
  }
  return undefined
}

export function getPendingWindowsTerminalCapabilities(
  ownerKey: string,
  includeWsl: boolean
): Promise<WindowsTerminalCapabilities> | undefined {
  for (const cacheKey of getCapabilityCacheKeys(ownerKey, includeWsl)) {
    const pending = pendingCapabilitiesByCacheKey.get(cacheKey)
    if (pending) {
      return pending
    }
  }
  return undefined
}

export function getCachedWindowsTerminalCapabilities(
  ownerKey = 'local',
  includeWsl = true
): WindowsTerminalCapabilities {
  return (
    getCachedWindowsTerminalCapabilityEntry(ownerKey, includeWsl)?.capabilities ??
    UNAVAILABLE_CAPABILITIES
  )
}

export function hasCachedWindowsTerminalCapabilities(
  ownerKey = 'local',
  includeWsl = true
): boolean {
  return getCachedWindowsTerminalCapabilityEntry(ownerKey, includeWsl) !== undefined
}

export function setLatestWindowsTerminalCapabilityRequestId(
  cacheKey: CapabilityCacheKey,
  requestId: number
): void {
  latestCapabilityRequestIdByCacheKey.set(cacheKey, requestId)
}

export function isLatestWindowsTerminalCapabilityRequest(
  cacheKey: CapabilityCacheKey,
  requestId: number
): boolean {
  return requestId === latestCapabilityRequestIdByCacheKey.get(cacheKey)
}

export function setPendingWindowsTerminalCapabilities(
  cacheKey: CapabilityCacheKey,
  pending: Promise<WindowsTerminalCapabilities>
): void {
  pendingCapabilitiesByCacheKey.set(cacheKey, pending)
}

export function deletePendingWindowsTerminalCapabilities(cacheKey: CapabilityCacheKey): void {
  pendingCapabilitiesByCacheKey.delete(cacheKey)
}

export function publishWindowsTerminalCapabilities(
  capabilities: WindowsTerminalCapabilities,
  cacheKey: CapabilityCacheKey,
  loadedAt = Date.now()
): void {
  cachedCapabilitiesByCacheKey.delete(cacheKey)
  cachedCapabilitiesByCacheKey.set(cacheKey, { capabilities, loadedAt })
  trimCapabilityOwnerCaches()
  for (const subscriber of subscribersByCacheKey.get(cacheKey) ?? []) {
    subscriber(capabilities)
  }
}

export function pruneExpiredWindowsTerminalCapabilityOwners(now: number): void {
  for (const [cacheKey, cached] of cachedCapabilitiesByCacheKey) {
    if (
      now - cached.loadedAt >= CAPABILITY_CACHE_TTL_MS &&
      !pendingCapabilitiesByCacheKey.has(cacheKey) &&
      !subscribersByCacheKey.has(cacheKey)
    ) {
      cachedCapabilitiesByCacheKey.delete(cacheKey)
      latestCapabilityRequestIdByCacheKey.delete(cacheKey)
    }
  }
}

export function subscribeWindowsTerminalCapabilities(
  cacheKey: CapabilityCacheKey,
  subscriber: (capabilities: WindowsTerminalCapabilities) => void
): () => void {
  const subscribers = subscribersByCacheKey.get(cacheKey) ?? new Set()
  subscribers.add(subscriber)
  subscribersByCacheKey.set(cacheKey, subscribers)
  return () => {
    const currentSubscribers = subscribersByCacheKey.get(cacheKey)
    currentSubscribers?.delete(subscriber)
    if (currentSubscribers?.size === 0) {
      subscribersByCacheKey.delete(cacheKey)
    }
  }
}

export function resetWindowsTerminalCapabilityCacheForTests(): void {
  cachedCapabilitiesByCacheKey.clear()
  pendingCapabilitiesByCacheKey.clear()
  latestCapabilityRequestIdByCacheKey.clear()
  subscribersByCacheKey.clear()
}

function getCapabilityCacheKeys(ownerKey: string, includeWsl: boolean): CapabilityCacheKey[] {
  const fullKey = resolveWindowsTerminalCapabilityCacheKey(ownerKey, true)
  if (includeWsl) {
    return [fullKey]
  }
  return [fullKey, resolveWindowsTerminalCapabilityCacheKey(ownerKey, false)]
}

function trimCapabilityOwnerCaches(): void {
  while (cachedCapabilitiesByCacheKey.size > CAPABILITY_OWNER_CACHE_MAX) {
    const oldest = cachedCapabilitiesByCacheKey.keys().next().value
    if (oldest === undefined) {
      break
    }
    cachedCapabilitiesByCacheKey.delete(oldest)
    if (!pendingCapabilitiesByCacheKey.has(oldest) && !subscribersByCacheKey.has(oldest)) {
      latestCapabilityRequestIdByCacheKey.delete(oldest)
    }
  }
}
