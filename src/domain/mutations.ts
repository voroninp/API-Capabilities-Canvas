import type {
  ApiCanvas,
  HttpContract,
  HttpParameter,
  HttpResponse,
  JsonSchemaNode,
  Operation,
  SchemaComponent,
  Step,
  UseCase,
  UserRole,
} from './apiCanvas'

function createId(): string {
  return crypto.randomUUID()
}

function touch<T extends ApiCanvas>(apiCanvas: T): T {
  return {
    ...apiCanvas,
    updatedAt: new Date().toISOString(),
  }
}

function nextOrder(items: readonly { order: number }[]): number {
  return items.reduce((maxOrder, item) => Math.max(maxOrder, item.order), 0) + 1
}

function replaceById<T extends { id: string }>(
  items: readonly T[],
  id: string,
  replace: (item: T) => T,
): readonly T[] {
  return items.map((item) => (item.id === id ? replace(item) : item))
}

function removeById<T extends { id: string }>(items: readonly T[], id: string): readonly T[] {
  return items.filter((item) => item.id !== id)
}

function rewriteSchemaRef(schemaRef: string | undefined, fromName: string, toName: string): string | undefined {
  if (!schemaRef) {
    return undefined
  }

  const fromRef = `#/components/schemas/${fromName}`
  const toRef = `#/components/schemas/${toName}`

  return schemaRef === fromRef ? toRef : schemaRef
}

function rewritePayloadSchemaRef(
  payload: { schemaRef?: string; schema?: JsonSchemaNode; example?: string },
  fromName: string,
  toName: string,
) {
  return {
    ...payload,
    schemaRef: rewriteSchemaRef(payload.schemaRef, fromName, toName),
  }
}

function rewriteContractSchemaRefs(contract: HttpContract, fromName: string, toName: string): HttpContract {
  return {
    ...contract,
    parameters: contract.parameters.map((parameter) => ({
      ...parameter,
      schemaRef: rewriteSchemaRef(parameter.schemaRef, fromName, toName),
    })),
    requestBody: contract.requestBody
      ? {
          ...contract.requestBody,
          content: Object.fromEntries(
            Object.entries(contract.requestBody.content).map(([mediaType, payload]) => [
              mediaType,
              rewritePayloadSchemaRef(payload, fromName, toName),
            ]),
          ),
        }
      : undefined,
    responses: contract.responses.map((response) => ({
      ...response,
      headers: response.headers.map((header) => ({
        ...header,
        schemaRef: rewriteSchemaRef(header.schemaRef, fromName, toName),
      })),
      content: Object.fromEntries(
        Object.entries(response.content).map(([mediaType, payload]) => [
          mediaType,
          rewritePayloadSchemaRef(payload, fromName, toName),
        ]),
      ),
    })),
  }
}

export function duplicateApiCanvas(apiCanvas: ApiCanvas): ApiCanvas {
  const roleMap = new Map(apiCanvas.roles.map((role) => [role.id, createId()]))
  const useCaseMap = new Map(apiCanvas.useCases.map((useCase) => [useCase.id, createId()]))
  const operationMap = new Map(apiCanvas.operations.map((operation) => [operation.id, createId()]))
  const stepMap = new Map(apiCanvas.steps.map((step) => [step.id, createId()]))
  const schemaMap = new Map(apiCanvas.schemaComponents.map((schema) => [schema.id, createId()]))
  const now = new Date().toISOString()

  return {
    ...apiCanvas,
    id: createId(),
    name: `${apiCanvas.name} copy`,
    createdAt: now,
    updatedAt: now,
    roles: apiCanvas.roles.map((role) => ({
      ...role,
      id: roleMap.get(role.id) ?? role.id,
    })),
    useCases: apiCanvas.useCases.map((useCase) => ({
      ...useCase,
      id: useCaseMap.get(useCase.id) ?? useCase.id,
      roleId: roleMap.get(useCase.roleId) ?? useCase.roleId,
    })),
    operations: apiCanvas.operations.map((operation) => ({
      ...operation,
      id: operationMap.get(operation.id) ?? operation.id,
      httpContract: operation.httpContract
        ? {
            ...operation.httpContract,
            operationId: `${operation.httpContract.operationId}Copy`,
            parameters: operation.httpContract.parameters.map((parameter) => ({
              ...parameter,
              id: createId(),
            })),
            responses: operation.httpContract.responses.map((response) => ({
              ...response,
              headers: response.headers.map((header) => ({
                ...header,
                id: createId(),
              })),
            })),
          }
        : undefined,
    })),
    steps: apiCanvas.steps.map((step) => ({
      ...step,
      id: stepMap.get(step.id) ?? step.id,
      useCaseId: useCaseMap.get(step.useCaseId) ?? step.useCaseId,
      operationId: operationMap.get(step.operationId) ?? step.operationId,
    })),
    schemaComponents: apiCanvas.schemaComponents.map((schema) => ({
      ...schema,
      id: schemaMap.get(schema.id) ?? schema.id,
    })),
  }
}

export function updateApiMetadata(
  apiCanvas: ApiCanvas,
  patch: Pick<ApiCanvas, 'description' | 'name' | 'servers' | 'tags' | 'version'>,
): ApiCanvas {
  return touch({
    ...apiCanvas,
    description: patch.description,
    name: patch.name,
    servers: patch.servers,
    tags: patch.tags,
    version: patch.version,
  })
}

export function createRole(apiCanvas: ApiCanvas): ApiCanvas {
  const role: UserRole = {
    id: createId(),
    name: `Role ${apiCanvas.roles.length + 1}`,
    description: '',
    order: nextOrder(apiCanvas.roles),
  }

  return touch({
    ...apiCanvas,
    roles: [...apiCanvas.roles, role],
  })
}

export function updateRole(apiCanvas: ApiCanvas, roleId: string, patch: Pick<UserRole, 'description' | 'name' | 'order'>): ApiCanvas {
  return touch({
    ...apiCanvas,
    roles: replaceById(apiCanvas.roles, roleId, (role) => ({ ...role, ...patch })),
  })
}

export function deleteRole(apiCanvas: ApiCanvas, roleId: string): ApiCanvas {
  const deletedUseCaseIds = new Set(
    apiCanvas.useCases.filter((useCase) => useCase.roleId === roleId).map((useCase) => useCase.id),
  )

  return touch({
    ...apiCanvas,
    roles: removeById(apiCanvas.roles, roleId),
    useCases: apiCanvas.useCases.filter((useCase) => !deletedUseCaseIds.has(useCase.id)),
    steps: apiCanvas.steps.filter((step) => !deletedUseCaseIds.has(step.useCaseId)),
  })
}

export function mergeRole(apiCanvas: ApiCanvas, sourceRoleId: string, targetRoleId: string): ApiCanvas {
  if (
    sourceRoleId === targetRoleId
    || !apiCanvas.roles.some((role) => role.id === sourceRoleId)
    || !apiCanvas.roles.some((role) => role.id === targetRoleId)
  ) {
    return apiCanvas
  }

  return touch({
    ...apiCanvas,
    roles: removeById(apiCanvas.roles, sourceRoleId),
    useCases: apiCanvas.useCases.map((useCase) => (
      useCase.roleId === sourceRoleId ? { ...useCase, roleId: targetRoleId } : useCase
    )),
  })
}

export function createUseCase(apiCanvas: ApiCanvas, roleId: string | undefined): ApiCanvas {
  const firstRoleId = roleId ?? apiCanvas.roles[0]?.id ?? ''

  if (!firstRoleId || !apiCanvas.roles.some((role) => role.id === firstRoleId)) {
    return apiCanvas
  }

  const useCase: UseCase = {
    id: createId(),
    roleId: firstRoleId,
    title: `Use case ${apiCanvas.useCases.length + 1}`,
    description: '',
    order: nextOrder(apiCanvas.useCases.filter((item) => item.roleId === firstRoleId)),
  }

  return touch({
    ...apiCanvas,
    useCases: [...apiCanvas.useCases, useCase],
  })
}

export function updateUseCase(
  apiCanvas: ApiCanvas,
  useCaseId: string,
  patch: Pick<UseCase, 'description' | 'order' | 'roleId' | 'title'>,
): ApiCanvas {
  return touch({
    ...apiCanvas,
    useCases: replaceById(apiCanvas.useCases, useCaseId, (useCase) => ({ ...useCase, ...patch })),
  })
}

export function deleteUseCase(apiCanvas: ApiCanvas, useCaseId: string): ApiCanvas {
  return touch({
    ...apiCanvas,
    useCases: removeById(apiCanvas.useCases, useCaseId),
    steps: apiCanvas.steps.filter((step) => step.useCaseId !== useCaseId),
  })
}

export function createOperation(apiCanvas: ApiCanvas): ApiCanvas {
  const operation: Operation = {
    id: createId(),
    name: `Operation ${apiCanvas.operations.length + 1}`,
    description: '',
  }

  return touch({
    ...apiCanvas,
    operations: [...apiCanvas.operations, operation],
  })
}

export function updateOperation(
  apiCanvas: ApiCanvas,
  operationId: string,
  patch: Pick<Operation, 'description' | 'name'>,
): ApiCanvas {
  return touch({
    ...apiCanvas,
    operations: replaceById(apiCanvas.operations, operationId, (operation) => ({
      ...operation,
      ...patch,
    })),
  })
}

export function setOperationContract(
  apiCanvas: ApiCanvas,
  operationId: string,
  contract: HttpContract | undefined,
): ApiCanvas {
  return touch({
    ...apiCanvas,
    operations: replaceById(apiCanvas.operations, operationId, (operation) => ({
      ...operation,
      httpContract: contract,
    })),
  })
}

export function deleteOperation(apiCanvas: ApiCanvas, operationId: string): ApiCanvas {
  return touch({
    ...apiCanvas,
    operations: removeById(apiCanvas.operations, operationId),
    steps: apiCanvas.steps.filter((step) => step.operationId !== operationId),
  })
}

export function mergeOperation(apiCanvas: ApiCanvas, sourceOperationId: string, targetOperationId: string): ApiCanvas {
  if (
    sourceOperationId === targetOperationId
    || !apiCanvas.operations.some((operation) => operation.id === sourceOperationId)
    || !apiCanvas.operations.some((operation) => operation.id === targetOperationId)
  ) {
    return apiCanvas
  }

  return touch({
    ...apiCanvas,
    operations: removeById(apiCanvas.operations, sourceOperationId),
    steps: apiCanvas.steps.map((step) => (
      step.operationId === sourceOperationId ? { ...step, operationId: targetOperationId } : step
    )),
  })
}

export function createStep(
  apiCanvas: ApiCanvas,
  useCaseId: string | undefined,
  operationId: string | undefined,
): ApiCanvas {
  const nextUseCaseId = useCaseId ?? apiCanvas.useCases[0]?.id ?? ''
  const nextOperationId = operationId ?? apiCanvas.operations[0]?.id ?? ''

  if (
    !nextUseCaseId
    || !apiCanvas.useCases.some((useCase) => useCase.id === nextUseCaseId)
    || !nextOperationId
    || !apiCanvas.operations.some((operation) => operation.id === nextOperationId)
  ) {
    return apiCanvas
  }

  const step: Step = {
    id: createId(),
    useCaseId: nextUseCaseId,
    operationId: nextOperationId,
    title: `Step ${apiCanvas.steps.length + 1}`,
    input: '',
    success: '',
    failure: '',
    order: nextOrder(apiCanvas.steps.filter((item) => item.useCaseId === nextUseCaseId)),
  }

  return touch({
    ...apiCanvas,
    steps: [...apiCanvas.steps, step],
  })
}

export function updateStep(
  apiCanvas: ApiCanvas,
  stepId: string,
  patch: Pick<Step, 'failure' | 'input' | 'operationId' | 'order' | 'success' | 'title' | 'useCaseId'>,
): ApiCanvas {
  return touch({
    ...apiCanvas,
    steps: replaceById(apiCanvas.steps, stepId, (step) => ({ ...step, ...patch })),
  })
}

export function deleteStep(apiCanvas: ApiCanvas, stepId: string): ApiCanvas {
  return touch({
    ...apiCanvas,
    steps: removeById(apiCanvas.steps, stepId),
  })
}

export function createSchemaComponent(apiCanvas: ApiCanvas): ApiCanvas {
  const schemaComponent: SchemaComponent = {
    id: createId(),
    name: `Schema${apiCanvas.schemaComponents.length + 1}`,
    schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  }

  return touch({
    ...apiCanvas,
    schemaComponents: [...apiCanvas.schemaComponents, schemaComponent],
  })
}

export function updateSchemaComponent(
  apiCanvas: ApiCanvas,
  schemaId: string,
  patch: Pick<SchemaComponent, 'name' | 'schema'>,
): ApiCanvas {
  const existing = apiCanvas.schemaComponents.find((schemaComponent) => schemaComponent.id === schemaId)
  const nextCanvas = touch({
    ...apiCanvas,
    schemaComponents: replaceById(apiCanvas.schemaComponents, schemaId, (schemaComponent) => ({
      ...schemaComponent,
      ...patch,
    })),
  })

  if (!existing || existing.name === patch.name) {
    return nextCanvas
  }

  return touch({
    ...nextCanvas,
    operations: nextCanvas.operations.map((operation) => ({
      ...operation,
      httpContract: operation.httpContract
        ? rewriteContractSchemaRefs(operation.httpContract, existing.name, patch.name)
        : undefined,
    })),
  })
}

export function deleteSchemaComponent(apiCanvas: ApiCanvas, schemaId: string): ApiCanvas {
  return touch({
    ...apiCanvas,
    schemaComponents: removeById(apiCanvas.schemaComponents, schemaId),
  })
}

export function defaultContract(operationName: string): HttpContract {
  const words = operationName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .match(/[a-zA-Z0-9]+/g) ?? []
  const operationId = words
    .map((word, index) => {
      const normalizedWord = word.toLowerCase()
      return index === 0
        ? normalizedWord
        : normalizedWord.charAt(0).toUpperCase() + normalizedWord.slice(1)
    })
    .join('')
  const pathSegment = words.map((word) => word.toLowerCase()).join('-')

  return {
    method: 'get',
    path: `/${pathSegment || 'resource'}`,
    operationId: operationId || 'operation',
    summary: operationName,
    description: '',
    tags: [],
    parameters: [],
    responses: [
      {
        status: '200',
        description: 'Successful response',
        headers: [],
        content: {},
      },
    ],
  }
}

export function createParameter(location: HttpParameter['in']): HttpParameter {
  return {
    id: createId(),
    name: `${location}Param`,
    in: location,
    description: '',
    required: location === 'path',
    schema: { type: 'string' },
  }
}

export function createResponse(): HttpResponse {
  return {
    status: '200',
    description: 'Response description',
    headers: [],
    content: {},
  }
}
