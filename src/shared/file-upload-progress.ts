export type FileUploadProgressPhase = 'scanning' | 'uploading' | 'complete'

export type FileUploadProgressUpdate = {
  phase: FileUploadProgressPhase
  completedFiles: number
  totalFiles: number
  transferredBytes: number
  totalBytes: number
  currentFile?: string
  currentFileBytesTransferred?: number
  currentFileBytesTotal?: number
}

export type FileUploadProgressEvent = FileUploadProgressUpdate & {
  progressId: string
}
