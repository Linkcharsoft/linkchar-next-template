import { AUTH_COOKIE_NAME, AUTH_INPUT_ERRORS } from '../../../../src/constants/auth'
import { checkInputError } from '../../../support/helpers'

describe('SignUp', () => {
  before(() => {
    cy.visit('/signup')

    cy.getCookie(AUTH_COOKIE_NAME).should('not.exist')

    cy.createInbox().then(({ id, email }) => {
      cy.wrap(id).as('inbox-id')
      cy.wrap(email).as('email-address')
    })
  })

  beforeEach(() => {
    cy.get('input[name="email"]').as('email-input').clear()
    cy.get('input[name="password"]').as('password-input').clear()
    cy.get('button[type="submit"]').as('submit-button')
  })

  it('Errors ❌: Required', () => {
    cy.get('@submit-button').click()
    checkInputError({
      alias: '@email-input',
      message: AUTH_INPUT_ERRORS.required
    })
    checkInputError({
      alias: '@password-input',
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

  it('Errors ❌: Password length', () => {
    cy.get('@password-input').type('1234567')

    cy.get('@submit-button').click()
    checkInputError({
      alias: '@password-input',
      message: AUTH_INPUT_ERRORS['password-length']
    })
  })

  it('Errors ❌: Password only numeric', () => {
    cy.get('@password-input').type('12345678')

    cy.get('@submit-button').click()
    checkInputError({
      alias: '@password-input',
      message: AUTH_INPUT_ERRORS['password-numeric']
    })
  })

  it('Errors ❌: Password one uppercase', () => {
    cy.get('@password-input').type('1234567a')

    cy.get('@submit-button').click()
    checkInputError({
      alias: '@password-input',
      message: AUTH_INPUT_ERRORS['password-uppercase']
    })
  })

  it('Errors ❌: Password one symbol', () => {
    cy.get('@password-input').type('1234567A')

    cy.get('@submit-button').click()
    checkInputError({
      alias: '@password-input',
      message: AUTH_INPUT_ERRORS['password-symbol']
    })
  })

  it('Success ✅: Password', () => {
    cy.get('@password-input').type('1234567A@')

    cy.get('@submit-button').click()
    checkInputError({
      alias: '@password-input',
      error: false
    })
  })

  it('Errors ❌: Existing user', () => {
    cy.get('@email-input').type(Cypress.env('AUTH_DEFAULT_USER'))
    cy.get('@password-input').type(Cypress.env('AUTH_DEFAULT_PASSWORD'))

    cy.get('@submit-button').click()
    checkInputError({
      alias: '@email-input'
    })
  })

  // it('Sign up ✅', () => {

  // })
})