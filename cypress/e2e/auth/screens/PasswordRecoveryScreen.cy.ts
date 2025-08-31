import { AUTH_COOKIE_NAME , AUTH_INPUT_ERRORS } from '../../../../src/constants/auth'
import { checkInputError } from '../../../support/helpers'

describe('Password Recovery: Screen', () => {
  before(() => {
    cy.visit('/password-recovery')

    cy.getCookie(AUTH_COOKIE_NAME).should('not.exist')
  })

  beforeEach(() => {
    cy.get('input[name="email"]').as('email-input').clear()
    cy.get('button[type="submit"]').as('submit-button')
  })

  it('Errors ❌: Required', () => {
    cy.get('@submit-button').click()

    checkInputError({
      alias: '@email-input',
      message: AUTH_INPUT_ERRORS.required
    })
  })

  it('Errors ❌: Invalid email', () => {
    cy.get('@email-input').type('test')

    cy.get('@submit-button').click()

    checkInputError({
      alias: '@email-input',
      message: AUTH_INPUT_ERRORS['invalid-email']
    })
  })

  it('Navigation 🔗: Login', () => {
    const baseURL = Cypress.config().baseUrl

    cy.get('a[href="/login"]').click()

    cy.url().should('equal', `${baseURL}/login`)

    cy.visit('/password-recovery')
  })
})
