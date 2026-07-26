import { describe, expect, test } from 'vitest'
import { createApiCanvas, sampleCanvas } from './apiCanvas'
import { getCanvasRows, getOperationRows, summarizeApi } from './selectors'

describe('createApiCanvas', () => {
  test('creates a trimmed canvas with empty collections', () => {
    const apiCanvas = createApiCanvas({
      name: '  Payments API  ',
      description: '  Handles checkout workflows.  ',
    })

    expect(apiCanvas.name).toBe('Payments API')
    expect(apiCanvas.description).toBe('Handles checkout workflows.')
    expect(apiCanvas.version).toBe('0.1.0')
    expect(apiCanvas.roles).toHaveLength(0)
    expect(apiCanvas.operations).toHaveLength(0)
  })
})

describe('getCanvasRows', () => {
  test('reorganizes steps around reusable operations', () => {
    const rows = getCanvasRows(sampleCanvas)

    expect(rows).toHaveLength(4)
    expect(rows[0]?.operation?.name).toBe('Search for products')
    expect(rows[0]?.role.name).toBe('End users')
    expect(rows[3]?.operation?.name).toBe('Search for products')
    expect(rows[3]?.role.name).toBe('Catalog admins')
  })

  test('keeps capability steps visible before an operation is assigned', () => {
    const rows = getCanvasRows({
      ...sampleCanvas,
      steps: sampleCanvas.steps.map((step, index) => index === 0 ? { ...step, operationId: '' } : step),
    })

    expect(rows).toHaveLength(4)
    expect(rows[0]?.operation).toBeUndefined()
  })
})

describe('getOperationRows', () => {
  test('groups each step usage around operations in operation order', () => {
    const rows = getOperationRows(sampleCanvas)

    expect(rows.map((row) => row.operation?.name)).toEqual([
      'Search for products',
      'Search for products',
      'Add a product to the cart',
      'Create an order',
    ])
    expect(rows.slice(0, 2).map((row) => row.role.name)).toEqual(['End users', 'Catalog admins'])
  })

  test('places unassigned operations after known operations', () => {
    const rows = getOperationRows({
      ...sampleCanvas,
      steps: sampleCanvas.steps.map((step, index) => index === 0 ? { ...step, operationId: '' } : step),
    })

    expect(rows.at(-1)?.operation).toBeUndefined()
  })
})

describe('summarizeApi', () => {
  test('counts operations, schemas, and contracts', () => {
    expect(summarizeApi(sampleCanvas)).toEqual({
      contractCount: 1,
      operationCount: 3,
      roleCount: 2,
      schemaCount: 2,
      stepCount: 4,
      useCaseCount: 2,
    })
  })
})