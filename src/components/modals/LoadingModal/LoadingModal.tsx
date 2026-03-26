'use client'
import './LoadingModal.sass'
import { AnimatePresence, m } from 'framer-motion'
import useModalStore from '@/stores/modalStore'
import Loader from '../../Loader/Loader'

const LoadingModal = () => {
  const { modals: { loadingModal } } = useModalStore()

  return (
    <AnimatePresence>
      {loadingModal.show && (
        <m.div
          className="LoadingModal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="mx-8 flex max-w-[700px] flex-col items-center gap-6">
            <div className='relative'>
              <Loader/>
            </div>

            <div className="flex flex-col items-center gap-2">
              <p className="text-bold-24 text-center text-surface-800">
                {loadingModal.title}
              </p>

              {loadingModal.subtitle && (
                <p className="text-medium-18 text-center text-surface-800">
                  {loadingModal.subtitle}
                </p>
              )}

              {loadingModal.content && (
                <p className="text-center text-surface-800">
                  {loadingModal.content}
                </p>
              )}
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}

export default LoadingModal
