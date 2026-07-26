import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { downloadBinaryFile, downloadTextFile } from './download'

describe('browser downloads', () => {
  const createObjectUrl = vi.fn<(blob: Blob) => string>(() => 'blob:test-download')
  const revokeObjectUrl = vi.fn<(url: string) => void>()
  const clickedAnchors: HTMLAnchorElement[] = []

  beforeEach(() => {
    vi.useFakeTimers()
    clickedAnchors.length = 0
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedAnchors.push(this)
    })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    createObjectUrl.mockClear()
    revokeObjectUrl.mockClear()
  })

  test('downloads UTF-8 text and releases the object URL after the click task', () => {
    downloadTextFile('canvas.json', '{"name":"Example"}', 'application/json')

    const blob = createObjectUrl.mock.calls[0]?.[0]
    const clickedAnchor = clickedAnchors[0]
    expect(blob).toBeInstanceOf(Blob)
    expect(blob?.type).toBe('application/json;charset=utf-8')
    expect(clickedAnchor?.download).toBe('canvas.json')
    expect(clickedAnchor?.isConnected).toBe(false)
    expect(revokeObjectUrl).not.toHaveBeenCalled()

    vi.runAllTimers()

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:test-download')
  })

  test('uses the requested MIME type for binary files', () => {
    downloadBinaryFile('canvas.xlsx', new Uint8Array([1, 2, 3]), 'application/vnd.ms-excel')

    const blob = createObjectUrl.mock.calls[0]?.[0]
    const clickedAnchor = clickedAnchors[0]
    expect(blob?.type).toBe('application/vnd.ms-excel')
    expect(clickedAnchor?.download).toBe('canvas.xlsx')
  })
})
