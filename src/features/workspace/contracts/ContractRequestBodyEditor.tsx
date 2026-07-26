import { Plus, Trash2 } from 'lucide-react'
import type { HttpContract } from '../../../domain/apiCanvas'
import { updateContentRecord } from './contentRecord'

export function ContractRequestBodyEditor({
  contract,
  schemaOptions,
  onChange,
}: {
  readonly contract: HttpContract
  readonly schemaOptions: readonly string[]
  readonly onChange: (contract: HttpContract) => void
}) {
  const requestBody = contract.requestBody

  return (
    <section className="editor-subsection">
      <div className="section-header">
        <h4>Request body</h4>
        {requestBody ? (
          <button className="danger-button" type="button" onClick={() => onChange({ ...contract, requestBody: undefined })}>
            <Trash2 size={14} /> Remove
          </button>
        ) : (
          <button className="ghost-button" type="button" onClick={() => onChange({ ...contract, requestBody: { description: '', required: true, content: { 'application/json': {} } } })}>
            <Plus size={14} /> Add body
          </button>
        )}
      </div>
      {requestBody ? (
        <div className="form-grid compact-form">
          <input
            value={requestBody.description}
            placeholder="Request body description"
            onChange={(event) => onChange({ ...contract, requestBody: { ...requestBody, description: event.target.value } })}
          />
          {Object.entries(requestBody.content).map(([mediaType, payload]) => (
            <div className="grid-inline fields-3" key={mediaType}>
              <input
                value={mediaType}
                onChange={(event) => onChange({
                  ...contract,
                  requestBody: {
                    ...requestBody,
                    content: updateContentRecord(requestBody.content, mediaType, event.target.value, payload),
                  },
                })}
              />
              <select
                value={payload.schemaRef ?? ''}
                onChange={(event) => onChange({
                  ...contract,
                  requestBody: {
                    ...requestBody,
                    content: updateContentRecord(requestBody.content, mediaType, mediaType, {
                      ...payload,
                      schemaRef: event.target.value || undefined,
                      schema: event.target.value ? undefined : payload.schema,
                    }),
                  },
                })}
              >
                <option value="">No schema</option>
                {schemaOptions.map((schemaRef) => (
                  <option key={schemaRef} value={schemaRef}>{schemaRef}</option>
                ))}
              </select>
              <button
                aria-label={`Delete request media type ${mediaType}`}
                className="danger-button"
                type="button"
                onClick={() => {
                  const nextContent = { ...requestBody.content }
                  delete nextContent[mediaType]
                  onChange({ ...contract, requestBody: { ...requestBody, content: nextContent } })
                }}
              >
                <Trash2 aria-hidden="true" size={14} />
              </button>
            </div>
          ))}
          <button
            className="ghost-button"
            type="button"
            onClick={() => onChange({
              ...contract,
              requestBody: {
                ...requestBody,
                content: {
                  ...requestBody.content,
                  [`application/custom-${Object.keys(requestBody.content).length}.json`]: {},
                },
              },
            })}
          >
            <Plus size={14} /> Add media type
          </button>
        </div>
      ) : null}
    </section>
  )
}
