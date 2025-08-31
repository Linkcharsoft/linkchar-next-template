/// <reference types="cypress" />
import { MailSlurp, InboxDto } from 'mailslurp-client'

type InboxType = {
  id: string
  emailAddress: string
}

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Create or retrieve a MailSlurp inbox.
       * - If it doesn't exist, it creates a new one and saves it in `cypress/fixtures/user.json`.
       * - If it exists but is expired, it generates a new one.
       * - If it exists and is still valid, it reuses it.
       * @example
       * cy.createInbox()
       */
      createInbox(): Chainable<InboxType>

      /**
       * Login with default user
       * @example
       * cy.login()
       */
      login()
    }
  }
}

Cypress.Commands.add('createInbox', () => {
  const FILE_NAME = 'cypress/fixtures/user.json'

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

      // 📌 Case 2: Inbox already exists in user.json
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

Cypress.Commands.add('login', () => {
  cy.visit('/login')

  cy.getCookie(AUTH_COOKIE_NAME).should('not.exist')

  cy.get('input[name="email"]').type(Cypress.env('AUTH_DEFAULT_USER'))
  cy.get('input[name="password"]').type(Cypress.env('AUTH_DEFAULT_PASSWORD'))
  cy.get('button[type="submit"]').click()

  const baseURL = Cypress.config().baseUrl
  cy.url().should('equal', `${baseURL}/`)

  cy.getCookie(AUTH_COOKIE_NAME).should('exist')
})




