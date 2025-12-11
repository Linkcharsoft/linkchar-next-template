import { AUTH_COOKIE_NAME, AUTH_EMAIL_SUBJECTS, AUTH_INPUT_ERRORS } from '../../../src/constants/auth'
import { checkInputError, checkPasswordErrors } from '../../support/helpers'

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

  it('Good password ', () => {
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

  it('Login', () => {
    const baseURL = Cypress.config().baseUrl

    cy.get('a[href="/login"]').click()

    cy.url().should('equal', `${baseURL}/login`)

    cy.visit('/signup')
  })
})

// describe('Sign Up: Success ✅', () => {
//   before(() => {
//     cy.visit('/signup')

//     cy.getCookie(AUTH_COOKIE_NAME).should('not.exist')

//     cy.createInbox().then(({ id, emailAddress }) => {
//       cy.wrap(id).as('inbox-id')
//       cy.wrap(emailAddress).as('email-address')
//     })
//   })

//   beforeEach(() => {
//     cy.get('input[name="email"]').as('email-input').clear()
//     cy.get('input[name="password"]').as('password-input').clear()
//     cy.get('button[type="submit"]').as('submit-button')
//   })

//   it('Email and Password', () => {
//     cy.intercept('POST', '/api/auth/registration').as('registration')

//     cy.get('@email-address').then((email) => {
//       cy.get('@email-input').type(email as string)
//     })
//     cy.get('@password-input').type(Cypress.env('AUTH_DEFAULT_PASSWORD'))

//     cy.get('@submit-button').click()

//     cy.wait('@registration').its('response.statusCode').should('eq', 201)

//     // Check email validation
//   })

//   it('Resend email validation', () => {

//   })
// })