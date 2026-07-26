import { z } from 'zod'
import type { ApiCanvas, JsonSchemaNode } from '../../domain/apiCanvas'

const jsonSchemaNodeSchema: z.ZodType<JsonSchemaNode> = z.lazy(() =>
  z.union([
    z.boolean(),
    z.object({
      $id: z.string().optional(),
      $ref: z.string().optional(),
      additionalProperties: jsonSchemaNodeSchema.optional(),
      default: z.unknown().optional(),
      description: z.string().optional(),
      enum: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
      example: z.unknown().optional(),
      format: z.string().optional(),
      items: jsonSchemaNodeSchema.optional(),
      properties: z.record(z.string(), jsonSchemaNodeSchema).optional(),
      required: z.array(z.string()).optional(),
      title: z.string().optional(),
      type: z.enum(['array', 'boolean', 'integer', 'number', 'object', 'string']).optional(),
    }).catchall(z.unknown()),
  ]),
)

const httpParameterSchema = z.object({
  id: z.string(),
  name: z.string(),
  in: z.enum(['cookie', 'header', 'path', 'query']),
  description: z.string(),
  required: z.boolean(),
  schemaRef: z.string().optional(),
  schema: jsonSchemaNodeSchema.optional(),
})

const mediaTypePayloadSchema = z.object({
  schemaRef: z.string().optional(),
  schema: jsonSchemaNodeSchema.optional(),
  example: z.string().optional(),
})

const httpResponseSchema = z.object({
  status: z.string(),
  description: z.string(),
  headers: z.array(httpParameterSchema),
  content: z.record(z.string(), mediaTypePayloadSchema),
})

const httpContractSchema = z.object({
  method: z.enum(['delete', 'get', 'patch', 'post', 'put']),
  path: z.string(),
  operationId: z.string(),
  summary: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  parameters: z.array(httpParameterSchema),
  requestBody: z
    .object({
      description: z.string(),
      required: z.boolean(),
      content: z.record(z.string(), mediaTypePayloadSchema),
    })
    .optional(),
  responses: z.array(httpResponseSchema),
})

const apiCanvasSchema: z.ZodType<ApiCanvas> = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  roles: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      order: z.number(),
    }),
  ),
  useCases: z.array(
    z.object({
      id: z.string(),
      roleId: z.string(),
      title: z.string(),
      description: z.string(),
      order: z.number(),
    }),
  ),
  steps: z.array(
    z.object({
      id: z.string(),
      useCaseId: z.string(),
      operationId: z.string(),
      title: z.string(),
      input: z.string(),
      success: z.string(),
      failure: z.string(),
      order: z.number(),
    }),
  ),
  operations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      httpContract: httpContractSchema.optional(),
    }),
  ),
  schemaComponents: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      schema: jsonSchemaNodeSchema,
    }),
  ),
  servers: z.array(z.string()),
  tags: z.array(z.string()),
})

export const apiEnvelopeSchema = z.object({
  kind: z.literal('api-capabilities-canvas/api'),
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  appVersion: z.string(),
  api: apiCanvasSchema,
})

export const workspaceEnvelopeSchema = z.object({
  kind: z.literal('api-capabilities-canvas/workspace'),
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  appVersion: z.string(),
  apis: z.array(apiCanvasSchema),
})

export const importEnvelopeSchema = z.union([apiEnvelopeSchema, workspaceEnvelopeSchema])

export type ImportedEnvelope = z.infer<typeof importEnvelopeSchema>
