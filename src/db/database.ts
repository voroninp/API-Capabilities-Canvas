import Dexie, { type EntityTable } from 'dexie'
import { sampleCanvas, type ApiCanvas } from '../domain/apiCanvas'

export interface PreferenceRecord {
  readonly id: string
  readonly value: string
}

export class ApiCapabilitiesDatabase extends Dexie {
  apiCanvases!: EntityTable<ApiCanvas, 'id'>
  preferences!: EntityTable<PreferenceRecord, 'id'>

  constructor() {
    super('api-capabilities-canvas')

    this.version(1).stores({
      apiCanvases: 'id, name, updatedAt',
      preferences: 'id',
    })

    this.on('populate', () => this.apiCanvases.add(sampleCanvas))
  }
}

export const database = new ApiCapabilitiesDatabase()