import { Boxes, FileCog, Network, Rows3, Sheet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { matchPath, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { ApiLibraryPage } from './features/library/ApiLibraryPage'
import { AnalyticsConsentModal } from './features/analytics/AnalyticsConsentModal'
import {
  type AnalyticsConsent,
  initializeAnalytics,
  readAnalyticsConsent,
  recordAnalyticsPageView,
  writeAnalyticsConsent,
} from './features/analytics/googleAnalytics'
import { ApiWorkspacePage } from './features/workspace/ApiWorkspacePage'

function App() {
  const { pathname } = useLocation()
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() ?? ''
  const [analyticsConsent, setAnalyticsConsent] = useState<AnalyticsConsent>(() => readAnalyticsConsent())
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(() =>
    Boolean(measurementId && readAnalyticsConsent() === 'pending'),
  )
  const apiId = matchPath('/api/:apiId/:tab', pathname)?.params.apiId
  const navigationItems = [
    { label: 'Library', icon: Rows3, to: '/' },
    ...(apiId
      ? [
          { label: 'Canvas', icon: Sheet, to: `/api/${apiId}/canvas` },
          { label: 'Contracts', icon: Network, to: `/api/${apiId}/contracts` },
          { label: 'Settings', icon: FileCog, to: `/api/${apiId}/settings` },
        ]
      : []),
  ]

  useEffect(() => {
    console.log(`[Analytics] GA Measurement ID provided: ${Boolean(measurementId)}`)
  }, [measurementId])

  useEffect(() => {
    writeAnalyticsConsent(analyticsConsent)
  }, [analyticsConsent])

  useEffect(() => {
    if (!measurementId || analyticsConsent !== 'granted') {
      return
    }

    initializeAnalytics(measurementId)
  }, [analyticsConsent, measurementId])

  useEffect(() => {
    if (!measurementId || analyticsConsent !== 'granted') {
      return
    }

    recordAnalyticsPageView(measurementId, pathname)
  }, [analyticsConsent, measurementId, pathname])

  function grantAnalyticsConsent() {
    setAnalyticsConsent('granted')
    setIsConsentModalOpen(false)
  }

  function denyAnalyticsConsent() {
    setAnalyticsConsent('denied')
    setIsConsentModalOpen(false)
  }

  return (
    <div className="app-shell">
      <aside className="side-panel">
        <div>
          <div className="brand-mark">
            <Boxes aria-hidden="true" size={22} />
          </div>
          <h1>API Capabilities Canvas</h1>
          <p className="lede">
            Explore roles, use cases, and capability steps before deriving reusable operations.
          </p>
        </div>

        <nav className="primary-nav" aria-label="Primary">
          {navigationItems.map(({ icon: Icon, label, to }) => (
            <NavLink
              key={label}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                ['nav-link', isActive ? 'active' : ''].filter(Boolean).join(' ')
              }
            >
              <Icon aria-hidden="true" size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {measurementId ? (
          <button className="ghost-button privacy-settings-button" type="button" onClick={() => setIsConsentModalOpen(true)}>
            Privacy settings
          </button>
        ) : null}
      </aside>

      <main className="main-panel">
        <Routes>
          <Route path="/" element={<ApiLibraryPage />} />
          <Route path="/api/:apiId/:tab" element={<ApiWorkspacePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {measurementId ? (
        <AnalyticsConsentModal
          consent={analyticsConsent}
          isOpen={isConsentModalOpen}
          onClose={() => setIsConsentModalOpen(false)}
          onDeny={denyAnalyticsConsent}
          onGrant={grantAnalyticsConsent}
          onReset={() => setAnalyticsConsent('pending')}
        />
      ) : null}
    </div>
  )
}

export default App
