import { describe, expect, test } from 'vitest'
import { ZodError } from 'zod'
import { sampleCanvas } from '../../domain/apiCanvas'
import { normalizeImportedApis, parseImportedJson, serializeApiCanvas, serializeWorkspace } from './jsonInterchange'

describe('jsonInterchange', () => {
  test('round-trips a single API envelope', () => {
    const serialized = serializeApiCanvas(sampleCanvas)
    const parsed = parseImportedJson(serialized)

    expect(parsed.kind).toBe('api-capabilities-canvas/api')
    const apis = normalizeImportedApis(parsed, [], true)
    expect(apis).toHaveLength(1)
    expect(apis[0]?.name).toBe(sampleCanvas.name)
  })

  test('round-trips a workspace envelope', () => {
    const serialized = serializeWorkspace([sampleCanvas])
    const parsed = parseImportedJson(serialized)

    expect(parsed.kind).toBe('api-capabilities-canvas/workspace')
  })

  test('rejects duplicate API IDs before they overwrite each other', () => {
    const parsed = parseImportedJson(serializeWorkspace([sampleCanvas, sampleCanvas]))

    expect(() => normalizeImportedApis(parsed, [], true)).toThrow(
      'Imported workspace contains duplicate API ID demo-canvas.',
    )
  })

  test('rejects invalid types for known JSON Schema keywords', () => {
    const envelope = JSON.parse(serializeApiCanvas(sampleCanvas)) as {
      api: { schemaComponents: { schema: Record<string, unknown> }[] }
    }
    envelope.api.schemaComponents[0]!.schema['type'] = 42

    expect(() => parseImportedJson(JSON.stringify(envelope))).toThrow(ZodError)
  })

  test('preserves advanced JSON Schema keywords for forward compatibility', () => {
    const envelope = JSON.parse(serializeApiCanvas(sampleCanvas)) as {
      api: { schemaComponents: { schema: Record<string, unknown> }[] }
    }
    envelope.api.schemaComponents[0]!.schema['oneOf'] = [
      { type: 'string' },
      { type: 'number' },
    ]

    const parsed = parseImportedJson(JSON.stringify(envelope))
    const api = parsed.kind === 'api-capabilities-canvas/api' ? parsed.api : undefined

    expect(api?.schemaComponents[0]?.schema).toMatchObject({
      oneOf: [{ type: 'string' }, { type: 'number' }],
    })
  })
})
