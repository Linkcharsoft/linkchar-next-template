declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_DOMAIN: string
    NEXT_PUBLIC_API_URL: string;
    NEXT_PUBLIC_MEDIA_URL: string;

    NEXT_PUBLIC_CLARITY_ID: string;

    NEXT_PUBLIC_APP_ENV: 'development' | 'staging' | 'production';


    AUTH_SECRET: string;
    AUTH_DEFAULT_USER: string;
    AUTH_DEFAULT_PASSWORD: string;
    MAILSLURP_API_KEY: string;


    SENTRY_AUTH_TOKEN: string
    NEXT_PUBLIC_SENTRY_DSN: string
  }
}