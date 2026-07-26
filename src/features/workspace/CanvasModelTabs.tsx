import { GitMerge, Plus, Trash2 } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import type { ApiCanvas, Operation, Step, UseCase, UserRole } from '../../domain/apiCanvas'
import {
  createOperation,
  createRole,
  createStep,
  createUseCase,
  deleteOperation,
  deleteRole,
  deleteStep,
  deleteUseCase,
  mergeOperation,
  mergeRole,
  updateOperation,
  updateRole,
  updateStep,
  updateUseCase,
} from '../../domain/mutations'
import { getOperationRows } from '../../domain/selectors'
import { CreatableCombobox } from './CreatableCombobox'

type ApplyChange = (nextValue: ApiCanvas) => void

function createNamedRole(apiCanvas: ApiCanvas, name: string): { apiCanvas: ApiCanvas; roleId: string } {
  const createdCanvas = createRole(apiCanvas)
  const role = createdCanvas.roles.at(-1)

  if (!role) {
    return { apiCanvas, roleId: '' }
  }

  return {
    apiCanvas: updateRole(createdCanvas, role.id, { ...role, name: name.trim() }),
    roleId: role.id,
  }
}

function createNamedOperation(apiCanvas: ApiCanvas, name: string): { apiCanvas: ApiCanvas; operationId: string } {
  const createdCanvas = createOperation(apiCanvas)
  const operation = createdCanvas.operations.at(-1)

  if (!operation) {
    return { apiCanvas, operationId: '' }
  }

  return {
    apiCanvas: updateOperation(createdCanvas, operation.id, { ...operation, name: name.trim() }),
    operationId: operation.id,
  }
}

function InlineField({
  ariaLabel,
  multiline = false,
  value,
  onCommit,
}: {
  readonly ariaLabel: string
  readonly multiline?: boolean
  readonly value: string
  readonly onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [isEditing, setIsEditing] = useState(false)
  const cancelEdit = useRef(false)
  const restoreFocus = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (!isEditing && restoreFocus.current) {
      restoreFocus.current = false
      triggerRef.current?.focus()
    }
  }, [isEditing])

  function commit() {
    setIsEditing(false)
    if (cancelEdit.current) {
      cancelEdit.current = false
      setDraft(value)
      return
    }
    if (draft !== value) {
      onCommit(draft.trim())
    }
  }

  if (!isEditing) {
    return (
      <button
        ref={triggerRef}
        aria-label={ariaLabel}
        className="inline-cell-value"
        type="button"
        onClick={() => setIsEditing(true)}
      >
        {value || '\u00a0'}
      </button>
    )
  }

  if (multiline) {
    return (
      <textarea
        aria-label={ariaLabel}
        autoFocus
        className="inline-cell-input"
        rows={2}
        value={draft}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            cancelEdit.current = true
            restoreFocus.current = true
            event.currentTarget.blur()
          }
        }}
      />
    )
  }

  return (
    <input
      aria-label={ariaLabel}
      autoFocus
      className="inline-cell-input"
      value={draft}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          restoreFocus.current = true
          event.currentTarget.blur()
        }
        if (event.key === 'Escape') {
          cancelEdit.current = true
          restoreFocus.current = true
          event.currentTarget.blur()
        }
      }}
    />
  )
}

function InlineCombobox({
  ariaLabel,
  options,
  value,
  onCommit,
}: {
  readonly ariaLabel: string
  readonly options: readonly { id: string; label: string }[]
  readonly value: string
  readonly onCommit: (optionId: string | undefined, value: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const restoreFocus = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isEditing && restoreFocus.current) {
      restoreFocus.current = false
      triggerRef.current?.focus()
    }
  }, [isEditing])

  if (!isEditing) {
    return (
      <button
        ref={triggerRef}
        aria-label={ariaLabel}
        className="inline-cell-value"
        type="button"
        onClick={() => setIsEditing(true)}
      >
        {value || '\u00a0'}
      </button>
    )
  }

  return (
    <CreatableCombobox
      ariaLabel={ariaLabel}
      autoFocus
      options={options}
      value={value}
      onCommit={onCommit}
      onEditingComplete={(shouldRestoreFocus) => {
        restoreFocus.current = shouldRestoreFocus
        setIsEditing(false)
      }}
    />
  )
}

function updateUseCaseRole(
  apiCanvas: ApiCanvas,
  useCase: UseCase,
  roleId: string | undefined,
  name: string,
): ApiCanvas {
  if (roleId) {
    return updateUseCase(apiCanvas, useCase.id, { ...useCase, roleId })
  }

  const created = createNamedRole(apiCanvas, name)
  return updateUseCase(created.apiCanvas, useCase.id, { ...useCase, roleId: created.roleId })
}

function updateStepOperation(
  apiCanvas: ApiCanvas,
  step: Step,
  operationId: string | undefined,
  name: string,
): ApiCanvas {
  if (operationId) {
    return updateStep(apiCanvas, step.id, { ...step, operationId })
  }

  const created = createNamedOperation(apiCanvas, name)
  return updateStep(created.apiCanvas, step.id, { ...step, operationId: created.operationId })
}

export function CanvasEditorTab({ apiCanvas, applyChange }: { readonly apiCanvas: ApiCanvas; readonly applyChange: ApplyChange }) {
  const [showUseCaseDraft, setShowUseCaseDraft] = useState(false)
  const [newUseCaseRole, setNewUseCaseRole] = useState(apiCanvas.roles[0]?.name ?? '')
  const [newUseCaseTitle, setNewUseCaseTitle] = useState('')
  const [stepDraftUseCaseId, setStepDraftUseCaseId] = useState('')
  const [stepDraft, setStepDraft] = useState({ title: '', input: '', success: '', failure: '', operation: '' })
  const roleOptions = apiCanvas.roles.map((role) => ({ id: role.id, label: role.name }))
  const operationOptions = apiCanvas.operations.map((operation) => ({ id: operation.id, label: operation.name }))
  const useCases = apiCanvas.roles
    .slice()
    .sort((left, right) => left.order - right.order)
    .flatMap((role) => apiCanvas.useCases
      .filter((useCase) => useCase.roleId === role.id)
      .sort((left, right) => left.order - right.order))

  function addUseCase() {
    const title = newUseCaseTitle.trim()
    const roleName = newUseCaseRole.trim()

    if (!title || !roleName) {
      return
    }

    const existingRole = apiCanvas.roles.find(
      (role) => role.name.localeCompare(roleName, undefined, { sensitivity: 'accent' }) === 0,
    )
    const resolved = existingRole
      ? { apiCanvas, roleId: existingRole.id }
      : createNamedRole(apiCanvas, roleName)
    const withUseCase = createUseCase(resolved.apiCanvas, resolved.roleId)
    const useCase = withUseCase.useCases.at(-1)

    if (useCase) {
      applyChange(updateUseCase(withUseCase, useCase.id, { ...useCase, title }))
    }
    setNewUseCaseTitle('')
    setShowUseCaseDraft(false)
  }

  function addStep(useCaseId: string) {
    const title = stepDraft.title.trim()
    const operationName = stepDraft.operation.trim()

    if (!title || !operationName) {
      return
    }

    const existingOperation = apiCanvas.operations.find(
      (operation) => operation.name.localeCompare(operationName, undefined, { sensitivity: 'accent' }) === 0,
    )
    const resolved = existingOperation
      ? { apiCanvas, operationId: existingOperation.id }
      : createNamedOperation(apiCanvas, operationName)
    const withStep = createStep(resolved.apiCanvas, useCaseId, resolved.operationId)
    const step = withStep.steps.at(-1)

    if (step) {
      applyChange(updateStep(withStep, step.id, {
        ...step,
        title: stepDraft.title,
        input: stepDraft.input,
        success: stepDraft.success,
        failure: stepDraft.failure,
        operationId: resolved.operationId,
      }))
    }
    setStepDraft({ title: '', input: '', success: '', failure: '', operation: '' })
    setStepDraftUseCaseId('')
  }

  return (
    <article className="editor-card canvas-table-card">
      <div className="section-header canvas-table-heading">
        <div>
          <p className="eyebrow">Canvas</p>
          <h3>Users, use cases, and steps</h3>
        </div>
        <button className="button" type="button" onClick={() => setShowUseCaseDraft(true)}>
          <Plus size={16} /> Add use case
        </button>
      </div>

      {showUseCaseDraft ? (
        <div className="canvas-draft-row">
          <CreatableCombobox
            ariaLabel="User for new use case"
            options={roleOptions}
            placeholder="Select or type a user"
            value={newUseCaseRole}
            onCommit={(_, value) => setNewUseCaseRole(value)}
          />
          <input
            aria-label="New use case title"
            placeholder="Use case title"
            value={newUseCaseTitle}
            onChange={(event) => setNewUseCaseTitle(event.target.value)}
          />
          <button className="button" type="button" onClick={addUseCase}>Add</button>
          <button className="ghost-button" type="button" onClick={() => setShowUseCaseDraft(false)}>Cancel</button>
        </div>
      ) : null}

      <div className="canvas-table-scroll">
        <table className="canvas-preview editable-canvas-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Use Case</th>
              <th>Step</th>
              <th>Input</th>
              <th>Success</th>
              <th>Failure</th>
              <th>Operation</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {useCases.map((useCase) => {
              const role = apiCanvas.roles.find((item) => item.id === useCase.roleId)
              const steps = apiCanvas.steps
                .filter((step) => step.useCaseId === useCase.id)
                .sort((left, right) => left.order - right.order)
              const visibleRows = Math.max(steps.length, 1) + (stepDraftUseCaseId === useCase.id ? 1 : 0)

              return (
                <Fragment key={useCase.id}>
                  {(steps.length ? steps : [undefined]).map((step, index) => (
                    <tr key={step?.id ?? `${useCase.id}-empty`}>
                      {index === 0 ? (
                        <td className="group-cell" rowSpan={visibleRows}>
                          <InlineCombobox
                            ariaLabel={`User for ${useCase.title}`}
                            options={roleOptions}
                            value={role?.name ?? ''}
                            onCommit={(roleId, value) => applyChange(updateUseCaseRole(apiCanvas, useCase, roleId, value))}
                          />
                        </td>
                      ) : null}
                      {index === 0 ? (
                        <td className="group-cell" rowSpan={visibleRows}>
                          <InlineField
                            ariaLabel={`Use case ${useCase.title}`}
                            value={useCase.title}
                            onCommit={(title) => applyChange(updateUseCase(apiCanvas, useCase.id, { ...useCase, title }))}
                          />
                          <div className="cell-actions">
                            <button
                              aria-label={`Add step to ${useCase.title}`}
                              className="icon-button"
                              title="Add step"
                              type="button"
                              onClick={() => setStepDraftUseCaseId(useCase.id)}
                            >
                              <Plus aria-hidden="true" size={15} />
                            </button>
                            <button
                              aria-label={`Delete use case ${useCase.title}`}
                              className="icon-button danger-icon"
                              title="Delete use case"
                              type="button"
                              onClick={() => {
                                if (!steps.length || window.confirm(`Delete ${useCase.title} and its ${steps.length} steps?`)) {
                                  applyChange(deleteUseCase(apiCanvas, useCase.id))
                                }
                              }}
                            >
                              <Trash2 aria-hidden="true" size={15} />
                            </button>
                          </div>
                        </td>
                      ) : null}
                      {step ? (
                        <>
                          <td><InlineField ariaLabel="Step title" value={step.title} onCommit={(title) => applyChange(updateStep(apiCanvas, step.id, { ...step, title }))} /></td>
                          <td><InlineField ariaLabel={`Input for ${step.title}`} multiline value={step.input} onCommit={(input) => applyChange(updateStep(apiCanvas, step.id, { ...step, input }))} /></td>
                          <td><InlineField ariaLabel={`Success for ${step.title}`} multiline value={step.success} onCommit={(success) => applyChange(updateStep(apiCanvas, step.id, { ...step, success }))} /></td>
                          <td><InlineField ariaLabel={`Failure for ${step.title}`} multiline value={step.failure} onCommit={(failure) => applyChange(updateStep(apiCanvas, step.id, { ...step, failure }))} /></td>
                          <td>
                            <InlineCombobox
                              ariaLabel={`Operation for ${step.title}`}
                              options={operationOptions}
                              value={apiCanvas.operations.find((operation) => operation.id === step.operationId)?.name ?? ''}
                              onCommit={(operationId, value) => applyChange(updateStepOperation(apiCanvas, step, operationId, value))}
                            />
                          </td>
                          <td className="canvas-action-cell">
                            <button
                              aria-label={`Delete step ${step.title}`}
                              className="icon-button danger-icon"
                              title="Delete step"
                              type="button"
                              onClick={() => applyChange(deleteStep(apiCanvas, step.id))}
                            >
                              <Trash2 aria-hidden="true" size={15} />
                            </button>
                          </td>
                        </>
                      ) : (
                        <td className="empty-table-cell" colSpan={6}>No steps yet. Add the first step from the use-case actions.</td>
                      )}
                    </tr>
                  ))}
                  {stepDraftUseCaseId === useCase.id ? (
                    <tr className="step-draft-row">
                      {(['title', 'input', 'success', 'failure'] as const).map((field) => (
                        <td key={field}>
                          <input
                            aria-label={`New step ${field}`}
                            placeholder={field[0].toUpperCase() + field.slice(1)}
                            value={stepDraft[field]}
                            onChange={(event) => setStepDraft((current) => ({ ...current, [field]: event.target.value }))}
                          />
                        </td>
                      ))}
                      <td>
                        <CreatableCombobox
                          ariaLabel="New step operation"
                          options={operationOptions}
                          placeholder="Select or type"
                          value={stepDraft.operation}
                          onCommit={(_, value) => setStepDraft((current) => ({ ...current, operation: value }))}
                        />
                      </td>
                      <td className="draft-actions">
                        <button
                          aria-label={`Save new step in ${useCase.title}`}
                          className="icon-button"
                          title="Save step"
                          type="button"
                          onClick={() => addStep(useCase.id)}
                        >
                          <Plus aria-hidden="true" size={15} />
                        </button>
                        <button
                          aria-label={`Cancel new step in ${useCase.title}`}
                          className="icon-button"
                          title="Cancel"
                          type="button"
                          onClick={() => setStepDraftUseCaseId('')}
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
            {useCases.length === 0 ? (
              <tr><td className="empty-table-cell" colSpan={8}>Add a use case to begin the canvas.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  )
}

function EntityActions({
  entityId,
  entities,
  usageCount,
  entityLabel,
  hasSourceContract = false,
  onDelete,
  onMerge,
}: {
  readonly entityId: string
  readonly entities: readonly { id: string; name: string }[]
  readonly usageCount: number
  readonly entityLabel: string
  readonly hasSourceContract?: boolean
  readonly onDelete: () => void
  readonly onMerge: (targetId: string) => void
}) {
  const [targetId, setTargetId] = useState('')

  return (
    <div className="entity-actions">
      <select aria-label={`Merge ${entityLabel} into`} value={targetId} onChange={(event) => setTargetId(event.target.value)}>
        <option value="">Merge into...</option>
        {entities.filter((entity) => entity.id !== entityId).map((entity) => (
          <option key={entity.id} value={entity.id}>{entity.name}</option>
        ))}
      </select>
      <button
        aria-label={`Merge ${entityLabel}`}
        className="icon-button"
        disabled={!targetId}
        title={`Merge ${entityLabel}`}
        type="button"
        onClick={() => {
          const target = entities.find((entity) => entity.id === targetId)
          const contractWarning = hasSourceContract ? ' The source HTTP contract will be discarded.' : ''
          if (target && window.confirm(`Move ${usageCount} references from ${entityLabel} to ${target.name} and delete the source?${contractWarning}`)) {
            onMerge(target.id)
          }
        }}
      >
        <GitMerge aria-hidden="true" size={15} />
      </button>
      <button
        aria-label={`Delete ${entityLabel}`}
        className="icon-button danger-icon"
        title={`Delete ${entityLabel}`}
        type="button"
        onClick={onDelete}
      >
        <Trash2 aria-hidden="true" size={15} />
      </button>
    </div>
  )
}

export function UsersTab({ apiCanvas, applyChange }: { readonly apiCanvas: ApiCanvas; readonly applyChange: ApplyChange }) {
  return (
    <article className="editor-card entity-tab-card">
      <div className="section-header">
        <div><p className="eyebrow">Users</p><h3>Canvas users</h3></div>
        <button className="button" type="button" onClick={() => applyChange(createRole(apiCanvas))}><Plus size={16} /> Add user</button>
      </div>
      <div className="canvas-table-scroll">
        <table className="canvas-preview entity-table">
          <thead><tr><th>Name</th><th>Description</th><th>Use cases</th><th>Actions</th></tr></thead>
          <tbody>
            {apiCanvas.roles.map((role: UserRole) => {
              const usageCount = apiCanvas.useCases.filter((useCase) => useCase.roleId === role.id).length
              return (
                <tr key={role.id}>
                  <td><InlineField ariaLabel={`User name ${role.name}`} value={role.name} onCommit={(name) => applyChange(updateRole(apiCanvas, role.id, { ...role, name }))} /></td>
                  <td><InlineField ariaLabel={`Description for ${role.name}`} multiline value={role.description} onCommit={(description) => applyChange(updateRole(apiCanvas, role.id, { ...role, description }))} /></td>
                  <td>{usageCount}</td>
                  <td>
                    <EntityActions
                      entityId={role.id}
                      entities={apiCanvas.roles}
                      entityLabel={role.name}
                      usageCount={usageCount}
                      onDelete={() => {
                        if (!usageCount || window.confirm(`Delete ${role.name} and its ${usageCount} use cases?`)) {
                          applyChange(deleteRole(apiCanvas, role.id))
                        }
                      }}
                      onMerge={(targetId) => applyChange(mergeRole(apiCanvas, role.id, targetId))}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </article>
  )
}

export function OperationsTab({ apiCanvas, applyChange }: { readonly apiCanvas: ApiCanvas; readonly applyChange: ApplyChange }) {
  const rows = getOperationRows(apiCanvas)

  return (
    <div className="model-tab-stack">
      <article className="editor-card entity-tab-card">
        <div className="section-header">
          <div><p className="eyebrow">Operations</p><h3>Reusable operations</h3></div>
          <button className="button" type="button" onClick={() => applyChange(createOperation(apiCanvas))}><Plus size={16} /> Add operation</button>
        </div>
        <div className="canvas-table-scroll">
          <table className="canvas-preview entity-table">
            <thead><tr><th>Name</th><th>Description</th><th>Steps</th><th>Actions</th></tr></thead>
            <tbody>
              {apiCanvas.operations.map((operation: Operation) => {
                const usageCount = apiCanvas.steps.filter((step) => step.operationId === operation.id).length
                return (
                  <tr key={operation.id}>
                    <td><InlineField ariaLabel={`Operation name ${operation.name}`} value={operation.name} onCommit={(name) => applyChange(updateOperation(apiCanvas, operation.id, { ...operation, name }))} /></td>
                    <td><InlineField ariaLabel={`Description for ${operation.name}`} multiline value={operation.description} onCommit={(description) => applyChange(updateOperation(apiCanvas, operation.id, { ...operation, description }))} /></td>
                    <td>{usageCount}</td>
                    <td>
                      <EntityActions
                        entityId={operation.id}
                        entities={apiCanvas.operations}
                        entityLabel={operation.name}
                        hasSourceContract={Boolean(operation.httpContract)}
                        usageCount={usageCount}
                        onDelete={() => {
                          if (!usageCount || window.confirm(`Delete ${operation.name} and its ${usageCount} steps?`)) {
                            applyChange(deleteOperation(apiCanvas, operation.id))
                          }
                        }}
                        onMerge={(targetId) => applyChange(mergeOperation(apiCanvas, operation.id, targetId))}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </article>

      <article className="editor-card final-output-card">
        <p className="eyebrow">Final output</p>
        <h3>Capabilities organized around operations</h3>
        <div className="canvas-table-scroll">
          <table className="canvas-preview operation-output-table">
            <thead><tr><th>Operation</th><th>Input</th><th>Success</th><th>Failure</th><th>Step</th><th>Use Case</th><th>User</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.stepId}>
                  <td><strong>{row.operation?.name || 'Not assigned'}</strong></td>
                  <td>{row.step.input}</td>
                  <td>{row.step.success}</td>
                  <td>{row.step.failure}</td>
                  <td>{row.step.title}</td>
                  <td>{row.useCase.title}</td>
                  <td>{row.role.name}</td>
                </tr>
              ))}
              {rows.length === 0 ? <tr><td className="empty-table-cell" colSpan={7}>No capability steps yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  )
}
