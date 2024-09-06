/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  env: {
    API_URL: process.env.API_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    // MEDIA_URL: process.env.MEDIA_URL,
    // STRAPI_URL: process.env.STRAPI_URL,
    // STRAPI_MEDIA_URL: process.env.STRAPI_MEDIA_URL,
  }
  // images: {
  //   remotePatterns: [
  //     {
  //       protocol: 'https',
  //       hostname: new URL(process.env.MEDIA_URL).host,
  //       port: '',
  //       pathname: '/**',
  //     },
  //     {
  //       protocol: 'https',
  //       hostname: new URL(process.env.STRAPI_URL).host,
  //       port: '',
  //       pathname: '/**',
  //     },
  //     {
  //       protocol: 'https',
  //       hostname: new URL(process.env.STRAPI_MEDIA_URL).host,
  //       port: '',
  //       pathname: '/**',
  //     }
  //   ]
  // }
}

module.exports = nextConfig
