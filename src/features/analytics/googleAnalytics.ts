export type AnalyticsConsent = 'pending' | 'granted' | 'denied'

const analyticsConsentStorageKey = 'api-capabilities-canvas.analytics.consent'
const analyticsScriptId = 'google-analytics-tag'

let initializedMeasurementId = ''

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

function hasBrowserSupport(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function getAnalyticsWindow() {
  return window as Window
}

export function readAnalyticsConsent(): AnalyticsConsent {
  if (!hasBrowserSupport()) {
    return 'pending'
  }

  try {
    const storedValue = window.localStorage.getItem(analyticsConsentStorageKey)

    if (storedValue === 'granted' || storedValue === 'denied') {
      return storedValue
    }
  } catch {
    return 'pending'
  }

  return 'pending'
}

export function writeAnalyticsConsent(consent: AnalyticsConsent): void {
  if (!hasBrowserSupport()) {
    return
  }

  try {
    if (consent === 'pending') {
      window.localStorage.removeItem(analyticsConsentStorageKey)
      return
    }

    window.localStorage.setItem(analyticsConsentStorageKey, consent)
  } catch {
    return
  }
}

export function initializeAnalytics(measurementId: string): boolean {
  if (!measurementId.trim() || !hasBrowserSupport()) {
    return false
  }

  if (initializedMeasurementId === measurementId) {
    return true
  }

  const analyticsWindow = getAnalyticsWindow()

  analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? []
  analyticsWindow.gtag = function gtag() {
    analyticsWindow.dataLayer?.push(arguments)
  }

  if (!document.getElementById(analyticsScriptId)) {
    const script = document.createElement('script')

    script.async = true
    script.id = analyticsScriptId
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
    script.dataset.analyticsProvider = 'google-tag'
    document.head.appendChild(script)
  }

  analyticsWindow.gtag('js', new Date())
  analyticsWindow.gtag('config', measurementId, { send_page_view: false })
  initializedMeasurementId = measurementId

  return true
}

export function recordAnalyticsPageView(measurementId: string, pagePath: string): void {
  if (!measurementId.trim() || !hasBrowserSupport()) {
    return
  }

  initializeAnalytics(measurementId)
  getAnalyticsWindow().gtag?.('event', 'page_view', {
    page_location: window.location.href,
    page_path: pagePath,
    page_title: document.title,
  })
}

export function resetAnalyticsRuntimeForTests(): void {
  initializedMeasurementId = ''

  if (!hasBrowserSupport()) {
    return
  }

  document.getElementById(analyticsScriptId)?.remove()
  delete window.dataLayer
  delete window.gtag
}
