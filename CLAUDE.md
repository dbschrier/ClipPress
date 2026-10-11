# Melee Note Taker

## What This Is

Desktop app for reviewing NVIDIA ShadowPlay clips, writing timestamped notes per clip, and exporting Discord-ready GIFs.

Workflow: pick a clip directory → clips auto-convert to GIF in background → watch MP4 in player with full controls → write timestamped notes → right-click player to copy GIF for Discord.

## Stack

- **Electron** — desktop shell, filesystem access, IPC
- **React + TypeScript** — UI
- **HTML5 `<video>`** — MP4 playback with controls (pause, seek, timestamp)
- **ffmpeg** (`ffmpeg-static` + `fluent-ffmpeg`) — MP4 → GIF conversion, runs in main process
- **electron-clipboard-ex** — writes GIF file path to clipboard (preserves animation for Discord)
- **JSON sidecar** — `notes.json` in clip directory, keyed by MP4 filename

## Commands

```bash
npm install       # install deps
npm run dev       # start Electron + Vite dev server
npm run build     # production build
```

## Project Structure

```
├── CLAUDE.md
├── CLAUDE.rules.md
├── CLAUDE.style.md
├── index.html
├── package.json
├── tsconfig.json
├── electron.vite.config.ts
├── .gitignore
├── .claude/
│   └── agents/
│       ├── engineering/
│       │   ├── frontend-developer.md
│       │   ├── electron-architect.md
│       │   └── rapid-prototyper.md
│       └── testing/
│           ├── bug-finder.md
│           └── performance-checker.md
├── electron/
│   ├── main.ts           # IPC handlers, GIF conversion queue, ffmpeg, clipboard
│   └── preload.ts        # contextBridge — exposes electron API to renderer
└── src/
    ├── types.ts           # ClipNote, NotesStore, GifStatus, GifStatusMap
    ├── electron.d.ts      # window.electron type declarations
    ├── main.tsx           # React entry point
    ├── App.tsx            # Root layout + toast notification state
    ├── App.css
    ├── components/
    │   ├── ClipPlayer.tsx     # <video> MP4 player, right-click copies GIF
    │   ├── ClipNavigator.tsx  # clip list with per-clip GIF status badge
    │   └── NotesPanel.tsx     # textarea, timestamp/tag toolbar, save indicator
    └── hooks/
        └── useClips.ts    # all state: clips, notes, gifStatus, gifPaths
```

## Agents

Specialized subagents live in `.claude/agents/`. Use them to keep work focused:

| Agent | Use when |
|---|---|
| `frontend-developer` | Building React components, hooks, UI |
| `electron-architect` | IPC handlers, file I/O, main process |
| `rapid-prototyper` | Want something on screen fast |
| `bug-finder` | Reviewing before calling a feature done |
| `performance-checker` | App feels slow or janky |

## IPC Channels

| Channel | Direction | Description |
|---|---|---|
| `clips:open-directory` | renderer → main | Opens OS folder picker, returns `{ dir, clips, gifPaths }`, kicks off GIF conversion |
| `notes:load` | renderer → main | Loads `notes.json` from a directory, returns `NotesStore` |
| `notes:save` | renderer → main | Writes updated note for one clip to `notes.json` |
| `clips:copy-gif` | renderer → main | Writes GIF file path to clipboard via `electron-clipboard-ex` |
| `clips:gif-ready` | main → renderer | Push event: `{ mp4Filename, gifPath, status }` as each GIF finishes |

## Data Model

```ts
interface ClipNote {
  filename: string    // "2025-03-21 18-42-30.mp4"
  notes: string
  updatedAt: string   // ISO
}
type NotesStore = Record<string, ClipNote>

type GifStatus = 'pending' | 'converting' | 'ready' | 'error'
type GifStatusMap = Record<string, GifStatus>  // keyed by MP4 filename
```

## GIF Conversion

- Triggered automatically on `clips:open-directory`
- GIFs stored in `{clipDir}/_gifs/{filename}.gif`
- Two-pass ffmpeg: palettegen → paletteuse (best quality for size)
- 15fps, adaptive resolution: 640px → 480px → 320px until ≤ 8MB (Discord free limit)
- Sequential queue — one conversion at a time to avoid CPU overload
- Already-converted GIFs are skipped on subsequent directory opens

## ShadowPlay Conventions

- Flat directory, no subdirectories
- Filename: `YYYY-MM-DD HH-MM-SS.mp4`
- Codec: H.264, container: MP4

## Decisions Made

- **Video player shows MP4** (not GIF) — enables real pause/seek/timestamp; GIF is for sharing only
- **Right-click player → copies GIF** via file-path clipboard (not bitmap) — Discord receives animated GIF, not a static PNG
- **Notes stored as `notes.json`** per clip directory — simple, portable, human-readable
- **`electron-clipboard-ex`** over `clipboard.writeImage` — writeImage only pastes first frame as PNG; file-path clipboard preserves animation
- No cloud sync, no tagging, no clip editing — out of scope

## Current Status

- [x] Project scaffolded
- [x] Electron main process + IPC
- [x] Directory picker
- [x] Video player (MP4, with controls)
- [x] Clip navigator with GIF status badges
- [x] Notes panel with auto-save
- [x] Timestamped notes + tag buttons
- [x] GIF conversion (background, persistent, Discord-sized)
- [x] Right-click to copy GIF + toast notification

@CLAUDE.rules.md
@CLAUDE.style.md
