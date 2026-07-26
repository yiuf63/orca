import { useEffect } from 'react'
import { useAppStore } from '@/store'

export function useGlobalMouseNavigation(): void {
  const navigateFileBack = useAppStore((s) => s.navigateFileBack)
  const navigateFileForward = useAppStore((s) => s.navigateFileForward)

  useEffect(() => {
    // 1. Electron IPC events from main process (WM_APPCOMMAND Mouse4 / Mouse5)
    let unsubBack: (() => void) | undefined
    let unsubForward: (() => void) | undefined

    if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
      const handleBack = (): void => navigateFileBack()
      const handleForward = (): void => navigateFileForward()

      window.electron.ipcRenderer.on('editor:navigate-back', handleBack)
      window.electron.ipcRenderer.on('editor:navigate-forward', handleForward)

      unsubBack = () =>
        window.electron.ipcRenderer.removeListener('editor:navigate-back', handleBack)
      unsubForward = () =>
        window.electron.ipcRenderer.removeListener('editor:navigate-forward', handleForward)
    }

    // 2. Browser DOM mouseup / auxclick events
    const handleMouseUp = (event: MouseEvent): void => {
      // Button 3 = Mouse4 (Back / Side button), Button 4 = Mouse5 (Forward / Side button)
      if (event.button === 3) {
        event.preventDefault()
        event.stopPropagation()
        navigateFileBack()
      } else if (event.button === 4) {
        event.preventDefault()
        event.stopPropagation()
        navigateFileForward()
      }
    }

    // 3. Keyboard shortcuts Alt+Left / Alt+Right / Cmd+[ / Cmd+]
    const handleKeyDown = (event: KeyboardEvent): void => {
      const isMac = navigator.userAgent.includes('Mac')
      const modKey = isMac ? event.metaKey : event.ctrlKey
      if ((event.altKey && event.key === 'ArrowLeft') || (modKey && event.key === '[')) {
        event.preventDefault()
        navigateFileBack()
      } else if ((event.altKey && event.key === 'ArrowRight') || (modKey && event.key === ']')) {
        event.preventDefault()
        navigateFileForward()
      }
    }

    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('auxclick', handleMouseUp)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      unsubBack?.()
      unsubForward?.()
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('auxclick', handleMouseUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [navigateFileBack, navigateFileForward])
}
