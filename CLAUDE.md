# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**SBS Upwork Co-Pilot** — a personal Chrome extension (MV3) for Stephen at SBS Digital. Replaces PouncerAI + a job-tracker extension with one bespoke tool powered by a free Google Gemini key. Single-user, never published to the store.

The authoritative spec is [Upwork-Copilot-Extension-BUILD-SPEC.md](Upwork-Copilot-Extension-BUILD-SPEC.md). Read it fully before scaffolding features.

---

## Non-negotiable compliance rules

These rules exist because violations risk suspension of a real Upwork account:

- **NEVER programmatically click Upwork's Submit/Send button.** Auto-fill only; a human submits.
- **No bulk scraping.** Only read pages the user is logged into and actively viewing.
- **Gentle, jittered polling** for the job monitor (default 3 min ± 30–60 s via `chrome.alarms`).
- **Never store Upwork credentials.** Operate on already-authenticated pages only.

---

## Tech stack

- **Manifest V3** Chrome extension (Chromium: Chrome, Edge, Brave, Arc)
- **TypeScript** throughout
- **React 18 + Vite** with `@crxjs/vite-plugin` for HMR and manifest handling
- **Tailwind CSS + shadcn/ui** for all UI
- **Storage:** `chrome.storage.local` for settings/keys/templates/profile/cache; **Supabase** for event logging (shared with the companion dashboard)
- **LLM:** Google Gemini REST API called from the **background service worker only** (`generativelanguage.googleapis.com` in `host_permissions`)
- **HubSpot CRM v3 REST API** called from the background service worker only

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

## Build commands (once scaffolded)

```bash
npm install          # install deps
npm run dev          # Vite HMR dev build — load dist/ in chrome://extensions
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

Load the extension: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

---

## Suggested build order

Follow the milestones in §16 of the spec:

1. Scaffold: Vite + CRXJS + React + Tailwind + TS; manifest; worker/content/popup/options skeletons; settings storage layer.
2. Gemini client + request queue in the worker; Options key entry + test call.
3. Profile Analyzer (parse → structure → store → project editor → monthly alarm).
4. **Proposal Generator** — highest day-one value. Templates engine → parse job → generate → auto-fill → review UI.
5. Unicode toolbar + connects normalizer (small, self-contained).
6. Job Monitor + Scorer (saved-search discovery → polling → dedupe → scoring → notifications).
7. Supabase event logging + submit-click detection.
8. HubSpot sync.
9. Polish: error states, quiet hours, batching, privacy notice, badges.

Ship milestones 1–4 as usable MVP.

---

## Key design decisions

**Selectors:** centralize all Upwork DOM selectors in a single `selectors.ts`. Every parser must fail gracefully — never throw into the page.

**Scoring engine:** two hard gates run first (fixed-price < $300 → score 1; hourly upper bound < $30 → score 1), then a weighted 0–100 mapped to 1–10. All thresholds and weights are editable in Settings. See §7 of the spec for the full rubric and the exact hourly-range boundary logic.

**Gemini rate limiting:** free tier is ~10–15 req/min. The worker must serialize calls through a queue with configurable RPM cap and exponential backoff on HTTP 429. Never fire scoring in parallel.

**Proposal auto-fill:** dispatch proper `input`/`change` events on the textarea so Upwork's React state registers the fill. Show a "Draft inserted — review before sending" marker and do nothing else.

**Notification sounds (MV3):** service workers cannot play audio directly; use an offscreen document.

**Supabase auth:** email/password auth (OAuth redirects are awkward inside extensions). Persist session in `chrome.storage.local`; refresh tokens in the worker.

**HubSpot pipeline stage:** fetch stages via API, pass them to Gemini, let the model pick the most appropriate stage from context. Dedupe contacts/deals by name/company before creating.
