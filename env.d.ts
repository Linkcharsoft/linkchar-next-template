declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_DOMAIN: string
    NEXT_PUBLIC_API_URL: string;
    NEXT_PUBLIC_MEDIA_URL: string;

    NEXT_PUBLIC_CLARITY_ID: string;

    NEXT_PUBLIC_IS_PRODUCTION: string;


    AUTH_SECRET: string;
    AUTH_DEFAULT_USER: string;
    AUTH_DEFAULT_PASSWORD: string;
    MAILSLURP_API_KEY: string;


    SENTRY_DSN: string
  }
}