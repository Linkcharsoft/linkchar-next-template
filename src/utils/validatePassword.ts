import { AUTH_INPUT_ERRORS } from '@/constants/auth'

const VALIDATION_TYPES = ['length', 'numeric', 'uppercase', 'symbol'] as const

type ValidationType = typeof VALIDATION_TYPES[number]

type ValidatePasswordType = {
  types: typeof VALIDATION_TYPES
  validations: {
    [key in ValidationType]: {
      label: string
      value: boolean
    }
  }
}

const validatePassword = (password: string): ValidatePasswordType => {
  return {
    types: VALIDATION_TYPES,
    validations: {
      length: {
        label: AUTH_INPUT_ERRORS['password-length'],
        value: password.length >= 8
      },
      numeric: {
        label: AUTH_INPUT_ERRORS['password-numeric'],
        value: !/^\d+$/.test(password)
      },
      // alphaNumeric: {
      //   label: AUTH_INPUT_ERRORS["password-alphanumeric"], // We might need this in future
      //   value: !/\d/.test(password)
      // },
      uppercase: {
        label: AUTH_INPUT_ERRORS['password-uppercase'],
        value: /[A-Z]/.test(password)
      },
      symbol: {
        label: AUTH_INPUT_ERRORS['password-symbol'],
        value: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/.test(password)
      }
    }
  }
}

export default validatePassword