const VALIDATION_TYPES = ['length', 'notNumeric', 'uppercase'] as const

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
        label: 'Minimum of 8 characters',
        value: password.length >= 8
      },
      notNumeric: {
        label: 'Cannot be entirely numeric',
        value: !/^\d+$/.test(password)
      },
      // alphaNumeric: {
      //   label: ';Must contain at least one number', // We might need this in future
      //   value: !/\d/.test(password)
      // },
      uppercase: {
        label: 'Must contain at least one uppercase letter',
        value: /[A-Z]/.test(password)
      }
    }
  }
}

export default validatePassword