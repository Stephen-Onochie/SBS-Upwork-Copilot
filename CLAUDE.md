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
  ├── Gemini client (proposal gen → Flash; scoring + profile analysis → Flash-Lite) + request queue
  ├── chrome.scripting: used by background to scrape active tab on demand (popup-triggered)
  ├── chrome.alarms: job-monitor polling + monthly profile reminder
  ├── Supabase event writer
  ├── HubSpot client
  └── chrome.notifications dispatcher
        ↕ chrome.runtime messages
Content scripts (upwork.com pages)          Extension pages
  ├── Job-post parser                         ├── Popup: status, Analyze Profile button, snooze
  ├── Proposal auto-fill + review UI          └── Options: keys, templates, profile/project
  ├── Unicode toolbar injection                   editor, scoring weights, monitor config,
  ├── Connects normalizer                         notifications (sound picker + volume preview)
  ├── Submit-click detector (analytics only)
  └── HubSpot "Sync" button
```

**Key invariant:** secrets (API keys, tokens) live in the service worker / `chrome.storage.local`, never in page context.

---

## Build commands

```bash
npm install          # install deps
npm run dev          # Vite HMR dev build — load dist/ in chrome://extensions
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

Load the extension: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

**Reloading after build:** A simple reload click at chrome://extensions often leaves the old service worker running. To force a fresh SW: **toggle the extension off, wait 2 s, toggle back on.** Or use `chrome://serviceworker-internals` to stop it manually.

---

## Key design decisions

**Profile analysis triggered from popup:** The "Analyze Profile" button lives in the popup, not injected into the page. It sends `SCRAPE_AND_ANALYZE_PROFILE` to the background, which uses `chrome.scripting.executeScript` (requires `scripting` permission) to scrape the active tab, then passes raw text to Gemini. This avoids relying on content script injection which can fail silently.

**Profile analysis uses Flash-Lite:** Profile parsing is structured extraction, not creative generation — Flash-Lite handles it fine and has more generous free-tier limits. Prompt is capped at 5,000 chars. Never use the generation model for profile analysis.

**Selectors:** centralize all Upwork DOM selectors in a single `selectors.ts`. Every parser must fail gracefully — never throw into the page. Upwork redesigns frequently; always add class-name fallbacks (`[class*="overview"]` etc.) alongside `data-test` selectors.

**Scoring engine:** two hard gates run first (fixed-price < $300 → score 1; hourly upper bound < $30 → score 1), then a weighted 0–100 mapped to 1–10. All thresholds and weights are editable in Settings. See §7 of the spec for the full rubric and the exact hourly-range boundary logic.

**Gemini rate limiting:** free tier is ~10–15 req/min. The worker serializes calls through a queue with configurable RPM cap and exponential backoff on HTTP 429. Never fire scoring in parallel. Key validity is tested via the lightweight `v1beta/models` endpoint, not `generateContent`.

**Supabase auth:** email/password auth for a user created inside the Supabase project (not the Supabase dashboard account). The `SUPABASE_LOGIN` message accepts `supabaseUrl` and `supabaseAnonKey` directly so the user doesn't need to save settings before signing in. Persist session in `chrome.storage.local`; refresh tokens in the worker.

**Notification sounds (MV3):** service workers cannot play audio directly; the options page uses the Web Audio API for preview (it's a regular browser page). At notification time, use an offscreen document.

**Message origin check:** `chrome.runtime.onMessage` rejects any sender where `sender.id !== chrome.runtime.id`.

**CSP:** explicit `content_security_policy` declared in manifest: `script-src 'self'; object-src 'self'`.

**HubSpot pipeline stage:** fetch stages via API, pass them to Gemini, let the model pick the most appropriate stage from context. Dedupe contacts/deals by name/company before creating.

**Icons:** generated by `scripts/gen-icons.mjs` using `sharp` — strips white background from the Circle Badge source PNG, composites onto navy `#1C374C` SVG circle. Re-run with `node scripts/gen-icons.mjs` if the logo needs updating. Source logo expected at `~/Downloads/Logo with Banner Circle.png`.
