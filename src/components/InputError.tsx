'use client'
import { AnimatePresence, motion } from 'framer-motion'

interface Props {
  message: string | undefined
}

const InputError = ({ message }: Props) => {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="InputError fw-medium text-sm flex items-center gap-2"
          style={{
            color: '#CC1600'
          }}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <i className="pi pi-exclamation-circle"></i>
          { message }
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default InputError
