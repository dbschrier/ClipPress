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
      copyDiscord: (discordPath: string) => Promise<void>
      onCompressProgress: (cb: (data: { mp4Filename: string; percent: number }) => void) => () => void
      onUpdateStatus: (cb: (data: { status: 'downloading' | 'ready' | 'error'; percent?: number; newVersion?: string | null; message?: string }) => void) => () => void
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
