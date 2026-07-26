import type { ApiCanvas, Operation, Step, UseCase, UserRole } from './apiCanvas'

export interface CanvasRow {
  readonly stepId: string
  readonly operation?: Operation
  readonly step: Step
  readonly useCase: UseCase
  readonly role: UserRole
}

export function getCanvasRows(api: ApiCanvas): readonly CanvasRow[] {
  const operationById = new Map(api.operations.map((operation) => [operation.id, operation]))
  const useCaseById = new Map(api.useCases.map((useCase) => [useCase.id, useCase]))
  const roleById = new Map(api.roles.map((role) => [role.id, role]))

  return [...api.steps]
    .sort((left, right) => {
      const leftUseCase = useCaseById.get(left.useCaseId)
      const rightUseCase = useCaseById.get(right.useCaseId)
      const leftRole = leftUseCase ? roleById.get(leftUseCase.roleId) : undefined
      const rightRole = rightUseCase ? roleById.get(rightUseCase.roleId) : undefined
      const roleOrder = (leftRole?.order ?? 0) - (rightRole?.order ?? 0)

      if (roleOrder !== 0) {
        return roleOrder
      }

      const useCaseOrder = (leftUseCase?.order ?? 0) - (rightUseCase?.order ?? 0)

      if (useCaseOrder !== 0) {
        return useCaseOrder
      }

      return left.order - right.order
    })
    .flatMap((step) => {
      const operation = operationById.get(step.operationId)
      const useCase = useCaseById.get(step.useCaseId)
      const role = useCase ? roleById.get(useCase.roleId) : undefined

      if (!useCase || !role) {
        return []
      }

      return [
        {
          stepId: step.id,
          operation,
          step,
          useCase,
          role,
        },
      ]
    })
}

export function getOperationRows(api: ApiCanvas): readonly CanvasRow[] {
  const operationOrder = new Map(api.operations.map((operation, index) => [operation.id, index]))

  return getCanvasRows(api).slice().sort((left, right) => {
    const operationDifference = (operationOrder.get(left.step.operationId) ?? Number.MAX_SAFE_INTEGER)
      - (operationOrder.get(right.step.operationId) ?? Number.MAX_SAFE_INTEGER)

    if (operationDifference !== 0) {
      return operationDifference
    }

    const roleDifference = left.role.order - right.role.order

    if (roleDifference !== 0) {
      return roleDifference
    }

    const useCaseDifference = left.useCase.order - right.useCase.order

    if (useCaseDifference !== 0) {
      return useCaseDifference
    }

    return left.step.order - right.step.order
  })
}

export function summarizeApi(api: ApiCanvas): {
  readonly contractCount: number
  readonly operationCount: number
  readonly roleCount: number
  readonly schemaCount: number
  readonly stepCount: number
  readonly useCaseCount: number
} {
  const contractCount = api.operations.filter((operation) => operation.httpContract).length

  return {
    contractCount,
    operationCount: api.operations.length,
    roleCount: api.roles.length,
    schemaCount: api.schemaComponents.length,
    stepCount: api.steps.length,
    useCaseCount: api.useCases.length,
  }
}