import { ReactNode } from 'react'
import InputError from './InputError'
import Label from './Label'

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

export default InputContainer