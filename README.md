# ClipPress

Compresses ShadowPlay MP4 clips under Discord's 20MB upload limit. Drop clips in, they compress in the background, copy to clipboard when done.

---

## How the app is structured

Electron apps run as **two separate processes** that can only talk to each other through a message-passing system called IPC. This is the most important thing to understand about this codebase.

```
┌─────────────────────────────────────────────────────────┐
│  MAIN PROCESS  (electron/main.ts)                       │
│                                                         │
│  - Has access to: filesystem, ffmpeg, clipboard         │
│  - Runs: compression queue, file I/O, OS dialogs        │
│  - Cannot touch: the UI at all                          │
└───────────────────────┬─────────────────────────────────┘
                        │
                   IPC messages
              (like API calls, but local)
                        │
┌───────────────────────▼─────────────────────────────────┐
│  RENDERER PROCESS  (src/)                               │
│                                                         │
│  - Has access to: React, the DOM, UI state              │
│  - Runs: clip list, player, status badges               │
│  - Cannot touch: filesystem or ffmpeg directly          │
└─────────────────────────────────────────────────────────┘
```

The bridge between them is `electron/preload.ts`, which defines exactly what the renderer is allowed to ask the main process to do.

---

## Data flow — what happens when you drop a clip

```
1. User drops a file onto the app window
        ↓
2. App.tsx catches the drag event
        ↓
3. useClips.ts → calls window.electron.loadDropped(filePaths)
        ↓  [IPC: renderer → main]
4. main.ts receives the call, queues the file for compression
        ↓
5. main.ts runs ffmpeg in the background
        ↓  [IPC: main → renderer, pushed events]
6. main.ts sends progress ticks  →  useClips updates compressProgress
   main.ts sends "ready" event   →  useClips updates discordStatus to 'ready'
        ↓
7. App.tsx sees the status transition → auto-copies to clipboard → shows toast
```

---

## Key files and what they own

### `electron/main.ts`
Everything that touches the operating system. If you need to read/write files, run ffmpeg, access the clipboard, or show an OS dialog — it lives here.

- `compressForDiscord()` — ffmpeg compression logic, bitrate math
- `queueFiles()` — compression queue, one file at a time
- `loadDropped()` — handles drag-and-drop file paths
- `openDir()` — handles folder picker, scans for .mp4s
- IPC handlers at the bottom (`ipcMain.handle(...)`)

### `electron/preload.ts`
The security boundary. Defines `window.electron` — the only way the UI can communicate with the main process. If you want to add a new IPC call, you register it here.

### `src/hooks/useClips.ts`
All clip-related state. The single source of truth for the renderer. Owns:
- The clip list and current index
- `discordStatus` — pending / converting / ready / error per clip
- `compressProgress` — 0–100 per clip
- `discordPaths` — where the compressed file lives
- IPC listeners (registered once on mount, never re-registered)

If something is wrong with clip state, start here.

### `src/App.tsx`
Root layout. Wires hooks to components. Owns:
- Drag-and-drop event handlers
- Toast notification state
- Auto-copy logic (watches for status transitions on the current clip)
- Update card UI

### `src/components/ClipNavigator.tsx`
The left sidebar. Pure display component — receives everything as props, emits events up. Owns:
- Clip list with status badges
- Prev/Next navigation buttons
- Version display

### `src/components/ClipPlayer.tsx`
The video player. Owns:
- `<video>` element for MP4 playback
- Copy-to-clipboard button
- Compression progress bar

---

## IPC channels — the contract between processes

| Channel | Direction | What it does |
|---|---|---|
| `clips:open-directory` | renderer → main | Opens OS folder picker, returns clip list |
| `clips:load-dropped` | renderer → main | Registers dropped files, queues compression |
| `clips:copy-discord` | renderer → main | Writes compressed file path to clipboard |
| `clips:discord-ready` | main → renderer | Push: compression finished (or errored) |
| `clips:compress-progress` | main → renderer | Push: compression percent tick |
| `app:update-status` | main → renderer | Push: OTA update downloading / ready |
| `app:restart-and-install` | renderer → main | Tells main to quit and install the update |

---

## Where to go to make a change

| What you want to change | File to open |
|---|---|
| Compression quality or file size target | `electron/main.ts` → `COMPRESS_STEPS` / `DISCORD_TARGET_BYTES` |
| What happens when a clip finishes compressing | `src/App.tsx` → the `useEffect` watching `discordStatus` |
| The sidebar UI | `src/components/ClipNavigator.tsx` |
| The video player UI | `src/components/ClipPlayer.tsx` |
| How clips accumulate across drops | `src/hooks/useClips.ts` → `applyResult()` |
| Adding a new IPC call | 1. `electron/main.ts` → add `ipcMain.handle()` 2. `electron/preload.ts` → expose it 3. `src/electron.d.ts` → add the type |
| Styles | `src/App.css` |

---

## Commands

```bash
npm run dev       # start dev server (hot reload)
npm test          # run unit tests
release.bat       # test → build → version bump → publish to GitHub
stage.bat         # test → build staging installer → serve locally for OTA testing
```

---

## Release pipeline

```
release.bat
  → npm test (gate — fails here if tests break)
  → npm run build (gate — fails here if TypeScript errors)
  → npm version patch (bumps 0.1.19 → 0.1.20, creates git tag)
  → git push + git push --tags
        ↓
  GitHub Actions picks up the tag
        ↓
  Builds installer on Windows VM
  Validates OTA artifacts (SHA512 check)
  Publishes to GitHub Releases
        ↓
  All installed copies of ClipPress check for the new version on next launch
```
