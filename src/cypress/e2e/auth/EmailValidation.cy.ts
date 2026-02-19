import { SESSION_COOKIE_NAME, AUTH_INPUT_ERRORS } from '@/constants/auth'
import checkInputError from '@/cypress/utils/checkInputError'
import extractValidationCodeFromEmail from '@/cypress/utils/extractValidationCodeFromEmail'

const baseURL = Cypress.config().baseUrl

describe('Email Validation: Errors ❌', () => {
  before(() => {
    const randomCode = Math.random().toString(36).slice(2, 24)
    cy.visit(`/signup/confirmation/${randomCode}`)

    cy.get('.pi-exclamation-triangle').should('exist')

    cy.getCookie(SESSION_COOKIE_NAME).should('not.exist')

    cy.createInbox().then(({ id, emailAddress }) => {
      Cypress.expose('INBOX_ID', id)
      Cypress.expose('EMAIL_ADDRESS', emailAddress)
    })
  })

  it('Required', () => {
    cy.get('input[name="email"]').as('email-input').clear()

    cy.get('button[type="submit"]').as('submit-button')
    cy.get('@submit-button').click()
    checkInputError({
      alias: '@email-input',
      message: AUTH_INPUT_ERRORS.required
    })
  })
})

describe('Email Validation: Navigation 🔗', () => {
  it('Redirects', () => {
    cy.visit('/signup/email-validation')
    cy.url().should('equal', `${baseURL}/login`)
    cy.visit('/signup/email-validation/')
    cy.url().should('equal', `${baseURL}/login`)

    const email = Cypress.expose('AUTH_DEFAULT_USER')
    cy.visit(`/signup/email-validation/${email.replace('@', '')}`)
    cy.url().should('equal', `${baseURL}/login`)
    cy.visit(`/signup/email-validation/${email}`)
    cy.url().should('include', `${baseURL}/signup/email-validation/`)
  })

  it('Login', () => {
    cy.get('a[href="/login"]').click()

    cy.url().should('equal', `${baseURL}/login`)

    cy.visit(`/signup/email-validation/${Cypress.expose('AUTH_DEFAULT_USER')}`)
  })
})

describe('Email Validation: Success ✅', () => {
  it('Try to login', () => {
    cy.intercept('POST', '/api/auth/registration/resend-email/').as('resend-email')

    cy.visit('/login')

    cy.get('input[name="email"]').as('email-input')
    cy.get('input[name="password"]').as('password-input')
    cy.get('button[type="submit"]').as('submit-button')

    const emailAddress = Cypress.expose('EMAIL_ADDRESS')
    cy.get('@email-input').type(emailAddress)
    cy.get('@password-input').type(Cypress.expose('AUTH_DEFAULT_PASSWORD'))

    cy.get('@submit-button').click()

    checkInputError({
      alias: '@email-input',
      message: AUTH_INPUT_ERRORS['verify-email']
    })

    cy.wait('@resend-email').its('response.statusCode').should('eq', 200)

    cy.url().should('equal', `${baseURL}/signup/email-validation/${encodeURIComponent(emailAddress)}`)
  })

  it('Resend email', () => {
    cy.intercept('POST', '/api/auth/registration/resend-email/').as('resend-email')

    cy.get('button[type="submit"]').as('resend-button')
    cy.get('@resend-button').should('be.disabled')
    cy.get('@resend-button', { timeout: 6000 }).should('not.be.disabled')

    cy.get('@resend-button').click()
    cy.wait('@resend-email').its('response.statusCode').should('eq', 200)

    cy.get('@resend-button').should('be.disabled')

    cy.get('@resend-button', { timeout: 35000 }).should('not.be.disabled')

    const inboxId = Cypress.expose('INBOX_ID')
    cy.getLastestEmail(inboxId).then((email) => {
      const code = extractValidationCodeFromEmail(email)

      cy.wrap(code).should('exist')
      Cypress.expose('EMAIL_VALIDATION_CODE', code)
    })

    cy.get('a[href="/login"]').click()

    cy.url().should('equal', `${baseURL}/login`)
  })

  it('Incorrect code ❌', () => {
    cy.intercept('POST', '/api/auth/registration/resend-email/').as('resend-email')
    cy.intercept('POST', '/api/auth/registration/verify-email/').as('validate-email')

    const code = Cypress.expose('EMAIL_VALIDATION_CODE')
    cy.wrap(code).should('exist')
    cy.visit(`/signup/confirmation/${code.slice(0, code.length - 1)}`)

    cy.wait('@validate-email').its('response.statusCode').should('eq', 404)
    cy.get('.pi-exclamation-triangle').should('exist')

    const emailAddress = Cypress.expose('EMAIL_ADDRESS')
    cy.get('input[name="email"]').type(emailAddress)

    cy.get('button[type="submit"]').as('resend-button')
    cy.get('@resend-button').should('not.be.disabled')
    cy.get('@resend-button').click()

    cy.wait('@resend-email').its('response.statusCode').should('eq', 200)

    cy.get('@resend-button').should('be.disabled')

    cy.get('@resend-button', { timeout: 35000 }).should('not.be.disabled')

    const inboxId = Cypress.expose('INBOX_ID')
    cy.getLastestEmail(inboxId).then((email) => {
      const code = extractValidationCodeFromEmail(email)

      cy.wrap(code).should('exist')
      Cypress.expose('EMAIL_VALIDATION_CODE', code)
    })
  })

  it('Correct code ✅', () => {
    cy.intercept('POST', '/api/auth/registration/verify-email/').as('validate-email')

    const code = Cypress.expose('EMAIL_VALIDATION_CODE')
    cy.wrap(code).should('exist')
    cy.visit(`/signup/confirmation/${code}`)

    cy.wait('@validate-email').its('response.statusCode').should('eq', 200)
    cy.get('.pi-check-circle').should('exist')

    cy.get('a[href="/login"]').click()

    cy.url().should('equal', `${baseURL}/login`)
  })
})