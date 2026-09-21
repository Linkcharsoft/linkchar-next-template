'use client'
import './HoneypotField.sass'
import { HONEYPOT_FIELD } from '@/constants/contactForms'
import type { ChangeEvent } from 'react'

// Spam trap: hidden from sight and tab order, so only an automated filler reaches it. Spread `honeypotProps` from useContactForm.
interface Props {
  /** Unique per form — several forms can be mounted on the same page. */
  id: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

const HoneypotField = ({ id, value, onChange }: Props) => (
  <div className='HoneypotField' aria-hidden='true'>
    <label htmlFor={id}>Leave this field empty</label>

    <input
      id={id}
      name={HONEYPOT_FIELD}
      type='text'
      tabIndex={-1}
      autoComplete='off'
      value={value}
      onChange={onChange}
    />
  </div>
)

export default HoneypotField
