import type { JsonSchemaNode } from '../../../domain/apiCanvas'

export type MediaContent = Record<string, { schemaRef?: string; schema?: JsonSchemaNode; example?: string }>

export function updateContentRecord(
  record: MediaContent,
  currentKey: string,
  nextKey: string,
  nextValue: MediaContent[string],
): MediaContent {
  const nextRecord = Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== currentKey),
  ) as MediaContent
  nextRecord[nextKey] = nextValue
  return nextRecord
}
