import { useEffect, useRef, useState } from 'react'

interface NotesPanelProps {
  filename: string
  value: string
  onChange: (text: string) => void
  onGetTime: () => number
  saveStatus: 'saved' | 'unsaved'
}

const TAGS = ['Neutral', 'Combo', 'Punish', 'Defense', 'Movement', 'Edgeguard']

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function NotesPanel({ filename, value, onChange, onGetTime, saveStatus }: NotesPanelProps) {
  const [local, setLocal] = useState(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setLocal(value)
  }, [filename, value]) // eslint-disable-line react-hooks/exhaustive-deps -- value included to catch initial async load; local edits go through handleChange which keeps them in sync

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setLocal(e.target.value)
    onChange(e.target.value)
  }

  function insertAtCursor(text: string) {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newValue = local.slice(0, start) + text + local.slice(end)
    setLocal(newValue)
    onChange(newValue)
    requestAnimationFrame(() => {
      textarea.selectionStart = start + text.length
      textarea.selectionEnd = start + text.length
      textarea.focus()
    })
  }

  function handleStamp() {
    insertAtCursor(`[${formatTime(onGetTime())}] `)
  }

  function handleTag(tag: string) {
    insertAtCursor(`[${formatTime(onGetTime())}] [${tag}] `)
  }

  const displayName = filename ? filename.replace(/\.mp4$/i, '') : null

  return (
    <div className="notes-panel">
      <div className="notes-meta">
        <span className="notes-filename">{displayName ?? 'No clip selected'}</span>
        <span className={`save-status ${saveStatus}`}>
          {saveStatus === 'saved' ? 'Saved' : '● Unsaved'}
        </span>
      </div>
      <div className="notes-toolbar">
        <button className="stamp-btn" onClick={handleStamp} disabled={!filename}>
          ⏱ Stamp
        </button>
        {TAGS.map(tag => (
          <button
            key={tag}
            className="tag-btn"
            onClick={() => handleTag(tag)}
            disabled={!filename}
          >
            {tag}
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={local}
        onChange={handleChange}
        placeholder="Write notes for this clip..."
        disabled={!filename}
      />
    </div>
  )
}
