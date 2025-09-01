import { AUTH_COOKIE_NAME , AUTH_INPUT_ERRORS } from '../../../src/constants/auth'
import { checkInputError } from '../../support/helpers'

const baseURL = Cypress.config().baseUrl

describe('Login: Errors ❌', () => {
  before(() => {
    cy.visit('/login')

    cy.getCookie(AUTH_COOKIE_NAME).should('not.exist')
  })

  beforeEach(() => {
    cy.get('input[name="email"]').as('email-input').clear()
    cy.get('input[name="password"]').as('password-input').clear()
    cy.get('button[type="submit"]').as('submit-button')
  })

  it('Required', () => {
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

  it('Invalid email', () => {
    cy.get('@email-input').type('test')

    cy.get('@submit-button').click()

    checkInputError({
      alias: '@email-input',
      message: AUTH_INPUT_ERRORS['invalid-email']
    })
  })

  it('Invalid credentials', () => {
    const randomCredential = Math.random().toString(36).slice(2, 12)

    cy.get('@email-input').type(`${randomCredential}@mail.com`)
    cy.get('@password-input').type(`${randomCredential.split('').reverse().join('')}`)

    cy.get('@submit-button').click()

    checkInputError({
      alias: '@email-input',
      message: AUTH_INPUT_ERRORS['invalid-email-or-password']
    })
    checkInputError({
      alias: '@password-input',
      message: AUTH_INPUT_ERRORS['invalid-email-or-password']
    })
  })
})

describe('Login: Navigation 🔗', () => {
  before(() => {
    cy.visit('/login')

    cy.getCookie(AUTH_COOKIE_NAME).should('not.exist')
  })

  beforeEach(() => {
    cy.get('input[name="email"]').as('email-input').clear()
    cy.get('input[name="password"]').as('password-input').clear()
    cy.get('button[type="submit"]').as('submit-button')
  })

  it('Sign Up', () => {
    cy.get('a[href="/signup"]').click()

    cy.url().should('equal', `${baseURL}/signup`)

    cy.visit('/login')
  })

  it('Password Recovery', () => {
    cy.get('a[href="/password-recovery"]').click()

    cy.url().should('equal', `${baseURL}/password-recovery`)

    cy.visit('/login')
  })
})

describe('Login: Success ✅', () => {
  it('Default user login', () => {
    cy.login()
  })
})