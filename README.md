# SBS Upwork Co-Pilot

A personal Chrome extension (MV3) for Stephen at SBS Digital. Replaces PouncerAI + a job-tracker extension with one bespoke tool powered by a free Google Gemini key. Single-user, never published to the store.

---

## Features

- **Proposal Generator** — parses job posts, generates tailored proposals via Gemini, auto-fills the textarea, and presents a review UI before you submit
- **Profile Analyzer** — parses your Upwork profile, structures it, stores it locally, and reminds you monthly to keep it fresh
- **Job Monitor & Scorer** — polls saved searches on a gentle jittered schedule (default 3 min ± 30–60 s), scores new jobs against configurable weights, and fires desktop notifications
- **Unicode Toolbar** — injects a formatting toolbar into proposal text fields
- **Connects Normalizer** — shows normalized connect cost per job
- **HubSpot Sync** — one-click button to push a client or deal to your HubSpot CRM pipeline
- **Supabase Event Logging** — logs submit clicks and key actions to a shared dashboard

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | Manifest V3, Chromium (Chrome, Edge, Brave, Arc) |
| Language | TypeScript throughout |
| UI | React 18 + Vite + `@crxjs/vite-plugin`, Tailwind CSS + shadcn/ui |
| Storage | `chrome.storage.local` (settings, keys, templates, profile, cache) |
| Database | Supabase (event logging, companion dashboard) |
| LLM | Google Gemini REST API (Flash for proposals, Flash-Lite for scoring) |
| CRM | HubSpot CRM v3 REST API |

---

## Architecture

```
Background service worker (owns all network calls + scheduling)
  ├── Gemini client (proposal gen → Flash; scoring → Flash-Lite) + request queue
  ├── chrome.alarms: job-monitor polling + monthly profile reminder
  ├── Supabase event writer
  ├── HubSpot client
  └── chrome.notifications dispatcher
        ↕ chrome.runtime messages
Content scripts (upwork.com pages)          Extension pages
  ├── Profile parser                          ├── Popup: status, toggles, analyze button
  ├── Job-post parser                         └── Options: keys, templates, profile/project
  ├── Proposal auto-fill + review UI              editor, scoring weights, monitor config
  ├── Unicode toolbar injection
  ├── Connects normalizer
  ├── Submit-click detector (analytics only)
  └── HubSpot "Sync" button
```

**Key invariant:** secrets (API keys, tokens) live in the service worker / `chrome.storage.local`, never in page context.

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Google Gemini API key (free tier)
- Optional: HubSpot API key, Supabase project URL + anon key

### Install & Run

```bash
npm install          # install dependencies
npm run dev          # Vite HMR dev build → outputs to dist/
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

### Load the Extension

1. Open `chrome://extensions` in Chrome (or Edge/Brave)
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `dist/` folder
4. Pin the extension and open **Options** to enter your API keys

---

## Compliance Rules

These rules exist to protect the connected Upwork account:

- **Never programmatically click Submit/Send.** Auto-fill only — a human submits.
- **No bulk scraping.** Only reads pages the user is actively viewing while logged in.
- **Gentle, jittered polling** — default 3 min ± 30–60 s via `chrome.alarms`.
- **No credential storage.** Operates on already-authenticated Upwork pages only.

---

## Build Milestones

1. Scaffold — Vite + CRXJS + React + Tailwind + TS, manifest, storage layer
2. Gemini client + request queue, Options key entry + test call
3. Profile Analyzer — parse → structure → store → project editor → monthly alarm
4. **Proposal Generator** — templates engine → parse job → generate → auto-fill → review UI *(MVP)*
5. Unicode toolbar + connects normalizer
6. Job Monitor + Scorer — saved-search discovery → polling → dedupe → scoring → notifications
7. Supabase event logging + submit-click detection
8. HubSpot sync
9. Polish — error states, quiet hours, batching, privacy notice, badges

Milestones 1–4 constitute the usable MVP.

---

## License

Private — internal use only at SBS Digital.
