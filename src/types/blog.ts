import type { RichTextDocumentType } from '@/types/cms'

// Domain model for a blog article, decoupled from Storyblok's raw story shape. The mapping lives in src/api/blog.ts.
export interface BlogPostType {
  slug: string
  title: string
  excerpt: string
  coverUrl: string
  coverAlt: string
  author: string
  category: string
  /** ISO date (Storyblok's first_published_at). Format at render time. */
  publishedAt: string
  /** ISO date (Storyblok's published_at, moves on every republish). The sitemap's lastmod. */
  updatedAt: string
  body: RichTextDocumentType | null
}

// Listing cards carry no body.
export type BlogPostSummaryType = Omit<BlogPostType, 'body'>
