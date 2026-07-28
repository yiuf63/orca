import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type {
  FileUploadProgressEvent,
  FileUploadProgressUpdate
} from '../../../shared/file-upload-progress'

type FileUploadProgressToastArgs = {
  fileCount: number
  targetLabel: 'remote' | 'runtime'
}

export type FileUploadProgressToast = {
  progressId: string
  update: (progress: FileUploadProgressUpdate) => void
  subscribe: () => () => void
  dismiss: () => void
}

export function createFileUploadProgressToast({
  fileCount,
  targetLabel
}: FileUploadProgressToastArgs): FileUploadProgressToast {
  const progressId = createUploadProgressId()
  const toastId = toast.loading(initialUploadMessage(fileCount, targetLabel))

  const update = (progress: FileUploadProgressUpdate): void => {
    toast.loading(formatUploadProgress(progress, targetLabel), { id: toastId })
  }

  return {
    progressId,
    update,
    subscribe: () =>
      window.api.fs.onUploadProgress((progress: FileUploadProgressEvent) => {
        if (progress.progressId === progressId) {
          update(progress)
        }
      }),
    dismiss: () => toast.dismiss(toastId)
  }
}

function createUploadProgressId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `upload-${Date.now()}-${Math.random()}`
}

function initialUploadMessage(fileCount: number, targetLabel: string): string {
  return translate(
    'components.fileUploadProgress.initial',
    'Uploading {{value0}} file{{value1}} to {{value2}}...',
    { value0: fileCount, value1: fileCount === 1 ? '' : 's', value2: targetLabel }
  )
}

function formatUploadProgress(
  progress: FileUploadProgressUpdate,
  targetLabel: 'remote' | 'runtime'
): string {
  if (progress.phase === 'scanning') {
    return translate(
      'components.fileUploadProgress.scanning',
      'Preparing upload to {{value0}}...',
      { value0: targetLabel }
    )
  }
  if (progress.phase === 'complete') {
    return translate('components.fileUploadProgress.complete', 'Upload complete')
  }
  const totalFiles = Math.max(progress.totalFiles, progress.completedFiles)
  const percent =
    progress.totalBytes > 0
      ? Math.min(100, Math.floor((progress.transferredBytes / progress.totalBytes) * 100))
      : 0
  const byteSummary =
    progress.totalBytes > 0
      ? `${formatBytes(progress.transferredBytes)} / ${formatBytes(progress.totalBytes)}`
      : formatBytes(progress.transferredBytes)
  return translate(
    'components.fileUploadProgress.uploading',
    'Uploading {{value0}}/{{value1}} files to {{value2}} - {{value3}}% - {{value4}}',
    {
      value0: Math.min(progress.completedFiles + 1, Math.max(totalFiles, 1)),
      value1: Math.max(totalFiles, 1),
      value2: targetLabel,
      value3: percent,
      value4: byteSummary
    }
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  for (const unit of units) {
    if (value < 1024 || unit === 'GB') {
      return `${value.toFixed(value < 10 ? 1 : 0)} ${unit}`
    }
    value /= 1024
  }
  return `${bytes} B`
}
