import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ApiCanvas, JsonSchemaNode } from '../../domain/apiCanvas'
import {
  createSchemaComponent,
  deleteSchemaComponent,
  updateSchemaComponent,
} from '../../domain/mutations'
import {
  buildStructuredSchema,
  createStructuredProperty,
  schemaToStructuredProperties,
  type StructuredPropertyDraft,
} from './schemaBuilder'

function getSchemaReferenceCounts(apiCanvas: ApiCanvas): Map<string, number> {
  const schemas = new Map<string, number>()

  apiCanvas.operations.forEach((operation) => {
    const contract = operation.httpContract

    if (!contract) {
      return
    }

    const refs = [
      ...contract.parameters.map((parameter) => parameter.schemaRef),
      ...(contract.requestBody ? Object.values(contract.requestBody.content).map((payload) => payload.schemaRef) : []),
      ...contract.responses.flatMap((response) => [
        ...response.headers.map((header) => header.schemaRef),
        ...Object.values(response.content).map((payload) => payload.schemaRef),
      ]),
    ]

    refs.forEach((schemaRef) => {
      if (schemaRef) {
        schemas.set(schemaRef, (schemas.get(schemaRef) ?? 0) + 1)
      }
    })
  })

  return schemas
}

export function SchemaEditorPanel({
  apiCanvas,
  applyChange,
  selectedSchemaId,
  setSelectedSchemaId,
}: {
  readonly apiCanvas: ApiCanvas
  readonly applyChange: (nextValue: ApiCanvas) => void
  readonly selectedSchemaId: string
  readonly setSelectedSchemaId: (value: string) => void
}) {
  const selectedSchema = apiCanvas.schemaComponents.find((schema) => schema.id === selectedSchemaId)
  const counts = getSchemaReferenceCounts(apiCanvas)
  const [schemaMode, setSchemaMode] = useState<'json' | 'structured'>('structured')
  const [schemaText, setSchemaText] = useState('')
  const [schemaError, setSchemaError] = useState('')

  useEffect(() => {
    if (!selectedSchema) {
      return
    }

    setSchemaText(JSON.stringify(selectedSchema.schema, null, 2))
    setSchemaMode(schemaToStructuredProperties(selectedSchema.schema).supported ? 'structured' : 'json')
    setSchemaError('')
  }, [selectedSchema])

  const structured = selectedSchema ? schemaToStructuredProperties(selectedSchema.schema) : { properties: [], supported: false }

  function updateStructured(properties: readonly StructuredPropertyDraft[]) {
    if (!selectedSchema) {
      return
    }

    applyChange(
      updateSchemaComponent(apiCanvas, selectedSchema.id, {
        ...selectedSchema,
        schema: buildStructuredSchema(properties),
      }),
    )
  }

  return (
    <section className="editor-section">
      <div className="section-header">
        <h4>Schemas</h4>
        <button
          className="ghost-button"
          type="button"
          onClick={() => {
            const next = createSchemaComponent(apiCanvas)
            applyChange(next)
            const created = next.schemaComponents[next.schemaComponents.length - 1]
            if (created) {
              setSelectedSchemaId(created.id)
            }
          }}
        >
          <Plus size={14} /> Add schema
        </button>
      </div>

      <select value={selectedSchemaId} onChange={(event) => setSelectedSchemaId(event.target.value)}>
        {apiCanvas.schemaComponents.map((schemaComponent) => (
          <option key={schemaComponent.id} value={schemaComponent.id}>
            {schemaComponent.name}
          </option>
        ))}
      </select>

      {selectedSchema ? (
        <div className="form-grid compact-form">
          <div className="field">
            <label>Schema name</label>
            <input
              value={selectedSchema.name}
              onChange={(event) =>
                applyChange(updateSchemaComponent(apiCanvas, selectedSchema.id, { ...selectedSchema, name: event.target.value }))
              }
            />
          </div>

          <div className="inline-actions">
            <button aria-pressed={schemaMode === 'structured'} className="ghost-button" type="button" onClick={() => setSchemaMode('structured')}>
              Structured mode
            </button>
            <button aria-pressed={schemaMode === 'json'} className="ghost-button" type="button" onClick={() => setSchemaMode('json')}>
              JSON mode
            </button>
          </div>

          {schemaMode === 'structured' ? (
            structured.supported ? (
              <div className="stack-sections">
                {structured.properties.map((property) => (
                  <div className="grid-inline fields-4" key={property.id}>
                    <input
                      value={property.name}
                      placeholder="Property name"
                      onChange={(event) =>
                        updateStructured(structured.properties.map((current) => current.id === property.id ? { ...current, name: event.target.value } : current))
                      }
                    />
                    <select
                      value={property.type}
                      onChange={(event) =>
                        updateStructured(structured.properties.map((current) => current.id === property.id ? { ...current, type: event.target.value as StructuredPropertyDraft['type'] } : current))
                      }
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="integer">integer</option>
                      <option value="boolean">boolean</option>
                      <option value="array">array</option>
                      <option value="object">object</option>
                    </select>
                    <label className="inline-toggle">
                      <input
                        type="checkbox"
                        checked={property.required}
                        onChange={(event) =>
                          updateStructured(structured.properties.map((current) => current.id === property.id ? { ...current, required: event.target.checked } : current))
                        }
                      />
                      <span>Required</span>
                    </label>
                    <button
                      aria-label={`Delete schema property ${property.name}`}
                      className="danger-button"
                      type="button"
                      onClick={() => updateStructured(structured.properties.filter((current) => current.id !== property.id))}
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </button>
                  </div>
                ))}
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    const existingNames = new Set(structured.properties.map((property) => property.name))
                    let suffix = structured.properties.length + 1

                    while (existingNames.has(`property${suffix}`)) {
                      suffix += 1
                    }

                    updateStructured([...structured.properties, createStructuredProperty(`property${suffix}`)])
                  }}
                >
                  <Plus size={14} /> Add property
                </button>
              </div>
            ) : (
              <p className="helper-text">This schema uses constructs the structured editor will not rewrite. Use JSON mode.</p>
            )
          ) : (
            <>
              <textarea value={schemaText} onChange={(event) => setSchemaText(event.target.value)} />
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(schemaText) as JsonSchemaNode
                    applyChange(updateSchemaComponent(apiCanvas, selectedSchema.id, { ...selectedSchema, schema: parsed }))
                    setSchemaError('')
                  } catch {
                    setSchemaError('Schema JSON is invalid.')
                  }
                }}
              >
                Apply JSON schema
              </button>
              {schemaError ? <p className="helper-text" style={{ color: 'var(--failure)' }}>{schemaError}</p> : null}
            </>
          )}

          <button
            className="danger-button"
            type="button"
            disabled={(counts.get(`#/components/schemas/${selectedSchema.name}`) ?? 0) > 0}
            onClick={() => applyChange(deleteSchemaComponent(apiCanvas, selectedSchema.id))}
          >
            <Trash2 size={14} /> Delete schema
          </button>
        </div>
      ) : null}
    </section>
  )
}
