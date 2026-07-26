import type { ApiCanvas, HttpContract, JsonSchemaNode } from './apiCanvas'

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  readonly id: string
  readonly message: string
  readonly path: string
  readonly severity: ValidationSeverity
  readonly title?: string
}

function createIssue(
  severity: ValidationSeverity,
  path: string,
  message: string,
  title?: string,
): ValidationIssue {
  return {
    id: `${severity}:${path}:${message}`,
    message,
    path,
    severity,
    title,
  }
}

function extractPathParameters(path: string): readonly string[] {
  return [...path.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1] ?? '').filter(Boolean)
}

function isWellFormedPathTemplate(path: string): boolean {
  return !/[{}]/.test(path.replaceAll(/\{[^{}]+\}/g, ''))
}

function isValidMediaType(mediaType: string): boolean {
  const token = '[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*'
  return new RegExp(`^(?:${token}|\\*)/(?:${token}|\\*)$`).test(mediaType)
}

function collectSchemaRefsFromSchema(schema: JsonSchemaNode | undefined, refs: Set<string>): void {
  if (!schema || typeof schema === 'boolean') {
    return
  }

  if (schema.$ref) {
    refs.add(schema.$ref)
  }

  if (schema.additionalProperties && typeof schema.additionalProperties !== 'boolean') {
    collectSchemaRefsFromSchema(schema.additionalProperties, refs)
  }

  if (schema.items && typeof schema.items !== 'boolean') {
    collectSchemaRefsFromSchema(schema.items, refs)
  }

  if (schema.properties) {
    Object.values(schema.properties).forEach((property) => {
      if (typeof property !== 'boolean') {
        collectSchemaRefsFromSchema(property, refs)
      }
    })
  }
}

function collectSchemaRefs(apiCanvas: ApiCanvas): Set<string> {
  const refs = new Set<string>()

  apiCanvas.operations.forEach((operation) => {
    const contract = operation.httpContract

    if (!contract) {
      return
    }

    contract.parameters.forEach((parameter) => {
      if (parameter.schemaRef) {
        refs.add(parameter.schemaRef)
      }
      collectSchemaRefsFromSchema(parameter.schema, refs)
    })

    if (contract.requestBody) {
      Object.values(contract.requestBody.content).forEach((payload) => {
        if (payload.schemaRef) {
          refs.add(payload.schemaRef)
        }
        collectSchemaRefsFromSchema(payload.schema, refs)
      })
    }

    contract.responses.forEach((response) => {
      response.headers.forEach((header) => {
        if (header.schemaRef) {
          refs.add(header.schemaRef)
        }
        collectSchemaRefsFromSchema(header.schema, refs)
      })

      Object.values(response.content).forEach((payload) => {
        if (payload.schemaRef) {
          refs.add(payload.schemaRef)
        }
        collectSchemaRefsFromSchema(payload.schema, refs)
      })
    })
  })

  return refs
}

function validateSchemaSource(
  issues: ValidationIssue[],
  value: { readonly schemaRef?: string; readonly schema?: JsonSchemaNode },
  path: string,
  schemaNames: Set<string>,
): void {
  if (value.schemaRef && value.schema !== undefined) {
    issues.push(
      createIssue(
        'error',
        path,
        'Choose either a schema component reference or an inline schema, not both.',
      ),
    )
  }

  if (!value.schemaRef) {
    return
  }

  const prefix = '#/components/schemas/'
  const schemaName = value.schemaRef.startsWith(prefix)
    ? value.schemaRef.slice(prefix.length)
    : undefined

  if (!schemaName || !schemaNames.has(schemaName)) {
    issues.push(
      createIssue(
        'error',
        path,
        `Schema reference ${value.schemaRef} cannot be resolved to a local component.`,
      ),
    )
  }
}

function validateUniqueIds(
  issues: ValidationIssue[],
  collectionName: string,
  items: readonly { readonly id: string }[],
): void {
  const seen = new Set<string>()

  items.forEach((item, index) => {
    const path = `${collectionName}.${index}.id`

    if (!item.id.trim()) {
      issues.push(createIssue('error', path, `${collectionName} IDs cannot be empty.`))
      return
    }

    if (seen.has(item.id)) {
      issues.push(createIssue('error', path, `${collectionName} ID ${item.id} is duplicated.`))
    }
    seen.add(item.id)
  })
}

function validateContract(
  issues: ValidationIssue[],
  contract: HttpContract,
  operationName: string,
  schemaNames: Set<string>,
): void {
  const pathParameters = extractPathParameters(contract.path)
  const declaredPathParameters = contract.parameters.filter((parameter) => parameter.in === 'path')

  if (!contract.path.startsWith('/')) {
    issues.push(createIssue('error', `operations.${operationName}.path`, 'HTTP path must start with /.'))
  }

  if (!isWellFormedPathTemplate(contract.path)) {
    issues.push(
      createIssue(
        'error',
        `operations.${operationName}.path`,
        'HTTP path template braces must contain a non-empty parameter name and cannot be nested.',
      ),
    )
  }

  contract.parameters.forEach((parameter, index) => {
    validateSchemaSource(
      issues,
      parameter,
      `operations.${operationName}.parameters.${index}.schema`,
      schemaNames,
    )
  })

  pathParameters.forEach((pathParameter) => {
    const declared = declaredPathParameters.find((parameter) => parameter.name === pathParameter)

    if (!declared) {
      issues.push(
        createIssue(
          'error',
          `operations.${operationName}.parameters`,
          `Path parameter ${pathParameter} is missing from the contract.`,
        ),
      )
      return
    }

    if (!declared.required) {
      issues.push(
        createIssue(
          'error',
          `operations.${operationName}.parameters`,
          `Path parameter ${pathParameter} must be required.`,
        ),
      )
    }
  })

  declaredPathParameters.forEach((parameter) => {
    if (!pathParameters.includes(parameter.name)) {
      issues.push(
        createIssue(
          'error',
          `operations.${operationName}.parameters`,
          `Path parameter ${parameter.name} is declared but not used in the path template.`,
        ),
      )
    }
  })

  if (contract.responses.length === 0) {
    issues.push(createIssue('error', `operations.${operationName}.responses`, 'At least one HTTP response is required.'))
  }

  const statusSet = new Set<string>()
  contract.responses.forEach((response, index) => {
    if (!response.description.trim()) {
      issues.push(
        createIssue(
          'error',
          `operations.${operationName}.responses.${index}`,
          'Every response requires a description.',
        ),
      )
    }

    if (!/^([1-5][0-9]{2}|default)$/.test(response.status)) {
      issues.push(
        createIssue(
          'error',
          `operations.${operationName}.responses.${index}`,
          `Response status ${response.status} is not a valid explicit code or default.`,
        ),
      )
    }

    if (statusSet.has(response.status)) {
      issues.push(
        createIssue(
          'error',
          `operations.${operationName}.responses.${index}`,
          `Response status ${response.status} is duplicated within the same operation.`,
        ),
      )
    }
    statusSet.add(response.status)

    response.headers.forEach((header, headerIndex) => {
      validateSchemaSource(
        issues,
        header,
        `operations.${operationName}.responses.${index}.headers.${headerIndex}.schema`,
        schemaNames,
      )
    })

    Object.entries(response.content).forEach(([mediaType, payload]) => {
      if (!isValidMediaType(mediaType)) {
        issues.push(
          createIssue(
            'error',
            `operations.${operationName}.responses.${index}.content`,
            `Media type ${mediaType} is invalid.`,
          ),
        )
      }

      validateSchemaSource(
        issues,
        payload,
        `operations.${operationName}.responses.${index}.content.${mediaType}`,
        schemaNames,
      )
    })
  })

  if (contract.requestBody) {
    Object.entries(contract.requestBody.content).forEach(([mediaType, payload]) => {
      if (!isValidMediaType(mediaType)) {
        issues.push(
          createIssue(
            'error',
            `operations.${operationName}.requestBody`,
            `Media type ${mediaType} is invalid.`,
          ),
        )
      }

      validateSchemaSource(
        issues,
        payload,
        `operations.${operationName}.requestBody.content.${mediaType}`,
        schemaNames,
      )
    })
  }

  const successStatuses = contract.responses.filter((response) => response.status.startsWith('2'))
  const failureStatuses = contract.responses.filter(
    (response) => response.status.startsWith('4') || response.status.startsWith('5') || response.status === 'default',
  )

  if (successStatuses.length === 0) {
    issues.push(
      createIssue(
        'warning',
        `operations.${operationName}.responses`,
        'No success status is defined for this HTTP contract.',
        operationName,
      ),
    )
  }

  if (failureStatuses.length === 0) {
    issues.push(
      createIssue(
        'warning',
        `operations.${operationName}.responses`,
        'No failure status is defined for this HTTP contract.',
        operationName,
      ),
    )
  }
}

export function validateApiCanvas(apiCanvas: ApiCanvas): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const roleIds = new Set(apiCanvas.roles.map((role) => role.id))
  const useCaseIds = new Set(apiCanvas.useCases.map((useCase) => useCase.id))
  const operationIds = new Set(apiCanvas.operations.map((operation) => operation.id))
  const schemaNames = new Set(apiCanvas.schemaComponents.map((schemaComponent) => schemaComponent.name))
  const methodPathPairs = new Set<string>()
  const operationIdsForContracts = new Set<string>()

  if (!apiCanvas.id.trim()) {
    issues.push(createIssue('error', 'id', 'API ID cannot be empty.'))
  }

  if (!apiCanvas.name.trim()) {
    issues.push(createIssue('error', 'name', 'API title is required.'))
  }

  if (!apiCanvas.version.trim()) {
    issues.push(createIssue('error', 'version', 'API version is required.'))
  }

  validateUniqueIds(issues, 'roles', apiCanvas.roles)
  validateUniqueIds(issues, 'useCases', apiCanvas.useCases)
  validateUniqueIds(issues, 'steps', apiCanvas.steps)
  validateUniqueIds(issues, 'operations', apiCanvas.operations)
  validateUniqueIds(issues, 'schemas', apiCanvas.schemaComponents)

  apiCanvas.roles.forEach((role) => {
    if (!role.name.trim()) {
      issues.push(createIssue('error', `roles.${role.id}.name`, 'Every user role requires a name.'))
    }
  })

  apiCanvas.schemaComponents.forEach((schemaComponent, index) => {
    if (!/^[a-zA-Z0-9._-]+$/.test(schemaComponent.name)) {
      issues.push(
        createIssue(
          'error',
          `schemas.${schemaComponent.id}.name`,
          `Schema name ${schemaComponent.name || '(empty)'} must contain only letters, numbers, periods, hyphens, and underscores.`,
        ),
      )
    }

    if (apiCanvas.schemaComponents.findIndex((candidate) => candidate.name === schemaComponent.name) !== index) {
      issues.push(
        createIssue(
          'error',
          `schemas.${schemaComponent.id}.name`,
          `Schema name ${schemaComponent.name} is duplicated.`,
        ),
      )
    }
  })

  apiCanvas.useCases.forEach((useCase) => {
    if (!useCase.title.trim()) {
      issues.push(createIssue('error', `useCases.${useCase.id}.title`, 'Every use case requires a title.'))
    }

    if (!roleIds.has(useCase.roleId)) {
      issues.push(createIssue('error', `useCases.${useCase.id}.roleId`, `Use case ${useCase.title} references an unknown role.`))
    }
  })

  apiCanvas.steps.forEach((step) => {
    if (!step.title.trim()) {
      issues.push(createIssue('error', `steps.${step.id}.title`, 'Every step requires a title.'))
    }

    if (!useCaseIds.has(step.useCaseId)) {
      issues.push(createIssue('error', `steps.${step.id}.useCaseId`, `Step ${step.title} references an unknown use case.`))
    }

    if (!operationIds.has(step.operationId)) {
      issues.push(createIssue('error', `steps.${step.id}.operationId`, `Step ${step.title} references an unknown operation.`))
    }

    if (!step.success.trim()) {
      issues.push(createIssue('error', `steps.${step.id}.success`, `Step ${step.title} is missing its success narrative.`))
    }

    if (!step.failure.trim()) {
      issues.push(createIssue('error', `steps.${step.id}.failure`, `Step ${step.title} is missing its failure narrative.`))
    }
  })

  apiCanvas.operations.forEach((operation) => {
    if (!operation.name.trim()) {
      issues.push(createIssue('error', `operations.${operation.id}.name`, 'Every operation requires a name.'))
    }

    const contract = operation.httpContract

    if (!contract) {
      issues.push(
        createIssue('info', `operations.${operation.id}`, 'No HTTP contract yet.', operation.name),
      )
      return
    }

    const methodPathKey = `${contract.method.toUpperCase()} ${contract.path}`

    if (!contract.operationId.trim()) {
      issues.push(createIssue('error', `operations.${operation.id}.operationId`, 'HTTP operationId is required.'))
    }

    if (methodPathPairs.has(methodPathKey)) {
      issues.push(
        createIssue('error', `operations.${operation.id}.path`, `The method/path pair ${methodPathKey} is duplicated.`),
      )
    }
    methodPathPairs.add(methodPathKey)

    if (operationIdsForContracts.has(contract.operationId)) {
      issues.push(
        createIssue('error', `operations.${operation.id}.operationId`, `HTTP operationId ${contract.operationId} is duplicated.`),
      )
    }
    operationIdsForContracts.add(contract.operationId)

    validateContract(issues, contract, operation.name, schemaNames)
  })

  const schemaRefs = collectSchemaRefs(apiCanvas)
  apiCanvas.schemaComponents.forEach((schemaComponent) => {
    const ref = `#/components/schemas/${schemaComponent.name}`
    if (!schemaRefs.has(ref)) {
      issues.push(
        createIssue('warning', `schemas.${schemaComponent.id}`, `Schema ${schemaComponent.name} is not referenced by any contract.`),
      )
    }
  })

  return issues
}

export function summarizeIssues(issues: readonly ValidationIssue[]): {
  readonly errors: number
  readonly infos: number
  readonly warnings: number
} {
  return issues.reduce(
    (summary, issue) => ({
      errors: summary.errors + (issue.severity === 'error' ? 1 : 0),
      infos: summary.infos + (issue.severity === 'info' ? 1 : 0),
      warnings: summary.warnings + (issue.severity === 'warning' ? 1 : 0),
    }),
    { errors: 0, infos: 0, warnings: 0 },
  )
}
