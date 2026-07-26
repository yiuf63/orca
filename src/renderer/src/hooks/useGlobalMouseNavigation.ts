import { useEffect } from 'react'
import { useAppStore } from '@/store'

export function useGlobalMouseNavigation(): void {
  const navigateFileBack = useAppStore((s) => s.navigateFileBack)
  const navigateFileForward = useAppStore((s) => s.navigateFileForward)

  useEffect(() => {
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

    const handleKeyDown = (event: KeyboardEvent): void => {
      const isMac = navigator.userAgent.includes('Mac')
      const modKey = isMac ? event.metaKey : event.ctrlKey
      if ((event.altKey && event.key === 'ArrowLeft') || (modKey && event.key === '[')) {
        // Prevent browser/system default if handled
        event.preventDefault()
        navigateFileBack()
      } else if ((event.altKey && event.key === 'ArrowRight') || (modKey && event.key === ']')) {
        event.preventDefault()
        navigateFileForward()
      }
    }

    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [navigateFileBack, navigateFileForward])
}
