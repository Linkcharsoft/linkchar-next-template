import type { StaticImageData } from 'next/image'

// An image that may come from the CMS (a remote a.storyblok.com URL, whose intrinsic size is parsed out of
// the filename) or from the bundled fallback content (a StaticImageData import).
export interface CmsImageType {
  image: string | StaticImageData
  alt: string
  width?: number
  height?: number
  objectPosition?: string
  /** Inlined base64 LQIP. Only the LCP photos carry one — it ships inside the HTML. */
  blurDataURL?: string
}

// A section's copy: kicker + title + lead, plus an optional trailing paragraph.
export interface HeadingType {
  kicker?: string
  title: string
  lead?: string
  note?: string
}

// A full-bleed photo with copy on top: page heros, photo banners.
export interface BannerType extends CmsImageType {
  kicker?: string
  title: string
  lead?: string
}

// A Storyblok richtext document, kept permissive so the domain model does not couple to the SDK's
// internal richtext type. Rendered with `StoryblokServerRichText` from '@storyblok/react/rsc'.
export interface RichTextDocumentType {
  type: string
  content?: unknown[]
  [key: string]: unknown
}

// Site-wide contact and footer data. The `config` story overrides it field by field.
export interface SiteConfigType {
  email: string
  phoneNumber: string
  phoneLabel: string
  whatsappNumber: string
  instagramUrl: string
  linkedinUrl: string
  addressLines: string[]
  footerDescription: string
  footerLegal: string
}
