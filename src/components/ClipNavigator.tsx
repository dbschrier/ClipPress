import type { ShareStatusMap } from '../types'

interface ClipNavigatorProps {
  clips: string[]
  currentIndex: number
  onSelect: (index: number) => void
  onOpen: () => void
  onPrev: () => void
  onNext: () => void
  discordStatus: ShareStatusMap
}

function getFilename(path: string): string {
  return (path.split(/[\\/]/).pop() ?? path).replace(/\.mp4$/i, '')
}

const BADGE_LABEL: Record<string, string> = {
  ready: 'MP4',
  converting: '...',
  error: 'ERR',
  pending: '·',
}

export function ClipNavigator({ clips, currentIndex, onSelect, onOpen, onPrev, onNext, discordStatus }: ClipNavigatorProps) {
  return (
    <div className="clip-navigator">
      <div className="nav-header">
        <span className="nav-section-label">Clips {clips.length > 0 ? `(${clips.length})` : ''}</span>
        <button className="open-btn" onClick={onOpen}>Open Folder</button>
      </div>

      {clips.length === 0 ? (
        <p className="empty-msg">Drop clips or open folder</p>
      ) : (
        <ul>
          {clips.map((clip, i) => {
            const filename = getFilename(clip)
            const raw = (clip.split(/[\\/]/).pop() ?? clip)
            const status = discordStatus[raw] ?? 'pending'
            return (
              <li
                key={clip}
                className={i === currentIndex ? 'active' : ''}
                onClick={() => onSelect(i)}
              >
                <span className="clip-name">{filename}</span>
                <span className={`share-badge share-badge--${status}`}>
                  {BADGE_LABEL[status]}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="nav-footer">
        <button onClick={onPrev} disabled={currentIndex === 0 || clips.length === 0}>← Prev</button>
        <span className="nav-counter">
          {clips.length > 0 ? `${currentIndex + 1} / ${clips.length}` : '—'}
        </span>
        <button onClick={onNext} disabled={currentIndex >= clips.length - 1 || clips.length === 0}>Next →</button>
      </div>
    </div>
  )
}
