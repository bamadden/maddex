// Generates every PWA/favicon size from the Maddex logo.
//
// Source is a JPEG photograph of the logo rather than an SVG, so it cannot be
// scaled losslessly — always generate DOWN from the largest source available.
// Regenerating from one of the small PNGs would compound artefacts.
//
// Run:  node scripts/generate-icons.js
import sharp from 'sharp'
import { mkdirSync, existsSync } from 'fs'

const source = './public/icons/maddex-logo-source.jpg'

if (!existsSync(source)) {
  console.error(`✗ Source logo not found at ${source}`)
  console.error('  Place the logo there, then re-run this script.')
  process.exit(1)
}

mkdirSync('./public/icons', { recursive: true })

// #060D1A — the terminal's background, so the icon sits on the same ground as
// the app rather than announcing itself with a different dark.
const BG = { r: 6, g: 13, b: 26, alpha: 1 }

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

for (const { size, name } of sizes) {
  // `contain`, not `cover`: cover crops to fill, which on a square target
  // silently trims the sides off a non-square logo. contain letterboxes it
  // onto the background instead, so the mark is always whole.
  await sharp(source)
    .resize(size, size, { fit: 'contain', background: BG })
    .png()
    .toFile(`./public/icons/${name}`)
  console.log(`✓ ${name}`)
}

await sharp(source)
  .resize(32, 32, { fit: 'contain', background: BG })
  .png()
  .toFile('./public/favicon.png')
console.log('✓ favicon.png')

const { width, height } = await sharp(source).metadata()
console.log(`\nAll icons generated from ${width}x${height} source.`)
if (width < 512 || height < 512) {
  console.warn(`⚠ Source is smaller than 512px — icon-512x512.png is upscaled and will look soft.`)
}
