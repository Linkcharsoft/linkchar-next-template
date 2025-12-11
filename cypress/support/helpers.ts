type CheckInputErrorProps = {
  alias: string
  message?: string
  error?: boolean
}

export const checkInputError = ({
  alias,
  message,
  error = true
}: {
  alias: string
  message?: string
  error?: boolean
}) => {
  if (error) {
    cy.get(alias)
      .should('have.class', 'p-invalid')
      .parents('.InputContainer')
      .find('.InputError')
      .should('be.visible')
      .then(($el) => {
        if (message) {
          expect($el.text()).to.eq(message)
        }
      })
  } else {
    cy.get(alias)
      .should('not.have.class', 'p-invalid')
      .parents('.InputContainer')
      .find('.InputError')
      .should('not.exist')
  }
}


const PASSWORD_TESTS = [
  {
    name: 'Password length',
    value: '1234567',
    error: AUTH_INPUT_ERRORS['password-length']
  }, {
    name: 'Password only numeric',
    value: '12345678',
    error: AUTH_INPUT_ERRORS['password-numeric']
  },
  // {
  //   name: 'Password with at least one number',
  //   value: 'abcdefgh',
  //   error: AUTH_INPUT_ERRORS['password-alphanumeric']
  // },
  {
    name: 'Password one uppercase',
    value: '1234567a',
    error: AUTH_INPUT_ERRORS['password-uppercase']
  }, {
    name: 'Password one symbol',
    value: '1234567A',
    error: AUTH_INPUT_ERRORS['password-symbol']
  }
]

export const checkPasswordErrors = ({
  inputAlias,
  submitAlias
}: {
  inputAlias: string
  submitAlias: string
}) => {
  PASSWORD_TESTS.forEach(test => {
    it(test.name, () => {
      cy.get(inputAlias).type(test.value)

      cy.get(submitAlias).click()
      checkInputError({
        alias: inputAlias,
        message: test.error
      })
    })
  })
}