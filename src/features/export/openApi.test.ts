import SwaggerParser from '@apidevtools/swagger-parser'
import { describe, expect, test } from 'vitest'
import { sampleCanvas } from '../../domain/apiCanvas'
import { buildOpenApiDocument, buildOpenApiYaml } from './openApi'

describe('openApi export', () => {
  test('builds a valid OpenAPI 3.1 document', async () => {
    const document = buildOpenApiDocument(sampleCanvas)
    const parser = SwaggerParser as unknown as {
      validate: (value: unknown) => Promise<unknown>
    }
    const validated = (await parser.validate(JSON.parse(JSON.stringify(document)) as unknown)) as Record<string, unknown>

    expect(validated['openapi']).toBe('3.1.0')
    expect(document.paths['/products']).toBeDefined()
  })

  test('builds YAML output', async () => {
    const yaml = await buildOpenApiYaml(sampleCanvas)

    expect(yaml).toContain('openapi: 3.1.0')
    expect(yaml).toContain('/products')
  })

  test('preserves multiple HTTP methods that share a path', () => {
    const getOperation = sampleCanvas.operations[0]!
    const postOperation = {
      ...getOperation,
      id: 'operation-create-product',
      httpContract: {
        ...getOperation.httpContract!,
        method: 'post' as const,
        operationId: 'createProduct',
      },
    }

    const document = buildOpenApiDocument({
      ...sampleCanvas,
      operations: [getOperation, postOperation],
    })

    expect(document.paths['/products']).toHaveProperty('get')
    expect(document.paths['/products']).toHaveProperty('post')
  })

  test('preserves boolean schemas and empty examples', () => {
    const operation = sampleCanvas.operations[0]!
    const document = buildOpenApiDocument({
      ...sampleCanvas,
      operations: [
        {
          ...operation,
          httpContract: {
            ...operation.httpContract!,
            responses: operation.httpContract!.responses.map((response, index) =>
              index === 0
                ? {
                    ...response,
                    content: {
                      'application/json': { schema: false, example: '' },
                    },
                  }
                : response,
            ),
          },
        },
      ],
    })

    const getOperation = document.paths['/products']?.['get'] as {
      responses: Record<string, { content?: Record<string, { example?: string; schema?: unknown }> }>
    }
    expect(getOperation.responses['200']?.content?.['application/json']).toEqual({
      schema: false,
      example: '',
    })
  })

  test.each([
    ['title', { name: ' ' }],
    ['version', { version: ' ' }],
  ])('blocks export when the API %s is blank', (_, patch) => {
    expect(() => buildOpenApiDocument({ ...sampleCanvas, ...patch })).toThrow()
  })
})
