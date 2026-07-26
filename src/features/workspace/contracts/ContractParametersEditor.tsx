import { Plus, Trash2 } from 'lucide-react'
import type { HttpContract, HttpParameter } from '../../../domain/apiCanvas'
import { createParameter } from '../../../domain/mutations'

export function ContractParametersEditor({
  contract,
  schemaOptions,
  onChange,
}: {
  readonly contract: HttpContract
  readonly schemaOptions: readonly string[]
  readonly onChange: (contract: HttpContract) => void
}) {
  return (
    <section className="editor-subsection">
      <div className="section-header">
        <h4>Parameters</h4>
        <div className="inline-actions">
          <button className="ghost-button" type="button" onClick={() => onChange({ ...contract, parameters: [...contract.parameters, createParameter('query')] })}>
            <Plus size={14} /> Query
          </button>
          <button className="ghost-button" type="button" onClick={() => onChange({ ...contract, parameters: [...contract.parameters, createParameter('path')] })}>
            <Plus size={14} /> Path
          </button>
        </div>
      </div>
      {contract.parameters.map((parameter) => (
        <div className="grid-inline fields-4" key={parameter.id}>
          <input
            value={parameter.name}
            placeholder="name"
            onChange={(event) => onChange({
              ...contract,
              parameters: contract.parameters.map((current) => current.id === parameter.id ? { ...current, name: event.target.value } : current),
            })}
          />
          <select
            value={parameter.in}
            onChange={(event) => onChange({
              ...contract,
              parameters: contract.parameters.map((current) => current.id === parameter.id
                ? {
                    ...current,
                    in: event.target.value as HttpParameter['in'],
                    required: event.target.value === 'path' ? true : current.required,
                  }
                : current),
            })}
          >
            <option value="query">query</option>
            <option value="path">path</option>
            <option value="header">header</option>
            <option value="cookie">cookie</option>
          </select>
          <select
            value={parameter.schemaRef ?? ''}
            onChange={(event) => onChange({
              ...contract,
              parameters: contract.parameters.map((current) => current.id === parameter.id
                ? { ...current, schemaRef: event.target.value || undefined, schema: event.target.value ? undefined : current.schema }
                : current),
            })}
          >
            <option value="">Inline string</option>
            {schemaOptions.map((schemaRef) => (
              <option key={schemaRef} value={schemaRef}>{schemaRef}</option>
            ))}
          </select>
          <button
            aria-label={`Delete parameter ${parameter.name}`}
            className="danger-button"
            type="button"
            onClick={() => onChange({ ...contract, parameters: contract.parameters.filter((current) => current.id !== parameter.id) })}
          >
            <Trash2 aria-hidden="true" size={14} />
          </button>
          <input
            className="field-span"
            value={parameter.description}
            placeholder="Description"
            onChange={(event) => onChange({
              ...contract,
              parameters: contract.parameters.map((current) => current.id === parameter.id ? { ...current, description: event.target.value } : current),
            })}
          />
        </div>
      ))}
    </section>
  )
}
