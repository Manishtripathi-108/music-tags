# Implementation Plan: Remote Audio Quality Comparison & Sequential Downloader

## 1. Objective
Implement a high-fidelity, sequential audio search, quality comparison, and downloader feature for the user's music library based on the BitChord Addon API.
Key features:
- Dedicated route (`/compare`) to inspect and compare local audio tracks against remote audio catalogue availability.
- User-specified API Base URL and Target Download Directory.
- Search queries with customizable parameters (`q`, `quality`, `atmos`, custom settings).
- Persistent storage for matched track IDs in SQLite (`remote_track_matches`) so tracks are never re-fetched unless explicitly requested.
- Strict sequential execution for both search and download requests to prevent overwhelming the API.
- Dolby Atmos availability detection and badging (`atmos`, `audioModes: ["DOLBY_ATMOS"]`, `eac3-joc`, `dash`).
- Audio quality parsing and comparison (lossless vs lossy, bit-depth, sample rate, bitrate).
- Download mode options:
  - **Highest Lossless**: Downloads the best lossless stream. Strict rule: never download Dolby when this mode is selected.
  - **Dolby Atmos**: Downloads Dolby Atmos immersive mix. Strict rule: never download non-Dolby when this mode is selected.
- File naming: `${isrc}.${extension}` (with fallback if ISRC missing), no metadata added to downloaded files.
- Resilient streaming download with progress tracking and validation.

---

## 2. Architecture & File Structure

```
src/
├── app/
│   ├── compare/
│   │   └── page.tsx                          # Dedicated Audio Quality Comparison route
│   └── api/
│       └── remote/
│           ├── compare/route.ts              # Fetch local tracks + cached remote matches
│           ├── search-track/route.ts         # Search single track sequentially with caching
│           ├── stream-track/route.ts         # Resolve stream details (/stream/:id)
│           ├── download-track/route.ts       # Sequential streaming downloader to disk
│           └── test-connection/route.ts      # Validate API URL & Target Directory
├── domain/
│   └── remote-audio/
│       ├── types.ts                          # Domain types for API tracks, streams, comparison
│       ├── quality-analyzer.ts               # Audio quality parsing, scoring, and comparison
│       └── track-matcher.ts                  # Fuzzy title/artist matcher & Dolby detector
├── infrastructure/
│   └── database/
│       ├── schema.ts                         # remoteTrackMatches Drizzle table definition
│       └── init.ts                           # SQLite table creation for remote_track_matches
├── components/
│   └── compare/
│       ├── CompareTopBar.tsx                 # Navigation & summary stats
│       ├── CompareConfigPanel.tsx            # API link, directory, quality, atmos, download mode
│       ├── CompareProgressBar.tsx            # Live sequential search & download progress
│       ├── CompareTrackTable.tsx             # Detailed comparison table with badges
│       └── CompareTrackRow.tsx               # Individual comparison row with actions
└── store/
    └── compareStore.ts                       # Zustand state management for comparison & downloads
```

---

## 3. Data Schema: `remote_track_matches`
SQLite Table definition:
- `id` (TEXT PRIMARY KEY)
- `local_track_id` (TEXT NOT NULL REFERENCES audio_files(id))
- `provider_url` (TEXT NOT NULL)
- `remote_track_id` (TEXT NOT NULL)
- `title` (TEXT)
- `artist` (TEXT)
- `album` (TEXT)
- `duration` (REAL)
- `artwork_url` (TEXT)
- `format` (TEXT)
- `audio_quality` (TEXT)
- `is_dolby` (INTEGER DEFAULT 0)
- `has_dolby` (INTEGER DEFAULT 0)
- `stream_url` (TEXT)
- `raw_search_json` (TEXT)
- `raw_stream_json` (TEXT)
- `download_status` (TEXT DEFAULT 'idle')
- `download_error` (TEXT)
- `download_path` (TEXT)
- `downloaded_at` (INTEGER)
- `last_checked_at` (INTEGER)
- `created_at` (INTEGER NOT NULL)
- `updated_at` (INTEGER NOT NULL)

---

## 4. Execution Phases

### Phase 1: Foundations & Database Persistence
- Add `remoteTrackMatches` to `src/infrastructure/database/schema.ts`.
- Update `src/infrastructure/database/init.ts` with SQL migration.
- Define domain interfaces in `src/domain/remote-audio/types.ts`.

### Phase 2: Quality Analysis & Matcher Logic
- Implement `quality-analyzer.ts`: Parse quality strings like `"24-bit / 96 kHz"` and compare with local file technical specs.
- Implement `track-matcher.ts`: Best candidate selection and Dolby detection.
- Write unit tests in `tests/remote-audio/quality-analyzer.test.ts`.

### Phase 3: Backend API Routes
- Implement `src/app/api/remote/compare/route.ts` (GET comparison list).
- Implement `src/app/api/remote/search-track/route.ts` (Single track search with cache check).
- Implement `src/app/api/remote/stream-track/route.ts` (Stream resolution).
- Implement `src/app/api/remote/download-track/route.ts` (Stream download to `${isrc}.${ext}`).
- Implement `src/app/api/remote/test-connection/route.ts` (API & directory test).

### Phase 4: Frontend State & UI (`/compare`)
- Create `src/store/compareStore.ts` with sequential search and download worker queues.
- Build comparison page UI with:
  - API Link & Target Directory input.
  - Search params toggle (quality, atmos, custom params).
  - Download Mode selection ("Highest Lossless" vs "Dolby Atmos").
  - Comparison table with upgrade badges, Dolby badges, specs comparison.
  - Sequential search runner with pause/stop and progress bar.
  - Sequential download runner with byte progress and error indicators.
- Add entry button in `WorkstationTopBar.tsx` and `WorkstationSidebar.tsx`.

### Phase 5: Verification & Polish
- Run Vitest tests.
- Run `npm run build` and ensure 0 errors.
- Verify sequential throttling, cache reuse, file naming (`${isrc}.${extension}`), and strict Dolby/Lossless download isolation.
