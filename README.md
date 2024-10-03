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

### Middleware

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

### Standar date format - dayjs

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