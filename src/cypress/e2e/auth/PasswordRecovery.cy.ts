import { AUTH_COOKIE_NAME , AUTH_INPUT_ERRORS } from '@/constants/auth'
import checkInputError from '@/cypress/utils/checkInputError'
import checkPasswordErrors from '@/cypress/utils/checkPasswordErrors'
import extractValidationCodeFromEmail from '@/cypress/utils/extractValidationCodeFromEmail'

const baseURL = Cypress.config().baseUrl

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

  it('Redirects', () => {
    cy.visit('/password-recovery/confirmation')
    cy.url().should('equal', `${baseURL}/login`)
    cy.visit('/password-recovery/confirmation/')
    cy.url().should('equal', `${baseURL}/login`)

    const randomCode = Math.random().toString(36).slice(2, 24)
    cy.visit(`/password-recovery/confirmation/${randomCode}`)
    cy.url().should('equal', `${baseURL}/login`)
    cy.visit(`/password-recovery/confirmation/${randomCode}/`)
    cy.url().should('equal', `${baseURL}/login`)

    const email = Cypress.env('AUTH_DEFAULT_USER')
    cy.visit(`/password-recovery/confirmation/${email.replace('@', '')}`)
    cy.url().should('equal', `${baseURL}/login`)
    cy.visit(`/password-recovery/confirmation/${email}`)
    cy.url().should('include', `${baseURL}/password-recovery/confirmation`)
  })

  it('Login', () => {
    cy.get('a[href="/login"]').click()

    cy.url().should('equal', `${baseURL}/login`)

    cy.visit('/password-recovery')
  })
})

describe('Password Recovery: Success ✅', () => {
  before(() => {
    cy.visit('/password-recovery')

    cy.getCookie(AUTH_COOKIE_NAME).should('not.exist')
  })

  it('Send email', () => {
    cy.intercept('POST', '/api/auth/password/recovery/').as('send-email')

    const emailAddress = Cypress.env('emailAddress')
    cy.wrap(emailAddress).should('exist')
    cy.get('input[name="email"]').type(emailAddress)

    cy.get('button[type="submit"]').as('send-button')
    cy.get('@send-button').should('not.be.disabled')

    cy.get('@send-button').click()
    cy.wait('@send-email').then(({ response, request }) => {

      expect(response?.statusCode).to.eq(200)
      expect(request.body).to.deep.equal({
        request_type: 'reset',
        email: emailAddress
      })
    })

    cy.get('@send-button').should('be.disabled')

    cy.get('@send-button', { timeout: 35000 }).should('not.be.disabled')

    const inboxId = Cypress.env('inboxId')
    cy.getLastestEmail(inboxId).then((email) => {
      const code = extractValidationCodeFromEmail(email)

      cy.wrap(code).should('exist')
      Cypress.env('passwordRecoveryCode', code)
    })
  })

  it('Incorrect code ❌', () => {
    cy.intercept('POST', '/api/auth/password/recovery/check-token/').as('validate-token')

    const code = Cypress.env('passwordRecoveryCode')
    cy.wrap(code).should('exist')
    cy.visit(`/password-recovery/confirmation/${code.slice(0, code.length - 1)}`)

    cy.wait('@validate-token').its('response.statusCode').should('eq', 404)
    cy.get('.pi-exclamation-triangle').should('exist')
  })

  it('Correct code ✅', () => {
    cy.intercept('POST', '/api/auth/password/recovery/check-token/').as('validate-token')
    cy.intercept('POST', '/api/auth/password/recovery/confirm/').as('change-password')

    const code = Cypress.env('passwordRecoveryCode')
    cy.wrap(code).should('exist')
    cy.visit(`/password-recovery/confirmation/${code}`)

    cy.wait('@validate-token').its('response.statusCode').should('eq', 200)
    cy.get('.pi-check-circle').should('exist')

    cy.get('input[name="password"]').as('password-input').clear()
    cy.get('button[type="submit"]').as('submit-button')

    checkPasswordErrors({
      inputAlias: '@password-input',
      submitAlias: '@submit-button'
    })

    cy.get('@password-input').type(Cypress.env('AUTH_DEFAULT_PASSWORD'))
    cy.get('@submit-button').click()
    checkInputError({
      alias: '@password-input',
      error: false
    })

    cy.wait('@change-password').its('response.statusCode').should('eq', 200)
  })

  it('Test password', () => {
    const emailAddress = Cypress.env('emailAddress')
    cy.wrap(emailAddress).should('exist')

    cy.login(emailAddress)
  })
})