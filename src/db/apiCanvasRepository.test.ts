import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sampleCanvas } from '../domain/apiCanvas'
import { database } from './database'
import { deleteApiCanvasRecord, listApiCanvases, seedSampleApiCanvas } from './apiCanvasRepository'

describe('API canvas repository', () => {
  beforeEach(async () => {
    await database.delete()
    await database.open()
  })

  afterEach(async () => {
    database.close()
  })

  it('seeds a new database once and preserves an intentionally empty library', async () => {
    expect(await listApiCanvases()).toEqual([sampleCanvas])

    await deleteApiCanvasRecord(sampleCanvas.id)

    expect(await listApiCanvases()).toEqual([])
  })

  it('restores the sample without overwriting an existing copy', async () => {
    expect(await seedSampleApiCanvas()).toBe(false)

    await deleteApiCanvasRecord(sampleCanvas.id)

    expect(await seedSampleApiCanvas()).toBe(true)
    expect(await seedSampleApiCanvas()).toBe(false)
    expect(await listApiCanvases()).toEqual([sampleCanvas])
  })
})