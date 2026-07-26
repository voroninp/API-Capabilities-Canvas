export type JsonSchemaNode =
  | boolean
  | {
      $id?: string
      $ref?: string
      additionalProperties?: JsonSchemaNode
      default?: unknown
      description?: string
      enum?: readonly (string | number | boolean | null)[]
      example?: unknown
      format?: string
      items?: JsonSchemaNode
      properties?: Record<string, JsonSchemaNode>
      required?: readonly string[]
      title?: string
      type?: 'array' | 'boolean' | 'integer' | 'number' | 'object' | 'string'
    }

export type ParameterLocation = 'cookie' | 'header' | 'path' | 'query'

export interface HttpParameter {
  readonly id: string
  readonly name: string
  readonly in: ParameterLocation
  readonly description: string
  readonly required: boolean
  readonly schemaRef?: string
  readonly schema?: JsonSchemaNode
}

export interface MediaTypePayload {
  readonly schemaRef?: string
  readonly schema?: JsonSchemaNode
  readonly example?: string
}

export interface HttpBody {
  readonly description: string
  readonly required: boolean
  readonly content: Record<string, MediaTypePayload>
}

export interface HttpResponse {
  readonly status: string
  readonly description: string
  readonly headers: readonly HttpParameter[]
  readonly content: Record<string, MediaTypePayload>
}

export interface HttpContract {
  readonly method: 'delete' | 'get' | 'patch' | 'post' | 'put'
  readonly path: string
  readonly operationId: string
  readonly summary: string
  readonly description: string
  readonly tags: readonly string[]
  readonly parameters: readonly HttpParameter[]
  readonly requestBody?: HttpBody
  readonly responses: readonly HttpResponse[]
}

export interface Operation {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly httpContract?: HttpContract
}

export interface Step {
  readonly id: string
  readonly useCaseId: string
  readonly operationId: string
  readonly title: string
  readonly input: string
  readonly success: string
  readonly failure: string
  readonly order: number
}

export interface UseCase {
  readonly id: string
  readonly roleId: string
  readonly title: string
  readonly description: string
  readonly order: number
}

export interface UserRole {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly order: number
}

export interface SchemaComponent {
  readonly id: string
  readonly name: string
  readonly schema: JsonSchemaNode
}

export interface ApiCanvas {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly version: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly roles: readonly UserRole[]
  readonly useCases: readonly UseCase[]
  readonly steps: readonly Step[]
  readonly operations: readonly Operation[]
  readonly schemaComponents: readonly SchemaComponent[]
  readonly servers: readonly string[]
  readonly tags: readonly string[]
}

export interface CreateApiCanvasInput {
  readonly name: string
  readonly description?: string
  readonly version?: string
}

function createTimestamp(): string {
  return new Date().toISOString()
}

function createId(): string {
  return crypto.randomUUID()
}

export function createApiCanvas(input: CreateApiCanvasInput): ApiCanvas {
  const now = createTimestamp()

  return {
    id: createId(),
    name: input.name.trim(),
    description: input.description?.trim() ?? '',
    version: input.version?.trim() || '0.1.0',
    createdAt: now,
    updatedAt: now,
    roles: [],
    useCases: [],
    steps: [],
    operations: [],
    schemaComponents: [],
    servers: [],
    tags: [],
  }
}

export const sampleCanvas: ApiCanvas = {
  id: 'demo-canvas',
  name: 'Commerce API',
  description:
    'A seeded example showing how business-level steps point to reusable operations.',
  version: '0.1.0',
  createdAt: '2026-07-25T00:00:00.000Z',
  updatedAt: '2026-07-25T00:00:00.000Z',
  roles: [
    {
      id: 'role-end-users',
      name: 'End users',
      description: 'Customers buying products through the storefront.',
      order: 1,
    },
    {
      id: 'role-catalog-admins',
      name: 'Catalog admins',
      description: 'Back-office staff managing the product catalog.',
      order: 2,
    },
  ],
  useCases: [
    {
      id: 'use-case-buy-products',
      roleId: 'role-end-users',
      title: 'Buy products',
      description: 'Find a product and complete checkout.',
      order: 1,
    },
    {
      id: 'use-case-fill-catalog',
      roleId: 'role-catalog-admins',
      title: 'Fill catalog',
      description: 'Keep the catalog relevant and discoverable.',
      order: 1,
    },
  ],
  steps: [
    {
      id: 'step-search-products',
      useCaseId: 'use-case-buy-products',
      operationId: 'operation-search-products',
      title: 'Search for products to buy',
      input: 'Catalog filters',
      success: 'Products matching filters',
      failure: 'No product found',
      order: 1,
    },
    {
      id: 'step-add-product',
      useCaseId: 'use-case-buy-products',
      operationId: 'operation-add-product-to-cart',
      title: 'Add a product to the cart',
      input: 'Selected product',
      success: 'Product info',
      failure: 'Product does not exist',
      order: 2,
    },
    {
      id: 'step-checkout',
      useCaseId: 'use-case-buy-products',
      operationId: 'operation-create-order',
      title: 'Check out',
      input: 'Cart',
      success: 'User gets an order',
      failure: 'Empty cart',
      order: 3,
    },
    {
      id: 'step-similar-products',
      useCaseId: 'use-case-fill-catalog',
      operationId: 'operation-search-products',
      title: 'Look for similar products',
      input: 'Catalog characteristics',
      success: 'Products matching characteristics',
      failure: 'No product found',
      order: 1,
    },
  ],
  operations: [
    {
      id: 'operation-search-products',
      name: 'Search for products',
      description: 'Search across the catalog using filters or characteristics.',
      httpContract: {
        method: 'get',
        path: '/products',
        operationId: 'searchProducts',
        summary: 'Search for products',
        description: 'Returns products matching filters or catalog characteristics.',
        tags: ['catalog'],
        parameters: [
          {
            id: 'parameter-query',
            name: 'query',
            in: 'query',
            description: 'Free-text search term or category filter.',
            required: false,
            schema: { type: 'string' },
          },
        ],
        responses: [
          {
            status: '200',
            description: 'Products matching the supplied filters.',
            headers: [],
            content: {
              'application/json': {
                schemaRef: '#/components/schemas/ProductSearchResult',
              },
            },
          },
          {
            status: '404',
            description: 'No products matching the search request.',
            headers: [],
            content: {
              'application/json': {
                schemaRef: '#/components/schemas/Problem',
              },
            },
          },
        ],
      },
    },
    {
      id: 'operation-add-product-to-cart',
      name: 'Add a product to the cart',
      description: 'Attach one selected product to the active cart.',
    },
    {
      id: 'operation-create-order',
      name: 'Create an order',
      description: 'Convert the cart into a submitted order.',
    },
  ],
  schemaComponents: [
    {
      id: 'schema-product-search-result',
      name: 'ProductSearchResult',
      schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
              },
              required: ['id', 'title'],
            },
          },
        },
        required: ['items'],
      },
    },
    {
      id: 'schema-problem',
      name: 'Problem',
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          status: { type: 'integer' },
        },
        required: ['title', 'status'],
      },
    },
  ],
  servers: ['https://api.example.com'],
  tags: ['catalog', 'commerce'],
}