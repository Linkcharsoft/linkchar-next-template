import 'cypress-mailslurp'
import './commands'

Cypress.on('uncaught:exception', (err) => {
  // Swallow React hydration errors Cypress mis-reports — see cypress-io/cypress#27204
  if (
    /hydrat/i.test(err.message) ||
    /Minified React error #418/.test(err.message) ||
    /Minified React error #423/.test(err.message)
  ) {
    return false
  }
})