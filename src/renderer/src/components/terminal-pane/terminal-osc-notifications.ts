export type OscNotificationPayload = {
  title: string
  body: string
}

// Why: OSC 9 format in iTerm2/ConEmu: "msg" or "title;msg".
export function parseOsc9Notification(
  data: string,
  defaultTitle: string = 'Terminal'
): OscNotificationPayload | null {
  const trimmed = data.trim()
  if (!trimmed) {
    return null
  }
  const parts = trimmed.split(';')
  if (parts.length >= 2) {
    const title = parts[0].trim() || defaultTitle
    const body = parts.slice(1).join(';').trim()
    if (!body) {
      return null
    }
    return { title, body }
  }
  return { title: defaultTitle, body: trimmed }
}

// Why: OSC 777 format in urxvt/kitty: "notify;title;body" or "notify;body".
export function parseOsc777Notification(
  data: string,
  defaultTitle: string = 'Terminal'
): OscNotificationPayload | null {
  const trimmed = data.trim()
  if (!trimmed) {
    return null
  }
  const parts = trimmed.split(';')
  if (parts[0].toLowerCase() !== 'notify') {
    return null
  }
  if (parts.length >= 3) {
    const title = parts[1].trim() || defaultTitle
    const body = parts.slice(2).join(';').trim()
    if (!body) {
      return null
    }
    return { title, body }
  }
  if (parts.length === 2) {
    const body = parts[1].trim()
    if (!body) {
      return null
    }
    return { title: defaultTitle, body }
  }
  return null
}

export function createOscNotificationThrottler(
  cooldownMs: number = 2000
): (data: string) => boolean {
  let lastFiredAt = 0
  return () => {
    const now = Date.now()
    if (now - lastFiredAt < cooldownMs) {
      return false
    }
    lastFiredAt = now
    return true
  }
}
