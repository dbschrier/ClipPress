import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClipNavigator } from '../components/ClipNavigator'
import type { ShareStatusMap } from '../types'

const CLIPS = [
  '/clips/2025-01-01 18-00-00.mp4',
  '/clips/2025-01-02 18-00-00.mp4',
  '/clips/2025-01-03 18-00-00.mp4',
]

function renderNav(overrides: {
  clips?: string[]
  currentIndex?: number
  discordStatus?: ShareStatusMap
  compressProgress?: Record<string, number>
  onSelect?: (i: number) => void
  version?: string
  newVersion?: string | null
} = {}) {
  const props = {
    clips: CLIPS,
    currentIndex: 0,
    onSelect: vi.fn(),
    onOpen: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    discordStatus: {} as ShareStatusMap,
    compressProgress: {},
    version: '1.0.0',
    newVersion: null,
    ...overrides,
  }
  return { ...render(<ClipNavigator {...props} />), props }
}

// --- Empty state ---

describe('empty state', () => {
  it('shows drop prompt when no clips', () => {
    renderNav({ clips: [] })
    expect(screen.getByText(/Drop clips or open folder/i)).toBeInTheDocument()
  })

  it('does not render the clip list', () => {
    renderNav({ clips: [] })
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})

// --- Clip list ---

describe('clip list', () => {
  it('renders one item per clip', () => {
    renderNav()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('strips .mp4 extension from displayed name', () => {
    renderNav()
    expect(screen.getByText('2025-01-01 18-00-00')).toBeInTheDocument()
  })

  it('marks the current clip as active', () => {
    renderNav({ currentIndex: 1 })
    const items = screen.getAllByRole('listitem')
    expect(items[1].className).toContain('active')
    expect(items[0].className).not.toContain('active')
  })

  it('calls onSelect with the correct index when a clip is clicked', async () => {
    const onSelect = vi.fn()
    renderNav({ onSelect })
    await userEvent.click(screen.getAllByRole('listitem')[2])
    expect(onSelect).toHaveBeenCalledWith(2)
  })
})

// --- Status badges ---

describe('status badges', () => {
  it('shows a dot badge for ready clips', () => {
    renderNav({ discordStatus: { '2025-01-01 18-00-00.mp4': 'ready' } })
    const dot = document.querySelector('.share-badge--ready')
    expect(dot).toBeInTheDocument()
  })

  it('shows a dot badge for error clips', () => {
    renderNav({ discordStatus: { '2025-01-01 18-00-00.mp4': 'error' } })
    expect(document.querySelector('.share-badge--error')).toBeInTheDocument()
  })

  it('shows a dot badge for pending clips', () => {
    renderNav({ discordStatus: { '2025-01-01 18-00-00.mp4': 'pending' } })
    expect(document.querySelector('.share-badge--pending')).toBeInTheDocument()
  })
})

// --- Per-clip compression progress ---

describe('compression progress in sidebar', () => {
  it('shows percentage instead of dot when a clip is converting', () => {
    renderNav({
      discordStatus: { '2025-01-01 18-00-00.mp4': 'converting' },
      compressProgress: { '2025-01-01 18-00-00.mp4': 67 },
    })
    expect(screen.getByText('67%')).toBeInTheDocument()
    expect(document.querySelector('.share-badge--converting')).not.toBeInTheDocument()
  })

  it('shows percentage for each converting clip independently', () => {
    renderNav({
      discordStatus: {
        '2025-01-01 18-00-00.mp4': 'converting',
        '2025-01-02 18-00-00.mp4': 'converting',
        '2025-01-03 18-00-00.mp4': 'pending',
      },
      compressProgress: {
        '2025-01-01 18-00-00.mp4': 43,
        '2025-01-02 18-00-00.mp4': 91,
      },
    })
    expect(screen.getByText('43%')).toBeInTheDocument()
    expect(screen.getByText('91%')).toBeInTheDocument()
    expect(document.querySelector('.share-badge--pending')).toBeInTheDocument()
  })

  it('shows dot (not percentage) once a clip finishes', () => {
    renderNav({
      discordStatus: { '2025-01-01 18-00-00.mp4': 'ready' },
      compressProgress: { '2025-01-01 18-00-00.mp4': 100 },
    })
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
    expect(document.querySelector('.share-badge--ready')).toBeInTheDocument()
  })
})

// --- Footer ---

describe('footer', () => {
  it('shows clip counter', () => {
    renderNav({ currentIndex: 1 })
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('shows version', () => {
    renderNav({ version: '1.2.3' })
    expect(screen.getByText('v1.2.3')).toBeInTheDocument()
  })

  it('shows upgrade arrow when newVersion is set', () => {
    renderNav({ version: '1.2.3', newVersion: '1.2.4' })
    expect(screen.getByText('v1.2.3 → v1.2.4')).toBeInTheDocument()
  })
})
