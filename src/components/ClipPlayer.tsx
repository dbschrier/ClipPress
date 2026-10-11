import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { ShareStatus } from '../types'

interface ClipPlayerProps {
  filePath: string | null
  discordPath: string | null
  discordStatus: ShareStatus
  progress: number  // 0-100
  onCopyAttempt: (msg: string) => void
}

export interface ClipPlayerHandle {
  getCurrentTime: () => number
}

function toFileUrl(filePath: string): string {
  return 'file:///' + filePath.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/')
}

export const ClipPlayer = forwardRef<ClipPlayerHandle, ClipPlayerProps>(
  function ClipPlayer({ filePath, discordPath, discordStatus, progress, onCopyAttempt }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
      const video = videoRef.current
      if (!video) return
      video.pause()
      video.src = filePath ? toFileUrl(filePath) : ''
      if (filePath) video.load()
    }, [filePath])

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => videoRef.current?.currentTime ?? 0
    }))

    function handleContextMenu(e: React.MouseEvent) {
      e.preventDefault()
      if (!filePath) return
      if (discordStatus !== 'ready' || !discordPath) {
        onCopyAttempt(discordStatus === 'converting' ? 'Still compressing...' : 'Not ready yet')
        return
      }
      window.electron.copyDiscord(discordPath)
        .then(() => onCopyAttempt('Copied — paste into Discord'))
        .catch(() => onCopyAttempt('Copy failed'))
    }

    const isConverting = discordStatus === 'converting'
    const isReady = discordStatus === 'ready'
    const isError = discordStatus === 'error'

    const statusLabel = !filePath
      ? 'Drop a clip here to compress for Discord'
      : isConverting
        ? `Compressing for Discord… ${progress}%`
        : isReady
          ? 'Ready — already copied to clipboard'
          : isError
            ? 'Compression failed'
            : 'Waiting to compress'

    const statusMod = !filePath || discordStatus === 'pending'
      ? 'idle'
      : discordStatus

    return (
      <div className="clip-player-wrap">
        <div className="clip-player" onContextMenu={handleContextMenu}>
          {!filePath && (
            <div className="player-empty">
              <img src="/assets/logo.svg" alt="Melee Note Taker" className="player-logo" />
              <p>Drop a clip here to get started</p>
            </div>
          )}
          <video
            ref={videoRef}
            controls
            style={{ display: filePath ? 'block' : 'none' }}
          />
        </div>

        <div className={`discord-status discord-status--${statusMod}`}>
          <span className="discord-status__label">{statusLabel}</span>
          {isConverting && (
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    )
  }
)
