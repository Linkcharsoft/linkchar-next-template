'use client'
import { Url } from 'next/dist/shared/lib/router/router'
import Link from 'next/link'
import { Button, ButtonProps as OriginalButtonProps } from 'primereact/button'
import { classNames } from 'primereact/utils'
import { Tooltip } from 'react-tooltip'

interface ButtonProps extends Omit<OriginalButtonProps, 'size'> {
  variant?: 'primary' | 'white' | 'transparent'
  size?: 'small' | 'medium' | 'large'
  href?: Url
  replace?: boolean | undefined
}

const VARIANT_CLASSES = {
  primary: 'CustomButton--Primary',
  white: 'CustomButton--White',
  transparent: 'CustomButton--Transparent',
}
const SIZE_CLASSES = {
  small: 'CustomButton--Small',
  medium: 'CustomButton--Medium',
  large: 'CustomButton--Large',
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
        <Tooltip id={tooltipId} />
      )}
    </>
  )
}

export default CustomButton
