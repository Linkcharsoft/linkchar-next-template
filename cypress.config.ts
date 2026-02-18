import { defineConfig } from 'cypress'
import dotenv from 'dotenv'

// Load environment variables from the .env file
dotenv.config()

export default defineConfig({
  video: false,
  screenshotOnRunFailure: false,
  e2e: {
    specPattern: 'src/cypress/e2e/**/*.cy.{ts,tsx}',
    supportFile: 'src/cypress/support/e2e.{ts,tsx}',

    baseUrl: 'http://localhost:3000',
    viewportWidth: 1920,
    viewportHeight: 1080,

    defaultCommandTimeout: 15000,
    requestTimeout: 10000,
    pageLoadTimeout: 60000,

    testIsolation: false,
    // chromeWebSecurity: false,
    waitForAnimations: true,
    experimentalWebKitSupport: true // Enable WebKit support
  },
  fixturesFolder: 'src/cypress/fixtures',
  expose: {
    AUTH_DEFAULT_USER: process.env.AUTH_DEFAULT_USER,
    AUTH_DEFAULT_PASSWORD: process.env.AUTH_DEFAULT_PASSWORD
  },
  env: {
    MAILSLURP_API_KEY: process.env.MAILSLURP_API_KEY
  }
})
