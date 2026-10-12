import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Stub window.electron so imports don't crash before per-test mocks are applied
Object.defineProperty(window, 'electron', {
  value: {},
  writable: true,
  configurable: true,
})

// HTMLMediaElement (video) is not implemented in jsdom — stub the methods ClipPlayer calls
Object.defineProperty(HTMLMediaElement.prototype, 'pause', { value: vi.fn(), writable: true })
Object.defineProperty(HTMLMediaElement.prototype, 'load',  { value: vi.fn(), writable: true })
