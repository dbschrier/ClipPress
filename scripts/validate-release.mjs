import { readFileSync, existsSync, createReadStream } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'

const DIST = 'dist'

function fail(msg) {
  console.error(`\n  FAIL  OTA validation: ${msg}\n`)
  process.exit(1)
}

function sha512ofFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha512')
    createReadStream(filePath)
      .on('data', chunk => hash.update(chunk))
      .on('end', () => resolve(hash.digest('base64')))
      .on('error', reject)
  })
}

const ymlPath = join(DIST, 'latest.yml')
if (!existsSync(ymlPath)) fail('dist/latest.yml not found — electron-builder may not have run')

const yml = readFileSync(ymlPath, 'utf8')

const version     = yml.match(/^version:\s*(.+)$/m)?.[1]?.trim()
const installerName = yml.match(/^path:\s*(.+)$/m)?.[1]?.trim()
const expectedHash  = yml.match(/^sha512:\s*(.+)$/m)?.[1]?.trim()

if (!version)      fail('latest.yml missing "version" field')
if (!installerName) fail('latest.yml missing "path" field')
if (!expectedHash)  fail('latest.yml missing "sha512" field')

const installerPath  = join(DIST, installerName)
const blockmapPath   = join(DIST, installerName + '.blockmap')

if (!existsSync(installerPath))  fail(`Installer not found: ${installerName}`)
if (!existsSync(blockmapPath))   fail(`Blockmap not found: ${installerName}.blockmap`)

const actualHash = await sha512ofFile(installerPath)
if (actualHash !== expectedHash) {
  fail(
    `SHA512 mismatch — latest.yml hash does not match installer on disk.\n` +
    `  expected: ${expectedHash}\n` +
    `  actual:   ${actualHash}`
  )
}

console.log(`\n  OK  OTA ready — v${version} (${installerName})\n`)
