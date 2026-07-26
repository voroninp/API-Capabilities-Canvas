import {
  ArrowLeft,
  Download,
  FileCog,
  FileJson2,
  FileSpreadsheet,
  Network,
  Plus,
  Redo2,
  TableProperties,
  Trash2,
  Undo2,
  UserRound,
  Workflow,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, useParams } from 'react-router-dom'
import type {
  ApiCanvas,
  HttpContract,
  HttpParameter,
  HttpResponse,
  JsonSchemaNode,
} from '../../domain/apiCanvas'
import {
  createParameter,
  createResponse,
  createSchemaComponent,
  defaultContract,
  deleteSchemaComponent,
  setOperationContract,
  updateApiMetadata,
  updateSchemaComponent,
} from '../../domain/mutations'
import { summarizeApi } from '../../domain/selectors'
import { summarizeIssues, validateApiCanvas, type ValidationIssue } from '../../domain/validation'
import { getApiCanvasById, saveApiCanvasRecord } from '../../db/apiCanvasRepository'
import { downloadBinaryFile, downloadTextFile } from '../export/download'
import { buildOpenApiDocument, buildOpenApiYaml } from '../export/openApi'
import { buildWorkbookBuffer } from '../export/workbook'
import { serializeApiCanvas } from '../interchange/jsonInterchange'
import {
  buildStructuredSchema,
  createStructuredProperty,
  schemaToStructuredProperties,
  type StructuredPropertyDraft,
} from './schemaBuilder'
import { CanvasEditorTab, OperationsTab, UsersTab } from './CanvasModelTabs'

const primaryTabDefinitions = [
  { key: 'canvas', label: 'Canvas', icon: TableProperties },
  { key: 'users', label: 'Users', icon: UserRound },
  { key: 'operations', label: 'Operations', icon: Workflow },
] as const

const secondaryTabDefinitions = [
  { key: 'contracts', label: 'Contracts', icon: Network },
  { key: 'settings', label: 'Settings', icon: FileCog },
] as const

const tabDefinitions = [...primaryTabDefinitions, ...secondaryTabDefinitions]

type TabKey = (typeof tabDefinitions)[number]['key']

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'api-canvas'
}

function getReferenceCounts(apiCanvas: ApiCanvas): {
  readonly operations: Map<string, number>
  readonly roles: Map<string, number>
  readonly schemas: Map<string, number>
  readonly useCases: Map<string, number>
} {
  const roles = new Map<string, number>()
  const useCases = new Map<string, number>()
  const operations = new Map<string, number>()
  const schemas = new Map<string, number>()

  apiCanvas.useCases.forEach((useCase) => {
    roles.set(useCase.roleId, (roles.get(useCase.roleId) ?? 0) + 1)
  })

  apiCanvas.steps.forEach((step) => {
    useCases.set(step.useCaseId, (useCases.get(step.useCaseId) ?? 0) + 1)
    operations.set(step.operationId, (operations.get(step.operationId) ?? 0) + 1)
  })

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
      if (!schemaRef) {
        return
      }
      schemas.set(schemaRef, (schemas.get(schemaRef) ?? 0) + 1)
    })
  })

  return { operations, roles, schemas, useCases }
}

function updateContentRecord(
  record: Record<string, { schemaRef?: string; schema?: JsonSchemaNode; example?: string }>,
  currentKey: string,
  nextKey: string,
  nextValue: { schemaRef?: string; schema?: JsonSchemaNode; example?: string },
) {
  const nextRecord = Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== currentKey),
  ) as Record<string, { schemaRef?: string; schema?: JsonSchemaNode; example?: string }>
  nextRecord[nextKey] = nextValue
  return nextRecord
}

function IssueSidebar({ issues, saveState }: { readonly issues: readonly ValidationIssue[]; readonly saveState: string }) {
  const summary = summarizeIssues(issues)

  return (
    <aside className="note-card validation-summary">
      <p className="eyebrow">Validation and persistence</p>
      <div className="pill-row">
        <span className="pill success">{summary.errors} errors</span>
        <span className="pill warning">{summary.warnings} warnings</span>
        <span className="pill info">{summary.infos} info</span>
        <span aria-atomic="true" aria-live="polite" className="pill" role="status">
          {saveState}
        </span>
      </div>
      <div className="issues-list">
        {issues.length === 0 ? <p className="helper-text">No validation issues.</p> : null}
        {issues.map((issue) => (
          <article className={`issue-card ${issue.severity}`} key={issue.id}>
            <strong>{issue.severity.toUpperCase()}</strong>
            {issue.title ? <h4 className="issue-title">{issue.title}</h4> : null}
            <p>{issue.message}</p>
            <span className="helper-text mono">{issue.path}</span>
          </article>
        ))}
      </div>
    </aside>
  )
}

function SchemaEditorPanel({
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
  const counts = getReferenceCounts(apiCanvas)
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
            <button
              aria-pressed={schemaMode === 'structured'}
              className="ghost-button"
              type="button"
              onClick={() => setSchemaMode('structured')}
            >
              Structured mode
            </button>
            <button
              aria-pressed={schemaMode === 'json'}
              className="ghost-button"
              type="button"
              onClick={() => setSchemaMode('json')}
            >
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
                        updateStructured(
                          structured.properties.map((current) =>
                            current.id === property.id ? { ...current, name: event.target.value } : current,
                          ),
                        )
                      }
                    />
                    <select
                      value={property.type}
                      onChange={(event) =>
                        updateStructured(
                          structured.properties.map((current) =>
                            current.id === property.id
                              ? { ...current, type: event.target.value as StructuredPropertyDraft['type'] }
                              : current,
                          ),
                        )
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
                          updateStructured(
                            structured.properties.map((current) =>
                              current.id === property.id ? { ...current, required: event.target.checked } : current,
                            ),
                          )
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

                    updateStructured([
                      ...structured.properties,
                      createStructuredProperty(`property${suffix}`),
                    ])
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
            disabled={(counts.schemas.get(`#/components/schemas/${selectedSchema.name}`) ?? 0) > 0}
            onClick={() => applyChange(deleteSchemaComponent(apiCanvas, selectedSchema.id))}
          >
            <Trash2 size={14} /> Delete schema
          </button>
        </div>
      ) : null}
    </section>
  )
}

function SettingsTab({
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
  function patchMetadata(nextPatch: Partial<Pick<ApiCanvas, 'description' | 'name' | 'servers' | 'tags' | 'version'>>) {
    applyChange(
      updateApiMetadata(apiCanvas, {
        name: nextPatch.name ?? apiCanvas.name,
        description: nextPatch.description ?? apiCanvas.description,
        version: nextPatch.version ?? apiCanvas.version,
        servers: nextPatch.servers ?? apiCanvas.servers,
        tags: nextPatch.tags ?? apiCanvas.tags,
      }),
    )
  }

  return (
    <article className="editor-card editor-grid">
      <section className="editor-section">
        <p className="eyebrow">API settings</p>
        <h3>Metadata and tags</h3>
        <div className="form-grid compact-form">
          <div className="field">
            <label>Title</label>
            <input required value={apiCanvas.name} onChange={(event) => patchMetadata({ name: event.target.value })} />
          </div>
          <div className="field">
            <label>Description (optional)</label>
            <textarea value={apiCanvas.description} onChange={(event) => patchMetadata({ description: event.target.value })} />
          </div>
          <div className="field">
            <label>Version</label>
            <input value={apiCanvas.version} onChange={(event) => patchMetadata({ version: event.target.value })} />
          </div>
          <div className="field">
            <label>Servers (comma separated)</label>
            <input
              value={apiCanvas.servers.join(', ')}
              onChange={(event) =>
                patchMetadata({ servers: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })
              }
            />
          </div>
          <div className="field">
            <label>Tags (comma separated)</label>
            <input
              value={apiCanvas.tags.join(', ')}
              onChange={(event) =>
                patchMetadata({ tags: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })
              }
            />
          </div>
        </div>
      </section>

      <SchemaEditorPanel
        apiCanvas={apiCanvas}
        applyChange={applyChange}
        selectedSchemaId={selectedSchemaId}
        setSelectedSchemaId={setSelectedSchemaId}
      />
    </article>
  )
}

function ContractsTab({
  apiCanvas,
  applyChange,
  selectedOperationId,
  setSelectedOperationId,
}: {
  readonly apiCanvas: ApiCanvas
  readonly applyChange: (nextValue: ApiCanvas) => void
  readonly selectedOperationId: string
  readonly setSelectedOperationId: (value: string) => void
}) {
  const selectedOperation = apiCanvas.operations.find((operation) => operation.id === selectedOperationId)
  const schemaOptions = apiCanvas.schemaComponents.map((schema) => `#/components/schemas/${schema.name}`)

  function updateContract(contract: HttpContract) {
    if (!selectedOperation) {
      return
    }
    applyChange(setOperationContract(apiCanvas, selectedOperation.id, contract))
  }

  function updateResponse(response: HttpResponse, patch: Partial<HttpResponse>) {
    if (!selectedOperation?.httpContract) {
      return
    }

    updateContract({
      ...selectedOperation.httpContract,
      responses: selectedOperation.httpContract.responses.map((current) =>
        current === response ? { ...current, ...patch } : current,
      ),
    })
  }

  return (
    <article className="editor-card">
      <p className="eyebrow">Contracts</p>
      <h3>HTTP mapping per operation</h3>
      <div className="form-grid compact-form">
        <div className="field">
          <label>Operation</label>
          <select value={selectedOperationId} onChange={(event) => setSelectedOperationId(event.target.value)}>
            {apiCanvas.operations.map((operation) => (
              <option key={operation.id} value={operation.id}>
                {operation.name}
              </option>
            ))}
          </select>
        </div>

        {selectedOperation ? (
          selectedOperation.httpContract ? (
            <div className="stack-sections">
              <div className="grid-inline fields-4">
                <div className="field">
                  <label>Method</label>
                  <select
                    value={selectedOperation.httpContract.method}
                    onChange={(event) =>
                      updateContract({
                        ...selectedOperation.httpContract!,
                        method: event.target.value as HttpContract['method'],
                      })
                    }
                  >
                    <option value="get">GET</option>
                    <option value="post">POST</option>
                    <option value="put">PUT</option>
                    <option value="patch">PATCH</option>
                    <option value="delete">DELETE</option>
                  </select>
                </div>
                <div className="field">
                  <label>Path</label>
                  <input value={selectedOperation.httpContract.path} onChange={(event) => updateContract({ ...selectedOperation.httpContract!, path: event.target.value })} />
                </div>
                <div className="field">
                  <label>operationId</label>
                  <input value={selectedOperation.httpContract.operationId} onChange={(event) => updateContract({ ...selectedOperation.httpContract!, operationId: event.target.value })} />
                </div>
                <div className="field">
                  <label>Tags</label>
                  <input
                    value={selectedOperation.httpContract.tags.join(', ')}
                    onChange={(event) =>
                      updateContract({
                        ...selectedOperation.httpContract!,
                        tags: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                      })
                    }
                  />
                </div>
              </div>

              <div className="field">
                <label>Summary</label>
                <input value={selectedOperation.httpContract.summary} onChange={(event) => updateContract({ ...selectedOperation.httpContract!, summary: event.target.value })} />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea value={selectedOperation.httpContract.description} onChange={(event) => updateContract({ ...selectedOperation.httpContract!, description: event.target.value })} />
              </div>

              <section className="editor-subsection">
                <div className="section-header">
                  <h4>Parameters</h4>
                  <div className="inline-actions">
                    <button className="ghost-button" type="button" onClick={() => updateContract({ ...selectedOperation.httpContract!, parameters: [...selectedOperation.httpContract!.parameters, createParameter('query')] })}>
                      <Plus size={14} /> Query
                    </button>
                    <button className="ghost-button" type="button" onClick={() => updateContract({ ...selectedOperation.httpContract!, parameters: [...selectedOperation.httpContract!.parameters, createParameter('path')] })}>
                      <Plus size={14} /> Path
                    </button>
                  </div>
                </div>
                {selectedOperation.httpContract.parameters.map((parameter) => (
                  <div className="grid-inline fields-4" key={parameter.id}>
                    <input
                      value={parameter.name}
                      placeholder="name"
                      onChange={(event) =>
                        updateContract({
                          ...selectedOperation.httpContract!,
                          parameters: selectedOperation.httpContract!.parameters.map((current) =>
                            current.id === parameter.id ? { ...current, name: event.target.value } : current,
                          ),
                        })
                      }
                    />
                    <select
                      value={parameter.in}
                      onChange={(event) =>
                        updateContract({
                          ...selectedOperation.httpContract!,
                          parameters: selectedOperation.httpContract!.parameters.map((current) =>
                            current.id === parameter.id
                              ? {
                                  ...current,
                                  in: event.target.value as HttpParameter['in'],
                                  required: event.target.value === 'path' ? true : current.required,
                                }
                              : current,
                          ),
                        })
                      }
                    >
                      <option value="query">query</option>
                      <option value="path">path</option>
                      <option value="header">header</option>
                      <option value="cookie">cookie</option>
                    </select>
                    <select
                      value={parameter.schemaRef ?? ''}
                      onChange={(event) =>
                        updateContract({
                          ...selectedOperation.httpContract!,
                          parameters: selectedOperation.httpContract!.parameters.map((current) =>
                            current.id === parameter.id
                              ? { ...current, schemaRef: event.target.value || undefined, schema: event.target.value ? undefined : current.schema }
                              : current,
                          ),
                        })
                      }
                    >
                      <option value="">Inline string</option>
                      {schemaOptions.map((schemaRef) => (
                        <option key={schemaRef} value={schemaRef}>
                          {schemaRef}
                        </option>
                      ))}
                    </select>
                    <button
                      aria-label={`Delete parameter ${parameter.name}`}
                      className="danger-button"
                      type="button"
                      onClick={() => updateContract({ ...selectedOperation.httpContract!, parameters: selectedOperation.httpContract!.parameters.filter((current) => current.id !== parameter.id) })}
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </button>
                    <input
                      className="field-span"
                      value={parameter.description}
                      placeholder="Description"
                      onChange={(event) =>
                        updateContract({
                          ...selectedOperation.httpContract!,
                          parameters: selectedOperation.httpContract!.parameters.map((current) =>
                            current.id === parameter.id ? { ...current, description: event.target.value } : current,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </section>

              <section className="editor-subsection">
                <div className="section-header">
                  <h4>Request body</h4>
                  {selectedOperation.httpContract.requestBody ? (
                    <button className="danger-button" type="button" onClick={() => updateContract({ ...selectedOperation.httpContract!, requestBody: undefined })}>
                      <Trash2 size={14} /> Remove
                    </button>
                  ) : (
                    <button className="ghost-button" type="button" onClick={() => updateContract({ ...selectedOperation.httpContract!, requestBody: { description: '', required: true, content: { 'application/json': {} } } })}>
                      <Plus size={14} /> Add body
                    </button>
                  )}
                </div>
                {selectedOperation.httpContract.requestBody ? (
                  <div className="form-grid compact-form">
                    <input
                      value={selectedOperation.httpContract.requestBody.description}
                      placeholder="Request body description"
                      onChange={(event) =>
                        updateContract({
                          ...selectedOperation.httpContract!,
                          requestBody: { ...selectedOperation.httpContract!.requestBody!, description: event.target.value },
                        })
                      }
                    />
                    {Object.entries(selectedOperation.httpContract.requestBody.content).map(([mediaType, payload]) => (
                      <div className="grid-inline fields-3" key={mediaType}>
                        <input
                          value={mediaType}
                          onChange={(event) =>
                            updateContract({
                              ...selectedOperation.httpContract!,
                              requestBody: {
                                ...selectedOperation.httpContract!.requestBody!,
                                content: updateContentRecord(selectedOperation.httpContract!.requestBody!.content, mediaType, event.target.value, payload),
                              },
                            })
                          }
                        />
                        <select
                          value={payload.schemaRef ?? ''}
                          onChange={(event) =>
                            updateContract({
                              ...selectedOperation.httpContract!,
                              requestBody: {
                                ...selectedOperation.httpContract!.requestBody!,
                                content: updateContentRecord(selectedOperation.httpContract!.requestBody!.content, mediaType, mediaType, {
                                  ...payload,
                                  schemaRef: event.target.value || undefined,
                                  schema: event.target.value ? undefined : payload.schema,
                                }),
                              },
                            })
                          }
                        >
                          <option value="">No schema</option>
                          {schemaOptions.map((schemaRef) => (
                            <option key={schemaRef} value={schemaRef}>
                              {schemaRef}
                            </option>
                          ))}
                        </select>
                        <button
                          aria-label={`Delete request media type ${mediaType}`}
                          className="danger-button"
                          type="button"
                          onClick={() => {
                            const nextContent = { ...selectedOperation.httpContract!.requestBody!.content }
                            delete nextContent[mediaType]
                            updateContract({
                              ...selectedOperation.httpContract!,
                              requestBody: { ...selectedOperation.httpContract!.requestBody!, content: nextContent },
                            })
                          }}
                        >
                          <Trash2 aria-hidden="true" size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() =>
                        updateContract({
                          ...selectedOperation.httpContract!,
                          requestBody: {
                            ...selectedOperation.httpContract!.requestBody!,
                            content: {
                              ...selectedOperation.httpContract!.requestBody!.content,
                              [`application/custom-${Object.keys(selectedOperation.httpContract!.requestBody!.content).length}.json`]: {},
                            },
                          },
                        })
                      }
                    >
                      <Plus size={14} /> Add media type
                    </button>
                  </div>
                ) : null}
              </section>

              <section className="editor-subsection">
                <div className="section-header">
                  <h4>Responses</h4>
                  <button className="ghost-button" type="button" onClick={() => updateContract({ ...selectedOperation.httpContract!, responses: [...selectedOperation.httpContract!.responses, createResponse()] })}>
                    <Plus size={14} /> Add response
                  </button>
                </div>
                {selectedOperation.httpContract.responses.map((response, index) => (
                  <div className="response-card" key={`${response.status}-${index}`}>
                    <div className="grid-inline fields-3">
                      <input value={response.status} onChange={(event) => updateResponse(response, { status: event.target.value })} placeholder="200" />
                      <input value={response.description} onChange={(event) => updateResponse(response, { description: event.target.value })} placeholder="Description" />
                      <button
                        aria-label={`Delete response ${response.status}`}
                        className="danger-button"
                        type="button"
                        onClick={() => updateContract({ ...selectedOperation.httpContract!, responses: selectedOperation.httpContract!.responses.filter((current) => current !== response) })}
                      >
                        <Trash2 aria-hidden="true" size={14} />
                      </button>
                    </div>
                    {Object.entries(response.content).map(([mediaType, payload]) => (
                      <div className="grid-inline fields-3" key={mediaType}>
                        <input value={mediaType} onChange={(event) => updateResponse(response, { content: updateContentRecord(response.content, mediaType, event.target.value, payload) })} />
                        <select
                          value={payload.schemaRef ?? ''}
                          onChange={(event) => updateResponse(response, {
                            content: updateContentRecord(response.content, mediaType, mediaType, {
                              ...payload,
                              schemaRef: event.target.value || undefined,
                              schema: event.target.value ? undefined : payload.schema,
                            }),
                          })}
                        >
                          <option value="">No schema</option>
                          {schemaOptions.map((schemaRef) => (
                            <option key={schemaRef} value={schemaRef}>
                              {schemaRef}
                            </option>
                          ))}
                        </select>
                        <button
                          aria-label={`Delete response media type ${mediaType}`}
                          className="danger-button"
                          type="button"
                          onClick={() => {
                            const nextContent = { ...response.content }
                            delete nextContent[mediaType]
                            updateResponse(response, { content: nextContent })
                          }}
                        >
                          <Trash2 aria-hidden="true" size={14} />
                        </button>
                      </div>
                    ))}
                    <button className="ghost-button" type="button" onClick={() => updateResponse(response, { content: { ...response.content, [`application/json${Object.keys(response.content).length || ''}`]: {} } })}>
                      <Plus size={14} /> Add media type
                    </button>
                  </div>
                ))}
              </section>

              <button className="danger-button" type="button" onClick={() => applyChange(setOperationContract(apiCanvas, selectedOperation.id, undefined))}>
                <Trash2 size={14} /> Remove contract
              </button>
            </div>
          ) : (
            <button className="button" type="button" onClick={() => applyChange(setOperationContract(apiCanvas, selectedOperation.id, defaultContract(selectedOperation.name)))}>
              <Plus size={16} /> Create contract
            </button>
          )
        ) : null}
      </div>
    </article>
  )
}

export function ApiWorkspacePage() {
  const { apiId = '', tab = 'canvas' } = useParams()
  const [apiCanvas, setApiCanvas] = useState<ApiCanvas>()
  const [past, setPast] = useState<readonly ApiCanvas[]>([])
  const [future, setFuture] = useState<readonly ApiCanvas[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [saveState, setSaveState] = useState('saved')
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [selectedOperationId, setSelectedOperationId] = useState('')
  const [selectedSchemaId, setSelectedSchemaId] = useState('')

  useEffect(() => {
    let cancelled = false

    setApiCanvas(undefined)
    setLoadError('')
    setActionError('')

    async function load() {
      try {
        const result = await getApiCanvasById(apiId)

        if (cancelled) {
          return
        }

        if (!result) {
          setLoadError('The requested API could not be found in IndexedDB.')
          return
        }

        setApiCanvas(result)
        setPast([])
        setFuture([])
        setIsDirty(false)
        setSaveState('saved')
      } catch {
        if (!cancelled) {
          setLoadError('The requested API could not be loaded from IndexedDB.')
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [apiId])

  useEffect(() => {
    if (!apiCanvas) {
      return
    }

    if (!selectedOperationId || !apiCanvas.operations.some((operation) => operation.id === selectedOperationId)) {
      setSelectedOperationId(apiCanvas.operations[0]?.id ?? '')
    }
    if (!selectedSchemaId || !apiCanvas.schemaComponents.some((schema) => schema.id === selectedSchemaId)) {
      setSelectedSchemaId(apiCanvas.schemaComponents[0]?.id ?? '')
    }
  }, [apiCanvas, selectedOperationId, selectedSchemaId])

  useEffect(() => {
    if (!apiCanvas || !isDirty) {
      return
    }

    let cancelled = false
    setSaveState('saving')
    const handle = window.setTimeout(() => {
      void saveApiCanvasRecord(apiCanvas)
        .then(() => {
          if (!cancelled) {
            setIsDirty(false)
            setSaveState('saved')
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSaveState('save failed')
          }
        })
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [apiCanvas, isDirty])

  function applyChange(nextValue: ApiCanvas) {
    if (!apiCanvas) {
      return
    }

    setPast((current) => [...current.slice(-39), apiCanvas])
    setFuture([])
    setApiCanvas(nextValue)
    setIsDirty(true)
  }

  function undo() {
    const previous = past[past.length - 1]

    if (!previous || !apiCanvas) {
      return
    }

    setPast((current) => current.slice(0, -1))
    setFuture((current) => [apiCanvas, ...current])
    setApiCanvas(previous)
    setIsDirty(true)
  }

  function redo() {
    const nextValue = future[0]

    if (!nextValue || !apiCanvas) {
      return
    }

    setFuture((current) => current.slice(1))
    setPast((current) => [...current, apiCanvas])
    setApiCanvas(nextValue)
    setIsDirty(true)
  }

  async function handleExportOpenApiYaml() {
    if (!apiCanvas) {
      return
    }

    setActionError('')

    try {
      const yaml = await buildOpenApiYaml(apiCanvas)
      downloadTextFile(`${sanitizeFileName(apiCanvas.name)}-openapi.yaml`, yaml, 'text/yaml')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The OpenAPI YAML export failed.')
    }
  }

  async function handleExportXlsx() {
    if (!apiCanvas) {
      return
    }

    setActionError('')

    try {
      const buffer = await buildWorkbookBuffer(apiCanvas)
      downloadBinaryFile(
        `${sanitizeFileName(apiCanvas.name)}-canvas.xlsx`,
        buffer,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The XLSX export failed.')
    }
  }

  if (loadError) {
    return (
      <div className="page-stack">
        <section className="page-panel">
          <Link className="ghost-button" to="/">
            <ArrowLeft aria-hidden="true" size={16} />
            <span>Back to library</span>
          </Link>
          <p className="helper-text" style={{ marginTop: '1rem', color: 'var(--failure)' }}>
            {loadError}
          </p>
        </section>
      </div>
    )
  }

  if (!apiCanvas) {
    return (
      <div className="page-stack">
        <section className="page-panel">
          <p className="helper-text">Loading workspace...</p>
        </section>
      </div>
    )
  }

  const summary = summarizeApi(apiCanvas)
  const issues = validateApiCanvas(apiCanvas)
  const isKnownTab = tabDefinitions.some((definition) => definition.key === tab)

  if (!isKnownTab) {
    return <Navigate to={`/api/${apiCanvas.id}/canvas`} replace />
  }

  const activeTab = tab as TabKey

  return (
    <div className="page-stack workspace-layout">
      <section className="page-panel workspace-header-panel">
        <div className="page-header">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>{apiCanvas.name}</h2>
            <p className="page-subtitle">{apiCanvas.description || 'No description yet.'}</p>
          </div>
          <div className="button-row">
            <button className="ghost-button" type="button" disabled={past.length === 0} onClick={undo}>
              <Undo2 aria-hidden="true" size={16} />
              <span>Undo</span>
            </button>
            <button className="ghost-button" type="button" disabled={future.length === 0} onClick={redo}>
              <Redo2 aria-hidden="true" size={16} />
              <span>Redo</span>
            </button>
            <Link className="ghost-button" to="/">
              <ArrowLeft aria-hidden="true" size={16} />
              <span>Back to library</span>
            </Link>
          </div>
        </div>

        <div className="pill-row workspace-summary">
          <span className="pill success">{summary.roleCount} roles</span>
          <span className="pill success">{summary.useCaseCount} use cases</span>
          <span className="pill success">{summary.stepCount} steps</span>
          <span className="pill success">{summary.operationCount} operations</span>
          <span className="pill warning">{summary.contractCount} contracts</span>
          <span className="pill warning">{summary.schemaCount} schemas</span>
        </div>

        <div className="button-row workspace-export-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() =>
              downloadTextFile(
                `${sanitizeFileName(apiCanvas.name)}.json`,
                serializeApiCanvas(apiCanvas),
                'application/json',
              )
            }
          >
            <FileJson2 aria-hidden="true" size={16} />
            <span>Export JSON</span>
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              try {
                setActionError('')
                downloadTextFile(
                  `${sanitizeFileName(apiCanvas.name)}-openapi.json`,
                  JSON.stringify(buildOpenApiDocument(apiCanvas), null, 2),
                  'application/json',
                )
              } catch (error) {
                setActionError(error instanceof Error ? error.message : 'The OpenAPI JSON export failed.')
              }
            }}
          >
            <Download aria-hidden="true" size={16} />
            <span>OpenAPI JSON</span>
          </button>
          <button className="ghost-button" type="button" onClick={() => void handleExportOpenApiYaml()}>
            <Download aria-hidden="true" size={16} />
            <span>OpenAPI YAML</span>
          </button>
          <button className="ghost-button" type="button" onClick={() => void handleExportXlsx()}>
            <FileSpreadsheet aria-hidden="true" size={16} />
            <span>Export XLSX</span>
          </button>
        </div>

        {actionError ? (
          <div className="message-banner error" role="alert">
            <p>{actionError}</p>
            <button
              aria-label="Dismiss export error"
              className="icon-button danger-icon"
              type="button"
              onClick={() => setActionError('')}
            >
              &times;
            </button>
          </div>
        ) : null}

        <div className="workspace-tab-groups">
          {[primaryTabDefinitions, secondaryTabDefinitions].map((definitions, index) => (
            <div className="tab-list" key={index}>
              {definitions.map(({ icon: Icon, key, label }) => (
                <NavLink
                  key={key}
                  to={`/api/${apiCanvas.id}/${key}`}
                  className={({ isActive }) =>
                    ['tab-link', isActive ? 'active' : ''].filter(Boolean).join(' ')
                  }
                >
                  <Icon aria-hidden="true" size={16} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="workspace-grid">
        <IssueSidebar issues={issues} saveState={saveState} />

        {activeTab === 'canvas' ? <CanvasEditorTab apiCanvas={apiCanvas} applyChange={applyChange} /> : null}
        {activeTab === 'users' ? <UsersTab apiCanvas={apiCanvas} applyChange={applyChange} /> : null}
        {activeTab === 'operations' ? <OperationsTab apiCanvas={apiCanvas} applyChange={applyChange} /> : null}
        {activeTab === 'contracts' ? (
          <ContractsTab
            apiCanvas={apiCanvas}
            applyChange={applyChange}
            selectedOperationId={selectedOperationId}
            setSelectedOperationId={setSelectedOperationId}
          />
        ) : null}
        {activeTab === 'settings' ? (
          <SettingsTab
            apiCanvas={apiCanvas}
            applyChange={applyChange}
            selectedSchemaId={selectedSchemaId}
            setSelectedSchemaId={setSelectedSchemaId}
          />
        ) : null}
      </section>
    </div>
  )
}
