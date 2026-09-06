// Generates every PWA/favicon size from the Maddex logo.
//
// Run:  node scripts/generate-icons.js
//
// Bounds and background colour are DETECTED, not hardcoded. An earlier
// version carried pixel coordinates measured from one particular source
// file; swapping in a different logo silently cropped the wrong region,
// because the numbers were still describing the old image. Nothing here
// knows the source's dimensions in advance.
import sharp from 'sharp'
import { mkdirSync, existsSync } from 'fs'

const source = './public/icons/maddex-logo-source.jpg'

if (!existsSync(source)) {
  console.error(`✗ Source logo not found at ${source}`)
  process.exit(1)
}

mkdirSync('./public/icons', { recursive: true })

const meta = await sharp(source).metadata()

// The source's OWN background, read from a corner. Not the app's #060D1A:
// these logos sit on a navy that is bluer and lighter, and padding a crop
// onto a different dark leaves a visible rectangle where the source ends.
// A JPEG has no alpha, so matching is the only way to a seamless tile.
const { data: corner } = await sharp(source).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true })
const BG = { r: corner[0], g: corner[1], b: corner[2], alpha: 1 }

// Trim finds the artwork by walking in from the edges until the colour
// changes, which is exactly the question "where does the mark start".
const trimmed = await sharp(source).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true })
const art = {
  width: trimmed.info.width,
  height: trimmed.info.height,
  left: -trimmed.info.trimOffsetLeft,
  top: -trimmed.info.trimOffsetTop,
}

// Square canvas at ~82% fill so the mark has margin rather than bleeding to
// the edge. Driven by whichever dimension is larger, so a wide mark and a
// tall one both end up the same visual weight.
const SQUARE = Math.round(Math.max(art.width, art.height) / 0.82)

async function tile(size) {
  const cropped = await sharp(source).extract(art).png().toBuffer()
  const padX = Math.round((SQUARE - art.width) / 2)
  const padY = Math.round((SQUARE - art.height) / 2)
  const squared = await sharp(cropped)
    .extend({ top: padY, bottom: padY, left: padX, right: padX, background: BG })
    .png()
    .toBuffer()
  return sharp(squared).resize(size, size, { fit: 'fill' }).png().toBuffer()
}

const sizes = [
  { size: 16,  name: 'favicon-16x16.png' },
  { size: 32,  name: 'favicon-32x32.png' },
  { size: 72,  name: 'icon-72x72.png' },
  { size: 96,  name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' },
  // In-app branding (sidebar 36px, topbar 28px). Same artwork as everything
  // else now that the source carries no wordmark — kept as separate files so
  // the components' paths do not have to change.
  { size: 96,  name: 'icon-mark-96.png' },
  { size: 192, name: 'icon-mark-192.png' },
]

for (const { size, name } of sizes) {
  await sharp(await tile(size)).toFile(`./public/icons/${name}`)
  console.log(`✓ ${name}`)
}

await sharp(await tile(32)).toFile('./public/favicon.png')
console.log('✓ favicon.png')

const bgHex = '#' + [BG.r, BG.g, BG.b].map((n) => n.toString(16).padStart(2, '0')).join('')
console.log(`\nSource ${meta.width}x${meta.height} · artwork ${art.width}x${art.height} at (${art.left},${art.top}) · background ${bgHex}`)
if (Math.max(art.width, art.height) < 512) {
  console.warn('⚠ Artwork is under 512px — the largest icons are upscaled and will look soft.')
}
