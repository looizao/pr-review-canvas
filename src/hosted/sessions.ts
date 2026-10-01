import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { readJsonOrDefault, writeJsonAtomic } from '../store/atomic-json.js'
import { LoginAttempts } from './auth.js'

const SessionSchema = z.object({
  userId: z.number().int().positive(),
  login: z.string(),
  token: z.string(),
  expires: z.number(),
})
export type Session = z.infer<typeof SessionSchema>
const EncryptedSchema = z.object({ iv: z.string(), tag: z.string(), data: z.string() })

export class Sessions {
  readonly logins = new LoginAttempts()
  private readonly key: Buffer
  private readonly root: string
  constructor(root: string, key: string) {
    this.root = root
    this.key = Buffer.from(key, 'hex')
  }

  private file(id: string): string {
    return path.join(this.root, 'sessions', `${id}.json`)
  }

  async create(session: Session): Promise<string> {
    const id = randomBytes(32).toString('hex')
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const data = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()])
    await writeJsonAtomic(this.file(id), {
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
      data: data.toString('base64'),
    })
    return id
  }

  async read(id: string | undefined): Promise<Session | null> {
    if (id === undefined || !/^[a-f0-9]{64}$/.test(id)) return null
    const encrypted = await readJsonOrDefault(this.file(id), EncryptedSchema, () => null)
    if (encrypted === null) return null
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(encrypted.iv, 'hex'))
      decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'))
      const session = SessionSchema.parse(
        JSON.parse(
          Buffer.concat([decipher.update(Buffer.from(encrypted.data, 'base64')), decipher.final()]).toString(
            'utf8'
          )
        )
      )
      if (session.expires > Date.now()) return session
    } catch {
      // A rotated key invalidates existing sessions.
    }
    await this.remove(id)
    return null
  }

  async remove(id: string | undefined): Promise<void> {
    if (id !== undefined && /^[a-f0-9]{64}$/.test(id)) await rm(this.file(id), { force: true })
  }
}
