import './PasswordValidator.sass'
import { classNames } from 'primereact/utils'
import validatePassword from '@/utils/validatePassword'

interface Props {
  password: string
}

const PasswordValidator = ({ password }: Props) => {
  const PASSWORD_VALIDATIONS = validatePassword(password)

  return (
    <div className="flex flex-col gap-1">
      {PASSWORD_VALIDATIONS.types.map((type, index) => (
        <div
          key={`Password-Validator-Type-${index}`}
          className="flex items-center gap-2"
        >
          <div className="flex w-4 items-center justify-center">
            <i
              className={classNames('pi', {
                'pi-circle-fill text-surface-700 text-10': !password,
                'pi-check text-green-600': password && PASSWORD_VALIDATIONS.validations[type].value,
                'pi-times text-red-600': password && !PASSWORD_VALIDATIONS.validations[type].value
              })}
            ></i>
          </div>
          <span className="text-14 text-surface-700">{PASSWORD_VALIDATIONS.validations[type].label}</span>
        </div>
      ))}
    </div>
  )
}

export default PasswordValidator