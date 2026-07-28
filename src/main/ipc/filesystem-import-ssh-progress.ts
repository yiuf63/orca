import type { FileUploadProgressUpdate } from '../../shared/file-upload-progress'

export class SshImportProgress {
  private completedFiles = 0
  private currentFile: string | undefined
  private currentFileBytesTotal = 0
  private currentFileBytesTransferred = 0
  private lastEmitAt = 0
  private totalBytes = 0
  private totalFiles = 0
  private transferredBytesCompleted = 0

  constructor(private readonly onProgress?: (progress: FileUploadProgressUpdate) => void) {}

  emitScanning(): void {
    this.emit('scanning', true)
  }

  addBudget(fileCount: number, totalBytes: number): void {
    if (fileCount <= 0 && totalBytes <= 0) {
      return
    }
    this.totalFiles += Math.max(0, fileCount)
    this.totalBytes += Math.max(0, totalBytes)
    this.emit('scanning', true)
  }

  startFile(filePath: string, byteLength: number): void {
    this.currentFile = filePath
    this.currentFileBytesTotal = Math.max(0, byteLength)
    this.currentFileBytesTransferred = 0
    this.emit('uploading', true)
  }

  updateFile(bytesTransferred: number): void {
    this.currentFileBytesTransferred = Math.max(
      this.currentFileBytesTransferred,
      Math.min(Math.max(0, bytesTransferred), this.currentFileBytesTotal)
    )
    this.emit('uploading')
  }

  completeFile(): void {
    this.currentFileBytesTransferred = this.currentFileBytesTotal
    this.completedFiles += 1
    this.emit('uploading', true)
    this.transferredBytesCompleted += this.currentFileBytesTotal
    this.currentFile = undefined
    this.currentFileBytesTotal = 0
    this.currentFileBytesTransferred = 0
  }

  clearCurrentFile(): void {
    this.currentFile = undefined
    this.currentFileBytesTotal = 0
    this.currentFileBytesTransferred = 0
  }

  emitComplete(): void {
    this.currentFile = undefined
    this.currentFileBytesTotal = 0
    this.currentFileBytesTransferred = 0
    this.emit('complete', true)
  }

  private get transferredBytes(): number {
    return Math.min(
      this.totalBytes,
      this.transferredBytesCompleted + this.currentFileBytesTransferred
    )
  }

  private emit(phase: FileUploadProgressUpdate['phase'], force = false): void {
    if (!this.onProgress) {
      return
    }
    const now = Date.now()
    if (!force && now - this.lastEmitAt < 100) {
      return
    }
    this.lastEmitAt = now
    this.onProgress({
      phase,
      completedFiles: this.completedFiles,
      totalFiles: this.totalFiles,
      transferredBytes: this.transferredBytes,
      totalBytes: this.totalBytes,
      ...(this.currentFile ? { currentFile: this.currentFile } : {}),
      ...(this.currentFile
        ? {
            currentFileBytesTransferred: this.currentFileBytesTransferred,
            currentFileBytesTotal: this.currentFileBytesTotal
          }
        : {})
    })
  }
}
