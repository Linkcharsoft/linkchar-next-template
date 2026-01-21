'use client'
import { m, AnimatePresence } from 'framer-motion'
import { classNames } from 'primereact/utils'
import { useMemo, useRef, useState } from 'react'
import { useOnClickOutside } from 'usehooks-ts'
import CustomButton from './CustomButton'
import Label from './Label'
import type { RefObject } from 'react'

type FilterBase<T> = T & ({
  title: string
  selected: string | number | boolean | undefined
  multiple?: false
  onChange: (value: string | number | boolean) => void
} | {
  title: string
  selected: (string | number)[]
  multiple: true
  onChange: (value: (string | number)[]) => void
})

type PillFilter = {
  type: 'pill'
} & ({
  options: {
    label: string
    value: string | number | boolean
    color?: string
  }[]
  multiple?: false
} | {
  options: {
    label: string
    value: string | number
    color?: string
  }[]
  multiple: true
})

type Filter = FilterBase<PillFilter>

export interface FilterItem {
  filters: Filter[]
  cleanFilters: () => void
  disabled: boolean
}

const motionProps = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 }
}

const Filters = ({ filters, cleanFilters, disabled }: FilterItem) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showFilters, setShowFilters] = useState<boolean>(false)

  useOnClickOutside(containerRef as RefObject<HTMLDivElement>, () => setShowFilters(false))

  const ACTIVE_FILTERS = useMemo(() => {
    let count = 0
    filters.forEach((filter) => {
      if (filter.type === 'pill' || filter.type === 'dropdown') {
        if (filter.selected !== undefined && filter.selected !== null) {
          return count += 1
        }
      }
    })
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
            className="Filters__Dropdown"
            {...motionProps}
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
                <Label className='flex w-full items-center justify-between gap-2 font-medium'>
                  { filter.title }

                  {(filter.multiple && filter.selected.length > 1) && (
                    <button
                      className='size-6 items-center justify-center hover:opacity-75'
                      onClick={() => filter.onChange([])}
                    >
                      <i className="pi pi-times text-14"></i>
                    </button>
                  )}
                </Label>
                <div className="align-center flex w-full flex-wrap gap-2">
                  {(filter.type === 'pill')
                  && filter.options.map((option, optionIndex) => (
                    <button
                      key={`FilterItem-${optionIndex}`}
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
                            filter.onChange('')
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
