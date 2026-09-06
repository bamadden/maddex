// Generates every PWA/favicon size from the Maddex logo.
//
// Run:  node scripts/generate-icons.js
import sharp from 'sharp'
import { mkdirSync, existsSync } from 'fs'

const source = './public/icons/maddex-logo-source.jpg'

if (!existsSync(source)) {
  console.error(`✗ Source logo not found at ${source}`)
  process.exit(1)
}

mkdirSync('./public/icons', { recursive: true })

// The source's OWN navy, sampled from it: rgb(1,16,49) / #011031.
//
// Not #060D1A, which the app uses. Those are visibly different — #011031 is
// bluer and lighter — so padding a crop of this JPEG onto #060D1A leaves a
// rectangle where the source ends. Since the logo is a photograph with no
// alpha, its background cannot be removed; matching it is the only way to get
// a seamless tile.
const BG = { r: 1, g: 16, b: 49, alpha: 1 }

// Artwork bounds inside the 886x886 source, measured with sharp's trim.
// The logo occupies 66% x 32% of the frame — two thirds of the height is
// empty navy, which is why naive resizing produced a tiny mark in a big tile.
const MARK = { left: 152, top: 315, width: 585, height: 205 }   // MX only
const FULL = { left: 152, top: 320, width: 585, height: 285 }   // MX + wordmark

// Below this, the MADDEX wordmark is a smudge — at 32px it renders about two
// pixels tall. Small sizes get the monogram alone, which is the actual brand
// mark and stays recognisable in a browser tab.
const WORDMARK_LEGIBLE_AT = 72

// Square canvas at ~86% fill, so the mark has margin instead of bleeding to
// the edges.
const SQUARE = Math.round(585 / 0.86)

async function tile(region, size) {
  const cropped = await sharp(source).extract(region).png().toBuffer()
  const padX = Math.round((SQUARE - region.width) / 2)
  const padY = Math.round((SQUARE - region.height) / 2)
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
]

for (const { size, name } of sizes) {
  const region = size < WORDMARK_LEGIBLE_AT ? MARK : FULL
  const buf = await tile(region, size)
  await sharp(buf).toFile(`./public/icons/${name}`)
  console.log(`✓ ${name.padEnd(22)} ${size < WORDMARK_LEGIBLE_AT ? 'MX monogram' : 'full logo'}`)
}

await sharp(await tile(MARK, 32)).toFile('./public/favicon.png')
console.log('✓ favicon.png            MX monogram')

// Mark-only asset for in-app branding. The sidebar renders at 36px and the
// topbar at 28px — both well under WORDMARK_LEGIBLE_AT — so the full lockup
// would put an illegible smudge of a wordmark under the monogram. In the
// topbar it would also sit directly beside real MADDEX text, saying the same
// word twice, once unreadably.
for (const size of [96, 192]) {
  await sharp(await tile(MARK, size)).toFile(`./public/icons/icon-mark-${size}.png`)
  console.log(`✓ icon-mark-${size}.png${' '.repeat(size === 96 ? 9 : 8)}MX monogram`)
}

const { width, height } = await sharp(source).metadata()
console.log(`\nGenerated from ${width}x${height} source.`)
