import type { Worktree } from '../../../shared/types'
import type { AppState } from '@/store/types'
import {
  isAutomationGeneratedWorkspace,
  isCliCreatedWorkspace,
  isDefaultBranchWorkspace,
  isDetachedHeadWorkspace
} from './worktree-sidebar-filter-predicates'

type SidebarFilterRevealState = Pick<
  AppState,
  | 'filterRepoIds'
  | 'hideAutomationGeneratedWorkspaces'
  | 'hideCliCreatedWorkspaces'
  | 'hideDefaultBranchWorkspace'
  | 'hideDetachedHeadWorkspaces'
>

type SidebarFilterRevealPatch = Partial<SidebarFilterRevealState>

export function buildSidebarFilterRevealPatchForWorktree(
  state: SidebarFilterRevealState,
  worktree: Worktree
): SidebarFilterRevealPatch {
  return {
    ...(state.filterRepoIds.length > 0 && !state.filterRepoIds.includes(worktree.repoId)
      ? { filterRepoIds: [] }
      : {}),
    ...(state.hideDefaultBranchWorkspace && isDefaultBranchWorkspace(worktree)
      ? { hideDefaultBranchWorkspace: false }
      : {}),
    ...(state.hideAutomationGeneratedWorkspaces && isAutomationGeneratedWorkspace(worktree)
      ? { hideAutomationGeneratedWorkspaces: false }
      : {}),
    ...(state.hideCliCreatedWorkspaces && isCliCreatedWorkspace(worktree)
      ? { hideCliCreatedWorkspaces: false }
      : {}),
    ...(state.hideDetachedHeadWorkspaces && isDetachedHeadWorkspace(worktree)
      ? { hideDetachedHeadWorkspaces: false }
      : {})
  }
}

export function activateAndRevealTargetWorktreeForSurface(
  state: Pick<
    AppState,
    | keyof SidebarFilterRevealState
    | 'activeWorktreeId'
    | 'getKnownWorktreeById'
    | 'setActiveWorktree'
    | 'setFilterRepoIds'
    | 'setHideAutomationGeneratedWorkspaces'
    | 'setHideCliCreatedWorkspaces'
    | 'setHideDefaultBranchWorkspace'
    | 'setHideDetachedHeadWorkspaces'
  >,
  worktreeId: string
): void {
  if (state.activeWorktreeId !== worktreeId) {
    state.setActiveWorktree(worktreeId)
  }

  const worktree = state.getKnownWorktreeById(worktreeId)
  if (!worktree) {
    return
  }
  const patch = buildSidebarFilterRevealPatchForWorktree(state, worktree)
  if (patch.filterRepoIds) {
    state.setFilterRepoIds(patch.filterRepoIds)
  }
  if (patch.hideDefaultBranchWorkspace === false) {
    state.setHideDefaultBranchWorkspace(false)
  }
  if (patch.hideAutomationGeneratedWorkspaces === false) {
    state.setHideAutomationGeneratedWorkspaces(false)
  }
  if (patch.hideCliCreatedWorkspaces === false) {
    state.setHideCliCreatedWorkspaces(false)
  }
  if (patch.hideDetachedHeadWorkspaces === false) {
    state.setHideDetachedHeadWorkspaces(false)
  }
}
