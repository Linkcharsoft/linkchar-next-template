import type { CmsImageType } from '@/types/cms'

export interface StoryblokAssetType {
  filename?: string
  alt?: string
  title?: string
}

// Storyblok encodes intrinsic size in the asset path (…/f/<space>/1200x800/<hash>/photo.jpg); next/image needs it.
const ASSET_DIMENSIONS = /\/(\d+)x(\d+)\//

export const mapAsset = (asset: StoryblokAssetType | undefined, fallbackAlt = ''): CmsImageType | undefined => {
  if (!asset?.filename) return undefined

  const dimensions = ASSET_DIMENSIONS.exec(asset.filename)

  return {
    // Storyblok can hand back a protocol-relative URL; next/image needs an absolute one.
    image: asset.filename.startsWith('//') ? `https:${asset.filename}` : asset.filename,
    alt: asset.alt || asset.title || fallbackAlt,
    width: dimensions ? Number(dimensions[1]) : undefined,
    height: dimensions ? Number(dimensions[2]) : undefined
  }
}

// A story field is only allowed to override its fallback when the editor actually filled it in.
export const orFallback = <T>(value: T | undefined | null, fallback: T): T => {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'string' && value.trim() === '') return fallback
  if (Array.isArray(value) && value.length === 0) return fallback
  return value
}

// Single-blok fields (schema `maximum: 1`) still arrive as an array.
export const first = <T>(bloks: T[] | undefined): T | undefined => bloks?.[0]

// Textareas that take one item per line.
export const lines = (value: string | undefined): string[] | undefined =>
  value?.split('\n').map((line) => line.trim()).filter(Boolean)

// Storyblok's image service renders a ~120 byte thumbnail; base64 it becomes the LQIP next/image needs as a Data URL.
// Reserve it for LCP photos: every one of these rides in the blocking HTML.
const BLUR_TRANSFORM = '/m/20x0/filters:blur(4):quality(35)'

export const withBlur = async <T extends CmsImageType>(photo: T): Promise<T> => {
  if (typeof photo.image !== 'string' || !photo.image.includes('a.storyblok.com')) return photo

  try {
    const response = await fetch(`${photo.image}${BLUR_TRANSFORM}`, { cache: 'force-cache' })
    if (!response.ok) return photo

    const body = Buffer.from(await response.arrayBuffer())
    const type = response.headers.get('content-type') || 'image/webp'
    return { ...photo, blurDataURL: `data:${type};base64,${body.toString('base64')}` }
  } catch {
    return photo
  }
}
