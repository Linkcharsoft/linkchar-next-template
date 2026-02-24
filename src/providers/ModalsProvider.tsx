import StateModal from '@/components/modals/StateModal/StateModal'
import ToastNotifications from '@/components/modals/ToastNotifications/ToastNotifications'

const ModalsProvider = () => {
  return (
    <>
      <ToastNotifications/>

      <StateModal/>
    </>
  )
}

export default ModalsProvider