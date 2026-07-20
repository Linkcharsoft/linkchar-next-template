import './InputContainer.sass'
import Label from '../../Label/Label'
import InputError from '../InputError/InputError'
import type { ReactNode } from 'react'

interface Props {
  /**
   * Accepts a node, not just a string, so a field can carry the required marker inside its own
   * accessible name — `<span>Nombre <span aria-hidden>*</span><span class='sr-only'>(obligatorio)</span></span>`.
   * See CONVENTIONS > Accessibility: `required` / `aria-required` are both unusable on this stack.
   */
  label: ReactNode
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