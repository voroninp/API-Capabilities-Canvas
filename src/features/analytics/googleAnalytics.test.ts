import { beforeEach, describe, expect, test } from 'vitest'
import {
  initializeAnalytics,
  readAnalyticsConsent,
  recordAnalyticsPageView,
  resetAnalyticsRuntimeForTests,
  writeAnalyticsConsent,
} from './googleAnalytics'

describe('googleAnalytics', () => {
  beforeEach(() => {
    resetAnalyticsRuntimeForTests()
    window.localStorage.clear()
  })

  test('stores and reads consent state', () => {
    expect(readAnalyticsConsent()).toBe('pending')

    writeAnalyticsConsent('granted')
    expect(readAnalyticsConsent()).toBe('granted')

    writeAnalyticsConsent('denied')
    expect(readAnalyticsConsent()).toBe('denied')
  })

  test('removes stored consent state for pending', () => {
    writeAnalyticsConsent('granted')
    expect(readAnalyticsConsent()).toBe('granted')

    writeAnalyticsConsent('pending')

    expect(readAnalyticsConsent()).toBe('pending')
    expect(window.localStorage.getItem('api-capabilities-canvas.analytics.consent')).toBeNull()
  })

  test('falls back to pending for unexpected stored values', () => {
    window.localStorage.setItem('api-capabilities-canvas.analytics.consent', 'unexpected')

    expect(readAnalyticsConsent()).toBe('pending')
  })

  test('does not initialize analytics without a measurement id', () => {
    expect(initializeAnalytics('')).toBe(false)
    expect(document.getElementById('google-analytics-tag')).toBeNull()
  })

  test('initializes analytics once and records a page view', () => {
    expect(initializeAnalytics('G-TEST')).toBe(true)
    expect(document.getElementById('google-analytics-tag')).toBeTruthy()

    recordAnalyticsPageView('G-TEST', '/api/demo-canvas/canvas')

    expect(window.dataLayer?.length).toBe(3)
    expect(Array.from(window.dataLayer?.at(2) as IArguments)).toEqual([
      'event',
      'page_view',
      expect.objectContaining({
        page_path: '/api/demo-canvas/canvas',
      }),
    ])
  })
})
