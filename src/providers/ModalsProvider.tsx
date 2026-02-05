import StateModal from '@/components/modals/StateModal'
import ToastNotifications from '@/components/modals/ToastNotifications'

const ModalsProvider = () => {
  return (
    <>
      <ToastNotifications/>

      <StateModal/>
    </>
  )
}

export default ModalsProvider