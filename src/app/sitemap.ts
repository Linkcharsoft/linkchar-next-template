import type { MetadataRoute } from 'next'

const sitemap = (): MetadataRoute.Sitemap => {
  const BASE_URL = process.env.NEXT_PUBLIC_DOMAIN

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1
    }, {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5
    }, {
      url: `${BASE_URL}/signup`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5
    }, {
      url: `${BASE_URL}/password-recovery`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5
    }
  ]
}

export default sitemap