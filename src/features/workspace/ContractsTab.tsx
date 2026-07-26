import { Plus, Trash2 } from 'lucide-react'
import type { ApiCanvas, HttpContract } from '../../domain/apiCanvas'
import { defaultContract, setOperationContract } from '../../domain/mutations'
import { ContractParametersEditor } from './contracts/ContractParametersEditor'
import { ContractRequestBodyEditor } from './contracts/ContractRequestBodyEditor'
import { ContractResponsesEditor } from './contracts/ContractResponsesEditor'

export function ContractsTab({
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

  return (
    <article className="editor-card">
      <p className="eyebrow">Contracts</p>
      <h3>HTTP mapping per operation</h3>
      <div className="form-grid compact-form">
        <div className="field">
          <label>Operation</label>
          <select value={selectedOperationId} onChange={(event) => setSelectedOperationId(event.target.value)}>
            {apiCanvas.operations.map((operation) => (
              <option key={operation.id} value={operation.id}>{operation.name}</option>
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
                    onChange={(event) => updateContract({
                      ...selectedOperation.httpContract!,
                      method: event.target.value as HttpContract['method'],
                    })}
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
                    onChange={(event) => updateContract({
                      ...selectedOperation.httpContract!,
                      tags: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                    })}
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

              <ContractParametersEditor contract={selectedOperation.httpContract} schemaOptions={schemaOptions} onChange={updateContract} />
              <ContractRequestBodyEditor contract={selectedOperation.httpContract} schemaOptions={schemaOptions} onChange={updateContract} />
              <ContractResponsesEditor contract={selectedOperation.httpContract} schemaOptions={schemaOptions} onChange={updateContract} />

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
