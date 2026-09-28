// Serves the repository root so the prototype can use the app's stylesheet, and opens the tour.
// Usage: node prototype/tour/serve.mjs [port]   then open http://localhost:3011/?pr=67
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const port = Number(process.argv[2] ?? 3011)
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.md': 'text/plain; charset=utf-8',
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`)
  if (url.pathname === '/') {
    res.writeHead(302, { location: `/prototype/tour/index.html${url.search || '?pr=67'}` })
    res.end()
    return
  }
  const path = normalize(join(root, decodeURIComponent(url.pathname)))
  if (!path.startsWith(root)) {
    res.writeHead(403)
    res.end()
    return
  }
  try {
    const info = await stat(path)
    const file = info.isDirectory() ? join(path, 'index.html') : path
    const body = await readFile(file)
    res.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('not found')
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`tour prototype: http://localhost:${port}/?pr=67  (or ?pr=68)`)
})
