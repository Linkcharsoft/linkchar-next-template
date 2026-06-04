'use client'
import './StateModal.sass'
import { Dialog } from 'primereact/dialog'
import useModalStore from '@/stores/modalStore'
import CustomButton from '../../CustomButton/CustomButton'
import type { StateTypes } from '@/types/general'

const STATE_ICONS: {
  [K in StateTypes]: string
} = {
  success: 'pi pi-check-circle text-green-600',
  info: 'pi pi-info-circle text-blue-600',
  warn: 'pi pi-exclamation-triangle text-orange-600',
  error: 'pi pi-times-circle text-red-600'
}

export default function StateModal () {
  const stateModal = useModalStore((s) => s.modals.stateModal)
  const closeModal = useModalStore((s) => s.closeModal)

  return (
    <Dialog
      header={stateModal.title}
      visible={stateModal.show}
      focusOnShow={false}
      draggable={false}
      onHide={() => closeModal('stateModal')}
      pt={{
        root: {
          className: 'w-full max-w-[420px]'
        },
        content: {
          className: 'p-4'
        },
        header: {
          className: 'px-4 py-3 text-center'
        },
        headerTitle: {
          className: 'text-bold-18 ml-8'
        }
      }}
    >
      <div className="flex flex-col items-center gap-6">
        <i className={`${STATE_ICONS[stateModal.type]} text-regular-32`}/>

        <div className="flex flex-col items-center gap-2 text-center">
          {stateModal.subtitle && (
            <p className='text-semibold-16'>{stateModal.subtitle}</p>
          )}
          <p className='text-regular-14'>{stateModal.content}</p>
        </div>

        <CustomButton
          variant={stateModal.type}
          pt={{
            root: {
              className: 'w-1/2 h-11'
            }
          }}
          onClick={() => {
            if(stateModal.button?.action) stateModal.button.action()
            closeModal('stateModal')
          }}
        >
          { stateModal.button?.label ?? 'OK' }
        </CustomButton>
      </div>
    </Dialog>
  )
}
