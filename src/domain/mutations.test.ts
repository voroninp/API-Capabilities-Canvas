import { describe, expect, test } from 'vitest'
import { sampleCanvas } from './apiCanvas'
import {
  createStep,
  createUseCase,
  defaultContract,
  deleteOperation,
  deleteRole,
  deleteUseCase,
  mergeOperation,
  mergeRole,
} from './mutations'

describe('HTTP contract defaults', () => {
  test('derives tooling-friendly identifiers and distinct paths from operation names', () => {
    expect(defaultContract('Search products')).toMatchObject({
      operationId: 'searchProducts',
      path: '/search-products',
    })
    expect(defaultContract('createOrder')).toMatchObject({
      operationId: 'createOrder',
      path: '/create-order',
    })
  })

  test('uses stable fallbacks when the operation name has no identifier characters', () => {
    expect(defaultContract('---')).toMatchObject({
      operationId: 'operation',
      path: '/resource',
    })
  })
})

describe('parent-dependent creation', () => {
  test('does not create a use case without an existing role', () => {
    const canvas = { ...sampleCanvas, roles: [], useCases: [], steps: [] }

    expect(createUseCase(canvas, undefined)).toBe(canvas)
    expect(createUseCase(canvas, 'missing-role')).toBe(canvas)
  })

  test('does not create a step without an existing use case and operation', () => {
    expect(createStep(sampleCanvas, 'missing-use-case', 'operation-search-products')).toBe(sampleCanvas)
    expect(createStep(sampleCanvas, 'use-case-buy-products', 'missing-operation')).toBe(sampleCanvas)
  })
})

describe('parent entity deletion', () => {
  test('deleting a role removes its use cases and steps', () => {
    const result = deleteRole(sampleCanvas, 'role-end-users')

    expect(result.useCases.some((useCase) => useCase.roleId === 'role-end-users')).toBe(false)
    expect(result.steps.some((step) => step.useCaseId === 'use-case-buy-products')).toBe(false)
  })

  test('deleting a use case removes its steps', () => {
    const result = deleteUseCase(sampleCanvas, 'use-case-buy-products')

    expect(result.steps.some((step) => step.useCaseId === 'use-case-buy-products')).toBe(false)
  })

  test('deleting an operation removes steps that reference it', () => {
    const result = deleteOperation(sampleCanvas, 'operation-search-products')

    expect(result.steps.some((step) => step.operationId === 'operation-search-products')).toBe(false)
  })
})

describe('entity merging', () => {
  test('moves use cases to the target role before removing the source', () => {
    const targetRole = sampleCanvas.roles[1]
    const result = mergeRole(sampleCanvas, 'role-end-users', 'role-catalog-admins')

    expect(result.roles).toHaveLength(sampleCanvas.roles.length - 1)
    expect(result.roles).toContain(targetRole)
    expect(result.useCases.find((useCase) => useCase.id === 'use-case-buy-products')?.roleId)
      .toBe('role-catalog-admins')
    expect(result.steps).toHaveLength(sampleCanvas.steps.length)
  })

  test('moves steps while preserving the target operation and its contract', () => {
    const targetOperation = sampleCanvas.operations.find(
      (operation) => operation.id === 'operation-search-products',
    )
    const result = mergeOperation(
      sampleCanvas,
      'operation-add-product-to-cart',
      'operation-search-products',
    )

    expect(result.operations).toHaveLength(sampleCanvas.operations.length - 1)
    expect(result.operations.find((operation) => operation.id === targetOperation?.id)).toBe(targetOperation)
    expect(result.steps.find((step) => step.id === 'step-add-product')?.operationId)
      .toBe('operation-search-products')
  })

  test('does nothing for self-merges or missing entities', () => {
    expect(mergeRole(sampleCanvas, 'role-end-users', 'role-end-users')).toBe(sampleCanvas)
    expect(mergeOperation(sampleCanvas, 'missing', 'operation-search-products')).toBe(sampleCanvas)
  })
})
