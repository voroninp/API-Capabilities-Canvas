import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { AnalyticsConsentModal } from './AnalyticsConsentModal'

describe('AnalyticsConsentModal', () => {
  test('moves focus into the dialog when opened and restores focus on close', () => {
    const onClose = vi.fn()
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const { rerender, unmount } = render(
      <AnalyticsConsentModal
        consent="pending"
        isOpen={true}
        onClose={onClose}
        onDeny={vi.fn()}
        onGrant={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Google Analytics preferences' })
    expect(dialog).toHaveFocus()

    rerender(
      <AnalyticsConsentModal
        consent="pending"
        isOpen={false}
        onClose={onClose}
        onDeny={vi.fn()}
        onGrant={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    expect(onClose).not.toHaveBeenCalled()
    expect(trigger).toHaveFocus()

    unmount()
    trigger.remove()
  })

  test('traps focus within the dialog while it is open', () => {
    render(
      <AnalyticsConsentModal
        consent="pending"
        isOpen={true}
        onClose={vi.fn()}
        onDeny={vi.fn()}
        onGrant={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Google Analytics preferences' })
    const allowButton = screen.getByRole('button', { name: 'Allow analytics' })
    const denyButton = screen.getByRole('button', { name: 'Deny analytics' })

    dialog.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(allowButton)

    fireEvent.keyDown(allowButton, { key: 'Tab' })
    expect(document.activeElement).toBe(denyButton)

    fireEvent.keyDown(denyButton, { key: 'Tab' })
    expect(document.activeElement).toBe(allowButton)
  })
})
