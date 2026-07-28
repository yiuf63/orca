import { readFileChunkViaSftp } from './ssh-filesystem-provider-sftp'
import type { SftpFactory } from './ssh-filesystem-download'
import type { SshRawTransferOptions } from './ssh-filesystem-file-upload'

export async function readSshFilesystemFileChunk(
  createSftp: SftpFactory | undefined,
  rawTransfer: SshRawTransferOptions | undefined,
  filePath: string,
  offset: number,
  length: number
): Promise<Buffer> {
  if (rawTransfer?.readFileChunk) {
    return rawTransfer.readFileChunk(filePath, offset, length)
  }
  if (!createSftp) {
    throw new Error('remote_chunked_read_unavailable')
  }
  const sftp = await createSftp()
  try {
    return await readFileChunkViaSftp(sftp, filePath, offset, length)
  } finally {
    sftp.end()
  }
}
