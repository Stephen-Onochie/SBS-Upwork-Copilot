// Generates public/icons/icon{16,48,128}.png
// Strips white background from the Circle Badge source, composites onto navy #1C374C.
// Run once: node scripts/gen-icons.mjs

import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = '/Users/stepheno/Downloads/Logo with Banner Circle.png'
const OUT = join(__dirname, '../public/icons')

async function removeWhiteBg(srcPath, size) {
  const { data, info } = await sharp(srcPath)
    .resize(size, size)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const buf = Buffer.from(data)
  for (let i = 0; i < buf.length; i += 4) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2]
    // Treat near-white as transparent
    if (r > 220 && g > 220 && b > 220) {
      buf[i + 3] = 0
    }
  }

  return sharp(buf, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toBuffer()
}

for (const size of [16, 48, 128]) {
  const outPath = join(OUT, `icon${size}.png`)

  // Navy circle background
  const bg = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#1C374C"/>
    </svg>`
  )

  const logoAlpha = await removeWhiteBg(SRC, size)

  await sharp(bg)
    .composite([{ input: logoAlpha, blend: 'over' }])
    .png()
    .toFile(outPath)

  console.log(`✓ icon${size}.png → ${outPath}`)
}

console.log('Done.')
