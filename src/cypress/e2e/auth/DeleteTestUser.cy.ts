describe('Delete Test Users', () => {
  it('Delete Request', () => {
    const baseURL = Cypress.config().baseUrl

    cy.request({
      method: 'DELETE',
      url: `${baseURL}/api/auth/delete-test-users`
    }).then((response) => {
      expect(response.status).to.eq(200)
    })
  })
})