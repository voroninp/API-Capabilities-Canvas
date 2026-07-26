import type { ApiCanvas } from '../../domain/apiCanvas'
import { duplicateApiCanvas } from '../../domain/mutations'
import { validateApiCanvas } from '../../domain/validation'
import { importEnvelopeSchema, type ImportedEnvelope } from './schemas'

const appVersion = '0.0.0'

export function serializeApiCanvas(apiCanvas: ApiCanvas): string {
  return JSON.stringify(
    {
      kind: 'api-capabilities-canvas/api',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      appVersion,
      api: apiCanvas,
    },
    null,
    2,
  )
}

export function serializeWorkspace(apiCanvases: readonly ApiCanvas[]): string {
  return JSON.stringify(
    {
      kind: 'api-capabilities-canvas/workspace',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      appVersion,
      apis: apiCanvases,
    },
    null,
    2,
  )
}

export function parseImportedJson(text: string): ImportedEnvelope {
  const jsonValue = JSON.parse(text) as unknown
  return importEnvelopeSchema.parse(jsonValue)
}

export function normalizeImportedApis(
  envelope: ImportedEnvelope,
  existingApis: readonly ApiCanvas[],
  replaceConflicts: boolean,
): readonly ApiCanvas[] {
  const importedApis = envelope.kind === 'api-capabilities-canvas/api' ? [envelope.api] : envelope.apis
  const existingById = new Set(existingApis.map((apiCanvas) => apiCanvas.id))
  const importedIds = new Set<string>()

  importedApis.forEach((apiCanvas) => {
    if (importedIds.has(apiCanvas.id)) {
      throw new Error(`Imported workspace contains duplicate API ID ${apiCanvas.id}.`)
    }
    importedIds.add(apiCanvas.id)
  })

  return importedApis.map((apiCanvas) => {
    const issues = validateApiCanvas(apiCanvas)
    const blockingIssues = issues.filter((issue) => issue.severity === 'error')

    if (blockingIssues.length > 0) {
      throw new Error(blockingIssues.map((issue) => issue.message).join('\n'))
    }

    if (!existingById.has(apiCanvas.id) || replaceConflicts) {
      return apiCanvas
    }

    return duplicateApiCanvas(apiCanvas)
  })
}
