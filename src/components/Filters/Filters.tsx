'use client'
import './Filters.sass'
import dayjs from 'dayjs'
import { m, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { classNames } from 'primereact/utils'
import { useMemo, useRef, useState } from 'react'
import { useMediaQuery } from 'usehooks-ts'
import CustomButton from '../CustomButton/CustomButton'
import Label from '../Label/Label'
import type { TargetAndTransition } from 'framer-motion'
import type { DropdownPassThroughOptions } from 'primereact/dropdown'
import type { MultiSelectPassThroughOptions } from 'primereact/multiselect'

const Calendar = dynamic(() => import('primereact/calendar').then(m => m.Calendar), { ssr: false })
const Dropdown = dynamic(() => import('primereact/dropdown').then(m => m.Dropdown), { ssr: false })
const MultiSelect = dynamic(() => import('primereact/multiselect').then(m => m.MultiSelect), { ssr: false })

// Types
type PrimitiveTypes = string | number | boolean
type UniqueTypes = string | number

type FilterBase = {
  title: string
}

type SelectionMode<T> = {
  multiple?: false
  selected: T | undefined
  onChange(value: T | undefined): void
} | {
  multiple: true
  selected: T[]
  onChange(value: T[]): void
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
  selected: { from: string | undefined, to: string | undefined }
  onChange: (value: { from: string | undefined, to: string | undefined }) => void
}

type Filter = PillFilter | DropdownFilter | DateFilter | DateRangeFilter

type MotionProps = {
  initial: TargetAndTransition
  animate: TargetAndTransition
  exit: TargetAndTransition
}

export interface FilterItem {
  filters: Filter[]
  cleanFilters: () => void
  locale?: 'en' | 'es'
  disabled?: boolean
}

// Constants
const DESKTOP_MOTION_PROPS: MotionProps = {
  initial: { opacity: 0, transform: 'translateY(-8px)' },
  animate: { opacity: 1, transform: 'translateY(0)' },
  exit: { opacity: 0, transform: 'translateY(-8px)' }
}
const MOBILE_MOTION_PROPS: MotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
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
  const isMobile = useMediaQuery('(max-width: 768px)')

  const ACTIVE_FILTERS = useMemo(() => {
    let count = 0

    for (const filter of filters) {
      if (filter.type === 'pill' || filter.type === 'dropdown' || filter.type === 'date') {
        if(filter.multiple) {
          if(filter.selected.length > 0) count += 1
        } else {
          if (
            filter.selected !== undefined &&
            filter.selected !== null &&
            filter.selected !== ''
          )
            count += 1
        }
      }
      if(filter.type === 'date-range') {
        if(filter.selected.from || filter.selected.to) count += 1
      }
    }

    return count
  }, [filters])

  const MOTION_PROPS = isMobile ? MOBILE_MOTION_PROPS : DESKTOP_MOTION_PROPS

  return (
    <div ref={containerRef} className="Filters">
      <CustomButton
        variant='primary'
        onClick={cleanFilters}
        disabled={disabled}
      >
        <i className="pi pi-trash text-regular-14" aria-hidden="true" />
        <span className="text-regular-14 hidden 2xl:inline">Clean filters</span>
      </CustomButton>
      <CustomButton
        variant='transparent'
        onClick={() => setShowFilters(!showFilters)}
        disabled={disabled}
      >
        <i className="pi pi-filter text-regular-14" aria-hidden="true"></i>
        <span className='text-regular-14 hidden 2xl:inline'>
          Filters {ACTIVE_FILTERS > 0 && `(${ACTIVE_FILTERS})`}
        </span>
      </CustomButton>

      <AnimatePresence>
        {showFilters && (
          <>
            <div
              className="Filters__Bg"
              onClick={() => setShowFilters(false)}
              onKeyDown={(e) => {
                if(e.key === 'Escape') {
                  setShowFilters(false)
                }
              }}
              role="button"
              tabIndex={0}
            ></div>
            <m.div
              className="Filters__Container"
              {...MOTION_PROPS}
              transition={{ duration: 0.15 }}
            >
              <div className="flex w-full items-center justify-between gap-4">
                <span className="text-semibold-16">Filters {ACTIVE_FILTERS > 0 && `(${ACTIVE_FILTERS})`}</span>

                <div className="flex items-center gap-2">
                  <CustomButton
                    variant='transparent'
                    size='detail'
                    aria-label='Clear filters'
                    onClick={cleanFilters}
                    data-tooltip-id={ACTIVE_FILTERS === 0 ? 'no-filters' : undefined}
                    data-tooltip-content='No filters to reset'
                    disabled={disabled || ACTIVE_FILTERS === 0}
                  >
                    <i className="pi pi-trash text-regular-14" aria-hidden="true" />
                  </CustomButton>
                  <CustomButton
                    variant='transparent'
                    size='detail'
                    aria-label='Close filters'
                    onClick={() => setShowFilters(false)}
                    disabled={disabled}
                  >
                    <i className="pi pi-times text-regular-14" aria-hidden="true" />
                  </CustomButton>
                </div>
              </div>

              {filters.map((filter, index) => (
                <div
                  key={`Filter-${index}`}
                  className="flex w-full flex-col items-start gap-2"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <Label htmlFor={`filter-${index}`}>
                      { filter.title }
                    </Label>

                    {(filter.type === 'pill' || filter.type === 'dropdown') && (
                      <>
                        {(filter.multiple && filter.selected.length > 1) && (
                          <CustomButton
                            variant='transparent'
                            size='detail'
                            className='hover:text-red-600'
                            aria-label='Clear selection'
                            onClick={() => filter.onChange([])}
                            disabled={disabled}
                          >
                            <i className="pi pi-times text-regular-14" aria-hidden="true"></i>
                          </CustomButton>
                        )}
                      </>
                    )}

                    {filter.type === 'date' && (
                      <>
                        {((filter.multiple && filter.selected.length > 0) || (!filter.multiple && filter.selected)) && (
                          <CustomButton
                            variant='transparent'
                            size='detail'
                            className='hover:text-red-600'
                            aria-label='Clear date'
                            onClick={() => {
                              if(filter.multiple) filter.onChange([])
                              else filter.onChange(undefined)
                            }}
                            disabled={disabled}
                          >
                            <i className="pi pi-times text-regular-14" aria-hidden="true"></i>
                          </CustomButton>
                        )}
                      </>
                    )}

                    {filter.type === 'date-range' && (
                      <>
                        {(filter.selected.from || filter.selected.to) && (
                          <CustomButton
                            variant='transparent'
                            size='detail'
                            className='hover:text-red-600'
                            aria-label='Clear date range'
                            onClick={() => filter.onChange({ from: undefined, to: undefined })}
                            disabled={disabled}
                          >
                            <i className="pi pi-times text-regular-14" aria-hidden="true"></i>
                          </CustomButton>
                        )}
                      </>
                    )}
                  </div>


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
                        <span className="text-regular-14">{option.label}</span>
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
                        className='w-full'
                        placeholder={filter.placeholder || filter.multiple ? 'Select dates' : 'Select a date'}
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
                        // pt={{
                        //   input: {
                        //     id: `filter-${index}` //! For now, this isn't working.. PrimeReact bug
                        //   }
                        // }}
                      />
                    )}

                    {filter.type === 'date-range' && (
                      <Calendar
                        className='w-full'
                        placeholder={filter.placeholder || 'Select a date range'}
                        value={filter.selected.from || filter.selected.to
                          ? [
                            filter.selected.from ? dayjs(filter.selected.from).toDate() : null,
                            filter.selected.to ? dayjs(filter.selected.to).toDate() : null
                          ]
                          : null
                        }
                        onChange={(e) => {
                          if(e.value) {
                            const range = e.value as (Date | null)[]
                            filter.onChange({
                              from: range[0] ? dayjs(range[0]).format('YYYY-MM-DD') : undefined,
                              to: range[1] ? dayjs(range[1]).format('YYYY-MM-DD') : undefined
                            })
                          } else {
                            filter.onChange({
                              from: undefined,
                              to: undefined
                            })
                          }
                        }}
                        selectionMode='range'
                        dateFormat={locale === 'en' ? 'mm/dd/yy' : 'dd/mm/yy'}
                        locale={locale}
                        // pt={{
                        //   input: {
                        //     id: `filter-${index}` //! For now, this isn't working.. PrimeReact bug
                        //   }
                        // }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </m.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Filters
