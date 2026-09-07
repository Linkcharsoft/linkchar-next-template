'use client'
import './SearchInput.sass'
import { IconField } from 'primereact/iconfield'
import { InputIcon } from 'primereact/inputicon'
import { InputText } from 'primereact/inputtext'
import { useId, useState } from 'react'
import { useDebounceCallback } from 'usehooks-ts'

interface Props {
  id?: string
  name?: string
  initialValue?: string
  placeholder?: string
  'aria-label'?: string
  onChange: (value?: string) => void
  disabled?: boolean
  className?: string
}

const SearchInput = ({
  id,
  name = 'search',
  initialValue,
  placeholder = 'Search...',
  'aria-label': ariaLabel,
  onChange,
  disabled,
  className
}: Props) => {
  const generatedId = useId()
  const [searchValue, setSearchValue] = useState<string>(initialValue || '')
  const [prevInitialValue, setPrevInitialValue] = useState(initialValue)

  const debouncedUpdateSearch = useDebounceCallback(onChange, 500)

  if (initialValue !== prevInitialValue) {
    setPrevInitialValue(initialValue)
    if (initialValue === undefined) setSearchValue('')
  }

  const clearSearch = () => {
    // Cancel the pending debounce, or a keystroke from <500ms ago re-applies the stale search.
    debouncedUpdateSearch.cancel()
    setSearchValue('')
    onChange()
  }

  return (
    <IconField iconPosition="right">
      <InputText
        id={id ?? generatedId}
        name={name}
        className={className}
        aria-label={ariaLabel || placeholder}
        value={searchValue}
        placeholder={placeholder}
        onChange={e => {
          const value = e.target.value
          setSearchValue(value)
          debouncedUpdateSearch(value)
        }}
        autoComplete="off"
        disabled={disabled}
        pt={{
          root: {
            className: 'SearchInput'
          }
        }}
      />

      {searchValue ? (
        <InputIcon
          className="pi pi-times text-regular-14 cursor-pointer hover:text-red-600 hover:opacity-75"
          role="button"
          tabIndex={0}
          aria-label="Clear search"
          onClick={clearSearch}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              clearSearch()
            }
          }}
        />
      ) : (
        <InputIcon className="pi pi-search text-regular-14" aria-hidden="true" />
      )}
    </IconField>
  )
}

export default SearchInput
