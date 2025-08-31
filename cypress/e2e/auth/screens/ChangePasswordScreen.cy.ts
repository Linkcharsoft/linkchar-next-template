describe('Change Password', () => {
  before(() => {
    cy.login()

    cy.visit('/change-password')
  })

  it('Navigation 🔗: Go Back', () => {
    const baseURL = Cypress.config().baseUrl

    cy.get('button[type="button"]').click()

    cy.url().should('equal', `${baseURL}/`)

    cy.visit('/change-password')
  })

  after(() => {
    cy.logout()
  })
})