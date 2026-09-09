import fs from 'node:fs'
import { defineConfig } from 'cypress'
import dotenv from 'dotenv'

// Same precedence as Next.js: .env.local wins over .env
dotenv.config({ path: ['.env.local', '.env'] })

export default defineConfig({
  video: false,
  screenshotOnRunFailure: false,
  e2e: {
    specPattern: 'src/cypress/e2e/**/*.cy.{ts,tsx}',
    supportFile: 'src/cypress/support/e2e.{ts,tsx}',

    baseUrl: 'http://localhost:3000',
    viewportWidth: 1920,
    viewportHeight: 1080,

    defaultCommandTimeout: 15_000,
    requestTimeout: 10_000,
    pageLoadTimeout: 60_000,

    testIsolation: false,
    // chromeWebSecurity: false,
    waitForAnimations: true,
    experimentalWebKitSupport: true, // Enable WebKit support

    setupNodeEvents (on) {
      on('task', {
        // cy.readFile fails on a missing file; the gitignored MailSlurp fixture is legitimately absent on a fresh clone.
        readFileMaybe (path: string) {
          return fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : null
        }
      })
    }
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
