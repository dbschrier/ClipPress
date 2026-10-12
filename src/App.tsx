import { useRef, useState, useEffect } from 'react'
import { useClips } from './hooks/useClips'
import { ClipPlayer } from './components/ClipPlayer'
import type { ClipPlayerHandle } from './components/ClipPlayer'
import { ClipNavigator } from './components/ClipNavigator'
import { version } from '../package.json'
import './App.css'

export function App() {
  const playerRef = useRef<ClipPlayerHandle>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'downloading' | 'ready' | 'error'>('idle')
  const [updatePercent, setUpdatePercent] = useState(0)
  const [newVersion, setNewVersion] = useState<string | null>(null)

  const {
    clips,
    currentIndex,
    currentClip,
    currentFilename,
    discordStatus,
    discordPaths,
    compressProgress,
    openDirectory,
    handleDrop,
    goNext,
    goPrev,
    goTo,
  } = useClips()

  useEffect(() => {
    const unsub = window.electron.onUpdateStatus(({ status, percent, newVersion: nv, message }) => {
      setUpdateStatus(status)
      if (percent !== undefined) setUpdatePercent(percent)
      if (nv !== undefined) setNewVersion(nv)
      if (status === 'error') showToast(`Update error: ${message ?? 'unknown'}`)
    })
    return unsub
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  // Auto-copy the current clip when it finishes compressing.
  const prevStatusRef = useRef<Record<string, string>>({})
  useEffect(() => {
    const prev = prevStatusRef.current[currentFilename]
    const curr = discordStatus[currentFilename]
    if (curr === 'ready' && prev !== 'ready' && currentFilename) {
      const path = discordPaths[currentFilename]
      if (path) {
        window.electron.copyDiscord(path)
          .then(() => showToast('Copied to clipboard'))
          .catch(() => showToast('Copy failed'))
      }
    }
    prevStatusRef.current = { ...discordStatus }
  }, [discordStatus, currentFilename, discordPaths])

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    const hasFiles = Array.from(e.dataTransfer.items).some(item => item.kind === 'file')
    if (hasFiles) setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
  }

  async function onDrop(e: React.DragEvent) {
    setIsDragOver(false)
    await handleDrop(e)
  }

  return (
    <div
      className={`app${isDragOver ? ' drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={onDrop}
    >
      {isDragOver && (
        <div className="drop-overlay">
          <span>Drop clips to compress</span>
        </div>
      )}
      <ClipNavigator
        clips={clips}
        currentIndex={currentIndex}
        onSelect={(i) => {
          goTo(i)
          const filename = clips[i]?.split(/[\\/]/).pop() ?? ''
          const path = discordPaths[filename]
          if (path && discordStatus[filename] === 'ready') {
            window.electron.copyDiscord(path)
              .then(() => showToast('Copied to clipboard'))
              .catch(() => showToast('Copy failed'))
          }
        }}
        onOpen={openDirectory}
        onPrev={goPrev}
        onNext={goNext}
        discordStatus={discordStatus}
        compressProgress={compressProgress}
        version={version}
        newVersion={updateStatus !== 'idle' ? newVersion : null}
      />
      <div className="main" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ClipPlayer
          ref={playerRef}
          filePath={currentClip}
          discordPath={currentFilename ? (discordPaths[currentFilename] ?? null) : null}
          discordStatus={currentFilename ? (discordStatus[currentFilename] ?? 'pending') : 'pending'}
          progress={currentFilename ? (compressProgress[currentFilename] ?? 0) : 0}
          onCopyAttempt={showToast}
        />
      </div>
      {toast && <div className="toast">{toast}</div>}
      {updateStatus !== 'idle' && (
        <div className="update-card">
          <div className="update-card__title">
            {updateStatus === 'downloading' ? 'Downloading update' : 'Update ready'}
          </div>
          {newVersion && (
            <div className="update-card__version">v{version} → v{newVersion}</div>
          )}
          {updateStatus === 'downloading' ? (
            <div className="update-card__track">
              <div className="update-card__fill" style={{ width: `${updatePercent}%` }} />
            </div>
          ) : (
            <button className="update-card__btn" onClick={() => window.electron.restartAndInstall()}>
              Restart now
            </button>
          )}
        </div>
      )}
    </div>
  )
}
