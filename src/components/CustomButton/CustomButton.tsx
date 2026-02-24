'use client'
import './CustomButton.sass'
import Link from 'next/link'
import { Button } from 'primereact/button'
import { classNames } from 'primereact/utils'
import { memo } from 'react'
import { Tooltip } from 'react-tooltip'
import type { StateTypes } from '@/types/general'
import type { Route } from 'next'
import type { ButtonProps as OriginalButtonProps } from 'primereact/button'

interface ButtonProps extends Omit<OriginalButtonProps, 'size'> {
  variant?: 'primary' | 'white' | 'transparent' | StateTypes
  size?: 'detail' | 'small' | 'medium' | 'large'
  href?: Route
  replace?: boolean | undefined
}

const VARIANT_CLASSES: {
  [key in NonNullable<ButtonProps['variant']>]: string
} = {
  primary: 'CustomButton--Primary',
  white: 'CustomButton--White',
  transparent: 'CustomButton--Transparent',

  // State Variants
  success: 'CustomButton--Success',
  info: 'CustomButton--Info',
  warn: 'CustomButton--Warn',
  error: 'CustomButton--Error'
}
const SIZE_CLASSES: {
  [key in NonNullable<ButtonProps['size']>]: string
} = {
  detail: 'CustomButton--Detail', // 32px
  small: 'CustomButton--Small', // 38px
  medium: 'CustomButton--Medium', // 44px
  large: 'CustomButton--Large' // 50px
}

const CustomButton = ({
  className,
  variant = 'primary',
  size = 'medium',
  href,
  replace,
  onClick,
  disabled = false,
  children,
  ...props
}: ButtonProps) => {
  const classes = classNames(
    'CustomButton',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    { 'CustomButton--Disabled': disabled },
    { 'CustomButton--Link': href },
    className
  )
  const tooltipId = props['data-tooltip-id']

  return (
    <>
      <Button
        className={classes}
        onClick={(disabled || href) ? undefined : onClick}
        aria-disabled={disabled}
        disabled={disabled}
        {...props}
      >
        {href ? (
          <Link
            href={disabled ? '#' : href}
            replace={replace}
            onClick={(e) => {
              if (disabled) {
                e.preventDefault()
                e.stopPropagation()
              }
            }}
          >
            { children }
          </Link>
        ) : (
          children
        )}
      </Button>

      {tooltipId && (
        <Tooltip className='z-10 text-14 !opacity-100' id={tooltipId} />
      )}
    </>
  )
}

export default memo(CustomButton)
