import { AUTH_COOKIE_NAME, AUTH_INPUT_ERRORS } from '../../../src/constants/auth'
import checkInputError from '../../utils/checkInputError'
import checkPasswordErrors from '../../utils/checkPasswordErrors'
import extractValidationCodeFromEmail from '../../utils/extractValidationCodeFromEmail'

const baseURL = Cypress.config().baseUrl

describe('Sign Up: Errors ❌', () => {
  before(() => {
    cy.visit('/signup')

    cy.getCookie(AUTH_COOKIE_NAME).should('not.exist')

    cy.createInbox().then(({ id, emailAddress }) => {
      Cypress.env('inboxId', id)
      Cypress.env('emailAddress', emailAddress)
    })
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

  checkPasswordErrors({
    inputAlias: '@password-input',
    submitAlias: '@submit-button'
  })

  it('Good password', () => {
    cy.get('@password-input').type('1234567A@')

    cy.get('@submit-button').click()
    checkInputError({
      alias: '@password-input',
      error: false
    })
  })

  it('Existing user', () => {
    cy.get('@email-input').type(Cypress.env('AUTH_DEFAULT_USER'))
    cy.get('@password-input').type(Cypress.env('AUTH_DEFAULT_PASSWORD'))

    cy.get('@submit-button').click()
    checkInputError({
      alias: '@email-input'
    })
  })
})

describe('Sign Up: Navigation 🔗', () => {
  it('Login', () => {
    cy.get('a[href="/login"]').click()

    cy.url().should('equal', `${baseURL}/login`)

    cy.visit('/signup')
  })
})

describe('Sign Up: Success ✅', () => {
  it('Email and password', () => {
    cy.intercept('POST', '/api/auth/registration').as('registration')
    cy.get('input[name="email"]').as('email-input')
    cy.get('input[name="password"]').as('password-input')
    cy.get('button[type="submit"]').as('submit-button')

    const emailAddress = Cypress.env('emailAddress')
    cy.get('@email-input').type(emailAddress)
    cy.get('@password-input').type(Cypress.env('AUTH_DEFAULT_PASSWORD'))
    cy.get('@submit-button').click()

    cy.wait('@registration').its('response.statusCode').should('eq', 201)

    const inboxId = Cypress.env('inboxId')
    cy.getLastestEmail(inboxId).then((email) => {
      const code = extractValidationCodeFromEmail(email)

      cy.wrap(code).should('exist')
      Cypress.env('firstEmailValidationCode', code)
    })
  })

  it('Immediate resend email', () => {
    cy.intercept('POST', '/api/auth/registration/resend-email/').as('resend-email')

    cy.url().should('include', `${baseURL}/signup/email-validation`)

    cy.get('a[href="https://outlook.com/"]').should('exist')
    cy.get('a[href="https://gmail.com/"]').should('exist')

    cy.get('.CustomButton--Transparent').as('resend-button')
    cy.get('@resend-button').should('not.be.disabled')

    cy.get('@resend-button').click()
    cy.wait('@resend-email').its('response.statusCode').should('eq', 200)

    cy.get('@resend-button').should('be.disabled')

    cy.get('@resend-button', { timeout: 35000 }).should('not.be.disabled')

    const inboxId = Cypress.env('inboxId')
    cy.getLastestEmail(inboxId).then((email) => {
      const newCode = extractValidationCodeFromEmail(email)
      cy.wrap(newCode).should('exist')

      const firstCode = Cypress.env('firstEmailValidationCode')
      expect(newCode).to.not.equal(firstCode)
    })

    cy.get('a[href="/login"]').click()

    cy.url().should('equal', `${baseURL}/login`)
  })

  it('Try to login', () => {
    cy.visit('/login')

    cy.get('input[name="email"]').as('login-email-input')
    cy.get('input[name="password"]').as('login-password-input')
    cy.get('button[type="submit"]').as('login-submit-button')

    const emailAddress = Cypress.env('emailAddress')
    cy.get('@login-email-input').type(emailAddress)
    cy.get('@login-password-input').type(Cypress.env('AUTH_DEFAULT_PASSWORD'))

    cy.get('@login-submit-button').click()

    checkInputError({
      alias: '@login-email-input',
      message: AUTH_INPUT_ERRORS['verify-email']
    })
  })
})