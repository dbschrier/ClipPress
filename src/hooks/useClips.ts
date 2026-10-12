import { useState, useCallback, useRef, useEffect } from 'react'
import type { ShareStatus, ShareStatusMap } from '../types'

export function useClips() {
  const [clips, setClips] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [discordStatus, setDiscordStatus] = useState<ShareStatusMap>({})
  const [discordPaths, setDiscordPaths] = useState<Record<string, string>>({})
  const [compressProgress, setCompressProgress] = useState<Record<string, number>>({})
  const discordUnsubscribe = useRef<(() => void) | null>(null)
  const progressUnsubscribe = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      if (discordUnsubscribe.current) discordUnsubscribe.current()
      if (progressUnsubscribe.current) progressUnsubscribe.current()
    }
  }, [])

  const processDirectoryResult = useCallback(async (
    result: { dir: string; clips: string[]; discordPaths: Record<string, string> } | null
  ) => {
    if (!result) return
    const { clips: newClips, discordPaths: existingDiscordPaths } = result

    setClips(newClips)
    setCurrentIndex(0)

    const filenames = new Set(newClips.map(p => p.split(/[\\/]/).pop()!))
    const initialStatus: ShareStatusMap = {}
    filenames.forEach(f => {
      initialStatus[f] = existingDiscordPaths[f] ? 'ready' : 'pending'
    })
    setDiscordStatus(initialStatus)
    setDiscordPaths(existingDiscordPaths)
    setCompressProgress({})

    discordUnsubscribe.current = window.electron.onDiscordReady(({ mp4Filename, discordPath, status }) => {
      if (!filenames.has(mp4Filename)) return
      setDiscordStatus(prev => ({ ...prev, [mp4Filename]: status }))
      if (status === 'ready') {
        setDiscordPaths(prev => ({ ...prev, [mp4Filename]: discordPath }))
        setCompressProgress(prev => ({ ...prev, [mp4Filename]: 100 }))
      }
    })

    progressUnsubscribe.current = window.electron.onCompressProgress(({ mp4Filename, percent }) => {
      if (!filenames.has(mp4Filename)) return
      setCompressProgress(prev => ({ ...prev, [mp4Filename]: percent }))
      setDiscordStatus(prev =>
        prev[mp4Filename] === 'pending' ? { ...prev, [mp4Filename]: 'converting' } : prev
      )
    })
  }, [])

  const cleanup = useCallback(() => {
    if (discordUnsubscribe.current) {
      discordUnsubscribe.current()
      discordUnsubscribe.current = null
    }
    if (progressUnsubscribe.current) {
      progressUnsubscribe.current()
      progressUnsubscribe.current = null
    }
  }, [])

  const openDirectory = useCallback(async () => {
    cleanup()
    const result = await window.electron.openDirectory()
    await processDirectoryResult(result)
  }, [cleanup, processDirectoryResult])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const files = Array.from(e.dataTransfer.files)
    const mp4s = files.filter(f => f.name.toLowerCase().endsWith('.mp4'))
    if (mp4s.length === 0) return
    const paths = mp4s
      .map(f => (f as File & { path: string }).path)
      .filter(Boolean)
    if (paths.length === 0) return
    cleanup()
    const result = await window.electron.loadDropped(paths)
    await processDirectoryResult(result)
  }, [cleanup, processDirectoryResult])

  const goNext = useCallback(() => {
    setCurrentIndex(i => clips.length === 0 ? 0 : Math.min(i + 1, clips.length - 1))
  }, [clips.length])

  const goPrev = useCallback(() => {
    setCurrentIndex(i => Math.max(i - 1, 0))
  }, [])

  const goTo = useCallback((index: number) => {
    setCurrentIndex(index)
  }, [])

  const currentClip = clips[currentIndex] ?? null
  const currentFilename = currentClip?.split(/[\\/]/).pop() ?? ''

  return {
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
  }
}
