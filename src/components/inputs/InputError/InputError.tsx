'use client'
import './InputError.sass'
import { AnimatePresence, m } from 'framer-motion'

interface Props {
  message: string | undefined
}

const InputError = ({ message }: Props) => {
  return (
    <AnimatePresence>
      {message && (
        <m.div
          role='alert'
          className='InputError text-medium-14 flex items-center gap-2 text-red-600'
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <i className='pi pi-exclamation-circle text-red-600' aria-hidden='true'></i>
          { message }
        </m.div>
      )}
    </AnimatePresence>
  )
}

export default InputError
