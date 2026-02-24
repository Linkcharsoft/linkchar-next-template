import './InputContainer.sass'
import { memo } from 'react'
import Label from '../../Label/Label'
import InputError from '../InputError/InputError'
import type { ReactNode } from 'react'

interface Props {
  label: string
  htmlFor: string
  error: string | undefined
  children: ReactNode
}

const InputContainer = ({
  label,
  htmlFor,
  error,
  children
}: Props) => {
  return (
    <div className="InputContainer">
      <Label htmlFor={htmlFor}>{label}</Label>
      { children }
      <InputError message={error}/>
    </div>
  )
}

export default memo(InputContainer)