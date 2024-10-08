# README Index

1. [Getting Started](#getting-started)
2. [General Information](#general-information)
   - [Template Functionalities](#template-functionalities)
   - [Libraries Included](#libraries-included)
3. [About the Template](#about-the-template)
4. [About NextAuth](#about-nextauth)
   - [NextAuth Configuration](#nextauth-configuration)
   - [NextAuth Providers](#nextauth-providers)
   - [NextAuth Callbacks](#nextauth-callbacks)
   - [NextAuth Session](#nextauth-session)
5. [Middleware](#middleware)
6. [Cypress E2E Testing](#cypress-e2e-testing)
   - [Project Structure](#project-structure)
   - [Additional Libraries](#additional-libraries)
   - [E2E Test Example](#e2e-test-example)
7. [Standard Date Format - dayjs](#standard-date-format---dayjs)
   - [Import and Configure the Plugin](#import-and-configure-the-plugin)
   - [Usage Examples](#usage-examples)
   - [Converting a Local Date to UTC](#converting-a-local-date-to-utc)
   - [Formatting UTC Dates](#formatting-utc-dates)

<hr>

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

## General information

This template includes the following functionalities:

- Login
- Signup
- Email validation
- Password recovery
- Complete profile
- Change password

And the next libraries:

- Next.js
- Tailwind CSS
- PrimeReact
- NextAuth
- Zustand
- @studio-freight/lenis
- formik
- framer-motion
- swr
- usehooks-ts
- dayjs

## About the template

This template is a Next.js template that includes a basic authentication system using NextAuth and Zustand. It also includes a custom hook called useParamsHandler that allows you to handle URL parameters in the URL. The template also includes a custom hook called usePressKey that allows you to handle keyboard events.
For auth functionalities, the template uses NextAuth, which is a popular authentication library for Next.js.

## About next-auth

NextAuth is a popular authentication library for Next.js. It provides a simple and easy-to-use API for handling authentication and authorization in your Next.js applications. With NextAuth, you can easily add authentication to your Next.js applications, including login, signup, password recovery, and more.

#### NextAuth configuration

The next-auth configuration file is located in the `src/pages/api/auth/[...nextauth].ts` file. This file contains the configuration for the authentication system, including the providers, callbacks, and other settings.

#### NextAuth providers

NextAuth supports various providers, including email, password, OAuth, and more. The providers are configured in the src/pages/api/auth/[...nextauth].ts file.
For this template, the providers are configured to use the credentials strategy, which allows users to sign in using their email and password. Additionally, this setup is combined with the JWT strategy to ensure token-based authentication, enabling secure and stateless session management for the users. The JWT tokens are issued and verified when users sign in using their credentials, allowing further API requests to be authenticated with these tokens.

#### NextAuth callbacks

NextAuth provides callbacks for various events, such as sign in, sign out, and error. The callbacks are configured in the `src/pages/api/auth/[...nextauth].ts` file.

#### NextAuth session

NextAuth provides a session object that contains information about the user's session, such as the user ID, access token, and refresh token. The session object is available in the `src/pages/api/auth/[...nextauth].ts` file.

## Middleware

This template includes a custom middleware function designed to manage access control based on user authentication status. The middleware retrieves the JWT token using NextAuth and determines whether users have access to public or private routes. Below is a summary of how the middleware works:

- Token Retrieval: The middleware attempts to retrieve the token using getToken from NextAuth.
- Public and Private Paths:
  - The template defines certain public paths (e.g., /login, /signup) that do not require authentication.
  - Static resources (e.g., images, fonts) are also publicly accessible.
- Redirection Logic:
  If an authenticated user tries to access public client paths like /login or /signup, they will be redirected to the home page (/).
  If no token is present and the user tries to access a private route, they will be redirected to the login page (/login).
- Profile Completion Check (optional): The middleware can be extended to check if a user's profile is complete and redirect them to a profile completion page if necessary.
  This middleware ensures that unauthenticated users are restricted from accessing private pages while authenticated users are seamlessly redirected to the appropriate sections of the application.

The middleware is located in the `src/middleware.ts` file and is responsible for handling authentication and authorization for different routes in the application.

## Cypress e2e testing
#### Project Structure
Your Cypress project follows this folder structure:
```textplain
cypress
├── e2e
│   └── **.cy.ts       // E2E test files in TypeScript format
├── fixtures
│   └── example.ts     // Static data for use in tests
└── support
    ├── commands.ts    // Custom Cypress commands
    └── e2e.ts         // Support configuration for E2E tests
```

#### Aditional Libraries
- cypress-dotenv to load environment variables from a .env file.
- cypress-file-upload to handle file uploads in tests, enabling the use of cy.upload().

#### e2e Text Example
```javascript
import 'cypress-file-upload'

describe('Profile Information Update', () => {
  before(function () {
    // Load data from fixture
    cy.fixture('example').then(function (data) {
      this.data = data
    })
  })

  it('logs in and updates profile information', function () {
    // Base URLs
    const baseUrl = Cypress.config('baseUrl')
    const profileUrl = `${baseUrl}/profile`

    // Dynamic variables for profile updates
    const firstName = 'TestFirst' + Math.floor(Math.random() * 1000)
    const lastName = 'TestLast' + Math.floor(Math.random() * 1000)
    const phone = '+12345' + Math.floor(Math.random() * 1000)
    
    // Intercept profile update request
    cy.intercept('PATCH', '/api/users/me').as('updateProfile')

    // Log in using custom command (requires setup in commands.ts)
    cy.login(this.data.email, this.data.password).then(() => {
      cy.url().should('eq', `${baseUrl}/dashboard`)
      cy.get('.ProfileButton').should('be.visible').click()
    })

    // Navigate to profile page
    cy.get('[href="/profile"]').click()
    cy.url().should('eq', profileUrl)

    // Update profile fields
    cy.get('#first_name').clear().type(firstName)
    cy.get('#last_name').clear().type(lastName)
    cy.get('#phone').clear().type(phone)

    // Submit changes
    cy.get('.saveButton').click()

    // Wait for profile update request
    cy.wait('@updateProfile').its('response.statusCode').should('eq', 200)

    // Reload page and verify updates
    cy.reload()
    cy.get('#first_name').should('have.value', firstName)
    cy.get('#last_name').should('have.value', lastName)
    cy.get('#phone').should('have.value', phone)
  })
})
```
Explanation of Key Sections
- Fixture Loading: Loads static data from a fixture file to make tests reusable.
- Dynamic Data Generation: Adds unique values for fields to simulate different data each test run.
- Interception: Captures network requests, allowing us to validate the response.
- Custom Commands: A cy.login() command (created in commands.ts) abstracts login steps, improving code readability.
- Assertions: Verifies that the profile page displays updated values after submission.

This test flow covers typical user actions like loading data, interacting with form fields, intercepting network requests, and verifying responses.



## Standard date format - dayjs

#### Import and Configure the Plugin
In the component or module where you need to work with UTC dates, import dayjs and the utc plugin, then extend dayjs with the plugin:
```javascript
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

// Extend dayjs with the UTC plugin
dayjs.extend(utc);
```

#### Usage Examples
```javascript
const currentUTCDate = dayjs().utc().format();
console.log(currentUTCDate); // Displays the current date and time in UTC (ISO format)
```

#### Converting a Local Date to UTC
If you have a local date and need to convert it to UTC, you can use this approach:
```javascript
const localDate = '2024-10-03T15:30:00'; // Local date
const utcDate = dayjs(localDate).utc().format();
console.log(utcDate); // Outputs the date in UTC
```

#### Formatting UTC Dates
To standardize the UTC date into a specific format, use the following code:
```javascript
const formattedUTCDate = dayjs().utc().format('YYYY-MM-DD HH:mm:ss');
console.log(formattedUTCDate); // For example: "2024-10-03 18:30:00"
```
For more information about dayjs, you can refer to the official documentation: https://day.js.org/docs/en/display/format