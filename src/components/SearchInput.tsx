'use client'
import { IconField } from 'primereact/iconfield'
import { InputIcon } from 'primereact/inputicon'
import { InputText } from 'primereact/inputtext'
import { memo, useState } from 'react'
import { useDebounceCallback } from 'usehooks-ts'

interface Props {
  initialValue: string
  placeholder?: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

const SearchInput = ({
  initialValue,
  placeholder = 'Buscar...',
  onChange,
  disabled,
  className
}: Props) => {
  const [searchValue, setSearchValue] = useState<string>(initialValue)

  const debouncedUpdateSearch = useDebounceCallback(onChange, 500)

  return (
    <IconField iconPosition="right">
      <InputText
        id='search'
        name='search'
        className={className}
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
          className="pi pi-times cursor-pointer hover:opacity-75"
          onClick={() => {
            setSearchValue('')
            onChange('')
          }}
        />
      ) : (
        <InputIcon className="pi pi-search text-3" />
      )}
    </IconField>
  )
}

export default memo(SearchInput)
