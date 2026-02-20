import type { MetadataRoute } from 'next'

const sitemap = (): MetadataRoute.Sitemap => {
  const BASE_URL = process.env.NEXT_PUBLIC_DOMAIN

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1
    }
  ]
}

export default sitemap