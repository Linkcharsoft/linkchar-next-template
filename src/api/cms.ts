import { cache } from 'react'
import { getStoryContent } from '@/api/storyblok'
import { SITE_CONFIG_FALLBACK } from '@/constants/content/siteConfig'
import { first, lines, mapAsset, orFallback } from '@/utils/storyblok'
import type { BannerType, CmsImageType, HeadingType, SiteConfigType } from '@/types/cms'
import type { StoryblokAssetType } from '@/utils/storyblok'

// Story → domain mapping. Screens receive these domain objects as props from their page.tsx and never import Storyblok.
// Every getter falls back to src/constants/content, so the site renders in full with no STORYBLOK_TOKEN.

interface BlokType {
  _uid?: string
}

export interface PhotoBlokType extends BlokType {
  image?: StoryblokAssetType
  alt?: string
  object_position?: string
}

export interface HeadingBlokType extends BlokType {
  kicker?: string
  title?: string
  lead?: string
  note?: string
}

export interface BannerBlokType extends PhotoBlokType {
  kicker?: string
  title?: string
  lead?: string
}

export const mapText = (value: string | undefined, fallback: string): string => orFallback(value, fallback)

export const mapPhoto = (blok: PhotoBlokType | undefined): CmsImageType | undefined => {
  const asset = mapAsset(blok?.image, blok?.alt)
  if (!blok || !asset) return undefined

  return { ...asset, alt: blok.alt || asset.alt, objectPosition: blok.object_position || undefined }
}

export const mapPhotos = (bloks: PhotoBlokType[] | undefined, fallback: CmsImageType[]): CmsImageType[] =>
  orFallback((bloks ?? []).flatMap((blok) => {
    const photo = mapPhoto(blok)
    return photo ? [photo] : []
  }), fallback)

export const mapImage = (bloks: PhotoBlokType[] | undefined, fallback: CmsImageType): CmsImageType =>
  mapPhoto(first(bloks)) ?? fallback

export const mapHeading = (bloks: HeadingBlokType[] | undefined, fallback: HeadingType): HeadingType => {
  const blok = first(bloks)
  return {
    kicker: orFallback(blok?.kicker, fallback.kicker),
    title: orFallback(blok?.title, fallback.title),
    lead: orFallback(blok?.lead, fallback.lead),
    note: orFallback(blok?.note, fallback.note)
  }
}

// A replaced photo keeps the fallback crop hint: it is a mild framing default, not tied to the file.
export const mapBanner = (bloks: BannerBlokType[] | undefined, fallback: BannerType): BannerType => {
  const blok = first(bloks)
  const photo = mapPhoto(blok) ?? fallback

  return {
    image: photo.image,
    alt: photo.alt,
    width: photo.width,
    height: photo.height,
    objectPosition: photo.objectPosition ?? fallback.objectPosition,
    kicker: orFallback(blok?.kicker, fallback.kicker),
    title: orFallback(blok?.title, fallback.title),
    lead: orFallback(blok?.lead, fallback.lead)
  }
}

interface ConfigStoryType {
  email?: string
  phone_number?: string
  phone_label?: string
  whatsapp_number?: string
  instagram_url?: string
  linkedin_url?: string
  address_lines?: string
  footer_description?: string
  footer_legal?: string
}

// Reference getter: one singleton story, field-by-field fallback. Every page getter follows this shape.
export const getSiteConfig = cache(async (preview = false): Promise<SiteConfigType> => {
  const content = await getStoryContent<ConfigStoryType>('config', preview)
  if (!content) return SITE_CONFIG_FALLBACK

  const fallback = SITE_CONFIG_FALLBACK

  return {
    email: mapText(content.email, fallback.email),
    phoneNumber: mapText(content.phone_number, fallback.phoneNumber),
    phoneLabel: mapText(content.phone_label, fallback.phoneLabel),
    whatsappNumber: mapText(content.whatsapp_number, fallback.whatsappNumber),
    instagramUrl: mapText(content.instagram_url, fallback.instagramUrl),
    linkedinUrl: mapText(content.linkedin_url, fallback.linkedinUrl),
    addressLines: orFallback(lines(content.address_lines), fallback.addressLines),
    footerDescription: mapText(content.footer_description, fallback.footerDescription),
    footerLegal: mapText(content.footer_legal, fallback.footerLegal)
  }
})
