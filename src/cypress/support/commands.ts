/* eslint-disable @typescript-eslint/no-namespace */
/// <reference types="cypress" />
import { AUTH_BACKEND_EMAIL_ADDRESS, AUTH_COOKIE_NAME } from '@/constants/auth'
import type { MailSlurp, InboxDto, Email } from 'mailslurp-client'

type InboxType = {
  id: string
  emailAddress: string
}

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login with default user
       * @example
       * cy.login()
       */
      login(email?: string, password?: string)

      /**
       * Logout user
       * @example
       * cy.logout()
       */
      logout()

      /**
       * Create or retrieve a MailSlurp inbox.
       * - If it doesn't exist, it creates a new one and saves it in `cypress/fixtures/auth-user.json`.
       * - If it exists but is expired, it generates a new one.
       * - If it exists and is still valid, it reuses it.
       * @example
       * cy.createInbox()
       */
      createInbox(): Chainable<InboxType>

      /**
       * Get the latest email from the inbox.
       * @param {string} inboxId - The ID of the inbox to get the latest email from.
       * @returns {Chainable<Email>} - The latest email in the inbox.
       */
      getLastestEmail(inboxId: string): Chainable<Email>
    }
  }
}

const baseURL = Cypress.config().baseUrl

Cypress.Commands.add('login', (
  email: string = Cypress.expose('AUTH_DEFAULT_USER'),
  password: string = Cypress.expose('AUTH_DEFAULT_PASSWORD')
) => {
  cy.intercept('POST', '/api/auth/login').as('login')

  cy.visit('/login')

  cy.getCookie(AUTH_COOKIE_NAME).should('not.exist')

  cy.get('input[name="email"]').type(email)
  cy.get('input[name="password"]').type(password)
  cy.get('button[type="submit"]').click()

  cy.wait('@login').its('response.statusCode').should('eq', 200)

  cy.url().should('equal', `${baseURL}/`)

  cy.getCookie(AUTH_COOKIE_NAME).should('exist')
})

Cypress.Commands.add('logout', () => {
  cy.clearCookie(AUTH_COOKIE_NAME)

  cy.visit('/login')

  cy.url().reload()

  cy.getCookie(AUTH_COOKIE_NAME).should('not.exist')

  cy.url().should('equal', `${baseURL}/login`)
})

Cypress.Commands.add('createInbox', () => {
  const FILE_NAME = 'src/cypress/fixtures/auth-user.json'

  cy.readFile(FILE_NAME, { log: false })
    .then((data: InboxType) => {
      let newUser = false

      const createAndSaveInbox = () => {
        return cy.mailslurp()
          .then((ms: MailSlurp) => ms.createInbox())
          .then(inbox => {
            newUser = true

            const userData = { id: inbox.id!, emailAddress: inbox.emailAddress! }

            cy.writeFile(FILE_NAME, userData, { log: false })
            return cy.wrap<InboxType>(userData, { log: false })
          })
      }

      // 📌 Case 1: No inbox found -> create a new one
      if (!data || !data.id || !data.emailAddress) return createAndSaveInbox()

      // 📌 Case 2: Inbox already exists in auth-user.json
      return cy.mailslurp()
        .then((ms: MailSlurp) => Cypress.Promise
          .try(() => ms.getInbox(data.id))
          .catch((err: any) => {
            const errors = ['Error403Forbidden', 'Error404NotFound']

            if (errors.includes(err.errorClass)) {
              return createAndSaveInbox()
            }
          })
        )
        .then((inbox: InboxDto) => {
          if(!newUser) {
          // Check inbox expiration
            if (!inbox.expiresAt || (inbox.expiresAt && new Date(inbox.expiresAt) < new Date())) {
            // Expired -> create a new one
              return createAndSaveInbox()
            }
          }

          // Inbox still valid -> return the existing one
          return cy.wrap<InboxType>({
            id: inbox.id,
            emailAddress: inbox.emailAddress
          }, { log: false })
        })
    })
})

Cypress.Commands.add('getLastestEmail', (inboxId: string) => {
  return cy.then(() => {
    return cy
      .mailslurp()
      .then((ms: MailSlurp) => ms.waitForLatestEmail(inboxId, 60000, false))
      .then((email: Email) => {
        expect(email.sender?.emailAddress).to.equal(AUTH_BACKEND_EMAIL_ADDRESS)

        return email
      })
  })
})

