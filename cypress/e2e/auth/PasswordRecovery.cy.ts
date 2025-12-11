import { AUTH_COOKIE_NAME , AUTH_INPUT_ERRORS } from '../../../src/constants/auth'
import checkInputError from '../../utils/checkInputError'

describe('Password Recovery: Errors ❌', () => {
  before(() => {
    cy.visit('/password-recovery')

    cy.getCookie(AUTH_COOKIE_NAME).should('not.exist')
  })

  beforeEach(() => {
    cy.get('input[name="email"]').as('email-input').clear()
    cy.get('button[type="submit"]').as('submit-button')
  })

  it('Required', () => {
    cy.get('@submit-button').click()

    checkInputError({
      alias: '@email-input',
      message: AUTH_INPUT_ERRORS.required
    })
  })

  it('Invalid email', () => {
    cy.get('@email-input').type('test')

    cy.get('@submit-button').click()

    checkInputError({
      alias: '@email-input',
      message: AUTH_INPUT_ERRORS['invalid-email']
    })
  })
})

describe('Password Recovery: Navigation 🔗', () => {
  before(() => {
    cy.visit('/password-recovery')

    cy.getCookie(AUTH_COOKIE_NAME).should('not.exist')
  })

  beforeEach(() => {
    cy.get('input[name="email"]').as('email-input').clear()
    cy.get('button[type="submit"]').as('submit-button')
  })

  it('Login', () => {
    const baseURL = Cypress.config().baseUrl

    cy.get('a[href="/login"]').click()

    cy.url().should('equal', `${baseURL}/login`)

    cy.visit('/password-recovery')
  })
})