import type { JsonSchemaNode } from '../../domain/apiCanvas'

export interface StructuredPropertyDraft {
  readonly description: string
  readonly id: string
  readonly name: string
  readonly required: boolean
  readonly type: 'array' | 'boolean' | 'integer' | 'number' | 'object' | 'string'
}

const supportedRootKeywords = new Set(['properties', 'required', 'type'])
const supportedPropertyKeywords = new Set(['description', 'type'])

export function schemaToStructuredProperties(
  schema: JsonSchemaNode,
): { readonly properties: readonly StructuredPropertyDraft[]; readonly supported: boolean } {
  if (
    typeof schema === 'boolean'
    || schema.type !== 'object'
    || Object.keys(schema).some((keyword) => !supportedRootKeywords.has(keyword))
  ) {
    return { properties: [], supported: false }
  }

  const required = new Set(schema.required ?? [])
  const entries = Object.entries(schema.properties ?? {})
  const properties: StructuredPropertyDraft[] = []

  if ([...required].some((name) => !schema.properties?.[name])) {
    return { properties: [], supported: false }
  }

  for (const [index, [name, property]] of entries.entries()) {
    if (
      typeof property === 'boolean'
      || !property.type
      || Object.keys(property).some((keyword) => !supportedPropertyKeywords.has(keyword))
    ) {
      return { properties: [], supported: false }
    }

    properties.push({
      id: `property-${index}`,
      name,
      required: required.has(name),
      type: property.type,
      description: property.description ?? '',
    })
  }

  return { properties, supported: true }
}

export function buildStructuredSchema(properties: readonly StructuredPropertyDraft[]): JsonSchemaNode {
  return {
    type: 'object',
    properties: Object.fromEntries(
      properties
        .filter((property) => property.name.trim())
        .map((property) => [
          property.name.trim(),
          {
            type: property.type,
            ...(property.description.trim() ? { description: property.description.trim() } : {}),
          },
        ]),
    ),
    required: properties
      .filter((property) => property.required && property.name.trim())
      .map((property) => property.name.trim()),
  }
}

export function createStructuredProperty(name: string): StructuredPropertyDraft {
  return {
    id: crypto.randomUUID(),
    name,
    required: false,
    type: 'string',
    description: '',
  }
}
