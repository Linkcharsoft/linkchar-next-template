import { DOMAIN } from '@/constants/env'
import type { MetadataRoute } from 'next'

const robots = (): MetadataRoute.Robots => {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Auth flows and dashboards shouldn't appear in search results.
      disallow: [
        '/api',
        '/dashboard',
        '/login',
        '/signup',
        '/password-recovery',
        '/change-password'
      ]
    },
    sitemap: `${DOMAIN}/sitemap.xml`
  }
}

export default robots