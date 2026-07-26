import type { ApiCanvas } from '../../domain/apiCanvas'
import { getCanvasRows } from '../../domain/selectors'

export async function buildWorkbookBuffer(apiCanvas: ApiCanvas): Promise<ArrayBuffer> {
  const ExcelJs = await import('exceljs')
  const workbook = new ExcelJs.Workbook()
  const canvasSheet = workbook.addWorksheet('API Canvas')
  const operationsSheet = workbook.addWorksheet('Operations')
  const infoSheet = workbook.addWorksheet('API Info')

  canvasSheet.columns = [
    { header: 'Operation', key: 'operation', width: 28 },
    { header: 'Input', key: 'input', width: 24 },
    { header: 'Success', key: 'success', width: 26 },
    { header: 'Failure', key: 'failure', width: 26 },
    { header: 'Step', key: 'step', width: 24 },
    { header: 'Use case', key: 'useCase', width: 20 },
    { header: 'User', key: 'role', width: 18 },
  ]

  getCanvasRows(apiCanvas)
    .toSorted((left, right) =>
      (left.operation?.name ?? 'Not assigned yet').localeCompare(
        right.operation?.name ?? 'Not assigned yet',
      ),
    )
    .forEach((row) => {
      canvasSheet.addRow({
        operation: row.operation?.name ?? 'Not assigned yet',
        input: row.step.input,
        success: row.step.success,
        failure: row.step.failure,
        step: row.step.title,
        useCase: row.useCase.title,
        role: row.role.name,
      })
    })

  operationsSheet.columns = [
    { header: 'Operation', key: 'operation', width: 28 },
    { header: 'Description', key: 'description', width: 34 },
    { header: 'HTTP method', key: 'method', width: 14 },
    { header: 'Path', key: 'path', width: 24 },
    { header: 'Statuses', key: 'statuses', width: 18 },
  ]

  apiCanvas.operations.toSorted((left, right) => left.name.localeCompare(right.name)).forEach((operation) => {
    operationsSheet.addRow({
      operation: operation.name,
      description: operation.description,
      method: operation.httpContract?.method.toUpperCase() ?? '',
      path: operation.httpContract?.path ?? '',
      statuses: operation.httpContract?.responses.map((response) => response.status).join(', ') ?? '',
    })
  })

  infoSheet.columns = [
    { header: 'Field', key: 'field', width: 20 },
    { header: 'Value', key: 'value', width: 52 },
  ]
  infoSheet.addRows([
    { field: 'Name', value: apiCanvas.name },
    { field: 'Description', value: apiCanvas.description },
    { field: 'Version', value: apiCanvas.version },
    { field: 'Servers', value: apiCanvas.servers.join(', ') },
    { field: 'Tags', value: apiCanvas.tags.join(', ') },
  ])

  ;[canvasSheet, operationsSheet, infoSheet].forEach((sheet) => {
    const header = sheet.getRow(1)
    header.font = { bold: true }
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5F3EF' },
    }
    header.border = {
      bottom: { style: 'thin', color: { argb: 'FFB8AA8B' } },
    }
    sheet.eachRow((row) => {
      row.alignment = { vertical: 'top', wrapText: true }
    })
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
  })

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>
}