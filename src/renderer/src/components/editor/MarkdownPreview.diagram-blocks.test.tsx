// @vitest-environment happy-dom
//
// Regression guard for diagram fenced blocks: mermaid/dot/graphviz/nomnoml
// must dispatch to their render components and bypass the copy-button <pre>
// wrapper that would otherwise wrap a <div> in invalid HTML.

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storeState = {
  openFile: vi.fn(),
  activateMarkdownLink: vi.fn(),
  openMarkdownPreview: vi.fn(),
  setMarkdownViewMode: vi.fn(),
  markdownFrontmatterVisible: {},
  setPendingEditorReveal: vi.fn(),
  addDiffComment: vi.fn(),
  deleteDiffComment: vi.fn(),
  updateDiffComment: vi.fn(),
  clearDeliveredDiffComments: vi.fn(),
  keybindings: {},
  worktreesByRepo: {},
  repos: [],
  folderWorkspaces: [],
  projectGroups: [],
  openFiles: [],
  activeFileIdByWorktree: {},
  settings: { openLinksInApp: true },
  editorFontZoomLevel: 0
}

vi.mock('@/store', () => {
  const useAppStore = Object.assign(
    (selector: (s: typeof storeState) => unknown) => selector(storeState),
    { getState: () => storeState }
  )
  return { useAppStore }
})
vi.mock('@/store/slices/worktree-helpers', () => ({
  findWorktreeById: () => null
}))
vi.mock('@/runtime/runtime-rpc-client', () => ({
  settingsForRuntimeOwner: (settings: unknown) => settings
}))
vi.mock('@/runtime/runtime-file-client', () => ({
  statRuntimePath: vi.fn(async () => ({ isDirectory: false }))
}))
vi.mock('@/lib/connection-context', () => ({
  getConnectionIdForFile: () => null
}))
vi.mock('@/lib/connection-owner-resolution', () => ({
  createConnectionIdForFileSelector: () => () => undefined
}))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('./useLocalImageSrc', () => ({ useLocalImageSrc: (src?: string) => src }))
vi.mock('./MermaidBlock', () => ({
  default: () => <div data-testid="mermaid-block" />
}))
vi.mock('./DotBlock', () => ({
  default: () => <div data-testid="dot-block" />
}))
vi.mock('./NomnomlBlock', () => ({
  default: () => <div data-testid="nomnoml-block" />
}))
vi.mock('./CodeBlockCopyButton', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="code-block-wrapper">{children}</div>
  )
}))
vi.mock('../diff-comments/DiffCommentCard', () => ({ DiffCommentCard: () => null }))
vi.mock('./NotesSendMenu', () => ({ NotesSendMenu: () => null }))
vi.mock('./MarkdownTableOfContentsPanel', () => ({ MarkdownTableOfContentsPanel: () => null }))

import MarkdownPreview from './MarkdownPreview'

describe('MarkdownPreview diagram fenced blocks', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  function render(content: string): void {
    act(() => {
      root.render(
        <MarkdownPreview
          content={content}
          filePath="/repo/docs/diagrams.md"
          sourceWorktreeId="wt-1"
          scrollCacheKey="test-key"
        />
      )
    })
  }

  it('dispatches each diagram language to its render component', () => {
    render(
      [
        '```mermaid',
        'flowchart TD',
        '  A --> B',
        '```',
        '```dot',
        'digraph G { A -> B }',
        '```',
        '```graphviz',
        'digraph H { C -> D }',
        '```',
        '```nomnoml',
        '[Customer] -> [Order]',
        '```'
      ].join('\n')
    )

    expect(container.querySelector('[data-testid="mermaid-block"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="dot-block"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="nomnoml-block"]')).not.toBeNull()
  })

  it('does not wrap diagram blocks in the copy-button <pre> wrapper', () => {
    render('```dot\ndigraph G { A -> B }\n```')

    expect(container.querySelector('[data-testid="dot-block"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="code-block-wrapper"]')).toBeNull()
  })

  it('still wraps regular code blocks in the copy-button <pre> wrapper', () => {
    render('```ts\nconst x = 1\n```')

    expect(container.querySelector('[data-testid="code-block-wrapper"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="dot-block"]')).toBeNull()
  })
})
