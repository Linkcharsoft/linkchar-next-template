import { defineConfig } from 'cypress'
import dotenv from 'dotenv'

// Load environment variables from the .env file
dotenv.config()

export default defineConfig({
  video: false,
  screenshotOnRunFailure: false,
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1536,
    viewportHeight: 678,
    defaultCommandTimeout: 20000,
    pageLoadTimeout: 60000,    

    env: {
      API_URL: process.env.API_URL
    },

    // setupNodeEvents(on, config) {
    //   // Implement node event listeners here, if needed
    // },
    experimentalStudio: true // Enable Cypress Studio for recording
  }
})

