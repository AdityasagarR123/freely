// Renders build/icon.svg and build/tray.svg into every icon format the app and installers need.
// electron-builder derives the macOS .icns from build/icon.png.
import { readFile, writeFile } from 'node:fs/promises'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'

const icon = await readFile('build/icon.svg')
const tray = await readFile('build/tray.svg')
const png = (svg, size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer()

await writeFile('build/icon.png', await png(icon, 1024))
await writeFile(
  'build/icon.ico',
  await pngToIco(await Promise.all([16, 24, 32, 48, 64, 128, 256].map((s) => png(icon, s)))),
)
// Windows/Linux tray: the full-colour icon. macOS: a black template image (auto-inverted in dark mode).
await writeFile('resources/tray.png', await png(icon, 32))
await writeFile('resources/trayTemplate.png', await png(tray, 22))
await writeFile('resources/trayTemplate@2x.png', await png(tray, 44))
console.log('icons written')
