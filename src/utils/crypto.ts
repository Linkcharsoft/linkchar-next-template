import { cookies } from 'next/headers'
import 'server-only'
import { SESSION_COOKIE_NAME } from '@/constants/auth'
import { AUTH_SECRET } from '@/constants/env'
import type { SessionType } from '@/types/auth'

const CRYPTO_ERRORS = {
  'miss-secret': 'Missing encryption secret (AUTH_SECRET)',
  'invalid-secret': 'Encryption secret (AUTH_SECRET) must be 32 characters long',
  'encrypt-failed': 'Failed to encrypt session',
  'decrypt-failed': 'Failed to decrypt session'
}

if (!AUTH_SECRET) throw new Error(CRYPTO_ERRORS['miss-secret'])
if (AUTH_SECRET.length !== 32) throw new Error(CRYPTO_ERRORS['invalid-secret'])

const ENCRYPTION_KEY = crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(AUTH_SECRET),
  'AES-GCM',
  true,
  ['encrypt', 'decrypt']
)

const IV_LENGTH = 12

export async function encryptSession (data: object): Promise<string> {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const key = await ENCRYPTION_KEY

    const encoded = new TextEncoder().encode(JSON.stringify(data))

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    )

    const result = new Uint8Array([...iv, ...new Uint8Array(encrypted)])
    return Buffer.from(result).toString('base64')
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : CRYPTO_ERRORS['encrypt-failed'])
  }
}

export async function decryptSession (session: string): Promise<SessionType | null> {
  try {
    const key = await ENCRYPTION_KEY

    const raw = Buffer.from(session, 'base64')
    const iv = raw.slice(0, IV_LENGTH)
    const data = raw.slice(IV_LENGTH)

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    )

    return JSON.parse(new TextDecoder().decode(decrypted))
  } catch (error) {
    try {
      const cookieStore = await cookies()
      cookieStore.delete(SESSION_COOKIE_NAME)
    } catch {
      // Middleware context: proxy clears the cookie via response
    }

    const message = error instanceof Error ? error.message : CRYPTO_ERRORS['decrypt-failed']
    throw new Error(message)
  }
}