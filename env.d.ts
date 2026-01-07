declare namespace NodeJS {
  interface ProcessEnv {
    API_URL: string;
    MEDIA_URL: string;

    CLARITY_ID: string;

    IS_PRODUCTION: string;


    AUTH_SECRET: string;
    AUTH_DEFAULT_USER: string;
    AUTH_DEFAULT_PASSWORD: string;
    MAILSLURP_API_KEY: string;
  }
}