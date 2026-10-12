import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import { mkdirSync, statSync, existsSync, readdirSync, unlinkSync, renameSync } from 'fs'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
// @ts-ignore — no types for electron-clipboard-ex
import clipboardEx from 'electron-clipboard-ex'

let mainWindow: BrowserWindow | null = null

// --- Types ---

type CompressTask = {
  mp4Path: string
  discordOut: string
  filename: string
}

// --- Discord compression helpers ---

const getDiscordDir = (dir: string) => join(dir, '_discord')
const getDiscordPath = (dir: string, filename: string) =>
  join(getDiscordDir(dir), filename) // keeps .mp4 extension

// Target 17.5MB — ~10% headroom covers container overhead and encoder overshoot
const DISCORD_TARGET_BYTES = 17.5 * 1024 * 1024

function getVideoDuration(mp4Path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(mp4Path, (err: Error, metadata: ffmpeg.FfprobeData) => {
      if (err) reject(err)
      else resolve(metadata.format.duration ?? 60)
    })
  })
}

function runFfmpegCompress(
  input: string,
  output: string,
  videoBitrateKbps: number,
  audioBitrateKbps: number,
  scaleFilter: string | null,
  onProgress?: (percent: number) => void
): Promise<void> {
  const tmp = output.replace(/\.mp4$/, '_tmp.mp4')
  const vf = scaleFilter ?? 'scale=trunc(iw/2)*2:trunc(ih/2)*2'

  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioBitrate(audioBitrateKbps)
      .videoBitrate(videoBitrateKbps)
      .outputOptions([
        `-maxrate ${videoBitrateKbps}k`,
        `-bufsize ${videoBitrateKbps * 2}k`,
        '-preset medium',
        '-movflags +faststart',
        '-y',
      ])
      .videoFilters(vf)
      .output(tmp)
      .on('progress', (p) => {
        if (onProgress && p.percent != null) {
          onProgress(Math.min(Math.round(p.percent), 99))
        }
      })
      .on('end', () => {
        try {
          if (existsSync(output)) unlinkSync(output)
          renameSync(tmp, output)
          resolve()
        } catch (e) {
          try { unlinkSync(tmp) } catch { /* ignore */ }
          reject(e)
        }
      })
      .on('error', (err) => {
        try { unlinkSync(tmp) } catch { /* ignore */ }
        reject(err)
      })
      .run()
  })
}

// Resolution + audio steps — tried in order until output is under 25MB
const COMPRESS_STEPS: Array<{ scale: string | null; audioBr: number }> = [
  { scale: null,        audioBr: 128 }, // original resolution
  { scale: 'scale=1280:-2', audioBr: 128 },
  { scale: 'scale=854:-2',  audioBr: 96  },
  { scale: 'scale=640:-2',  audioBr: 64  },
]

async function compressForDiscord(
  mp4Path: string,
  outPath: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const duration = await getVideoDuration(mp4Path)

  for (const step of COMPRESS_STEPS) {
    const totalKbps = Math.floor((DISCORD_TARGET_BYTES * 8) / duration / 1000)
    const videoKbps = Math.max(totalKbps - step.audioBr, 150)
    await runFfmpegCompress(mp4Path, outPath, videoKbps, step.audioBr, step.scale, onProgress)
    if (statSync(outPath).size <= 20 * 1024 * 1024) return
  }
}

// --- Compression queue ---

let compressionQueue: CompressTask[] = []
let isCompressing = false

async function drainQueue(): Promise<void> {
  if (isCompressing || compressionQueue.length === 0) return
  isCompressing = true
  while (compressionQueue.length > 0) {
    const task = compressionQueue.shift()!
    mainWindow?.webContents.send('clips:discord-ready', {
      mp4Filename: task.filename,
      discordPath: task.discordOut,
      status: 'converting'
    })
    try {
      await compressForDiscord(task.mp4Path, task.discordOut, (percent) => {
        mainWindow?.webContents.send('clips:compress-progress', {
          mp4Filename: task.filename,
          percent
        })
      })
      mainWindow?.webContents.send('clips:discord-ready', {
        mp4Filename: task.filename,
        discordPath: task.discordOut,
        status: 'ready'
      })
    } catch (err) {
      console.error(`[discord] failed: ${task.filename}`, err)
      mainWindow?.webContents.send('clips:discord-ready', {
        mp4Filename: task.filename,
        discordPath: task.discordOut,
        status: 'error'
      })
    }
  }
  isCompressing = false
}

// Queue specific files for compression (not the whole directory)
function queueFiles(filePaths: string[]) {
  if (filePaths.length === 0) return
  const dir = join(filePaths[0], '..')
  mkdirSync(getDiscordDir(dir), { recursive: true })
  for (const mp4Path of filePaths) {
    const filename = mp4Path.split(/[\\/]/).pop()!
    const out = getDiscordPath(dir, filename)
    if (!existsSync(out)) {
      compressionQueue.push({ mp4Path, discordOut: out, filename })
    }
  }
  drainQueue()
}

// --- Directory-open logic (no auto-compress — browse only) ---

function openDir(dir: string): { dir: string; clips: string[]; discordPaths: Record<string, string> } {
  const filenames = readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.mp4'))
    .sort()
  const clips = filenames.map(f => join(dir, f))

  const discordPaths: Record<string, string> = {}
  for (const filename of filenames) {
    const dp = getDiscordPath(dir, filename)
    if (existsSync(dp)) discordPaths[filename] = dp
  }

  return { dir, clips, discordPaths }
}

// --- Dropped-files logic (compress only the dropped files) ---

function loadDropped(filePaths: string[]): { dir: string; clips: string[]; discordPaths: Record<string, string> } {
  const dir = join(filePaths[0], '..')

  queueFiles(filePaths)

  const discordPaths: Record<string, string> = {}
  for (const fp of filePaths) {
    const filename = fp.split(/[\\/]/).pop()!
    const dp = getDiscordPath(dir, filename)
    if (existsSync(dp)) discordPaths[filename] = dp
  }

  return { dir, clips: filePaths, discordPaths }
}

// --- Window ---

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#1a1a1a',
    icon: join(__dirname, '../../resources/logo-256.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// --- IPC ---

ipcMain.handle('clips:open-directory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Clips Folder'
  })
  if (canceled || filePaths.length === 0) return null
  return openDir(filePaths[0])
})

// Drag-and-drop: load only the dropped files, compress only those
ipcMain.handle('clips:load-dropped', async (_event, filePaths: string[]) => {
  if (!filePaths || filePaths.length === 0) return null
  return loadDropped(filePaths)
})


ipcMain.handle('clips:copy-discord', async (_event, discordFilePath: string) => {
  clipboardEx.writeFilePaths([discordFilePath])
})

ipcMain.handle('app:restart-and-install', () => {
  autoUpdater.quitAndInstall()
})

app.whenReady().then(() => {
  // When packaged, ffmpeg binary lives in app.asar.unpacked — resolve path after app is ready
  const resolvedFfmpegPath = ffmpegPath
    ? (app.isPackaged ? ffmpegPath.replace('app.asar', 'app.asar.unpacked') : ffmpegPath)
    : null
  if (resolvedFfmpegPath) ffmpeg.setFfmpegPath(resolvedFfmpegPath)

  Menu.setApplicationMenu(null)
  createWindow()

  if (app.isPackaged) {
    // Beta installs check for beta updates; stable installs only get stable
    autoUpdater.allowPrerelease = app.getVersion().includes('-')
    autoUpdater.on('error', (err) => {
      console.error('[updater] error:', err?.message)
      mainWindow?.webContents.send('app:update-status', { status: 'error', message: err?.message })
    })
    let newVersion: string | null = null
    autoUpdater.on('update-available', (info) => {
      newVersion = info.version
      console.log('[updater] update available:', info.version)
    })
    autoUpdater.on('update-not-available', () => {
      console.log('[updater] already up to date')
    })
    autoUpdater.on('download-progress', (progress) => {
      mainWindow?.webContents.send('app:update-status', {
        status: 'downloading',
        percent: Math.round(progress.percent),
        newVersion,
      })
    })
    autoUpdater.on('update-downloaded', () => {
      mainWindow?.webContents.send('app:update-status', { status: 'ready', percent: 100, newVersion })
    })
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[updater] checkForUpdates failed:', err?.message)
    })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
