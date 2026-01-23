'use client'
import dayjs from 'dayjs'
import { m, AnimatePresence } from 'framer-motion'
import { Calendar } from 'primereact/calendar'
import { Dropdown } from 'primereact/dropdown'
import { MultiSelect } from 'primereact/multiselect'
import { classNames } from 'primereact/utils'
import { useMemo, useRef, useState } from 'react'
import { useOnClickOutside } from 'usehooks-ts'
import CustomButton from './CustomButton'
import Label from './Label'
import type { DropdownPassThroughOptions } from 'primereact/dropdown'
import type { MultiSelectPassThroughOptions } from 'primereact/multiselect'
import type { RefObject } from 'react'

// Types
type PrimitiveTypes = string | number | boolean
type UniqueTypes = string | number

type FilterBase = {
  title: string
}

type SelectionMode<T> = {
  multiple?: false
  selected: T | undefined
  onChange: (value: T | undefined) => void // TODO: Make the value returned by onChange infer the type based on options.value
} | {
  multiple: true
  selected: T[]
  onChange: (value: T[]) => void
}

type PillFilter = FilterBase & {
  type: 'pill'
  options: {
    label: string
    value: PrimitiveTypes
    color?: string
  }[]
} & SelectionMode<PrimitiveTypes>

type DropdownFilter = FilterBase & {
  type: 'dropdown'
  options: {
    label: string
    value: UniqueTypes
  }[]
  placeholder?: string
  loading?: boolean
  disabled?: boolean
} & SelectionMode<UniqueTypes>

type DateFilter = FilterBase & {
  type: 'date'
  placeholder?: string
} & SelectionMode<string>

type DateRangeFilter = FilterBase & {
  type: 'date-range'
  placeholder?: string
} & SelectionMode<{ from?: string, to?: string }>

type Filter = PillFilter | DropdownFilter | DateFilter | DateRangeFilter

export interface FilterItem {
  filters: Filter[]
  cleanFilters: () => void
  locale?: 'en' | 'es'
  disabled?: boolean
}

// Constants
const MOTION_PROPS = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 }
}
const MULTISELECT_PT: MultiSelectPassThroughOptions = {
  panel: {
    className: 'Filter__MultiSelect-Panel'
  },
  header: {
    className: 'Filter__MultiSelect-Header'
  },
  headerCheckbox: {
    box: {
      className: 'Filter__MultiSelect-Checkbox'
    }
  },
  filterContainer: {
    className: 'Filter__MultiSelect-Filter'
  },
  wrapper: {
    className: 'Filter__MultiSelect-Wrapper'
  },
  list: {
    className: 'Filter__MultiSelect-List'
  },
  item: {
    className: 'Filter__MultiSelect-Item'
  },
  checkbox: {
    box: {
      className: 'Filter__MultiSelect-Checkbox'
    }
  }
}
const DROPDOWN_PT: DropdownPassThroughOptions = {
  header: {
    className: 'Filter__Dropdown-Header'
  },
  filterContainer: {
    className: 'Filter__Dropdown-Filter'
  },
  wrapper: {
    className: 'Filter__Dropdown-Wrapper'
  },
  list: {
    className: 'Filter__Dropdown-List'
  },
  item: {
    className: 'Filter__Dropdown-Item'
  }
}

const Filters = ({
  filters,
  cleanFilters,
  locale = 'en',
  disabled = false
}: FilterItem) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showFilters, setShowFilters] = useState<boolean>(false)

  // useOnClickOutside(containerRef as RefObject<HTMLDivElement>, () => setShowFilters(false))

  const ACTIVE_FILTERS = useMemo(() => {
    let count = 0
    for (const filter of filters) {
      if (filter.type === 'pill' || filter.type === 'dropdown' || filter.type === 'date') {
        if(filter.multiple) {
          if(filter.selected.length > 0) count += 1
        } else {
          if (
            filter.selected !== undefined &&
            filter.selected !== null
          )
            count += 1
        }
      }
    }
    return count
  }, [filters])

  return (
    <div ref={containerRef} className="Filters">
      <CustomButton
        variant='primary'
        onClick={cleanFilters}
        disabled={disabled}
      >
        <i className="pi pi-trash text-14" />
        <span className="hidden text-14 2xl:inline">Limpiar filtros</span>
      </CustomButton>
      <CustomButton
        variant='transparent'
        onClick={() => setShowFilters(!showFilters)}
        disabled={disabled}
      >
        <i className="pi pi-filter text-14"></i>
        <span className='hidden text-14 2xl:inline'>
          Filtros {ACTIVE_FILTERS > 0 && `(${ACTIVE_FILTERS})`}
        </span>
      </CustomButton>

      <AnimatePresence>
        {showFilters && (
          <m.div
            className="Filters__Container"
            {...MOTION_PROPS}
            transition={{ duration: 0.15 }}
          >
            <div className="flex w-full items-center justify-between gap-4">
              <span className="text-4 font-bold">Filtros {ACTIVE_FILTERS > 0 && `(${ACTIVE_FILTERS})`}</span>
              <CustomButton
                variant='transparent'
                size='detail'
                onClick={cleanFilters}
                disabled={disabled || ACTIVE_FILTERS === 0}
              >
                <i className="pi pi-trash text-14" />
              </CustomButton>
            </div>

            {filters.map((filter, index) => (
              <div
                key={`Filter-${index}`}
                className="flex w-full flex-col items-start gap-2"
              >
                <Label
                  htmlFor={`filter-${index}`}
                  className='flex w-full items-center justify-between gap-2 font-medium'
                >
                  { filter.title }

                  {(filter.type === 'pill') && (
                    <>
                      {(filter.multiple && filter.selected.length > 1) && (
                        <button
                          type='button'
                          className='size-6 items-center justify-center hover:text-red-500 hover:opacity-75'
                          onClick={() => filter.onChange([])}
                        >
                          <i className="pi pi-times text-14"></i>
                        </button>
                      )}
                    </>
                  )}

                  {filter.type === 'date' && (
                    <>
                      {((filter.multiple && filter.selected.length > 0) || (!filter.multiple && filter.selected)) && (
                        <button
                          type='button'
                          className='size-6 items-center justify-center hover:text-red-500 hover:opacity-75'
                          onClick={() => {
                            if(filter.multiple) filter.onChange([])
                            else filter.onChange(undefined)
                          }}
                        >
                          <i className="pi pi-times text-14"></i>
                        </button>
                      )}
                    </>
                  )}
                </Label>


                <div className="align-center flex w-full flex-wrap gap-2">
                  {(filter.type === 'pill')
                  && filter.options.map((option, optionIndex) => (
                    <button
                      id={`filter-${index}`}
                      type='button'
                      key={`FilterItem-${index}-${optionIndex}`}
                      className={classNames('Filters__Item', {
                        'Disabled': filter.multiple ? !filter.selected.includes(option.value) : filter.selected !== option.value,
                        'Selected': filter.multiple ? filter.selected.includes(option.value) : filter.selected === option.value
                      })}
                      onClick={() => {
                        if(filter.multiple) {
                          if(filter.selected.includes(option.value)) {
                            filter.onChange(filter.selected.length > 1 ? filter.selected.filter(v => v !== option.value) : [])
                          } else {
                            filter.onChange([...filter.selected, option.value])
                          }
                        } else {
                          if (filter.selected === option.value) {
                            filter.onChange(undefined)
                          } else {
                            filter.onChange(option.value)
                          }
                        }
                      }}
                    >
                      {option.color && (
                        <div
                          className="Filters__Circle"
                          style={{ backgroundColor: option.color }}
                        />
                      )}
                      <span className="text-4">{option.label}</span>
                    </button>
                  ))}

                  {filter.type === 'dropdown' && (
                    <>
                      {filter.multiple ? (
                        <MultiSelect
                          placeholder={filter.loading ? 'Loading...' : filter.placeholder || 'Select an option'}
                          value={filter.selected}
                          onChange={(e) => filter.onChange(e.value)}
                          options={filter.options}
                          loading={filter.loading}
                          filter
                          showClear={filter.selected.length > 0}
                          disabled={filter.disabled || filter.loading}
                          pt={{
                            ...MULTISELECT_PT,
                            input: {
                              id: `filter-${index}`
                            }
                          }}
                        />
                      ) : (
                        <Dropdown
                          className='w-full'
                          placeholder={filter.loading ? 'Loading...' : filter.placeholder || 'Select an option'}
                          value={filter.selected}
                          onChange={(e) => filter.onChange(e.value)}
                          options={filter.options}
                          loading={filter.loading}
                          filter
                          showClear={Boolean(filter.selected)}
                          disabled={filter.disabled || filter.loading}
                          pt={{
                            ...DROPDOWN_PT,
                            input: {
                              id: `filter-${index}`
                            }
                          }}
                        />
                      )}
                    </>
                  )}

                  {filter.type === 'date' && (
                    <Calendar
                      id={`filter-${index}`}
                      className='w-full'
                      placeholder={filter.placeholder || 'Select a date'}
                      value={filter.multiple
                        ? filter.selected.map(s => dayjs(s).toDate())
                        : filter.selected
                          ? dayjs(filter.selected).toDate()
                          : null
                      }
                      onChange={(e) => {
                        if(filter.multiple) {
                          if(!e.value) filter.onChange([])
                          else filter.onChange((e.value as Date[])
                            .sort((a, b) => a.getTime() - b.getTime())
                            .map(v => dayjs(v).format('YYYY-MM-DD')))
                        } else {
                          if(!e.value) filter.onChange(undefined)
                          else filter.onChange(dayjs(e.value as Date).format('YYYY-MM-DD'))
                        }
                      }}
                      selectionMode={filter.multiple ? 'multiple' : 'single'}
                      dateFormat={locale === 'en' ? 'mm/dd/yy' : 'dd/mm/yy'}
                      locale={locale}
                    />
                  )}
                </div>
              </div>
            ))}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Filters
