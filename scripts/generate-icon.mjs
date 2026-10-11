import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const svg = readFileSync(join(root, 'src/assets/logo.svg'), 'utf8')

mkdirSync(join(root, 'resources'), { recursive: true })

for (const size of [256, 64, 32]) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  const png = resvg.render().asPng()
  writeFileSync(join(root, `resources/logo-${size}.png`), png)
}

console.log('Icons generated in resources/')
