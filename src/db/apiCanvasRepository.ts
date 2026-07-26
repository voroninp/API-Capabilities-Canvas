import { database } from './database'
import type { ApiCanvas, CreateApiCanvasInput } from '../domain/apiCanvas'
import { createApiCanvas, sampleCanvas } from '../domain/apiCanvas'

export async function listApiCanvases(): Promise<readonly ApiCanvas[]> {
  const canvases = await database.apiCanvases.orderBy('updatedAt').reverse().toArray()
  return canvases
}

export async function getApiCanvasById(apiId: string): Promise<ApiCanvas | undefined> {
  return database.apiCanvases.get(apiId)
}

export async function createApiCanvasRecord(
  input: CreateApiCanvasInput,
): Promise<ApiCanvas> {
  const apiCanvas = createApiCanvas(input)
  await database.apiCanvases.add(apiCanvas)
  return apiCanvas
}

export async function deleteApiCanvasRecord(apiId: string): Promise<void> {
  await database.apiCanvases.delete(apiId)
}

export async function saveApiCanvasRecord(apiCanvas: ApiCanvas): Promise<void> {
  await database.apiCanvases.put(apiCanvas)
}

export async function seedSampleApiCanvas(): Promise<boolean> {
  return database.transaction('rw', database.apiCanvases, async () => {
    if (await database.apiCanvases.get(sampleCanvas.id)) {
      return false
    }

    await database.apiCanvases.add(sampleCanvas)
    return true
  })
}

export async function replaceApiCanvases(apiCanvases: readonly ApiCanvas[]): Promise<void> {
  await database.transaction('rw', database.apiCanvases, async () => {
    for (const apiCanvas of apiCanvases) {
      await database.apiCanvases.put(apiCanvas)
    }
  })
}