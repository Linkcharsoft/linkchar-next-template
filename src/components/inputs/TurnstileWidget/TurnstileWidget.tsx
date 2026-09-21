'use client'
import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { TURNSTILE_SITE_KEY } from '@/constants/env'

// Cloudflare Turnstile challenge. Renders nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set; the route verifies only when its secret is set too.
interface Props {
  /** Receives the token, or `null` when it expires or errors. Spread `turnstileProps` from useContactForm. */
  onToken: (token: string | null) => void
}

interface TurnstileRenderOptions {
  sitekey: string
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
}

interface TurnstileApiType {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string
  remove: (widgetId: string) => void
}

declare global {
  // `var` is the only declaration that lands on `typeof globalThis`, which is what the lint-preferred access reads.
  var turnstile: TurnstileApiType | undefined
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

const TurnstileWidget = ({ onToken }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    const turnstile = globalThis.turnstile
    if (!ready || !container || !turnstile || !TURNSTILE_SITE_KEY) return

    const widgetId = turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: onToken,
      'expired-callback': () => onToken(null),
      'error-callback': () => onToken(null)
    })

    return () => turnstile.remove(widgetId)
  }, [ready, onToken])

  if (!TURNSTILE_SITE_KEY) return null

  return (
    <>
      <Script src={SCRIPT_SRC} strategy='afterInteractive' onReady={() => setReady(true)}/>
      <div ref={containerRef} className='TurnstileWidget'/>
    </>
  )
}

export default TurnstileWidget
