type CheckInputErrorProps = {
  alias: string
  message: string
  error?: true
} | {
  alias: string
  error: false
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
      .and('have.text', message)
  } else {
    cy.get(alias)
      .should('not.have.class', 'p-invalid')
      .parents('.InputContainer')
      .find('.InputError')
      .should('not.exist')
  }
}