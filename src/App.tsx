import { Boxes, FileCog, Network, Rows3, Sheet } from 'lucide-react'
import { matchPath, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { ApiLibraryPage } from './features/library/ApiLibraryPage'
import { ApiWorkspacePage } from './features/workspace/ApiWorkspacePage'

function App() {
  const { pathname } = useLocation()
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
      </aside>

      <main className="main-panel">
        <Routes>
          <Route path="/" element={<ApiLibraryPage />} />
          <Route path="/api/:apiId/:tab" element={<ApiWorkspacePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
