import { useEffect, useId, useRef, useState } from 'react'

export interface ComboboxOption {
  readonly id: string
  readonly label: string
}

export function CreatableCombobox({
  ariaLabel,
  autoFocus = false,
  options,
  placeholder,
  value,
  onCommit,
  onEditingComplete,
}: {
  readonly ariaLabel: string
  readonly autoFocus?: boolean
  readonly options: readonly ComboboxOption[]
  readonly placeholder?: string
  readonly value: string
  readonly onCommit: (optionId: string | undefined, value: string) => void
  readonly onEditingComplete?: (restoreFocus: boolean) => void
}) {
  const listId = useId()
  const [draft, setDraft] = useState(value)
  const cancelEdit = useRef(false)
  const restoreFocus = useRef(false)

  useEffect(() => setDraft(value), [value])

  function commit() {
    if (cancelEdit.current) {
      cancelEdit.current = false
      setDraft(value)
      return
    }
    const nextValue = draft.trim()

    if (!nextValue || nextValue === value) {
      setDraft(value)
      return
    }

    const option = options.find(
      (item) => item.label.localeCompare(nextValue, undefined, { sensitivity: 'accent' }) === 0,
    )
    onCommit(option?.id, nextValue)
  }

  return (
    <div className="creatable-combobox">
      <input
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        list={listId}
        placeholder={placeholder}
        value={draft}
        onBlur={() => {
          commit()
          onEditingComplete?.(restoreFocus.current)
          restoreFocus.current = false
        }}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            restoreFocus.current = true
            event.currentTarget.blur()
          }
          if (event.key === 'Escape') {
            cancelEdit.current = true
            restoreFocus.current = true
            event.currentTarget.blur()
          }
        }}
      />
      <datalist id={listId}>
        {options.map((option) => <option key={option.id} value={option.label} />)}
      </datalist>
    </div>
  )
}
