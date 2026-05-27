'use client'
import './SearchInput.sass'
import { IconField } from 'primereact/iconfield'
import { InputIcon } from 'primereact/inputicon'
import { InputText } from 'primereact/inputtext'
import { useEffect, useState } from 'react'
import { useDebounceCallback } from 'usehooks-ts'

interface Props {
  initialValue?: string
  placeholder?: string
  'aria-label'?: string
  onChange: (value?: string) => void
  disabled?: boolean
  className?: string
}

const SearchInput = ({
  initialValue,
  placeholder = 'Search...',
  'aria-label': ariaLabel,
  onChange,
  disabled,
  className
}: Props) => {
  const [searchValue, setSearchValue] = useState<string>(initialValue || '')

  const debouncedUpdateSearch = useDebounceCallback(onChange, 500)

  useEffect(() => {
    if(initialValue === undefined) setSearchValue('')
  }, [initialValue])

  return (
    <IconField iconPosition="right">
      <InputText
        id='search'
        name='search'
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
          onClick={() => {
            setSearchValue('')
            onChange()
          }}
        />
      ) : (
        <InputIcon className="pi pi-search text-regular-14" />
      )}
    </IconField>
  )
}

export default SearchInput
