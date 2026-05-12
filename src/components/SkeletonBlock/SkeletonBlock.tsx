'use client'
import './SkeletonBlock.sass'
import { classNames } from 'primereact/utils'

interface Props {
  className?: string
  /**
   * Use on dark backgrounds (e.g. dark cards/footers). Switches the placeholder
   * to a darker shade with a more subtle shimmer.
   */
  dark?: boolean
}

const SkeletonBlock = ({ className, dark = false }: Props) => {
  return (
    <div
      className={classNames(
        'SkeletonBlock',
        { 'SkeletonBlock--Dark': dark },
        className
      )}
    />
  )
}

export default SkeletonBlock
