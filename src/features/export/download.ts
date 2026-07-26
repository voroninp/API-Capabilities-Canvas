function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.hidden = true
  document.body.append(anchor)

  try {
    anchor.click()
  } finally {
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

export function downloadTextFile(fileName: string, contents: string, mimeType: string): void {
  downloadBlob(fileName, new Blob([contents], { type: `${mimeType};charset=utf-8` }))
}

export function downloadBinaryFile(fileName: string, contents: BlobPart, mimeType: string): void {
  downloadBlob(fileName, new Blob([contents], { type: mimeType }))
}
