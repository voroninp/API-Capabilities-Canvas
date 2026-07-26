import { Plus, Trash2 } from 'lucide-react'
import type { HttpContract, HttpResponse } from '../../../domain/apiCanvas'
import { createResponse } from '../../../domain/mutations'
import { updateContentRecord } from './contentRecord'

export function ContractResponsesEditor({
  contract,
  schemaOptions,
  onChange,
}: {
  readonly contract: HttpContract
  readonly schemaOptions: readonly string[]
  readonly onChange: (contract: HttpContract) => void
}) {
  function updateResponse(response: HttpResponse, patch: Partial<HttpResponse>) {
    onChange({
      ...contract,
      responses: contract.responses.map((current) => current === response ? { ...current, ...patch } : current),
    })
  }

  return (
    <section className="editor-subsection">
      <div className="section-header">
        <h4>Responses</h4>
        <button className="ghost-button" type="button" onClick={() => onChange({ ...contract, responses: [...contract.responses, createResponse()] })}>
          <Plus size={14} /> Add response
        </button>
      </div>
      {contract.responses.map((response, index) => (
        <div className="response-card" key={`${response.status}-${index}`}>
          <div className="grid-inline fields-3">
            <input value={response.status} onChange={(event) => updateResponse(response, { status: event.target.value })} placeholder="200" />
            <input value={response.description} onChange={(event) => updateResponse(response, { description: event.target.value })} placeholder="Description" />
            <button
              aria-label={`Delete response ${response.status}`}
              className="danger-button"
              type="button"
              onClick={() => onChange({ ...contract, responses: contract.responses.filter((current) => current !== response) })}
            >
              <Trash2 aria-hidden="true" size={14} />
            </button>
          </div>
          {Object.entries(response.content).map(([mediaType, payload]) => (
            <div className="grid-inline fields-3" key={mediaType}>
              <input
                value={mediaType}
                onChange={(event) => updateResponse(response, {
                  content: updateContentRecord(response.content, mediaType, event.target.value, payload),
                })}
              />
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
                  <option key={schemaRef} value={schemaRef}>{schemaRef}</option>
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
          <button
            className="ghost-button"
            type="button"
            onClick={() => updateResponse(response, {
              content: { ...response.content, [`application/json${Object.keys(response.content).length || ''}`]: {} },
            })}
          >
            <Plus size={14} /> Add media type
          </button>
        </div>
      ))}
    </section>
  )
}
