import checkPasswordErrors from '../../utils/checkPasswordErrors'
import extractValidationCodeFromEmail from '../../utils/extractValidationCodeFromEmail'

const baseURL = Cypress.config().baseUrl

describe('Change Password: Navigation 🔗', () => {
  before(() => {
    cy.login()

    cy.visit('/change-password')
  })

  it('Redirects', () => {
    cy.visit('/change-password/confirmation')
    cy.url().should('equal', `${baseURL}/`)

    cy.visit('/change-password/confirmation/')
    cy.url().should('equal', `${baseURL}/`)
  })

  it('Go Back', () => {
    cy.get('button[type="button"]').click()

    cy.url().should('equal', `${baseURL}/`)

    cy.visit('/change-password')
  })
})

describe('Change Password: Success ✅', () => {
  before(() => {
    const emailAddress = Cypress.env('emailAddress')
    cy.wrap(emailAddress).should('exist')

    cy.login(Cypress.env('emailAddress'))

    cy.visit('/change-password')
  })

  it('Send email', () => {
    cy.intercept('POST', '/api/auth/password/recovery/').as('send-email')

    cy.get('button[type="submit"]').as('send-button')
    cy.get('@send-button').should('not.be.disabled')

    cy.get('@send-button').click()
    cy.wait('@send-email').then(({ response, request }) => {
      const emailAddress = Cypress.env('emailAddress')
      cy.wrap(emailAddress).should('exist')

      expect(response?.statusCode).to.eq(200)
      expect(request.body).to.deep.equal({
        request_type: 'change',
        email: emailAddress
      })
    })

    cy.get('@send-button').should('be.disabled')

    cy.get('@send-button', { timeout: 35000 }).should('not.be.disabled')

    const inboxId = Cypress.env('inboxId')
    cy.getLastestEmail(inboxId).then((email) => {
      const code = extractValidationCodeFromEmail(email)

      cy.wrap(code).should('exist')
      Cypress.env('changePasswordCode', code)
    })
  })

  it('Incorrect code ❌', () => {
    cy.intercept('POST', '/api/auth/password/recovery/check-token/').as('validate-token')

    const code = Cypress.env('changePasswordCode')
    cy.wrap(code).should('exist')
    cy.visit(`/change-password/confirmation/${code.slice(0, code.length - 1)}`)

    cy.wait('@validate-token').its('response.statusCode').should('eq', 404)
    cy.get('.pi-exclamation-triangle').should('exist')

    const emailAddress = Cypress.env('emailAddress')
    cy.get('input[name="email"]').type(emailAddress)

    cy.get('button[type="submit"]').as('resend-button')
    cy.get('@resend-button').should('not.be.disabled')
    cy.get('@resend-button').click()

    cy.wait('@resend-email').its('response.statusCode').should('eq', 200)

    cy.get('@resend-button').should('be.disabled')

    cy.get('@resend-button', { timeout: 35000 }).should('not.be.disabled')

    const inboxId = Cypress.env('inboxId')
    cy.getLastestEmail(inboxId).then((email) => {
      const code = extractValidationCodeFromEmail(email)

      cy.wrap(code).should('exist')
      Cypress.env('emailValidationCode', code)
    })
  })

  it('Correct code ✅', () => {
    cy.intercept('POST', '/api/auth/password/recovery/check-token/').as('validate-token')
    cy.intercept('POST', '/api/auth/password/recovery/confirm/').as('change-password')

    const code = Cypress.env('changePasswordCode')
    cy.wrap(code).should('exist')
    cy.visit(`/change-password/confirmation/${code}`)

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
    cy.logout()

    const emailAddress = Cypress.env('emailAddress')
    cy.wrap(emailAddress).should('exist')

    cy.login(Cypress.env('emailAddress'))
  })
})