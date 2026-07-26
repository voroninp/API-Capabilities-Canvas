import { describe, expect, test } from 'vitest'
import { sampleCanvas } from '../../domain/apiCanvas'
import { buildWorkbookBuffer } from './workbook'

describe('workbook export', () => {
  test('sorts worksheet rows by Operation', async () => {
    const ExcelJs = await import('exceljs')
    const exportedBuffer = await buildWorkbookBuffer(sampleCanvas)
    const workbook = new ExcelJs.Workbook()

    await workbook.xlsx.load(
      exportedBuffer as Parameters<typeof workbook.xlsx.load>[0],
    )

    expect(workbook.getWorksheet('API Canvas')?.getColumn(1).values.slice(2)).toEqual([
      'Add a product to the cart',
      'Create an order',
      'Search for products',
      'Search for products',
    ])
    expect(workbook.getWorksheet('Operations')?.getColumn(1).values.slice(2)).toEqual([
      'Add a product to the cart',
      'Create an order',
      'Search for products',
    ])
  }, 15_000)
})
