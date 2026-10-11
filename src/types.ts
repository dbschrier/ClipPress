export interface ClipNote {
  filename: string
  notes: string
  updatedAt: string
}

export type NotesStore = Record<string, ClipNote>

export type ShareStatus = 'pending' | 'converting' | 'ready' | 'error'
export type ShareStatusMap = Record<string, ShareStatus>
