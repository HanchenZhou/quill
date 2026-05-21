// Rasterizes build/icon.svg into the full macOS iconset and bundles into icon.icns.
// Requires `iconutil` (built into macOS).
import { readFileSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SVG = join(ROOT, 'build', 'icon.svg')
const ICONSET = join(ROOT, 'build', 'icon.iconset')
const ICNS = join(ROOT, 'build', 'icon.icns')

const sizes = [
  { name: 'icon_16x16.png', size: 16 },
  { name: 'icon_16x16@2x.png', size: 32 },
  { name: 'icon_32x32.png', size: 32 },
  { name: 'icon_32x32@2x.png', size: 64 },
  { name: 'icon_128x128.png', size: 128 },
  { name: 'icon_128x128@2x.png', size: 256 },
  { name: 'icon_256x256.png', size: 256 },
  { name: 'icon_256x256@2x.png', size: 512 },
  { name: 'icon_512x512.png', size: 512 },
  { name: 'icon_512x512@2x.png', size: 1024 }
]

async function main() {
  rmSync(ICONSET, { recursive: true, force: true })
  mkdirSync(ICONSET, { recursive: true })

  const svg = readFileSync(SVG)

  for (const { name, size } of sizes) {
    await sharp(svg, { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(join(ICONSET, name))
    console.log(`  wrote ${name} (${size}×${size})`)
  }

  execSync(`iconutil -c icns "${ICONSET}" -o "${ICNS}"`, { stdio: 'inherit' })
  rmSync(ICONSET, { recursive: true, force: true })

  console.log(`\nBuilt ${ICNS}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
