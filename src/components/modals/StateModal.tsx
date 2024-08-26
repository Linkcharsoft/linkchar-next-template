import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import useAppContext from '@/hooks/useAppContext'

/* DOCS: https://primereact.org/dialog/ */

export default function BasicDemo() {
  const { modalState, hideModalState } = useAppContext()

  /* THIS IS A EXAMPLE COLORS AND ICONS */

  const TYPE_ICON = {
    success: 'pi pi-check-circle text-green-500',
    info: 'pi pi-info-circle text-blue-500',
    warning: 'pi pi-exclamation-triangle text-yellow-500',
    error: 'pi pi-times-circle text-red-500'
  }

  const SERVERITY_BUTTON = {
    success: 'p-button-success',
    info: 'p-button-info',
    warning: 'p-button-warning',
    error: 'p-button-danger'
  }

  return (
    <div className="card flex justify-content-center">
      <Dialog
        header="Header"
        visible={modalState.show}
        focusOnShow={false}
        draggable={false}
        headerClassName="text-center"
        style={{ width: '350px' }}
        onHide={() => {
          hideModalState()
        }}
        pt={{
          content: {
            className: 'py-4 pb-5'
          },
          header: {
            className: 'py-3'
          },
          headerTitle: {
            className: 'text-lg font-bold ml-10'
          }
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <i className={TYPE_ICON[modalState.type]} style={{ fontSize: '2rem' }} />
          <p>{modalState.content}</p>
          <Button
            label="OK"
            className={SERVERITY_BUTTON[modalState.type]}
            pt={{
              root: {
                className: 'w-1/2 h-12'
              }
            }}
            onClick={() => {}}
          />
        </div>
      </Dialog>
    </div>
  )
}
