import { useEffect, useRef } from 'react'
import type { AnalyticsConsent } from './googleAnalytics'

export function AnalyticsConsentModal({
  consent,
  isOpen,
  onClose,
  onDeny,
  onGrant,
  onReset,
}: {
  readonly consent: AnalyticsConsent
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onDeny: () => void
  readonly onGrant: () => void
  readonly onReset: () => void
}) {
  const dialogRef = useRef<HTMLElement | null>(null)
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )

      if (focusableElements.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const currentActiveElement = document.activeElement
      const currentIndex = currentActiveElement instanceof HTMLElement ? focusableElements.indexOf(currentActiveElement) : -1

      if (event.shiftKey) {
        event.preventDefault()
        if (currentIndex <= 0) {
          lastElement?.focus()
          return
        }

        focusableElements[currentIndex - 1]?.focus()
        return
      }

      event.preventDefault()
      if (currentIndex === -1 || currentIndex >= focusableElements.length - 1) {
        firstElement?.focus()
        return
      }

      focusableElements[currentIndex + 1]?.focus()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedElementRef.current?.focus()
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const statusLabel =
    consent === 'granted'
      ? 'Enabled'
      : consent === 'denied'
        ? 'Disabled'
        : 'Not set'

  return (
    <div className="analytics-modal-overlay" role="presentation">
      <section
        aria-labelledby="analytics-consent-title"
        aria-modal="true"
        className="analytics-modal"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <p className="eyebrow">Privacy settings</p>
        <h2 id="analytics-consent-title">Google Analytics preferences</h2>
        <p className="helper-text">
          This app can send anonymous page-view events to Google Analytics 4 only after you explicitly allow it.
        </p>
        <p className="helper-text">
          Recommended setup across apps: one GA4 property, with one web stream per application.
        </p>

        <div className="pill-row analytics-status-row">
          <span className={`pill ${consent === 'granted' ? 'success' : consent === 'denied' ? 'failure' : 'info'}`}>
            {statusLabel}
          </span>
        </div>

        <div className="button-row analytics-actions">
          {consent !== 'granted' ? (
            <button className="button" type="button" onClick={onGrant}>
              Allow analytics
            </button>
          ) : null}
          {consent !== 'denied' ? (
            <button className="ghost-button" type="button" onClick={onDeny}>
              Deny analytics
            </button>
          ) : null}
          {consent !== 'pending' ? (
            <button className="ghost-button" type="button" onClick={onReset}>
              Reset to ask me again
            </button>
          ) : null}
        </div>

        {consent !== 'pending' ? (
          <div className="analytics-modal-footer">
            <button className="ghost-button" type="button" onClick={() => onCloseRef.current()}>
              Close
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
