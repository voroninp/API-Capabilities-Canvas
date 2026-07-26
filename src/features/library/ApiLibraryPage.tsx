import { Copy, Database, Download, FileUp, Plus, Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { type ChangeEvent, type FormEvent, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ApiCanvas } from '../../domain/apiCanvas'
import { duplicateApiCanvas } from '../../domain/mutations'
import { summarizeApi } from '../../domain/selectors'
import {
  createApiCanvasRecord,
  deleteApiCanvasRecord,
  listApiCanvases,
  replaceApiCanvases,
  saveApiCanvasRecord,
  seedSampleApiCanvas,
} from '../../db/apiCanvasRepository'
import { downloadBinaryFile, downloadTextFile } from '../export/download'
import { buildWorkbookBuffer } from '../export/workbook'
import {
  normalizeImportedApis,
  parseImportedJson,
  serializeApiCanvas,
  serializeWorkspace,
} from '../interchange/jsonInterchange'

interface DraftApi {
  readonly description: string
  readonly name: string
}

const emptyDraft: DraftApi = {
  description: '',
  name: '',
}

export function ApiLibraryPage() {
  const [draft, setDraft] = useState<DraftApi>(emptyDraft)
  const [isSeeding, setIsSeeding] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  const queriedApiCanvases = useLiveQuery(async () => listApiCanvases(), [])
  const apiCanvases = queriedApiCanvases ?? []
  const hasSampleApi = apiCanvases.some((apiCanvas) => apiCanvas.id === 'demo-canvas')

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!draft.name.trim()) {
      setErrorMessage('An API name is required.')
      return
    }

    setIsSaving(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      await createApiCanvasRecord(draft)
      setDraft(emptyDraft)
      setStatusMessage('API created.')
    } catch {
      setErrorMessage('The API could not be saved to IndexedDB.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(apiCanvas: ApiCanvas) {
    if (!window.confirm(`Delete ${apiCanvas.name}? This cannot be undone.`)) {
      return
    }

    try {
      await deleteApiCanvasRecord(apiCanvas.id)
      setStatusMessage('API deleted.')
    } catch {
      setErrorMessage('The API could not be deleted.')
    }
  }

  async function handleDuplicate(apiCanvas: ApiCanvas) {
    try {
      await saveApiCanvasRecord(duplicateApiCanvas(apiCanvas))
      setStatusMessage(`Duplicated ${apiCanvas.name}.`)
    } catch {
      setErrorMessage('The API could not be duplicated.')
    }
  }

  async function handleSeedSample() {
    setIsSeeding(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      const inserted = await seedSampleApiCanvas()
      setStatusMessage(inserted ? 'Example API added.' : 'Example API is already present.')
    } catch {
      setErrorMessage('The example API could not be added to IndexedDB.')
    } finally {
      setIsSeeding(false)
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setErrorMessage('')
    setStatusMessage('')

    try {
      const contents = await file.text()
      const envelope = parseImportedJson(contents)
      const replaceConflicts = window.confirm(
        'Replace APIs when imported IDs already exist? Choose Cancel to import conflicting APIs as copies.',
      )
      const normalized = normalizeImportedApis(envelope, apiCanvases, replaceConflicts)
      await replaceApiCanvases(normalized)
      setStatusMessage(
        envelope.kind === 'api-capabilities-canvas/api'
          ? 'API imported.'
          : `${normalized.length} APIs imported from workspace JSON.`,
      )
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The selected file could not be imported.')
    } finally {
      event.target.value = ''
    }
  }

  function handleExportWorkspace() {
    downloadTextFile('api-capabilities-workspace.json', serializeWorkspace(apiCanvases), 'application/json')
  }

  async function handleExportXlsx(apiCanvas: ApiCanvas) {
    try {
      const buffer = await buildWorkbookBuffer(apiCanvas)
      downloadBinaryFile(
        `${apiCanvas.name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}-canvas.xlsx`,
        buffer,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
    } catch {
      setErrorMessage(`The XLSX export for ${apiCanvas.name} failed.`)
    }
  }

  const totals = apiCanvases.reduce(
    (summary, apiCanvas) => {
      const counts = summarizeApi(apiCanvas)

      return {
        operations: summary.operations + counts.operationCount,
        schemas: summary.schemas + counts.schemaCount,
        steps: summary.steps + counts.stepCount,
      }
    },
    {
      operations: 0,
      schemas: 0,
      steps: 0,
    },
  )

  return (
    <div className="page-stack">
      <section className="page-panel">
        <div className="page-header">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>API library</h2>
            <p className="page-subtitle">
              Store multiple API canvases locally, share them as JSON, and open each one into an
              editor that can emit OpenAPI and XLSX outputs.
            </p>
          </div>
          <div className="button-row">
            <button
              className="ghost-button"
              type="button"
              disabled={queriedApiCanvases === undefined || isSeeding || hasSampleApi}
              onClick={() => void handleSeedSample()}
            >
              <Database aria-hidden="true" size={16} />
              <span>{isSeeding ? 'Adding example...' : 'Add example API'}</span>
            </button>
            <button className="ghost-button" type="button" onClick={handleExportWorkspace}>
              <Download aria-hidden="true" size={16} />
              <span>Export workspace JSON</span>
            </button>
            <button className="ghost-button" type="button" onClick={() => importRef.current?.click()}>
              <FileUp aria-hidden="true" size={16} />
              <span>Import JSON</span>
            </button>
            <input
              ref={importRef}
              hidden
              accept="application/json,.json"
              type="file"
              onChange={handleImport}
            />
          </div>
        </div>

        <div className="summary-grid" style={{ marginTop: '1.25rem' }}>
          <article className="stat-card">
            <p className="meta-label">APIs</p>
            <p className="stat-value">{apiCanvases.length}</p>
          </article>
          <article className="stat-card">
            <p className="meta-label">Operations</p>
            <p className="stat-value">{totals.operations}</p>
          </article>
          <article className="stat-card">
            <p className="meta-label">Schemas</p>
            <p className="stat-value">{totals.schemas}</p>
          </article>
        </div>
      </section>

      <section className="page-panel">
        <div className="page-header">
          <div>
            <p className="eyebrow">Create</p>
            <h2>New API</h2>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleCreate}>
          <div className="field">
            <label htmlFor="api-name">API title</label>
            <input
              id="api-name"
              required
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Payments API"
            />
          </div>

          <div className="field">
            <label htmlFor="api-description">Description (optional)</label>
            <textarea
              id="api-description"
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="What capability space does this API cover?"
            />
          </div>

          <div className="button-row">
            <button className="button" type="submit" disabled={isSaving}>
              <Plus aria-hidden="true" size={18} />
              <span>{isSaving ? 'Saving...' : 'Create API'}</span>
            </button>
          </div>
        </form>

        {errorMessage ? <p className="helper-text" style={{ color: 'var(--failure)' }}>{errorMessage}</p> : null}
        {statusMessage ? <p className="helper-text" style={{ color: 'var(--success)' }}>{statusMessage}</p> : null}
      </section>

      <section className="page-panel">
        <div className="page-header">
          <div>
            <p className="eyebrow">Canvases</p>
            <h2>Stored APIs</h2>
          </div>
        </div>

        {queriedApiCanvases === undefined ? <p className="helper-text">Loading API library...</p> : null}

        {queriedApiCanvases !== undefined && apiCanvases.length === 0 ? (
          <article className="empty-state">
            <h3>No APIs yet</h3>
            <p className="helper-text" style={{ marginTop: '0.5rem' }}>
              Create your first canvas to start defining roles, use cases, operations, and
              transport contracts.
            </p>
          </article>
        ) : null}

        <div className="list-grid">
          {apiCanvases.map((apiCanvas) => {
            const summary = summarizeApi(apiCanvas)

            return (
              <article className="api-card" key={apiCanvas.id}>
                <header>
                  <div>
                    <p className="meta-label">{apiCanvas.version}</p>
                    <h3>{apiCanvas.name}</h3>
                  </div>
                  <button
                    className="danger-button"
                    type="button"
                    aria-label={`Delete ${apiCanvas.name}`}
                    onClick={() => {
                      void handleDelete(apiCanvas)
                    }}
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </header>

                <p className="helper-text">{apiCanvas.description || 'No description yet.'}</p>

                <div className="pill-row">
                  <span className="pill success">{summary.roleCount} roles</span>
                  <span className="pill success">{summary.useCaseCount} use cases</span>
                  <span className="pill success">{summary.stepCount} steps</span>
                  <span className="pill warning">{summary.contractCount} HTTP contracts</span>
                </div>

                <div className="inline-actions">
                  <button className="ghost-button" type="button" onClick={() => void handleDuplicate(apiCanvas)}>
                    <Copy aria-hidden="true" size={16} />
                    <span>Duplicate</span>
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() =>
                      downloadTextFile(
                        `${apiCanvas.name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.json`,
                        serializeApiCanvas(apiCanvas),
                        'application/json',
                      )
                    }
                  >
                    <Download aria-hidden="true" size={16} />
                    <span>Export JSON</span>
                  </button>
                  <button className="ghost-button" type="button" onClick={() => void handleExportXlsx(apiCanvas)}>
                    <Download aria-hidden="true" size={16} />
                    <span>Export XLSX</span>
                  </button>
                  <Link className="button" to={`/api/${apiCanvas.id}/canvas`}>
                    Open workspace
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}