import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClips } from '../hooks/useClips'

// --- Shared mock state ---

type DiscordReadyCb = (d: { mp4Filename: string; discordPath: string; status: string }) => void
type ProgressCb    = (d: { mp4Filename: string; percent: number }) => void

let discordReadyListeners: DiscordReadyCb[] = []
let progressListeners: ProgressCb[] = []

function emitDiscordReady(d: Parameters<DiscordReadyCb>[0]) {
  discordReadyListeners.forEach(cb => cb(d))
}
function emitProgress(d: Parameters<ProgressCb>[0]) {
  progressListeners.forEach(cb => cb(d))
}

// --- Helpers ---

function makeResult(clips: string[], discordPaths: Record<string, string> = {}) {
  const dir = clips[0]?.replace(/\\/g, '/').split('/').slice(0, -1).join('/') ?? '/dir'
  return { dir, clips, discordPaths }
}

function makeDragEvent(filePaths: string[]): React.DragEvent {
  const files = filePaths.map(p => {
    const name = p.replace(/\\/g, '/').split('/').pop()!
    const f = new File([''], name, { type: 'video/mp4' })
    Object.defineProperty(f, 'path', { value: p })
    return f
  })
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: { files: files as unknown as FileList },
  } as unknown as React.DragEvent
}

// --- Per-test setup ---

beforeEach(() => {
  discordReadyListeners = []
  progressListeners = []

  window.electron = {
    openDirectory:     vi.fn(),
    loadDropped:       vi.fn(),
    copyDiscord:       vi.fn().mockResolvedValue(undefined),
    onUpdateStatus:    vi.fn(() => vi.fn()),
    restartAndInstall: vi.fn(),
    onDiscordReady: vi.fn((cb: DiscordReadyCb) => {
      discordReadyListeners.push(cb)
      return () => { discordReadyListeners = discordReadyListeners.filter(x => x !== cb) }
    }),
    onCompressProgress: vi.fn((cb: ProgressCb) => {
      progressListeners.push(cb)
      return () => { progressListeners = progressListeners.filter(x => x !== cb) }
    }),
  } as unknown as typeof window.electron
})

// --- Initial drop ---

describe('handleDrop — initial state', () => {
  it('new clips start as pending', async () => {
    vi.mocked(window.electron.loadDropped).mockResolvedValue(
      makeResult(['/clips/a.mp4'])
    )
    const { result } = renderHook(() => useClips())
    await act(async () => { await result.current.handleDrop(makeDragEvent(['/clips/a.mp4'])) })

    expect(result.current.discordStatus['a.mp4']).toBe('pending')
    expect(result.current.clips).toHaveLength(1)
  })

  it('already-compressed clips start as ready', async () => {
    vi.mocked(window.electron.loadDropped).mockResolvedValue(
      makeResult(['/clips/a.mp4'], { 'a.mp4': '/clips/_discord/a.mp4' })
    )
    const { result } = renderHook(() => useClips())
    await act(async () => { await result.current.handleDrop(makeDragEvent(['/clips/a.mp4'])) })

    expect(result.current.discordStatus['a.mp4']).toBe('ready')
    expect(result.current.discordPaths['a.mp4']).toBe('/clips/_discord/a.mp4')
  })

  it('mixed drop: compressed clips ready, new clips pending', async () => {
    vi.mocked(window.electron.loadDropped).mockResolvedValue(
      makeResult(
        ['/clips/a.mp4', '/clips/b.mp4'],
        { 'a.mp4': '/clips/_discord/a.mp4' }
      )
    )
    const { result } = renderHook(() => useClips())
    await act(async () => {
      await result.current.handleDrop(makeDragEvent(['/clips/a.mp4', '/clips/b.mp4']))
    })

    expect(result.current.discordStatus['a.mp4']).toBe('ready')
    expect(result.current.discordStatus['b.mp4']).toBe('pending')
  })

  it('non-mp4 files are ignored', async () => {
    const { result } = renderHook(() => useClips())
    await act(async () => {
      await result.current.handleDrop(makeDragEvent(['/clips/not-a-video.txt']))
    })

    expect(window.electron.loadDropped).not.toHaveBeenCalled()
    expect(result.current.clips).toHaveLength(0)
  })
})

// --- Accumulation ---

describe('handleDrop — accumulates across drops', () => {
  it('second drop appends to the first', async () => {
    vi.mocked(window.electron.loadDropped)
      .mockResolvedValueOnce(makeResult(['/clips/a.mp4']))
      .mockResolvedValueOnce(makeResult(['/clips/b.mp4']))

    const { result } = renderHook(() => useClips())

    await act(async () => { await result.current.handleDrop(makeDragEvent(['/clips/a.mp4'])) })
    await act(async () => { await result.current.handleDrop(makeDragEvent(['/clips/b.mp4'])) })

    expect(result.current.clips).toHaveLength(2)
    expect(result.current.clips[0]).toContain('a.mp4')
    expect(result.current.clips[1]).toContain('b.mp4')
  })

  it('duplicate paths are not added twice', async () => {
    vi.mocked(window.electron.loadDropped)
      .mockResolvedValue(makeResult(['/clips/a.mp4']))

    const { result } = renderHook(() => useClips())

    await act(async () => { await result.current.handleDrop(makeDragEvent(['/clips/a.mp4'])) })
    await act(async () => { await result.current.handleDrop(makeDragEvent(['/clips/a.mp4'])) })

    expect(result.current.clips).toHaveLength(1)
  })

  it('events for clips from earlier drops are still handled', async () => {
    vi.mocked(window.electron.loadDropped)
      .mockResolvedValueOnce(makeResult(['/clips/a.mp4']))
      .mockResolvedValueOnce(makeResult(['/clips/b.mp4']))

    const { result } = renderHook(() => useClips())

    await act(async () => { await result.current.handleDrop(makeDragEvent(['/clips/a.mp4'])) })
    await act(async () => { await result.current.handleDrop(makeDragEvent(['/clips/b.mp4'])) })

    // a.mp4 from the first drop should still receive events
    act(() => { emitDiscordReady({ mp4Filename: 'a.mp4', discordPath: '/x/a.mp4', status: 'ready' }) })

    expect(result.current.discordStatus['a.mp4']).toBe('ready')
    expect(result.current.discordStatus['b.mp4']).toBe('pending')
  })

  it('events for unknown filenames are ignored', async () => {
    vi.mocked(window.electron.loadDropped).mockResolvedValue(makeResult(['/clips/a.mp4']))
    const { result } = renderHook(() => useClips())
    await act(async () => { await result.current.handleDrop(makeDragEvent(['/clips/a.mp4'])) })

    act(() => { emitDiscordReady({ mp4Filename: 'unknown.mp4', discordPath: '/x', status: 'ready' }) })

    expect(result.current.discordStatus['unknown.mp4']).toBeUndefined()
  })
})

// --- Compression events ---

describe('compression events', () => {
  it('first progress tick promotes pending → converting', async () => {
    vi.mocked(window.electron.loadDropped).mockResolvedValue(makeResult(['/clips/a.mp4']))
    const { result } = renderHook(() => useClips())
    await act(async () => { await result.current.handleDrop(makeDragEvent(['/clips/a.mp4'])) })

    act(() => { emitProgress({ mp4Filename: 'a.mp4', percent: 12 }) })

    expect(result.current.discordStatus['a.mp4']).toBe('converting')
    expect(result.current.compressProgress['a.mp4']).toBe(12)
  })

  it('discord-ready marks clip as ready and stores path', async () => {
    vi.mocked(window.electron.loadDropped).mockResolvedValue(makeResult(['/clips/a.mp4']))
    const { result } = renderHook(() => useClips())
    await act(async () => { await result.current.handleDrop(makeDragEvent(['/clips/a.mp4'])) })

    act(() => {
      emitDiscordReady({ mp4Filename: 'a.mp4', discordPath: '/clips/_discord/a.mp4', status: 'ready' })
    })

    expect(result.current.discordStatus['a.mp4']).toBe('ready')
    expect(result.current.discordPaths['a.mp4']).toBe('/clips/_discord/a.mp4')
    expect(result.current.compressProgress['a.mp4']).toBe(100)
  })

  it('discord-ready with error marks clip as error', async () => {
    vi.mocked(window.electron.loadDropped).mockResolvedValue(makeResult(['/clips/a.mp4']))
    const { result } = renderHook(() => useClips())
    await act(async () => { await result.current.handleDrop(makeDragEvent(['/clips/a.mp4'])) })

    act(() => {
      emitDiscordReady({ mp4Filename: 'a.mp4', discordPath: '', status: 'error' })
    })

    expect(result.current.discordStatus['a.mp4']).toBe('error')
  })
})

// --- openDirectory ---

describe('openDirectory — appends same as handleDrop', () => {
  it('new clips start as pending', async () => {
    vi.mocked(window.electron.openDirectory).mockResolvedValue(
      makeResult(['/dir/a.mp4'])
    )
    const { result } = renderHook(() => useClips())
    await act(async () => { await result.current.openDirectory() })

    expect(result.current.discordStatus['a.mp4']).toBe('pending')
  })

  it('already-compressed clips start as ready', async () => {
    vi.mocked(window.electron.openDirectory).mockResolvedValue(
      makeResult(['/dir/a.mp4'], { 'a.mp4': '/dir/_discord/a.mp4' })
    )
    const { result } = renderHook(() => useClips())
    await act(async () => { await result.current.openDirectory() })

    expect(result.current.discordStatus['a.mp4']).toBe('ready')
  })

  it('open after drop appends, does not replace', async () => {
    vi.mocked(window.electron.loadDropped).mockResolvedValue(makeResult(['/clips/a.mp4']))
    vi.mocked(window.electron.openDirectory).mockResolvedValue(makeResult(['/dir/b.mp4']))

    const { result } = renderHook(() => useClips())
    await act(async () => { await result.current.handleDrop(makeDragEvent(['/clips/a.mp4'])) })
    await act(async () => { await result.current.openDirectory() })

    expect(result.current.clips).toHaveLength(2)
    expect(result.current.discordStatus['a.mp4']).toBe('pending')
    expect(result.current.discordStatus['b.mp4']).toBe('pending')
  })

  it('cancelled open dialog leaves state unchanged', async () => {
    vi.mocked(window.electron.openDirectory).mockResolvedValue(null)
    const { result } = renderHook(() => useClips())
    await act(async () => { await result.current.openDirectory() })

    expect(result.current.clips).toHaveLength(0)
  })
})
