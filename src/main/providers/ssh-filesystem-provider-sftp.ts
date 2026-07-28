import type { FileEntryWithStats, SFTPWrapper, Stats } from 'ssh2'
import type { FileStat } from './types'

const ABORTED_SFTP_OPERATION_GRACE_MS = 5_000

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error('Download canceled')
}

function waitForSftpCallback<T>(
  register: (callback: (err?: Error | null, value?: T) => void) => void,
  options?: { signal?: AbortSignal }
): Promise<T> {
  return new Promise((resolve, reject) => {
    const signal = options?.signal
    if (signal?.aborted) {
      reject(abortReason(signal))
      return
    }

    let settled = false
    let abortTimer: ReturnType<typeof setTimeout> | undefined
    const cleanup = (): void => {
      clearTimeout(abortTimer)
      signal?.removeEventListener('abort', onAbort)
    }
    const settle = (error?: Error | null, value?: T): void => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      if (signal?.aborted) {
        reject(abortReason(signal))
      } else if (error) {
        reject(error)
      } else {
        resolve(value as T)
      }
    }
    const onAbort = (): void => {
      if (!signal || settled) {
        return
      }
      // Why: the folder owner closes SFTP on abort; wait for its callback so
      // Windows local handles quiesce before the temporary tree is removed.
      abortTimer = setTimeout(() => settle(abortReason(signal)), ABORTED_SFTP_OPERATION_GRACE_MS)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      register((error, value) => settle(error, value))
    } catch (error) {
      settle(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

export function fileStatFromSftpStats(stats: Stats): FileStat {
  let type: FileStat['type'] = 'file'
  if (stats.isDirectory()) {
    type = 'directory'
  } else if (stats.isSymbolicLink()) {
    type = 'symlink'
  }
  const maybeNlink = (stats as Stats & { nlink?: unknown }).nlink
  return {
    size: stats.size,
    type,
    mtime: stats.mtime * 1000,
    ...(typeof maybeNlink === 'number' ? { nlink: maybeNlink } : {})
  }
}

export function lstatViaSftp(sftp: SFTPWrapper, filePath: string): Promise<FileStat> {
  return new Promise((resolve, reject) => {
    sftp.lstat(filePath, (err, stats) => {
      if (err) {
        reject(err)
        return
      }
      resolve(fileStatFromSftpStats(stats))
    })
  })
}

export function fastGetViaSftp(
  sftp: SFTPWrapper,
  sourcePath: string,
  destinationPath: string,
  options?: { signal?: AbortSignal }
): Promise<void> {
  return waitForSftpCallback<void>(
    (callback) => sftp.fastGet(sourcePath, destinationPath, callback),
    options
  )
}

export function readDirViaSftp(
  sftp: SFTPWrapper,
  dirPath: string,
  options?: { signal?: AbortSignal }
): Promise<FileEntryWithStats[]> {
  return waitForSftpCallback<FileEntryWithStats[]>(
    (callback) => sftp.readdir(dirPath, callback),
    options
  )
}

export function statViaSftp(
  sftp: SFTPWrapper,
  filePath: string,
  options?: { signal?: AbortSignal }
): Promise<Stats> {
  return waitForSftpCallback<Stats>((callback) => sftp.stat(filePath, callback), options)
}

export function readFileChunkViaSftp(
  sftp: SFTPWrapper,
  filePath: string,
  offset: number,
  length: number
): Promise<Buffer> {
  if (length <= 0) {
    return Promise.resolve(Buffer.alloc(0))
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let settled = false
    const stream = sftp.createReadStream(filePath, {
      start: offset,
      end: offset + length - 1
    })
    const cleanup = (): void => {
      stream.off('data', onData)
      stream.off('end', onEnd)
      stream.off('error', onError)
    }
    const settle = (fn: typeof resolve | typeof reject, value: Buffer | Error): void => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      fn(value as never)
    }
    const onData = (chunk: Buffer): void => {
      chunks.push(Buffer.from(chunk))
    }
    const onEnd = (): void => settle(resolve, Buffer.concat(chunks))
    const onError = (error: Error): void => settle(reject, error)
    stream.on('data', onData)
    stream.on('end', onEnd)
    stream.on('error', onError)
  })
}
