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

    const statusLabel = isReady
      ? 'Ready — paste into Discord'
      : isError
        ? 'Compression failed'
        : 'Queued'

    const statusMod = discordStatus === 'pending' ? 'pending' : discordStatus

    return (
      <div className="clip-player-wrap">
        <div className="clip-player" onContextMenu={handleContextMenu}>
          {!filePath && (
            <div className="player-empty">
              <svg className="player-empty__icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <polygon points="22,14 22,86 90,50" fill="#76b900"/>
              </svg>
              <p>Drop a clip to compress it for Discord</p>
            </div>
          )}
          <video
            ref={videoRef}
            controls
            style={{ display: filePath ? 'block' : 'none' }}
          />

          {filePath && isConverting && (
            <div className="compress-overlay">
              <div className="compress-overlay__row">
                <span className="compress-overlay__label">Compressing</span>
                <span className="compress-overlay__pct">{progress}%</span>
              </div>
              <div className="compress-overlay__track">
                <div className="compress-overlay__fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {filePath && !isConverting && (
            <div className={`status-badge status-badge--${statusMod}`}>
              <span className="status-badge__dot" />
              <span>{statusLabel}</span>
            </div>
          )}
        </div>
      </div>
    )
  }
)
