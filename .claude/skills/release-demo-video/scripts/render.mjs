// Usage: node render.mjs <video.html> <out.mp4> [fps]
// Seeks the page frame by frame and pipes PNGs into ffmpeg, so every frame is exact whatever
// the machine's speed. About 4 minutes for a 2-minute video at 30 fps.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

const [file, out, fpsArg] = process.argv.slice(2)
if (file === undefined || out === undefined) {
  console.error('usage: node render.mjs <video.html> <out.mp4> [fps]')
  process.exit(2)
}
const fps = Number(fpsArg ?? 30)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.goto(`${pathToFileURL(path.resolve(file)).href}?render`)
await page.evaluate(() => document.fonts.ready)
const total = await page.evaluate(() => window.videoTotal)
const frames = Math.round(total * fps)
const ffmpeg = spawn(
  'ffmpeg',
  [
    ...['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-'],
    ...['-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'],
    out,
  ],
  { stdio: ['pipe', 'inherit', 'inherit'] }
)
for (let i = 0; i < frames; i++) {
  await page.evaluate(t => window.videoSeek(t), i / fps)
  const png = await page.screenshot({ type: 'png' })
  if (!ffmpeg.stdin.write(png)) await new Promise(resolve => ffmpeg.stdin.once('drain', resolve))
  if (i % 300 === 0) console.log(`frame ${i}/${frames}`)
}
ffmpeg.stdin.end()
const code = await new Promise(resolve => ffmpeg.on('close', resolve))
await browser.close()
if (code !== 0) process.exit(1)
console.log(`wrote ${out}: ${total}s at ${fps} fps`)
