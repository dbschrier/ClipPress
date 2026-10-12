import { contextBridge, ipcRenderer } from 'electron'

type ShareStatus = 'pending' | 'converting' | 'ready' | 'error'

contextBridge.exposeInMainWorld('electron', {
  openDirectory: () => ipcRenderer.invoke('clips:open-directory'),
  loadDropped: (filePaths: string[]) => ipcRenderer.invoke('clips:load-dropped', filePaths),
  loadNotes: (dir: string) => ipcRenderer.invoke('notes:load', dir),
  saveNote: (dir: string, filename: string, notes: string) =>
    ipcRenderer.invoke('notes:save', dir, filename, notes),
  copyDiscord: (discordPath: string) => ipcRenderer.invoke('clips:copy-discord', discordPath),
  onDiscordReady: (cb: (data: { mp4Filename: string; discordPath: string; status: ShareStatus }) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, data: { mp4Filename: string; discordPath: string; status: ShareStatus }) => cb(data)
    ipcRenderer.on('clips:discord-ready', listener)
    return () => ipcRenderer.removeListener('clips:discord-ready', listener)
  },
  onCompressProgress: (cb: (data: { mp4Filename: string; percent: number }) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, data: { mp4Filename: string; percent: number }) => cb(data)
    ipcRenderer.on('clips:compress-progress', listener)
    return () => ipcRenderer.removeListener('clips:compress-progress', listener)
  },
  onUpdateStatus: (cb: (data: { status: 'downloading' | 'ready' | 'error'; percent?: number; newVersion?: string | null; message?: string }) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, data: { status: 'downloading' | 'ready' | 'error'; percent?: number; newVersion?: string | null; message?: string }) => cb(data)
    ipcRenderer.on('app:update-status', listener)
    return () => ipcRenderer.removeListener('app:update-status', listener)
  },
  restartAndInstall: () => ipcRenderer.invoke('app:restart-and-install'),
})
