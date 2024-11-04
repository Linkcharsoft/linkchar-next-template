import { defineConfig } from 'cypress'
import dotenv from 'dotenv'

// Load environment variables from the .env file
dotenv.config()

export default defineConfig({
  video: false,
  screenshotOnRunFailure: false,
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1920,
    viewportHeight: 1080,
    defaultCommandTimeout: 15000,
    requestTimeout: 10000,
    pageLoadTimeout: 60000,
    testIsolation: false,
    chromeWebSecurity: false,
    waitForAnimations: true,
    experimentalStudio: true, // Enable Cypress Studio for recording
    experimentalWebKitSupport: true, // Enable WebKit support
    env: {
      API_URL: process.env.API_URL
    },
  }
})
