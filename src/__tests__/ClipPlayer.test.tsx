import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClipPlayer } from '../components/ClipPlayer'
import type { ShareStatus } from '../types'

function renderPlayer(overrides: {
  filePath?: string | null
  discordPath?: string | null
  discordStatus?: ShareStatus
  progress?: number
  onCopyAttempt?: (msg: string) => void
} = {}) {
  const props = {
    filePath: null,
    discordPath: null,
    discordStatus: 'pending' as ShareStatus,
    progress: 0,
    onCopyAttempt: vi.fn(),
    ...overrides,
  }
  return render(<ClipPlayer {...props} />)
}

beforeEach(() => {
  window.electron = {
    copyDiscord: vi.fn().mockResolvedValue(undefined),
  } as unknown as typeof window.electron
})

// --- Empty state ---

describe('empty state (no clip loaded)', () => {
  it('shows drop prompt', () => {
    renderPlayer()
    expect(screen.getByText(/Drop a clip/i)).toBeInTheDocument()
  })

  it('does not show any overlay or badge', () => {
    renderPlayer()
    expect(screen.queryByText('In queue')).not.toBeInTheDocument()
    expect(screen.queryByText('Compressing')).not.toBeInTheDocument()
    expect(screen.queryByText(/paste into Discord/i)).not.toBeInTheDocument()
  })
})

// --- Pending state ---

describe('pending state (clip loaded, queued)', () => {
  it('shows "In queue" overlay', () => {
    renderPlayer({ filePath: '/clips/a.mp4' })
    expect(screen.getByText('In queue')).toBeInTheDocument()
  })

  it('does not show a progress percentage', () => {
    renderPlayer({ filePath: '/clips/a.mp4', progress: 0 })
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })
})

// --- Converting state ---

describe('converting state (actively compressing)', () => {
  it('shows "Compressing" label', () => {
    renderPlayer({ filePath: '/clips/a.mp4', discordStatus: 'converting', progress: 0 })
    expect(screen.getByText('Compressing')).toBeInTheDocument()
  })

  it('shows current progress percentage', () => {
    renderPlayer({ filePath: '/clips/a.mp4', discordStatus: 'converting', progress: 67 })
    expect(screen.getByText('67%')).toBeInTheDocument()
  })

  it('does not show the status badge', () => {
    renderPlayer({ filePath: '/clips/a.mp4', discordStatus: 'converting', progress: 50 })
    expect(screen.queryByText(/paste into Discord/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Compression failed')).not.toBeInTheDocument()
  })
})

// --- Ready state ---

describe('ready state (compressed, copied to clipboard)', () => {
  it('shows ready badge', () => {
    renderPlayer({
      filePath: '/clips/a.mp4',
      discordPath: '/clips/_discord/a.mp4',
      discordStatus: 'ready',
    })
    expect(screen.getByText('Ready — paste into Discord')).toBeInTheDocument()
  })

  it('does not show compression overlay', () => {
    renderPlayer({
      filePath: '/clips/a.mp4',
      discordPath: '/clips/_discord/a.mp4',
      discordStatus: 'ready',
    })
    expect(screen.queryByText('In queue')).not.toBeInTheDocument()
    expect(screen.queryByText('Compressing')).not.toBeInTheDocument()
  })
})

// --- Error state ---

describe('error state (compression failed)', () => {
  it('shows error badge', () => {
    renderPlayer({ filePath: '/clips/a.mp4', discordStatus: 'error' })
    expect(screen.getByText('Compression failed')).toBeInTheDocument()
  })
})

// --- Right-click / copy behaviour ---

describe('right-click context menu', () => {
  it('calls onCopyAttempt with ready message when status is ready', async () => {
    const onCopyAttempt = vi.fn()
    renderPlayer({
      filePath: '/clips/a.mp4',
      discordPath: '/clips/_discord/a.mp4',
      discordStatus: 'ready',
      onCopyAttempt,
    })

    fireEvent.contextMenu(screen.getByRole('region', { hidden: true }) ?? document.querySelector('.clip-player')!)

    await vi.waitFor(() => {
      expect(window.electron.copyDiscord).toHaveBeenCalledWith('/clips/_discord/a.mp4')
    })
  })

  it('calls onCopyAttempt with "Still compressing..." when converting', () => {
    const onCopyAttempt = vi.fn()
    renderPlayer({
      filePath: '/clips/a.mp4',
      discordStatus: 'converting',
      onCopyAttempt,
    })

    fireEvent.contextMenu(document.querySelector('.clip-player')!)

    expect(onCopyAttempt).toHaveBeenCalledWith('Still compressing...')
    expect(window.electron.copyDiscord).not.toHaveBeenCalled()
  })

  it('calls onCopyAttempt with "Not ready yet" when pending', () => {
    const onCopyAttempt = vi.fn()
    renderPlayer({
      filePath: '/clips/a.mp4',
      discordStatus: 'pending',
      onCopyAttempt,
    })

    fireEvent.contextMenu(document.querySelector('.clip-player')!)

    expect(onCopyAttempt).toHaveBeenCalledWith('Not ready yet')
  })

  it('does nothing when no clip is loaded', () => {
    const onCopyAttempt = vi.fn()
    renderPlayer({ filePath: null, onCopyAttempt })

    fireEvent.contextMenu(document.querySelector('.clip-player')!)

    expect(onCopyAttempt).not.toHaveBeenCalled()
    expect(window.electron.copyDiscord).not.toHaveBeenCalled()
  })
})
