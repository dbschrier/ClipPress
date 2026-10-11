import { useState, useCallback, useRef, useEffect } from 'react'
import type { NotesStore, ShareStatus, ShareStatusMap } from '../types'

export function useClips() {
  const [clipDir, setClipDir] = useState('')
  const [clips, setClips] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [notes, setNotes] = useState<NotesStore>({})
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved'>('saved')
  const [discordStatus, setDiscordStatus] = useState<ShareStatusMap>({})
  const [discordPaths, setDiscordPaths] = useState<Record<string, string>>({})
  const [compressProgress, setCompressProgress] = useState<Record<string, number>>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
    const { dir, clips: newClips, discordPaths: existingDiscordPaths } = result

    setClipDir(dir)
    setClips(newClips)
    setCurrentIndex(0)
    const loaded = await window.electron.loadNotes(dir)
    setNotes(loaded)
    setSaveStatus('saved')

    const filenames = newClips.map(p => p.split(/[\\/]/).pop()!)
    const initialStatus: ShareStatusMap = {}
    filenames.forEach(f => {
      initialStatus[f] = existingDiscordPaths[f] ? 'ready' : 'pending'
    })
    setDiscordStatus(initialStatus)
    setDiscordPaths(existingDiscordPaths)

    discordUnsubscribe.current = window.electron.onDiscordReady(({ mp4Filename, discordPath, status }) => {
      setDiscordStatus(prev => ({ ...prev, [mp4Filename]: status }))
      if (status === 'ready') {
        setDiscordPaths(prev => ({ ...prev, [mp4Filename]: discordPath }))
        setCompressProgress(prev => ({ ...prev, [mp4Filename]: 100 }))
      }
    })

    progressUnsubscribe.current = window.electron.onCompressProgress(({ mp4Filename, percent }) => {
      setCompressProgress(prev => ({ ...prev, [mp4Filename]: percent }))
    })
  }, [])

  const cleanup = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
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

  const saveNote = useCallback((text: string) => {
    if (!clipDir || clips.length === 0) return
    const filename = clips[currentIndex].split(/[\\/]/).pop()!

    setNotes(prev => ({
      ...prev,
      [filename]: { filename, notes: text, updatedAt: new Date().toISOString() }
    }))

    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const savedFilename = filename
    saveTimer.current = setTimeout(() => {
      window.electron.saveNote(clipDir, savedFilename, text).then(() => {
        setSaveStatus(prev => prev === 'unsaved' ? 'saved' : prev)
      })
    }, 500)
  }, [clipDir, clips, currentIndex])

  const currentClip = clips[currentIndex] ?? null
  const currentFilename = currentClip?.split(/[\\/]/).pop() ?? ''
  const currentNote = currentFilename ? (notes[currentFilename]?.notes ?? '') : ''

  return {
    clipDir,
    clips,
    currentIndex,
    currentClip,
    currentFilename,
    currentNote,
    saveStatus,
    discordStatus,
    discordPaths,
    compressProgress,
    openDirectory,
    handleDrop,
    goNext,
    goPrev,
    goTo,
    saveNote,
  }
}
