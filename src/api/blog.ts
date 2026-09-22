import { getStories, getStory } from '@/api/storyblok'
import type { BlogPostSummaryType, BlogPostType } from '@/types/blog'
import type { RichTextDocumentType } from '@/types/cms'
import type { ISbStoryData } from '@storyblok/react/rsc'

// Reference collection: stories under a Storyblok folder, exposed with bare slugs. Ships UNMOUNTED — no page imports it
// until the init-storyblok agent scaffolds the listing and detail routes.

const BLOG_FOLDER = 'blog'
const DEFAULT_AUTHOR = 'Editorial team'

// Shape of the `blog_post` content type defined in Storyblok.
interface BlogPostContentType {
  title?: string
  excerpt?: string
  author?: string
  category?: string
  cover?: { filename?: string, alt?: string }
  body?: RichTextDocumentType
}

// Storyblok returns the folder-prefixed full_slug ('blog/my-post'); the routes see the bare slug ('my-post').
const bareSlug = (fullSlug: string): string => fullSlug.replace(new RegExp(`^${BLOG_FOLDER}/`), '').replace(/\/$/, '')

const mapStory = (story: ISbStoryData<BlogPostContentType>): BlogPostType => {
  const content = story.content
  return {
    slug: bareSlug(story.full_slug),
    title: content.title || story.name,
    excerpt: content.excerpt || '',
    coverUrl: content.cover?.filename || '',
    coverAlt: content.cover?.alt || content.title || story.name,
    author: content.author || DEFAULT_AUTHOR,
    category: content.category || '',
    publishedAt: story.first_published_at || story.published_at || story.created_at,
    updatedAt: story.published_at || story.first_published_at || story.created_at,
    body: content.body ?? null
  }
}

const toSummary = (post: BlogPostType): BlogPostSummaryType => ({
  slug: post.slug,
  title: post.title,
  excerpt: post.excerpt,
  coverUrl: post.coverUrl,
  coverAlt: post.coverAlt,
  author: post.author,
  category: post.category,
  publishedAt: post.publishedAt,
  updatedAt: post.updatedAt
})

export const getBlogPosts = async (preview = false): Promise<BlogPostSummaryType[]> => {
  const stories = await getStories<BlogPostContentType>(BLOG_FOLDER, preview)
  return stories.map((story) => toSummary(mapStory(story)))
}

export const getBlogPost = async (slug: string, preview = false): Promise<BlogPostType | null> => {
  const story = await getStory<BlogPostContentType>(`${BLOG_FOLDER}/${slug}`, preview)
  return story ? mapStory(story) : null
}

// Derived from the listing rather than cdn/links so the prerendered set and the listing can never diverge.
export const getBlogSlugs = async (): Promise<string[]> => {
  const posts = await getBlogPosts()
  return posts.map((post) => post.slug)
}
