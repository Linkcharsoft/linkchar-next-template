describe('Navigation and Route Protection', () => {
  const baseUrl = Cypress.config('baseUrl')
  const protectedRoute = `${baseUrl}/`
  const loginRoute = `${baseUrl}/login`
  
  before(() => {
    // Load fixture data if needed, e.g., user credentials
    cy.fixture('userData').then(function (data) {
      this.data = data
    })
  })

  context('Unauthenticated user', () => {
    it('should redirect to login page when trying to access a protected route', function () {
      cy.visit(protectedRoute)
      cy.url().should('eq', loginRoute) // Assert redirection to login
    })
  })

  context('Authenticated user', () => {
    beforeEach(function () {
      // Log in using custom command and store session
      cy.login(this.data.email, this.data.password) // Make sure you have this command in commands.ts
    })

    it('should access protected route after login', () => {
      cy.visit(protectedRoute)
      cy.url().should('eq', protectedRoute) // Assert the user is on the protected route
      cy.contains('Powered by Linkchar') // Customize based on your dashboard content
    })

    it('should redirect to home when visiting login page as authenticated user', () => {
      cy.visit(loginRoute)
      cy.url().should('eq', `${baseUrl}/`) // Assert redirection to home page
    })
  })
})
