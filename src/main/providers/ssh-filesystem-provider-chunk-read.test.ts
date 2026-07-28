import { describe, expect, it, vi } from 'vitest'
import { SshFilesystemProvider } from './ssh-filesystem-provider'

describe('SshFilesystemProvider readFileChunk', () => {
  it('reads chunks through raw transfer when provided', async () => {
    const readFileChunk = vi.fn().mockResolvedValue(Buffer.from('chunk'))
    const mux = { onNotification: vi.fn(() => vi.fn()) }
    const provider = new SshFilesystemProvider('conn-1', mux as never, undefined, {
      readFileChunk
    })

    await expect(provider.readFileChunk('/home/user/big.log', 1024, 5)).resolves.toEqual(
      Buffer.from('chunk')
    )
    expect(readFileChunk).toHaveBeenCalledWith('/home/user/big.log', 1024, 5)
  })
})
