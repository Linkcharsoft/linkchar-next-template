import { DOMAIN } from '@/constants/env'
import type { MetadataRoute } from 'next'

const sitemap = (): MetadataRoute.Sitemap => {
  return [
    {
      url: DOMAIN,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1
    }, {
      url: `${DOMAIN}/login`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5
    }, {
      url: `${DOMAIN}/signup`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5
    }, {
      url: `${DOMAIN}/password-recovery`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5
    }
  ]
}

export default sitemap