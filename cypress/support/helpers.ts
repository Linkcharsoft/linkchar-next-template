type CheckInputErrorProps = {
  alias: string
  message?: string
  error?: boolean
}

export const checkInputError = ({
  alias,
  message,
  error = true
}: CheckInputErrorProps) => {
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