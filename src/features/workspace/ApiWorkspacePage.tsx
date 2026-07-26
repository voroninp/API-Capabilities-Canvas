import {
  ArrowLeft,
  Download,
  FileCog,
  FileJson2,
  FileSpreadsheet,
  Network,
  Redo2,
  TableProperties,
  Undo2,
  UserRound,
  Workflow,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, useParams } from 'react-router-dom'
import type { ApiCanvas } from '../../domain/apiCanvas'
import { summarizeApi } from '../../domain/selectors'
import { validateApiCanvas } from '../../domain/validation'
import { findApiCanvasById, saveApiCanvasRecord } from '../../db/apiCanvasRepository'
import { downloadBinaryFile, downloadTextFile } from '../export/download'
import { buildOpenApiDocument, buildOpenApiYaml } from '../export/openApi'
import { buildWorkbookBuffer } from '../export/workbook'
import { serializeApiCanvas } from '../interchange/jsonInterchange'
import { CanvasEditorTab, OperationsTab, UsersTab } from './CanvasModelTabs'
import { ContractsTab } from './ContractsTab'
import { SettingsTab } from './SettingsTab'
import { WorkspaceValidationSummary } from './WorkspaceValidationSummary'

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
        const result = await findApiCanvasById(apiId)

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
        <WorkspaceValidationSummary issues={issues} saveState={saveState} />

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
