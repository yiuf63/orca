export async function installReactScanDevOverlay(): Promise<void> {
  if (!import.meta.env.DEV || import.meta.env.MODE === 'test') {
    return
  }

  try {
    const { scan } = await import('react-scan')
    scan({
      enabled: true,
      showFPS: true,
      showToolbar: true
    })
  } catch (error) {
    console.warn('[react-scan] dev overlay failed to start', error)
  }
}
