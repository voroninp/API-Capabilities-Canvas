import { describe, expect, test } from 'vitest'
import { sampleCanvas } from './apiCanvas'
import { validateApiCanvas } from './validation'

describe('validateApiCanvas', () => {
  test('reports operations without HTTP contracts as info with a distinct title', () => {
    const issues = validateApiCanvas(sampleCanvas)
    const issue = issues.find((candidate) => candidate.message === 'No HTTP contract yet.')
    const operation = sampleCanvas.operations.find((candidate) => !candidate.httpContract)

    expect(issue).toEqual(expect.objectContaining({ severity: 'info', title: operation?.name }))
  })

  test('requires OpenAPI metadata but allows an empty description', () => {
    const withoutDescription = validateApiCanvas({ ...sampleCanvas, description: '' })
    const withoutTitle = validateApiCanvas({ ...sampleCanvas, name: '   ' })
    const withoutVersion = validateApiCanvas({ ...sampleCanvas, version: '   ' })

    expect(withoutDescription.some((issue) => issue.path === 'description')).toBe(false)
    expect(withoutTitle).toContainEqual(expect.objectContaining({ severity: 'error', path: 'name' }))
    expect(withoutVersion).toContainEqual(expect.objectContaining({ severity: 'error', path: 'version' }))
  })

  test('rejects duplicate schema names that would collapse during export', () => {
    const issues = validateApiCanvas({
      ...sampleCanvas,
      schemaComponents: [sampleCanvas.schemaComponents[0]!, { ...sampleCanvas.schemaComponents[1]!, name: 'ProductSearchResult' }],
    })

    expect(issues.some((issue) => issue.message === 'Schema name ProductSearchResult is duplicated.')).toBe(true)
  })

  test('validates schema sources everywhere they can appear in a contract', () => {
    const operation = sampleCanvas.operations[0]!
    const contract = operation.httpContract!
    const issues = validateApiCanvas({
      ...sampleCanvas,
      operations: [
        {
          ...operation,
          httpContract: {
            ...contract,
            parameters: [
              {
                ...contract.parameters[0]!,
                schemaRef: '#/components/schemas/Missing',
                schema: { type: 'string' },
              },
            ],
            responses: [
              {
                ...contract.responses[0]!,
                headers: [
                  {
                    ...contract.parameters[0]!,
                    id: 'response-header',
                    schemaRef: 'Problem',
                    schema: undefined,
                  },
                ],
              },
              contract.responses[1]!,
            ],
          },
        },
      ],
    })

    expect(issues).toContainEqual(expect.objectContaining({
      message: 'Choose either a schema component reference or an inline schema, not both.',
    }))
    expect(issues).toContainEqual(expect.objectContaining({
      message: 'Schema reference #/components/schemas/Missing cannot be resolved to a local component.',
    }))
    expect(issues).toContainEqual(expect.objectContaining({
      message: 'Schema reference Problem cannot be resolved to a local component.',
    }))
  })

  test('rejects component names that cannot be addressed by an OpenAPI component reference', () => {
    const issues = validateApiCanvas({
      ...sampleCanvas,
      schemaComponents: [
        ...sampleCanvas.schemaComponents,
        { id: 'invalid-schema', name: 'Order detail', schema: { type: 'object' } },
      ],
    })

    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'error',
      path: 'schemas.invalid-schema.name',
    }))
  })

  test('rejects blank and duplicate entity IDs before keyed updates become ambiguous', () => {
    const issues = validateApiCanvas({
      ...sampleCanvas,
      roles: [
        sampleCanvas.roles[0]!,
        { ...sampleCanvas.roles[1]!, id: sampleCanvas.roles[0]!.id },
      ],
      operations: [
        ...sampleCanvas.operations,
        { id: '   ', name: 'Invalid operation', description: '' },
      ],
    })

    expect(issues).toContainEqual(expect.objectContaining({
      message: 'roles ID role-end-users is duplicated.',
    }))
    expect(issues).toContainEqual(expect.objectContaining({
      message: 'operations IDs cannot be empty.',
    }))
  })

  test('requires labels used to identify domain entities and HTTP operations', () => {
    const operation = sampleCanvas.operations[0]!
    const issues = validateApiCanvas({
      ...sampleCanvas,
      roles: [{ ...sampleCanvas.roles[0]!, name: ' ' }, sampleCanvas.roles[1]!],
      useCases: [{ ...sampleCanvas.useCases[0]!, title: ' ' }, sampleCanvas.useCases[1]!],
      steps: [{ ...sampleCanvas.steps[0]!, title: ' ' }, ...sampleCanvas.steps.slice(1)],
      operations: [
        {
          ...operation,
          name: ' ',
          httpContract: { ...operation.httpContract!, operationId: ' ' },
        },
        ...sampleCanvas.operations.slice(1),
      ],
    })

    expect(issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'roles.role-end-users.name',
      'useCases.use-case-buy-products.title',
      'steps.step-search-products.title',
      'operations.operation-search-products.name',
      'operations.operation-search-products.operationId',
    ]))
  })

  test('rejects malformed path templates without restricting legal parameter names', () => {
    const operation = sampleCanvas.operations[0]!
    const contract = operation.httpContract!
    const invalidIssues = validateApiCanvas({
      ...sampleCanvas,
      operations: [{ ...operation, httpContract: { ...contract, path: '/products/{}' } }],
    })
    const legalNameIssues = validateApiCanvas({
      ...sampleCanvas,
      operations: [{
        ...operation,
        httpContract: {
          ...contract,
          path: '/products/{product-id}',
          parameters: [{
            id: 'product-id',
            name: 'product-id',
            in: 'path',
            description: '',
            required: true,
            schema: { type: 'string' },
          }],
        },
      }],
    })

    expect(invalidIssues).toContainEqual(expect.objectContaining({
      message: 'HTTP path template braces must contain a non-empty parameter name and cannot be nested.',
    }))
    expect(legalNameIssues.some((issue) => issue.path.endsWith('.path'))).toBe(false)
  })

  test('accepts media types and wildcard ranges but rejects malformed content keys', () => {
    const operation = sampleCanvas.operations[0]!
    const contract = operation.httpContract!
    const issues = validateApiCanvas({
      ...sampleCanvas,
      operations: [{
        ...operation,
        httpContract: {
          ...contract,
          responses: contract.responses.map((response, index) => index === 0
            ? {
                ...response,
                content: {
                  '*/*': {},
                  'application/json/extra': {},
                },
              }
            : response),
        },
      }],
    })

    expect(issues.filter((issue) => issue.message.includes('Media type')).map((issue) => issue.message))
      .toEqual(['Media type application/json/extra is invalid.'])
  })
})
