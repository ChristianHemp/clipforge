# Video Editor JS

A timeline-based video editor that runs entirely in the browser — upload video, image, and audio files, arrange them on a multi-track timeline, trim and reposition clips, add text overlays, mix audio, and export a finished video file. No backend, no server-side rendering, no account system. Everything — decoding, compositing, mixing, and encoding — happens client-side using native browser APIs.

## Overview

The editor currently supports:

- **Media upload** — drag in local video, image, and audio files; metadata (duration, dimensions) is read directly from the files in-browser
- **Timeline editing** — add clips to video/audio/text tracks, drag to reposition, drag either edge to trim
- **Synchronized playback** — a single authoritative clock drives video, audio, and overlay rendering together, with drift correction and correct scrub-seek behavior
- **Text overlays** — timed, positionable, styleable text composited on top of video in both Preview and the exported file
- **Audio mixing** — multiple overlapping audio sources (standalone clips and a video clip's own embedded audio) play and export together through a real Web Audio graph
- **Per-clip volume** — independent volume/mute per clip, live during playback and preserved in export
- **Undo/redo** — full history for structural edits, drags, trims, and property changes, with continuous gestures collapsed into single steps
- **Local persistence** — the project and all uploaded media survive a page refresh via IndexedDB, with no server round-trip
- **Browser-side export** — renders the composed timeline to a downloadable WebM file using `<canvas>` and `MediaRecorder`, with no server-side transcoding step

## Motivation

This project started as an exercise in **reimplementing** a video editing application around a deliberately different architecture and stack, rather than translating an existing codebase file-by-file. It was inspired by an existing AI-powered video editor, but the implementation here is a clean-room rebuild that:

- removes the AI generation/chat layer entirely and rebuilds the product around **manual editing** — every clip, trim, and overlay is placed by direct user interaction, not generated
- is written in **plain JavaScript/JSX**, not TypeScript, using runtime validation and defensive defaults instead of a compile-time type system
- uses a **simpler, purpose-built architecture** sized for a standalone client-side editor, rather than carrying over machinery (AI orchestration, multi-provider service integrations, a generalized effects/skill registry) that a non-AI, single-purpose editor doesn't need

The interesting engineering problems turned out to be the same ones any browser-based NLE has to solve regardless of stack: keeping a timeline clock authoritative over multiple independently-decoding media elements, mapping timeline time to source-media time under trimming, mixing overlapping audio sources without double-playback, and reconstructing a live composited video stream frame-by-frame for recording — all with only what the browser provides natively.

## Features

**Timeline editing**
- Multi-track timeline (video, audio, text), each track holding an ordered list of clips
- Pointer-based drag-to-move and drag-to-trim (both edges) using native Pointer Events and Pointer Capture
- Click-to-seek and a live playhead on the timeline ruler
- Clip selection, deletion, and an Inspector panel for per-clip properties

**Playback**
- One authoritative `requestAnimationFrame` clock drives the entire timeline — not any individual `<video>` element's own clock
- Automatic drift correction: media elements are only reseeked when they drift past a tolerance, avoiding audible/visible stutter from constant seeking
- Correct behavior on pause, resume, and scrub — including scrubbing while playback is active

**Audio**
- A persistent Web Audio graph (`AudioContext` → `GainNode`s → `destination`) mixes every simultaneously-active audio source, including a video clip's own embedded dialogue
- Per-clip volume (0–100%) and mute, applied live to the corresponding `GainNode` with short-ramp smoothing to avoid clicks
- The same source video's audio is never double-played: once routed through `createMediaElementSource`, native output is spec-suppressed in favor of the graph

**Text overlays**
- Timed text clips with position (normalized 0–1 coordinates), font size, color, weight, and alignment
- Draggable directly in the Preview panel; position is stored independent of Preview's on-screen pixel size so it renders identically at export resolution

**Persistence / history**
- IndexedDB stores project structure and every uploaded asset's raw binary data (not object URLs, which are only valid for the tab that created them)
- Snapshot-based undo/redo; continuous interactions (drags, trims, slider input, typing) are grouped into a single history entry via a begin/commit transaction pattern, not one entry per intermediate event
- A "Clear Project" action is treated as a history boundary — undo cannot resurrect a project that was explicitly cleared

**Export**
- Renders the composed timeline — video, images, text overlays, and mixed audio — to a `.webm` file entirely client-side
- Uses `canvas.captureStream()` combined with a `MediaStreamAudioDestinationNode`'s track, recorded together by `MediaRecorder`
- Cancellable, with progress reporting, and fully isolated from live editor state (edits made during export don't affect the file being produced)

## Architecture

```text
User interaction (pointer / keyboard / click)
        ↓
React components  (Timeline, Preview, Inspector, Toolbar)
        ↓
Zustand stores     (projectStore · editorStore · historyStore)
        ↓                    ↓                      ↓
   pure helpers        RAF playback clock      undo/redo snapshots
 (playback.js,         (usePlaybackClock)
  clipEditing.js)
        ↓
Preview compositor  +  Web Audio graph
        ↓                    ↓
  IndexedDB              Canvas + MediaRecorder
 (persistence)              (export)
```

**State is split into three deliberately separate stores**, each with a different lifetime and a different consumer:

- **`projectStore`** — the persistent project itself: uploaded assets and the tracks/clips that reference them. This is the only state that gets saved to IndexedDB and the only state undo/redo snapshots.
- **`editorStore`** — transient UI/session state: the playhead position, play/pause flag, current selection, hydration status. None of this is ever persisted or included in undo history — undoing a clip move shouldn't rewind the playhead, and refreshing the page is expected to reset playback state even though the project itself survives.
- **`historyStore`** — the undo/redo stacks. Holds `{past, future}` arrays of project snapshots and a small transaction API (`beginTransaction` / `commitTransaction` / `cancelTransaction`) that lets continuous gestures produce exactly one history entry regardless of how many intermediate updates they generate.

Because `projectStore`'s mutators always build new arrays/objects rather than mutating existing ones in place, a history snapshot can hold a plain **reference** to a past `{assets, tracks}` value with no cloning — a later edit can never reach back and change what a snapshot is already holding. The same property is what makes exporting from a live snapshot safe: an edit made mid-export can't retroactively affect the frozen state the export is reading from.

**IndexedDB persistence** stores two kinds of data separately: a small structural record (`tracks` plus asset *metadata*) and the actual binary `Blob` for each uploaded file, keyed by asset id. Blob URLs (`blob:https://...`) are never persisted — they're only valid for the browser session that created them — so on load, every asset's real `Blob` is read back and a fresh object URL is created for it.

**Timeline/pointer editing** is built on native Pointer Events rather than a drag-and-drop library. One small primitive (`beginPointerDrag`) handles pointer capture and reports a `(deltaX, deltaY)` since pointerdown; move/trim math (in `clipEditing.js`) and 2D spatial dragging (for text overlay positioning) both build on the same primitive.

**The Preview compositor** renders a fixed-aspect-ratio "composition frame" (matching the export canvas's dimensions) containing whichever video/image clip is active, any currently-active text overlays, and invisible `<audio>`/routed `<video>` elements for audio playback — all driven by the same `currentTime` from `editorStore`.

**The export pipeline** is intentionally isolated from the editor: it runs its own `requestAnimationFrame` clock (never `editorStore.currentTime`), creates its own hidden media elements and its own temporary `AudioContext`, and writes to an offscreen canvas — none of it touches what's on screen or what the user hears while it runs.

## Major implementation details

**An authoritative timeline clock, not per-element clocks.** Both the editor and export drive a single `currentTime`/`exportTime` value via `requestAnimationFrame`, computed from a `(wallClockTime, timelineTime)` baseline rather than accumulated per-frame deltas (which would drift over a long session). Every media element — video, audio, or overlay — is a *follower* of this clock, corrected via seeks only when it drifts past a tolerance, never treated as the source of truth itself.

**Timeline time vs. source media time.** A clip's position on the timeline (`startTime`) is independent of where in its underlying source file it starts playing from (`trimStart`). The mapping — `sourceTime = trimStart + (currentTime - clip.startTime)` — is centralized in one helper and reused identically by live playback and by export, so trimming behaves consistently in both.

**Pointer-based drag/trim math with delta-from-origin, not accumulated deltas.** Each drag snapshots the clip's starting values once at `pointerdown`; every `pointermove` computes new values from that fixed origin plus the pointer's *total* movement so far, not from the previous frame's value — this avoids compounding rounding error over a long drag and makes the math trivially unit-testable in isolation from React and the DOM.

**Normalized overlay coordinates.** Text overlay position is stored as `x`/`y` in `[0, 1]`, relative to the fixed composition size (not the Preview panel's current on-screen size, which varies with window size, and not the currently-playing video's own aspect ratio, which varies per clip). Preview maps this to CSS percentages; export maps it to canvas pixels via the same `width × normalized` arithmetic — both reference the identical composition dimensions, so a position looks the same in Preview as it does in the exported file.

**Web Audio mixing via `GainNode`s, not raw `<video>`/`<audio>` output.** Every audio-producing element — a standalone audio clip or a video clip's own embedded track — is connected once via `createMediaElementSource()` into a shared graph: `source → GainNode → destination`. This is what allows multiple simultaneously-active clips to mix together (impossible with native element playback alone), and per-clip volume is just that clip's `GainNode.gain` value. Export uses the identical pattern with its own temporary `AudioContext` feeding a `MediaStreamAudioDestinationNode`, whose output track is combined with the canvas's video track before being handed to `MediaRecorder`.

**Blob persistence in IndexedDB, not object URL persistence.** Object URLs are a runtime-only handle into the browser's memory and become invalid the moment the page reloads. The actual `Blob` for every uploaded file is what gets stored; a fresh object URL is created from it exactly once, at load time, and never written back to storage.

## Tech stack

| | |
|---|---|
| UI | React 19, plain JavaScript/JSX (no TypeScript) |
| State | Zustand |
| Build tool | Vite |
| Persistence | IndexedDB (native API, no wrapper library) |
| Media/compositing | Canvas 2D, `<video>`/`<audio>` elements, Pointer Events |
| Audio | Web Audio API (`AudioContext`, `GainNode`, `MediaElementAudioSourceNode`, `MediaStreamAudioDestinationNode`) |
| Export | `canvas.captureStream()` + `MediaRecorder` (WebM/VP9+Opus with fallbacks) |

No AI SDKs, no backend framework, no state-sync/collab library, no video-processing dependency (no ffmpeg.wasm, no WebCodecs) — the entire rendering and export pipeline is built on browser-native APIs.

## Getting started

```bash
npm install
npm run dev       # starts a local dev server
```

Other scripts:

```bash
npm run build      # production build to dist/
npm run preview    # serve the production build locally
```

Requires a Chromium-based browser (or another browser with full `MediaRecorder` + `MediaStreamAudioDestinationNode` support) for export; playback and editing work in any modern browser with Web Audio support.

## Project structure

```text
src/
├── components/      # Timeline, Preview, Inspector, Toolbar, and per-clip-type layers
├── store/           # projectStore, editorStore, historyStore (Zustand)
├── lib/             # pure helpers: timeline math, trim/move math, media sync, volume, geometry
├── audio/           # the editor's live Web Audio graph
├── export/          # the isolated export pipeline (its own clock, audio graph, canvas renderer)
└── hooks/           # cross-cutting effects: the playback clock, persistence
```

## Known limitations

- **Export is WebM only** — browser-native `MediaRecorder` MP4 muxing isn't reliably available across browsers, so there's no MP4 output option
- **Single-line text overlays** — no text wrapping/multiline layout
- **No transitions between clips** — cuts are hard cuts; crossfades or other transitions aren't implemented
- **No waveform display** — audio clips render as plain rectangles on the timeline, with no visual indication of the underlying audio content
- **No multi-select** — clips are edited one at a time

## Possible future directions

- Transitions between adjacent clips (requires the compositor to reason about two overlapping clips at a boundary)
- Waveform rendering in the timeline (requires offline audio decoding via `AudioContext.decodeAudioData`)
- Multi-select and group operations, building on the existing transaction-based history model
- Adjustable timeline zoom (the pixels-per-second scale is currently a fixed constant, but the math it feeds is already parameterized by it)
