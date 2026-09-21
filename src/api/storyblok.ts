import { apiPlugin, storyblokInit } from '@storyblok/react/rsc'
import { APP_ENV, STORYBLOK_REGION, STORYBLOK_TOKEN } from '@/constants/env'
import { captureError } from '@/utils/captureError'
import type { ISbStoryData } from '@storyblok/react/rsc'

// Lazy: storyblokInit warns on every worker when the token is missing, so a token-less build stays quiet.
let storyblokApi: ReturnType<typeof storyblokInit> | undefined

const getStoryblokApi = () => {
  storyblokApi ??= storyblokInit({
    accessToken: STORYBLOK_TOKEN,
    use: [apiPlugin],
    apiOptions: {
      region: STORYBLOK_REGION
    }
  })

  return storyblokApi()
}

// Uses Draft Mode's cookie, not searchParams — reading searchParams would opt every page out of static rendering.
export const isPreview = async (): Promise<boolean> => {
  const { draftMode } = await import('next/headers')
  const draft = await draftMode()
  return draft.isEnabled
}

// Draft outside production so unpublished edits show in dev and in the Visual Editor.
const resolveVersion = (preview: boolean): 'draft' | 'published' =>
  preview || APP_ENV !== 'production' ? 'draft' : 'published'

// Cache-busts the Storyblok fetch: Amplify restores .next/cache between builds, so without this a publish never reaches the site.
const BUILD_CV = Date.now()

// Storyblok's per_page default is 25 and getAll() inherits it; without this a listing silently drops the 26th story onward.
const PER_PAGE = 100

// storyblok-js-client rejects with a plain object `{ message, status, response }`, not an Error instance.
const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { status?: number }).status === 404

// Singleton stories (a page's copy, the site config). Errors are swallowed: every caller in src/api/cms.ts falls back to src/constants/content.
export const getStoryContent = async <T>(slug: string, preview = false): Promise<T | null> => {
  if (!STORYBLOK_TOKEN) return null

  try {
    const { data } = await getStoryblokApi().get(`cdn/stories/${slug}`, { version: resolveVersion(preview), cv: BUILD_CV })
    return (data.story as ISbStoryData<T> | undefined)?.content ?? null
  } catch (error) {
    captureError(`storyblok-${slug}`, error, 'warning')
    return null
  }
}

// A collection under a folder (blog posts, cases). Throws on anything but "no token": the pages are prerendered, so a swallowed error would bake an empty listing into static HTML.
export const getStories = async <T>(folder: string, preview = false): Promise<ISbStoryData<T>[]> => {
  if (!STORYBLOK_TOKEN) return []

  return await getStoryblokApi().getAll('cdn/stories', {
    version: resolveVersion(preview),
    starts_with: `${folder}/`,
    is_startpage: false,
    sort_by: 'first_published_at:desc',
    per_page: PER_PAGE,
    cv: BUILD_CV
  }) as ISbStoryData<T>[]
}

// One story of a collection by its full slug ('blog/my-post'). Only a genuine 404 means "no such story"; anything else throws for the same reason as above.
export const getStory = async <T>(fullSlug: string, preview = false): Promise<ISbStoryData<T> | null> => {
  if (!STORYBLOK_TOKEN) return null

  try {
    const { data } = await getStoryblokApi().get(`cdn/stories/${fullSlug}`, { version: resolveVersion(preview), cv: BUILD_CV })
    return (data.story as ISbStoryData<T> | undefined) ?? null
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}
