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

// Keys the flat navy out of the JPEG, turning it into a mark with real
// transparency.
//
// Measured: the logo's own navy is #021236, the sidebar is #030912 and the
// app background is #060D1A — a distance of 37 and 29 respectively, which
// renders as a visibly lighter square sitting behind the mark. Matching one
// of them still leaves the other wrong, and the source is a JPEG so there is
// no alpha channel to reuse.
//
// Alpha is the pixel's distance from the background rather than a hard
// threshold: a cutoff produces a jagged, aliased edge on a mark this size,
// whereas a ramp keeps the anti-aliasing the original artwork already has.
async function keyed() {
  const { data, info } = await sharp(source).extract(art).raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(info.width * info.height * 4)
  // Everything more than SOLID from the background is fully opaque; the band
  // below it ramps, which is where the edge pixels live.
  const SOLID = 90
  const EDGE = 25
  for (let i = 0, o = 0; i < data.length; i += info.channels, o += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const dist = Math.sqrt((r - BG.r) ** 2 + (g - BG.g) ** 2 + (b - BG.b) ** 2)
    const a = dist <= EDGE ? 0 : dist >= SOLID ? 255 : Math.round(((dist - EDGE) / (SOLID - EDGE)) * 255)
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
}

// `transparent` marks are for in-app branding, where the tile has to sit on
// the sidebar and the topbar — two different darks. A transparent mark blends
// into both, and into any future surface, instead of matching one of them.
//
// PWA icons keep a solid background, on the app's #060D1A rather than the
// source's navy: a home-screen icon with transparency gets composited onto
// whatever the OS chooses, which on iOS is white.
async function tile(size, { transparent = false } = {}) {
  // BOTH variants start from the keyed mark. Cropping the raw JPEG instead
  // left the source's own navy inside the artwork region while the padding
  // around it took the app colour — a lighter rectangle in the middle of the
  // tile, which is the exact seam this was meant to remove. Keying first and
  // flattening after means one background across the whole icon.
  const cropped = await keyed()
  const padX = Math.round((SQUARE - art.width) / 2)
  const padY = Math.round((SQUARE - art.height) / 2)
  const pad = transparent
    ? { r: 0, g: 0, b: 0, alpha: 0 }
    : { r: 6, g: 13, b: 26, alpha: 1 }   // #060D1A — the app's background
  const squared = await sharp(cropped)
    .extend({ top: padY, bottom: padY, left: padX, right: padX, background: pad })
    .png()
    .toBuffer()

  // Solid tiles are flattened onto the app background so the source's own
  // navy does not survive as a lighter rectangle inside the icon.
  const resized = sharp(squared).resize(size, size, { fit: 'fill' })
  return (transparent ? resized : resized.flatten({ background: { r: 6, g: 13, b: 26 } })).png().toBuffer()
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
]

// In-app branding (sidebar 36px, topbar 28px), generated with transparency.
const MARKS = [
  { size: 96,  name: 'icon-mark-96.png' },
  { size: 192, name: 'icon-mark-192.png' },
]

for (const { size, name } of sizes) {
  await sharp(await tile(size)).toFile(`./public/icons/${name}`)
  console.log(`✓ ${name}`)
}

for (const { size, name } of MARKS) {
  await sharp(await tile(size, { transparent: true })).toFile(`./public/icons/${name}`)
  console.log(`✓ ${name} (transparent)`)
}

await sharp(await tile(32)).toFile('./public/favicon.png')
console.log('✓ favicon.png')

const bgHex = '#' + [BG.r, BG.g, BG.b].map((n) => n.toString(16).padStart(2, '0')).join('')
console.log(`\nSource ${meta.width}x${meta.height} · artwork ${art.width}x${art.height} at (${art.left},${art.top}) · background ${bgHex}`)
if (Math.max(art.width, art.height) < 512) {
  console.warn('⚠ Artwork is under 512px — the largest icons are upscaled and will look soft.')
}
