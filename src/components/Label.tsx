import { HTMLProps, memo } from 'react'

const Label = (props: HTMLProps<HTMLLabelElement>) => {
  return (
    <label
      className="text-surface-700 text-base font-semibold not-italic leading-normal"
      {...props}
    >
      {props.children}
    </label>
  )
}

export default memo(Label)
