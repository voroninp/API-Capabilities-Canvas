import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { sampleCanvas } from '../../domain/apiCanvas'
import { SettingsTab } from './SettingsTab'

describe('SettingsTab', () => {
  test('applies metadata changes through the workspace mutation boundary', () => {
    const applyChange = vi.fn()

    render(
      <SettingsTab
        apiCanvas={sampleCanvas}
        applyChange={applyChange}
        selectedSchemaId={sampleCanvas.schemaComponents[0]!.id}
        setSelectedSchemaId={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByDisplayValue(sampleCanvas.name), { target: { value: 'Orders API' } })

    expect(applyChange).toHaveBeenCalledOnce()
    expect(applyChange.mock.calls[0]?.[0].name).toBe('Orders API')
  })

  test('reports invalid JSON without applying a schema change', () => {
    const applyChange = vi.fn()

    render(
      <SettingsTab
        apiCanvas={sampleCanvas}
        applyChange={applyChange}
        selectedSchemaId={sampleCanvas.schemaComponents[0]!.id}
        setSelectedSchemaId={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'JSON mode' }))
    fireEvent.change(screen.getAllByRole('textbox').at(-1)!, { target: { value: '{invalid' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply JSON schema' }))

    expect(screen.getByText('Schema JSON is invalid.')).toBeInTheDocument()
    expect(applyChange).not.toHaveBeenCalled()
  })

  test('selects a newly created schema', () => {
    const applyChange = vi.fn()
    const setSelectedSchemaId = vi.fn()

    render(
      <SettingsTab
        apiCanvas={sampleCanvas}
        applyChange={applyChange}
        selectedSchemaId={sampleCanvas.schemaComponents[0]!.id}
        setSelectedSchemaId={setSelectedSchemaId}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add schema' }))

    const nextCanvas = applyChange.mock.calls[0]?.[0]
    const createdSchema = nextCanvas.schemaComponents.at(-1)
    expect(createdSchema).toBeDefined()
    expect(setSelectedSchemaId).toHaveBeenCalledWith(createdSchema.id)
  })
})
