import { readFileSync, writeFileSync, cpSync, mkdirSync, readdirSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const baseVersion = pkg.version.replace(/-.*$/, '')
const gitHash = execSync('git rev-parse --short HEAD').toString().trim()
const stagingVersion = `${baseVersion}-staging.${gitHash}`

console.log(`\n  ClipPress Staging Build`)
console.log(`  ${'─'.repeat(40)}`)
console.log(`  Version : ${stagingVersion}`)
console.log(`  Config  : electron-builder.stage.yml`)
console.log(`  Output  : dist-staging/ → staging/\n`)

pkg.version = stagingVersion
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')

try {
  execSync('npx electron-vite build', { stdio: 'inherit' })
  execSync('npx electron-builder --config electron-builder.stage.yml --publish never', { stdio: 'inherit' })

  mkdirSync('staging', { recursive: true })
  for (const f of readdirSync('dist-staging')) {
    if (f.endsWith('.exe') || f.endsWith('.blockmap') || f === 'latest.yml') {
      cpSync(join('dist-staging', f), join('staging', f))
    }
  }

  console.log(`\n  Build complete: ${stagingVersion}`)
  console.log(`  Artifacts copied to staging/\n`)
} finally {
  execSync('git checkout package.json package-lock.json', { stdio: 'pipe' })
}
