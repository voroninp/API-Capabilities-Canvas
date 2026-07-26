import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { sampleCanvas } from '../../domain/apiCanvas'
import { CanvasEditorTab, OperationsTab, UsersTab } from './CanvasModelTabs'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CanvasEditorTab', () => {
  test('assigns an existing operation selected by typing', () => {
    const applyChange = vi.fn()
    render(<CanvasEditorTab apiCanvas={sampleCanvas} applyChange={applyChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Operation for Search for products to buy' }))
    const input = screen.getByRole('combobox', { name: 'Operation for Search for products to buy' })

    fireEvent.change(input, { target: { value: 'Add a product to the cart' } })
    fireEvent.blur(input)

    const nextCanvas = applyChange.mock.calls[0]?.[0]
    expect(nextCanvas.steps.find((step: { id: string }) => step.id === 'step-search-products')?.operationId)
      .toBe('operation-add-product-to-cart')
    expect(nextCanvas.operations).toHaveLength(sampleCanvas.operations.length)
  })

  test('creates and assigns a new operation from typed text', () => {
    const applyChange = vi.fn()
    render(<CanvasEditorTab apiCanvas={sampleCanvas} applyChange={applyChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Operation for Check out' }))
    const input = screen.getByRole('combobox', { name: 'Operation for Check out' })

    fireEvent.change(input, { target: { value: 'Reserve inventory' } })
    fireEvent.blur(input)

    const nextCanvas = applyChange.mock.calls[0]?.[0]
    const createdOperation = nextCanvas.operations.find(
      (operation: { name: string }) => operation.name === 'Reserve inventory',
    )
    expect(createdOperation).toBeDefined()
    expect(nextCanvas.steps.find((step: { id: string }) => step.id === 'step-checkout')?.operationId)
      .toBe(createdOperation.id)
  })

  test('renders existing canvas values as text until clicked', () => {
    render(<CanvasEditorTab apiCanvas={sampleCanvas} applyChange={vi.fn()} />)

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Input for Search for products to buy' }))

    expect(screen.getByRole('textbox', { name: 'Input for Search for products to buy' })).toHaveValue('Catalog filters')
  })

  test('returns focus to an inline field after keyboard commit and cancel', () => {
    render(<CanvasEditorTab apiCanvas={sampleCanvas} applyChange={vi.fn()} />)

    const titleButton = screen.getAllByRole('button', { name: 'Step title' })[0]!
    fireEvent.click(titleButton)
    const commitInput = screen.getByRole('textbox', { name: 'Step title' })
    fireEvent.change(commitInput, { target: { value: 'Updated step' } })
    fireEvent.keyDown(commitInput, { key: 'Enter' })

    expect(screen.getAllByRole('button', { name: 'Step title' })[0]).toHaveFocus()

    const inputName = 'Input for Search for products to buy'
    fireEvent.click(screen.getByRole('button', { name: inputName }))
    const cancelInput = screen.getByRole('textbox', { name: inputName })
    fireEvent.keyDown(cancelInput, { key: 'Escape' })

    expect(screen.getByRole('button', { name: inputName })).toHaveFocus()
  })

  test('returns focus to an inline combobox after keyboard commit', () => {
    render(<CanvasEditorTab apiCanvas={sampleCanvas} applyChange={vi.fn()} />)
    const name = 'Operation for Search for products to buy'

    fireEvent.click(screen.getByRole('button', { name }))
    const input = screen.getByRole('combobox', { name })
    fireEvent.change(input, { target: { value: 'Create an order' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByRole('button', { name })).toHaveFocus()
  })
})

describe('UsersTab', () => {
  test('confirms a merge and preserves the source use cases and steps', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const applyChange = vi.fn()
    render(<UsersTab apiCanvas={sampleCanvas} applyChange={applyChange} />)

    fireEvent.change(screen.getByLabelText('Merge End users into'), {
      target: { value: 'role-catalog-admins' },
    })
    fireEvent.click(screen.getByTitle('Merge End users'))

    const nextCanvas = applyChange.mock.calls[0]?.[0]
    expect(nextCanvas.roles.some((role: { id: string }) => role.id === 'role-end-users')).toBe(false)
    expect(nextCanvas.useCases.find((useCase: { id: string }) => useCase.id === 'use-case-buy-products')?.roleId)
      .toBe('role-catalog-admins')
    expect(nextCanvas.steps).toHaveLength(sampleCanvas.steps.length)
  })
})

describe('OperationsTab', () => {
  test('renders the final output in the requested read-only column order', () => {
    render(<OperationsTab apiCanvas={sampleCanvas} applyChange={vi.fn()} />)
    const outputCard = screen.getByText('Capabilities organized around operations').closest('article')

    expect(outputCard).not.toBeNull()
    expect(within(outputCard as HTMLElement).getAllByRole('columnheader').map((header) => header.textContent))
      .toEqual(['Operation', 'Input', 'Success', 'Failure', 'Step', 'Use Case', 'User'])
    expect(within(outputCard as HTMLElement).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(outputCard as HTMLElement).getAllByText('Search for products')).toHaveLength(2)
  })
})
