// Usage: node stills.mjs <video.html> <outDir> <seconds>...
// Saves one 1920x1080 PNG per time, named still-<seconds>.png, and prints the video's length.
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

const [file, out, ...times] = process.argv.slice(2)
if (file === undefined || out === undefined || times.length === 0) {
  console.error('usage: node stills.mjs <video.html> <outDir> <seconds>...')
  process.exit(2)
}
await mkdir(out, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => m.type() === 'error' && errors.push(m.text()))
await page.goto(`${pathToFileURL(path.resolve(file)).href}?render`)
await page.evaluate(() => document.fonts.ready)
for (const t of times) {
  await page.evaluate(s => window.videoSeek(s), Number(t))
  await page.screenshot({ path: path.join(out, `still-${t}.png`) })
}
console.log(`total ${await page.evaluate(() => window.videoTotal)}s`)
await browser.close()
if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}
