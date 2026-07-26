import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'

export function useGlobalMouseNavigation(): void {
  const navigateFileBack = useAppStore((s) => s.navigateFileBack)
  const navigateFileForward = useAppStore((s) => s.navigateFileForward)
  const lastNavTimeRef = useRef(0)

  useEffect(() => {
    const triggerBack = (): void => {
      const now = Date.now()
      if (now - lastNavTimeRef.current < 150) {
        return
      }
      lastNavTimeRef.current = now
      navigateFileBack()
    }

    const triggerForward = (): void => {
      const now = Date.now()
      if (now - lastNavTimeRef.current < 150) {
        return
      }
      lastNavTimeRef.current = now
      navigateFileForward()
    }

    // 1. Electron IPC events from main process (WM_APPCOMMAND Mouse4 / Mouse5)
    let unsubBack: (() => void) | undefined
    let unsubForward: (() => void) | undefined

    if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('editor:navigate-back', triggerBack)
      window.electron.ipcRenderer.on('editor:navigate-forward', triggerForward)

      unsubBack = () =>
        window.electron.ipcRenderer.removeListener('editor:navigate-back', triggerBack)
      unsubForward = () =>
        window.electron.ipcRenderer.removeListener('editor:navigate-forward', triggerForward)
    }

    // 2. Browser DOM mouse events (Button 3 = Mouse4 / Back, Button 4 = Mouse5 / Forward)
    const handleMouse = (event: MouseEvent): void => {
      if (event.button === 3) {
        event.preventDefault()
        event.stopPropagation()
        triggerBack()
      } else if (event.button === 4) {
        event.preventDefault()
        event.stopPropagation()
        triggerForward()
      }
    }

    // 3. Keyboard shortcuts (Alt+Left / Alt+Right, Cmd+[ / Cmd+], Ctrl+[ / Ctrl+])
    const handleKeyDown = (event: KeyboardEvent): void => {
      const isMac = navigator.userAgent.includes('Mac')
      const modKey = isMac ? event.metaKey : event.ctrlKey

      if ((event.altKey && event.key === 'ArrowLeft') || (modKey && event.key === '[')) {
        event.preventDefault()
        triggerBack()
      } else if ((event.altKey && event.key === 'ArrowRight') || (modKey && event.key === ']')) {
        event.preventDefault()
        triggerForward()
      }
    }

    window.addEventListener('mousedown', handleMouse, true)
    window.addEventListener('mouseup', handleMouse, true)
    window.addEventListener('auxclick', handleMouse, true)
    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      unsubBack?.()
      unsubForward?.()
      window.removeEventListener('mousedown', handleMouse, true)
      window.removeEventListener('mouseup', handleMouse, true)
      window.removeEventListener('auxclick', handleMouse, true)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [navigateFileBack, navigateFileForward])
}
