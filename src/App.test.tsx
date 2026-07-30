import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('./features/workspace/ApiWorkspacePage', () => ({
  ApiWorkspacePage: () => <div>Workspace</div>,
}))

vi.mock('./features/library/ApiLibraryPage', () => ({
  ApiLibraryPage: () => <div>Library</div>,
}))

vi.mock('./features/analytics/googleAnalytics', async () => {
  const actual = await vi.importActual<typeof import('./features/analytics/googleAnalytics')>(
    './features/analytics/googleAnalytics',
  )

  return {
    ...actual,
    initializeAnalytics: vi.fn(),
    recordAnalyticsPageView: vi.fn(),
  }
})

import App from './App'
import { initializeAnalytics, recordAnalyticsPageView, resetAnalyticsRuntimeForTests } from './features/analytics/googleAnalytics'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  resetAnalyticsRuntimeForTests()
  window.localStorage.clear()
  vi.unstubAllEnvs()
})

describe('App analytics integration', () => {
  test('tracks page views only after opt-in and on route changes', async () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST')

    render(
      <MemoryRouter initialEntries={['/api/demo-canvas/canvas']}>
        <App />
      </MemoryRouter>,
    )

    expect(initializeAnalytics).not.toHaveBeenCalled()
    expect(recordAnalyticsPageView).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Allow analytics' }))

    await waitFor(() => {
      expect(initializeAnalytics).toHaveBeenCalledWith('G-TEST')
      expect(recordAnalyticsPageView).toHaveBeenCalledWith('G-TEST', '/api/demo-canvas/canvas')
    })

    fireEvent.click(screen.getByRole('link', { name: 'Settings' }))

    await waitFor(() => {
      expect(recordAnalyticsPageView).toHaveBeenLastCalledWith('G-TEST', '/api/demo-canvas/settings')
    })
  })

  test('does not track page views when analytics is denied', async () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST')

    render(
      <MemoryRouter initialEntries={['/api/demo-canvas/canvas']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Deny analytics' }))
    fireEvent.click(screen.getByRole('link', { name: 'Settings' }))

    await waitFor(() => {
      expect(initializeAnalytics).not.toHaveBeenCalled()
      expect(recordAnalyticsPageView).not.toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Privacy settings' }))
    expect(screen.getByRole('dialog', { name: 'Google Analytics preferences' })).toBeInTheDocument()
  })
})
