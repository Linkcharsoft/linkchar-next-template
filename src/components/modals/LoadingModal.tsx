'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/stores/appStore'

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

              <div className="relative h-12 w-12 [&>span]:absolute [&>span]:inset-0 [&>span]:inline-flex [&>span]:h-full [&>span]:w-full [&>span]:before:h-2 [&>span]:before:w-2 [&>span]:before:animate-customLoading [&>span]:before:rounded-full [&>span]:before:bg-indigo-600">
                <span className=""></span>
                <span className="rotate-[30deg] before:!animation-delay-[-1.1s]"></span>
                <span className="rotate-[60deg] before:!animation-delay-[-1s]"></span>
                <span className="rotate-[90deg] before:!animation-delay-[-0.9s]"></span>
                <span className="rotate-[120deg] before:!animation-delay-[-0.8s]"></span>
                <span className="rotate-[150deg] before:!animation-delay-[-0.7s]"></span>
                <span className="rotate-[180deg] before:!animation-delay-[-0.6s]"></span>
                <span className="rotate-[210deg] before:!animation-delay-[-0.5s]"></span>
                <span className="rotate-[240deg] before:!animation-delay-[-0.4s]"></span>
                <span className="rotate-[270deg] before:!animation-delay-[-0.3s]"></span>
                <span className="rotate-[300deg] before:!animation-delay-[-0.2s]"></span>
                <span className="rotate-[330deg] before:!animation-delay-[-0.1s]"></span>
              </div>
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

export default LoadingModal
