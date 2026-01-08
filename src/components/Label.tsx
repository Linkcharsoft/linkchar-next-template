import { memo } from 'react'
import type { HTMLProps } from 'react'

const Label = (props: HTMLProps<HTMLLabelElement>) => {
  return (
    <label
      className="text-base font-semibold not-italic leading-normal text-surface-700"
      {...props}
    >
      {props.children}
    </label>
  )
}

export default memo(Label)
