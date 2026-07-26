import type { ApiCanvas, HttpResponse, JsonSchemaNode } from '../../domain/apiCanvas'
import { validateApiCanvas } from '../../domain/validation'

export interface OpenApiDocument {
  readonly openapi: '3.1.0'
  readonly info: {
    readonly title: string
    readonly version: string
    readonly description: string
  }
  readonly servers?: readonly { url: string }[]
  readonly tags?: readonly { name: string }[]
  readonly paths: Record<string, Record<string, unknown>>
  readonly components: {
    readonly schemas: Record<string, JsonSchemaNode>
  }
}

function schemaField(
  schemaRef: string | undefined,
  schema: JsonSchemaNode | undefined,
): Record<string, unknown> {
  if (schemaRef) {
    return { schema: { $ref: schemaRef } }
  }

  return schema === undefined ? {} : { schema }
}

function responseToOpenApi(response: HttpResponse): Record<string, unknown> {
  return {
    description: response.description,
    ...(Object.keys(response.content).length > 0
      ? {
          content: Object.fromEntries(
            Object.entries(response.content).map(([mediaType, payload]) => [
              mediaType,
              {
                ...schemaField(payload.schemaRef, payload.schema),
                ...(payload.example !== undefined ? { example: payload.example } : {}),
              },
            ]),
          ),
        }
      : {}),
    ...(response.headers.length > 0
      ? {
          headers: Object.fromEntries(
            response.headers.map((header) => [
              header.name,
              {
                description: header.description,
                required: header.required,
                ...schemaField(header.schemaRef, header.schema),
              },
            ]),
          ),
        }
      : {}),
  }
}

export function buildOpenApiDocument(apiCanvas: ApiCanvas): OpenApiDocument {
  const issues = validateApiCanvas(apiCanvas)
  const blockingIssues = issues.filter(
    (issue) =>
      issue.severity === 'error' &&
      (
        issue.path === 'name'
        || issue.path === 'version'
        || issue.path.startsWith('operations.')
        || issue.path.startsWith('schemas.')
      ),
  )

  if (blockingIssues.length > 0) {
    throw new Error(blockingIssues.map((issue) => issue.message).join('\n'))
  }

  const paths: Record<string, Record<string, unknown>> = {}
  apiCanvas.operations
    .filter((operation) => operation.httpContract)
    .sort((left, right) =>
      (left.httpContract?.path ?? '').localeCompare(right.httpContract?.path ?? ''),
    )
    .forEach((operation) => {
      const contract = operation.httpContract!
      paths[contract.path] = {
        ...paths[contract.path],
        [contract.method]: {
            operationId: contract.operationId,
            summary: contract.summary,
            description: contract.description,
            tags: contract.tags,
            ...(contract.parameters.length > 0
              ? {
                  parameters: contract.parameters.map((parameter) => ({
                    name: parameter.name,
                    in: parameter.in,
                    description: parameter.description,
                    required: parameter.required,
                    ...schemaField(parameter.schemaRef, parameter.schema),
                  })),
                }
              : {}),
            ...(contract.requestBody
              ? {
                  requestBody: {
                    description: contract.requestBody.description,
                    required: contract.requestBody.required,
                    content: Object.fromEntries(
                      Object.entries(contract.requestBody.content).map(([mediaType, payload]) => [
                        mediaType,
                        {
                          ...schemaField(payload.schemaRef, payload.schema),
                          ...(payload.example !== undefined ? { example: payload.example } : {}),
                        },
                      ]),
                    ),
                  },
                }
              : {}),
            responses: Object.fromEntries(
              contract.responses
                .slice()
                .sort((left, right) => left.status.localeCompare(right.status))
                .map((response) => [response.status, responseToOpenApi(response)]),
            ),
          },
        }
    })

  return {
    openapi: '3.1.0',
    info: {
      title: apiCanvas.name,
      version: apiCanvas.version,
      description: apiCanvas.description,
    },
    ...(apiCanvas.servers.length > 0 ? { servers: apiCanvas.servers.map((url) => ({ url })) } : {}),
    ...(apiCanvas.tags.length > 0 ? { tags: apiCanvas.tags.map((name) => ({ name })) } : {}),
    paths,
    components: {
      schemas: Object.fromEntries(
        apiCanvas.schemaComponents
          .slice()
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((schemaComponent) => [schemaComponent.name, schemaComponent.schema]),
      ),
    },
  }
}

export async function buildOpenApiYaml(apiCanvas: ApiCanvas): Promise<string> {
  const document = buildOpenApiDocument(apiCanvas)
  const yaml = await import('yaml')
  return yaml.stringify(document)
}
