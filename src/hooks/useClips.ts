import { useState, useCallback, useRef, useEffect } from 'react'
import type { ShareStatus, ShareStatusMap } from '../types'

export function useClips() {
  const [clips, setClips] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [discordStatus, setDiscordStatus] = useState<ShareStatusMap>({})
  const [discordPaths, setDiscordPaths] = useState<Record<string, string>>({})
  const [compressProgress, setCompressProgress] = useState<Record<string, number>>({})

  // Mirror of clips kept in a ref so applyResult can read it without stale closures.
  const clipsRef = useRef<string[]>([])

  // Single persistent pair of IPC listeners for the lifetime of the component.
  // The `mp4Filename in prev` guard scopes events to filenames we actually track,
  // replacing the old per-session filenames Set.
  useEffect(() => {
    const unsubDiscord = window.electron.onDiscordReady(({ mp4Filename, discordPath, status }) => {
      setDiscordStatus(prev => {
        if (!(mp4Filename in prev)) return prev
        return { ...prev, [mp4Filename]: status as ShareStatus }
      })
      if (status === 'ready') {
        setDiscordPaths(prev => ({ ...prev, [mp4Filename]: discordPath }))
        setCompressProgress(prev => ({ ...prev, [mp4Filename]: 100 }))
      }
    })

    const unsubProgress = window.electron.onCompressProgress(({ mp4Filename, percent }) => {
      setDiscordStatus(prev => {
        if (!(mp4Filename in prev)) return prev
        if (prev[mp4Filename] === 'pending') return { ...prev, [mp4Filename]: 'converting' }
        return prev
      })
      setCompressProgress(prev => ({ ...prev, [mp4Filename]: percent }))
    })

    return () => {
      unsubDiscord()
      unsubProgress()
    }
  }, [])

  // Append new clips from a drop or open-directory result.
  // Duplicate paths are silently skipped.
  const applyResult = useCallback((
    result: { clips: string[]; discordPaths: Record<string, string> } | null
  ) => {
    if (!result) return

    const { clips: newClips, discordPaths: existingDiscordPaths } = result
    const current = clipsRef.current

    const existingSet = new Set(current)
    const unique = newClips.filter(c => !existingSet.has(c))
    if (unique.length === 0) return

    const next = [...current, ...unique]
    clipsRef.current = next
    setClips(next)

    // Navigate to the first new clip that still needs compression.
    const firstPending = unique.findIndex(p => !existingDiscordPaths[p.split(/[\\/]/).pop()!])
    setCurrentIndex(current.length + (firstPending >= 0 ? firstPending : 0))

    setDiscordStatus(prev => {
      const updates: ShareStatusMap = {}
      for (const p of unique) {
        const f = p.split(/[\\/]/).pop()!
        updates[f] = existingDiscordPaths[f] ? 'ready' : 'pending'
      }
      return { ...prev, ...updates }
    })

    setDiscordPaths(prev => ({ ...prev, ...existingDiscordPaths }))

    setCompressProgress(prev => {
      const resets: Record<string, number> = {}
      for (const p of unique) {
        const f = p.split(/[\\/]/).pop()!
        resets[f] = 0
      }
      return { ...prev, ...resets }
    })
  }, [])

  const openDirectory = useCallback(async () => {
    const result = await window.electron.openDirectory()
    applyResult(result)
  }, [applyResult])

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
    const result = await window.electron.loadDropped(paths)
    applyResult(result)
  }, [applyResult])

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
