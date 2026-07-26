import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { sampleCanvas } from '../../domain/apiCanvas'
import { ContractsTab } from './ContractsTab'

describe('ContractsTab', () => {
  test('adds a query parameter through the workspace mutation boundary', () => {
    const applyChange = vi.fn()

    render(
      <ContractsTab
        apiCanvas={sampleCanvas}
        applyChange={applyChange}
        selectedOperationId="operation-search-products"
        setSelectedOperationId={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Query' }))

    const nextOperation = applyChange.mock.calls[0]?.[0].operations.find(
      (operation: { id: string }) => operation.id === 'operation-search-products',
    )
    expect(nextOperation.httpContract.parameters).toHaveLength(2)
    expect(nextOperation.httpContract.parameters.at(-1).in).toBe('query')
  })

  test('creates a default contract for an operation without one', () => {
    const applyChange = vi.fn()

    render(
      <ContractsTab
        apiCanvas={sampleCanvas}
        applyChange={applyChange}
        selectedOperationId="operation-add-product-to-cart"
        setSelectedOperationId={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create contract' }))

    const nextOperation = applyChange.mock.calls[0]?.[0].operations.find(
      (operation: { id: string }) => operation.id === 'operation-add-product-to-cart',
    )
    expect(nextOperation.httpContract).toMatchObject({
      method: 'get',
      operationId: 'addAProductToTheCart',
      path: '/add-a-product-to-the-cart',
    })
  })
})
