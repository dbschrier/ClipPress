import { createServer } from 'http'
import { createReadStream, statSync, existsSync, readdirSync } from 'fs'
import { join, extname } from 'path'

const PORT = 8080
const STAGING_DIR = 'staging'

const MIME = {
  '.exe': 'application/octet-stream',
  '.blockmap': 'application/octet-stream',
  '.yml': 'text/yaml',
}

const server = createServer((req, res) => {
  const decoded = decodeURIComponent(req.url)
  const filename = decoded.replace(/^\/staging\//, '').replace(/^\//, '')
  const filePath = join(STAGING_DIR, filename)

  if (!existsSync(filePath)) {
    process.stdout.write(`  404  ${filename}\n`)
    res.writeHead(404)
    res.end('Not found')
    return
  }

  const stat = statSync(filePath)
  const total = stat.size
  const ext = extname(filename.replace('.blockmap', '')) || extname(filename)
  const rangeHeader = req.headers.range

  if (rangeHeader) {
    const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-')
    const start = parseInt(startStr, 10)
    const end = endStr ? parseInt(endStr, 10) : total - 1
    const chunkSize = end - start + 1
    process.stdout.write(`  206  ${filename} [${start}-${end}]\n`)
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
    })
    createReadStream(filePath, { start, end }).pipe(res)
  } else {
    process.stdout.write(`  200  ${filename} (${(total / 1024 / 1024).toFixed(1)} MB)\n`)
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Length': total,
      'Accept-Ranges': 'bytes',
    })
    createReadStream(filePath).pipe(res)
  }
})

server.listen(PORT, () => {
  console.log(`\n  Staging server  →  http://localhost:${PORT}/staging/\n`)

  const files = existsSync(STAGING_DIR) ? readdirSync(STAGING_DIR) : []
  if (files.length === 0) {
    console.log(`  (staging/ is empty — run stage.bat to build first)\n`)
  } else {
    console.log(`  Serving:`)
    for (const f of files) {
      const size = statSync(join(STAGING_DIR, f)).size
      const mb = (size / 1024 / 1024).toFixed(1)
      console.log(`    ${f.padEnd(60)} ${mb.padStart(6)} MB`)
    }
    console.log()
  }

  console.log(`  Install staging/ app, then open it to trigger the update check.`)
  console.log(`  Press Ctrl+C to stop.\n`)
})
