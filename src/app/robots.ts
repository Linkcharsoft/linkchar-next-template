import type { MetadataRoute } from 'next'

const robots = (): MetadataRoute.Robots => {
  const BASE_URL = process.env.NEXT_PUBLIC_DOMAIN

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard/']
    },
    sitemap: `${BASE_URL}/sitemap.xml`
  }
}

export default robots