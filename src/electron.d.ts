declare global {
  interface Window {
    electron: {
      openDirectory: () => Promise<{
        dir: string
        clips: string[]
        discordPaths: Record<string, string>
      } | null>
      loadDropped: (filePaths: string[]) => Promise<{
        dir: string
        clips: string[]
        discordPaths: Record<string, string>
      } | null>
      loadNotes: (dir: string) => Promise<Record<string, { filename: string; notes: string; updatedAt: string }>>
      saveNote: (dir: string, filename: string, notes: string) => Promise<void>
      copyDiscord: (discordPath: string) => Promise<void>
      onCompressProgress: (cb: (data: { mp4Filename: string; percent: number }) => void) => () => void
      onUpdateStatus: (cb: (data: { status: 'downloading' | 'ready'; percent: number }) => void) => () => void
      restartAndInstall: () => Promise<void>
      onDiscordReady: (cb: (data: {
        mp4Filename: string
        discordPath: string
        status: 'pending' | 'converting' | 'ready' | 'error'
      }) => void) => () => void
    }
  }
}

export {}
