'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { memo } from 'react'
import { useAppStore } from '@/stores/appStore'
import Loader from '../Loader'

const LoadingModal = () => {
  const { loadingModal } = useAppStore()

  return (
    <AnimatePresence>
      {loadingModal.show && (
        <motion.div
          className="LoadingModal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="mx-8 flex max-w-[700px] flex-col items-center gap-4">
            <div className='relative'>
              <Loader/>
            </div>

            {loadingModal.title && (
              <p className="text-center text-2xl font-bold text-surface-800">
                {loadingModal.title}
              </p>
            )}

            {loadingModal.message && (
              <p className="text-center text-surface-800">
                {loadingModal.message}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default memo(LoadingModal)
