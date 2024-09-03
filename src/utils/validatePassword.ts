type ValidatePasswordType = {
  length: boolean
  uppercase: boolean
  notNumeric: boolean
}

const validatePassword = (password: string): ValidatePasswordType => {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    notNumeric: !/^\d+$/.test(password)
  }
}

export default validatePassword