import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import { STORYBLOK_TOKEN } from '@/constants/env'
import type { Route } from 'next'
import type { NextRequest } from 'next/server'

// Enables Next.js Draft Mode for the Storyblok Visual Editor, then redirects to the story being edited.
// Story slug (or folder prefix, with its trailing slash) → route. Anything unmapped opens the landing.
const STORY_ROUTES: Record<string, string> = {
  config: '/',
  home: '/'
}

const resolveTarget = (slug: string): string => {
  const exact = STORY_ROUTES[slug]
  if (exact) return exact

  const folder = Object.keys(STORY_ROUTES).find((key) => key.endsWith('/') && slug.startsWith(key))
  if (folder) return `${STORY_ROUTES[folder]}/${slug.slice(folder.length)}`

  return '/'
}

export async function GET (request: NextRequest) {
  const { searchParams } = request.nextUrl

  // Light guard: only enable draft for a request carrying the space token.
  const token = searchParams.get('token')
  const slug = searchParams.get('slug')?.replace(/\/$/, '') ?? ''

  if (!STORYBLOK_TOKEN || token !== STORYBLOK_TOKEN) {
    return new Response('Invalid token', { status: 401 })
  }

  const draft = await draftMode()
  draft.enable()

  redirect(resolveTarget(slug) as Route)
}
