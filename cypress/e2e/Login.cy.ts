describe('Login and logout', () => {
  it('Login, check token, and logout', function () {
    const email = Cypress.env('ADMIN_EMAIL') || 'admin@admin.com'
    const password = Cypress.env('ADMIN_PASSWORD') || 'Usuario12.'
    const homeUrl = `${Cypress.env('BASE_URL') || 'http://localhost:3000'}`
    const loginUrl = `${Cypress.env('BASE_URL') || 'http://localhost:3000'}/login`

    // Login
    cy.login(email, password).then(() => {
      cy.wait(2000)

      // Verificación de la URL
      cy.url({ timeout: 30000 }).should('eq', `${homeUrl}/success-login`)
      // Verify if the token is stored in cookies
      cy.getCookie('next-auth.session-token').should('exist')
      cy.get('pre').contains('admin@admin.com').should('be.visible')
      
      // Logout
      cy.get('button').contains('Cerrar Sesión').should('be.visible').click()

      cy.wait(2000)

      // Check if the token is removed from cookies
      cy.getCookie('next-auth.session-token').should('not.exist')

      // Verify if the user is redirected to the login page
      cy.url({ timeout: 30000 }).should('eq', loginUrl)
    })
  })
})
