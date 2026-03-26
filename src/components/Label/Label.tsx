import './Label.sass'
import type { HTMLProps } from 'react'

const Label = (props: HTMLProps<HTMLLabelElement>) => {
  return (
    <label
      className="text-medium-16 leading-normal text-surface-700"
      {...props}
    >
      {props.children}
    </label>
  )
}

export default Label
