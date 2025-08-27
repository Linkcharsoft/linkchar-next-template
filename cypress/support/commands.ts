/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Create or retrieve a MailSlurp inbox.
     * - If it doesn't exist, it creates a new one and saves it in `cypress/fixtures/user.json`.
     * - If it exists but is expired, it generates a new one.
     * - If it exists and is still valid, it reuses it.
     * @example
     * cy.createInbox()
     */
    createInbox(): Chainable<{ id: string; email: string }>
  }
}

Cypress.Commands.add('createInbox', () => {
  const FILE_NAME = 'cypress/fixtures/user.json'

  return cy.readFile(FILE_NAME, { log: false, failOnNonExisting: false })
    .then((data) => {
      cy.log('Data: ',data)

      const createAndSaveInbox = () => {
        return cy.mailslurp({ apiKey: Cypress.env('MAILSLURP_API_KEY') })
          .then((ms: MailSlurp) => ms.createInbox())
          .then(inbox => {
            const userData = { id: inbox.id!, email: inbox.emailAddress! }

            cy.writeFile(FILE_NAME, userData, { log: false })
            return cy.wrap(userData, { log: false })
          })
      }

      // 📌 Case 1: No inbox found -> create a new one
      if (!data || !data.id || !data.email) return createAndSaveInbox()

      // 📌 Case 2: Inbox already exists in user.json
      return cy.mailslurp({ apiKey: Cypress.env('MAILSLURP_API_KEY') })
        .then((ms: MailSlurp) => Cypress.Promise
          .try(() => ms.getInbox(data.id))
          .catch((err: any) => {
            cy.log(err)
            const errors = ['Error403Forbidden', 'Error404NotFound']

            if (errors.includes(err.errorClass)) {
              return createAndSaveInbox()
            }
          })
        )
        .then(inbox => {

          cy.log(inbox)
          // Check inbox expiration
          if (inbox.expiresAt && new Date(inbox.expiresAt) < new Date()) {
            // Expired -> create a new one
            return createAndSaveInbox()
          }

          // Inbox still valid -> return the existing one
          return cy.wrap(data, { log: false })
        })
    })
})