'use client'
import { AnimatePresence, m } from 'framer-motion'
import { memo } from 'react'

interface Props {
  message: string | undefined
}

const InputError = ({ message }: Props) => {
  return (
    <AnimatePresence>
      {message && (
        <m.div
          className="InputError fw-medium flex items-center gap-2 text-sm text-red-600"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <i className="pi pi-exclamation-circle text-red-600"></i>
          { message }
        </m.div>
      )}
    </AnimatePresence>
  )
}

export default memo(InputError)
