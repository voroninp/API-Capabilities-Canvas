import { describe, expect, test } from 'vitest'
import {
  buildStructuredSchema,
  createStructuredProperty,
  schemaToStructuredProperties,
} from './schemaBuilder'

describe('structured schema conversion', () => {
  test('round-trips the supported object subset without changing row identity', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        id: { type: 'string' as const, description: 'Stable identifier' },
        active: { type: 'boolean' as const },
      },
      required: ['id'],
    }

    const first = schemaToStructuredProperties(schema)
    const second = schemaToStructuredProperties(schema)

    expect(first.supported).toBe(true)
    expect(first.properties.map((property) => property.id)).toEqual(
      second.properties.map((property) => property.id),
    )
    expect(buildStructuredSchema(first.properties)).toEqual(schema)
  })

  test.each([
    ['root metadata', { type: 'object' as const, title: 'Product', properties: {} }],
    ['property formats', { type: 'object' as const, properties: { id: { type: 'string' as const, format: 'uuid' } } }],
    ['nested objects', { type: 'object' as const, properties: { owner: { type: 'object' as const, properties: {} } } }],
    ['array items', { type: 'object' as const, properties: { tags: { type: 'array' as const, items: { type: 'string' as const } } } }],
  ])('rejects %s that a structured edit would discard', (_, schema) => {
    expect(schemaToStructuredProperties(schema).supported).toBe(false)
  })

  test('creates a named property that survives serialization', () => {
    const property = createStructuredProperty('property1')
    const schema = buildStructuredSchema([property])

    expect(schema).toMatchObject({
      properties: { property1: { type: 'string' } },
    })
  })
})
