import { DOMAIN } from '@/constants/env'
import type { MetadataRoute } from 'next'

const robots = (): MetadataRoute.Robots => {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard']
    },
    sitemap: `${DOMAIN}/sitemap.xml`
  }
}

export default robots