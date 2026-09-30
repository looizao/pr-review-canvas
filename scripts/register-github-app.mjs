import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { serve } from '@hono/node-server'
import { createRegistrationApp } from '../src/hosted/registration.ts'

const { values } = parseArgs({
  options: {
    'public-url': { type: 'string' },
    organization: { type: 'string', default: 'CactusTechnologies' },
    output: { type: 'string', default: '.env.hosted' },
    port: { type: 'string', default: '3011' },
  },
})
if (!values['public-url']) throw new Error('Pass --public-url https://<service>.onrender.com')
const origin = new URL(values['public-url'])
if (
  origin.protocol !== 'https:' ||
  origin.pathname !== '/' ||
  origin.search ||
  origin.hash ||
  origin.username ||
  origin.password
)
  throw new Error('The public URL must be an HTTPS origin')
if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(values.organization)) throw new Error('Invalid GitHub organization')
const port = Number(values.port)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid local callback port')
const output = path.resolve(values.output)
const manifest = JSON.parse(await readFile(new URL('../github-app-manifest.json', import.meta.url), 'utf8'))
const { app, url } = createRegistrationApp({
  origin: origin.origin,
  organization: values.organization,
  output,
  manifest,
  callbackOrigin: `http://127.0.0.1:${port}`,
  completed: installationUrl => {
    process.stdout.write(`Credentials saved to ${output}\nInstall the app: ${installationUrl}\n`)
  },
})
const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, () => {
  process.stdout.write(`Open this local registration page: ${url}\n`)
})
const expiry = setTimeout(
  () => {
    server.close()
    server.closeAllConnections()
  },
  60 * 60 * 1000
)
const stop = () => {
  clearTimeout(expiry)
  server.close()
  server.closeAllConnections()
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)
