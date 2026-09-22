'use client'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { useEffect, useRef } from 'react'

// Refreshes the route on every Visual Editor edit so changes show live. Render it only while Draft Mode is on.
const BRIDGE_SRC = 'https://app.storyblok.com/f/storyblok-v2-latest.js'

interface StoryblokBridgeInstanceType {
  on: (events: string[], callback: () => void) => void
}

declare global {
  // `var` is the only declaration that lands on `typeof globalThis`, which is what the lint-preferred access reads.
  var StoryblokBridge: (new () => StoryblokBridgeInstanceType) | undefined
}

const StoryblokBridge = () => {
  const router = useRouter()
  const initialized = useRef(false)

  const initBridge = () => {
    if (initialized.current || !globalThis.StoryblokBridge) return

    initialized.current = true
    new globalThis.StoryblokBridge().on(['input', 'published', 'change'], () => router.refresh())
  }

  // The script may already be present when the component remounts on a client-side navigation.
  useEffect(() => {
    initBridge()
  })

  return <Script src={BRIDGE_SRC} strategy='afterInteractive' onLoad={initBridge}/>
}

export default StoryblokBridge
