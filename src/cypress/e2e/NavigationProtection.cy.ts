import { AUTHENTICATED_HOME_PATH, LISTENER_COOKIE_NAME, SESSION_COOKIE_NAME } from '@/constants/auth'

const baseURL = Cypress.config().baseUrl

describe('Navigation Protection: Unauthenticated 🔒', () => {
  before(() => {
    cy.clearCookies()
  })

  it('Protected route redirects to login', () => {
    cy.visit('/dashboard', { failOnStatusCode: false })

    cy.url().should('equal', `${baseURL}/login`)
    cy.getCookie(SESSION_COOKIE_NAME).should('not.exist')
    cy.getCookie(LISTENER_COOKIE_NAME).should('not.exist')
  })

  it('Public root path loads without redirect', () => {
    cy.visit('/')

    cy.url().should('equal', `${baseURL}/`)
  })
})

describe('Navigation Protection: Authenticated 🔐', () => {
  before(() => {
    cy.login()
  })

  it('Login auth path redirects to home', () => {
    cy.visit('/login')

    cy.url().should('equal', `${baseURL}${AUTHENTICATED_HOME_PATH}`)
  })

  it('Signup auth path redirects to home', () => {
    cy.visit('/signup')

    cy.url().should('equal', `${baseURL}${AUTHENTICATED_HOME_PATH}`)
  })

  it('Password recovery auth path redirects to home', () => {
    cy.visit('/password-recovery')

    cy.url().should('equal', `${baseURL}${AUTHENTICATED_HOME_PATH}`)
  })

  after(() => {
    cy.logout()
  })
})

describe('Navigation Protection: Corrupt Cookies 🧹', () => {
  beforeEach(() => {
    cy.clearCookies()
  })

  it('Orphan listener cookie redirects and purges', () => {
    cy.setCookie(LISTENER_COOKIE_NAME, Date.now().toString())

    cy.visit('/dashboard', { failOnStatusCode: false })

    cy.url().should('equal', `${baseURL}/login`)
    cy.getCookie(SESSION_COOKIE_NAME).should('not.exist')
    cy.getCookie(LISTENER_COOKIE_NAME).should('not.exist')
  })

  it('Orphan session cookie redirects and purges', () => {
    cy.setCookie(SESSION_COOKIE_NAME, 'not-a-real-encrypted-payload')

    cy.visit('/dashboard', { failOnStatusCode: false })

    cy.url().should('equal', `${baseURL}/login`)
    cy.getCookie(SESSION_COOKIE_NAME).should('not.exist')
    cy.getCookie(LISTENER_COOKIE_NAME).should('not.exist')
  })

  it('Corrupt session value with valid pair redirects and purges', () => {
    cy.setCookie(SESSION_COOKIE_NAME, 'not-a-real-encrypted-payload')
    cy.setCookie(LISTENER_COOKIE_NAME, Date.now().toString())

    cy.visit('/dashboard', { failOnStatusCode: false })

    cy.url().should('equal', `${baseURL}/login`)
    cy.getCookie(SESSION_COOKIE_NAME).should('not.exist')
    cy.getCookie(LISTENER_COOKIE_NAME).should('not.exist')
  })
})
