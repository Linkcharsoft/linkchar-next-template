import { DOMAIN } from '@/constants/env'
import type { MetadataRoute } from 'next'

// Uncomment when wiring up dynamic entries (DB/API-sourced URLs) so the sitemap
// reflects content changes. While all entries are static, leave it commented —
// otherwise every sitemap request rebuilds for nothing.
// export const dynamic = 'force-dynamic'

const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${DOMAIN}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1
    }
  ]

  // Pattern for dynamic entries (products, posts, etc.) — uncomment when an API exists:
  //
  // import { getPublicItems } from '@/api/items'
  // const res = await getPublicItems('page_size=500&ordering=-updated_at')
  // const dynamicEntries = res.ok
  //   ? res.data.data.map(item => ({
  //       url: `${DOMAIN}/items/${item.id}`,
  //       lastModified: new Date(item.updatedAt),
  //       changeFrequency: 'weekly' as const,
  //       priority: 0.8
  //     }))
  //   : []

  return [
    ...staticEntries
    // ...dynamicEntries
  ]
}

export default sitemap