import type { ApiCanvas } from '../../domain/apiCanvas'
import { updateApiMetadata } from '../../domain/mutations'
import { SchemaEditorPanel } from './SchemaEditorPanel'

export function SettingsTab({
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
              onChange={(event) => patchMetadata({ servers: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
            />
          </div>
          <div className="field">
            <label>Tags (comma separated)</label>
            <input
              value={apiCanvas.tags.join(', ')}
              onChange={(event) => patchMetadata({ tags: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
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
