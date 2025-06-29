import 'server-only'
import { SessionType } from '@/types/auth'

const SECRET_KEY = process.env.AUTH_SECRET
if (!SECRET_KEY) throw new Error('Missing AUTH_SECRET')
if (SECRET_KEY.length !== 32) throw new Error('AUTH_SECRET must be 32 characters long')

const ENCRYPTION_KEY = crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(process.env.AUTH_SECRET!),
  'AES-GCM',
  true,
  ['encrypt', 'decrypt']
)

const IV_LENGTH = 12

export async function encryptSession(data: object): Promise<string> {
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
    throw new Error(error instanceof Error ? error.message : 'Failed to encrypt session')
  }
}

export async function decryptSession(session: string): Promise<SessionType | null> {
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
    throw new Error(error instanceof Error ? error.message : 'Failed to decrypt session')
  }
}