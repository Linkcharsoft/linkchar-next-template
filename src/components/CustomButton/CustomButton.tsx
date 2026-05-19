'use client'
import './CustomButton.sass'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Button } from 'primereact/button'
import { classNames } from 'primereact/utils'
import type { StateTypes } from '@/types/general'
import type { Route } from 'next'
import type { ButtonProps as OriginalButtonProps } from 'primereact/button'
import type { ReactNode } from 'react'

// Lazy-load react-tooltip — it only mounts when a button receives `data-tooltip-id`.
const Tooltip = dynamic(() => import('react-tooltip').then(m => m.Tooltip), { ssr: false })

type CustomButtonVariant = 'primary' | 'white' | 'transparent' | StateTypes
type CustomButtonSize = 'detail' | 'small' | 'medium' | 'large'

interface SharedProps {
  variant?: CustomButtonVariant
  size?: CustomButtonSize
  disabled?: boolean
  className?: string
  children?: ReactNode
  'data-tooltip-id'?: string
  'data-tooltip-content'?: string
}

interface LinkButtonProps extends SharedProps {
  href: Route
  replace?: boolean
  // Props that are silently dropped on the Link branch — TS will block them at the call site.
  onClick?: never
  type?: never
  loading?: never
  loadingIcon?: never
  icon?: never
  iconPos?: never
  badge?: never
  severity?: never
  outlined?: never
  text?: never
  raised?: never
  rounded?: never
  plain?: never
  label?: never
}

interface ActionButtonProps extends SharedProps, Omit<OriginalButtonProps, 'size' | keyof SharedProps> {
  href?: never
  replace?: never
}

type ButtonProps = LinkButtonProps | ActionButtonProps

const VARIANT_CLASSES: {
  [key in CustomButtonVariant]: string
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
  [key in CustomButtonSize]: string
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
    className
  )
  const tooltipId = props['data-tooltip-id']

  if (href) {
    return (
      <>
        <Link
          href={disabled ? '#' : href}
          replace={replace}
          className={classes}
          aria-disabled={disabled}
          data-tooltip-id={tooltipId}
          onClick={(e) => {
            if (disabled) {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
        >
          { children }
        </Link>

        {tooltipId && (
          <Tooltip className='CustomButton__Tooltip' id={tooltipId} />
        )}
      </>
    )
  }

  return (
    <>
      <Button
        className={classes}
        onClick={disabled ? undefined : onClick}
        aria-disabled={disabled}
        disabled={disabled}
        {...props}
      >
        { children }
      </Button>

      {tooltipId && (
        <Tooltip className='CustomButton__Tooltip' id={tooltipId} />
      )}
    </>
  )
}

export default CustomButton
