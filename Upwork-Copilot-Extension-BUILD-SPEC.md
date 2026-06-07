# Upwork Co-Pilot for SBS Digital — Chrome Extension Build Spec

> **For:** the Claude Code session that will build this.
> **Working product name:** "SBS Upwork Co-Pilot" (rename freely).
> **Owner / sole user:** Stephen (single-user personal tool — not a multi-tenant SaaS).
> **Companion doc:** `Upwork-Copilot-Dashboard-PRD.md` (the Next.js metrics dashboard that consumes the data this extension produces).

This document is the authoritative build spec. Read it fully before scaffolding. Where it says "editable in settings," that means a real control on the Options page, not a hardcoded constant.

---

## 1. What we're building and why

Stephen runs sales for SBS Digital primarily through Upwork. He was about to pay $35/mo for PouncerAI (proposal generation) and uses a job-tracker extension. This tool replaces both with one bespoke extension tuned to his workflow, powered by his own **free Google Gemini API key**.

The extension does five jobs, all inside the Upwork web UI:

1. **Profile Analyzer** — reads his live Upwork profile + keeps a structured store of his projects/tools, used to tailor proposals.
2. **Job Monitor + Scorer** — watches his native Upwork saved searches, scores every new job 1–10, and fires browser notifications for strong matches.
3. **Proposal Generator** — reads the open job post, generates a tailored cover letter from block-based templates, and auto-fills the cover-letter box (never submits).
4. **Connects Bid Normalizer + Unicode Toolbar** — small helpers on the apply page.
5. **HubSpot Sync** — one-click push of a client to HubSpot when they reply.

It also logs activity events to Supabase, which the companion dashboard turns into a gamified sales tracker.

---

## 2. Compliance guardrails (NON-NEGOTIABLE — read first)

Upwork allows Chrome extensions but does **not** vet them, and the user bears all risk. Upwork explicitly **bans**: auto-submitting proposals, auto-refresh-and-fire bots, bulk scraping of job feeds/profiles, and mass messaging. Violations risk **suspension of Stephen's real Upwork account.** Build defensively:

- **NEVER click Upwork's Submit/Send button programmatically.** The extension auto-*fills* fields; a human reviews and submits. This is the single most important rule.
- **No bulk scraping.** Only read pages Stephen is logged into and would normally view: his own profile, his own saved-search results, an open job post he navigated to, his own messages.
- **Gentle, jittered polling** for the job monitor (see §6). No tight refresh loops.
- **No storing of Upwork credentials.** The extension never touches login; it operates on already-authenticated pages.
- Keep the existing Upwork "non-affiliation" disclaimer pattern: this tool is not affiliated with Upwork.

If any feature seems to require crossing these lines, stop and leave it as a manual step.

---

## 3. Tech stack

- **Manifest V3** Chrome extension (also loads in Edge/Brave/Arc — Chromium).
- **TypeScript** throughout.
- **React 18 + Vite** for the Options page, Popup, and any injected panel UI. Use a Vite MV3 plugin (e.g. `@crxjs/vite-plugin`) for HMR + manifest handling.
- **Tailwind CSS + shadcn/ui** for UI (matches Stephen's house stack so the dashboard and extension feel consistent).
- **Storage:**
  - `chrome.storage.local` → settings, API keys, templates, scoring weights, the analyzed profile + project store, polling state, dedupe cache.
  - **Supabase** → activity events (proposals generated, proposals sent, jobs scored, profile analyses, HubSpot syncs). Shared with the dashboard. See §12.
- **LLM:** Google Gemini via the Generative Language REST API, called from the **background service worker** (declare `generativelanguage.googleapis.com` in `host_permissions` so extension fetches bypass page CORS). Bring-your-own-key.
- **HubSpot:** REST API (CRM v3) using a private-app access token, called from the background service worker.

---

## 4. High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Background service worker (the brain)                         │
│  • Gemini client (generate proposals, score jobs)             │
│  • Polling scheduler (chrome.alarms) for saved-search monitor │
│  • Dedupe + scoring queue with rate-limit throttle            │
│  • Supabase event writer                                      │
│  • HubSpot client                                             │
│  • chrome.notifications dispatcher                            │
└───────────────▲───────────────────────────▲──────────────────┘
                │ messages (chrome.runtime)  │
┌───────────────┴───────────┐   ┌────────────┴──────────────────┐
│ Content scripts (on        │   │ Extension pages               │
│ upwork.com pages)          │   │  • Popup: status + quick      │
│  • Profile parser          │   │    toggles + "analyze profile"│
│  • Job-post parser         │   │  • Options: full settings,    │
│  • Proposal auto-fill UI   │   │    templates, profile/projects│
│  • Unicode toolbar inject  │   │    editor, scoring weights    │
│  • Connects normalizer     │   └───────────────────────────────┘
│  • Submit-click detector   │
│  • HubSpot "Sync" button    │
└────────────────────────────┘
```

The service worker owns all network calls and scheduling. Content scripts only read the DOM, inject UI, and message the worker. Keep secrets (API keys, tokens) in the worker / storage, never in page context.

---

## 5. Feature: Profile Analyzer

**Goal:** build and maintain an AI-readable model of Stephen so proposals are tailored to *him*, not generic.

**Trigger:** an "Analyze my profile" button in the Popup and on his own profile page (content script detects he's on `upwork.com/freelancers/...` viewing his own profile, or the profile settings page).

**Behavior:**
1. Content script scrapes the visible profile DOM: title/headline, overview/bio, hourly rate, skills/tags, work history items, employment, education, and **portfolio/project entries**.
2. Sends raw scraped text to the worker → Gemini structures it into a clean JSON profile.
3. Store in `chrome.storage.local` under `profile` (overwrites previous; keep a short version history list so the dashboard can show "profile updated" events).
4. **Project store:** maintain a separate editable list `projects[]`, each `{ name, description, tools: string[], url, relevanceTags: string[] }`. Seed it from the portfolio scrape; let Stephen add/edit/delete entries on the Options page. This list powers the "relevant projects" template block (§8) and proposal links.
5. Log a `profile_analysis` event to Supabase (timestamp, # projects, # skills).

**Monthly re-analyze reminder:**
- Use `chrome.alarms` to fire on the **1st of each month**. On fire, raise a `chrome.notifications` reminder: "Time to re-analyze your Upwork profile to keep proposals current." Clicking it opens his profile page with the analyze action primed.
- Store `lastProfileAnalysis` date; show a subtle badge in the Popup if it's >35 days stale.

---

## 6. Feature: Job Monitor + Scorer

**Goal:** watch Stephen's saved searches and surface scored jobs, like the Upwork Toolkit extension — but with our own 1–10 scoring.

**Important platform reality:** Upwork **removed RSS feeds in 2024**. There is no official feed API. The compliant approach (used by toolkit-style extensions) is to read the user's **native Upwork saved searches** and re-check their results pages while Chrome is open. Stephen creates/saves filters *in Upwork itself* (Upwork allows up to 30 saved searches) — we do **not** rebuild filter UI in the extension.

**Behavior:**
1. **Discover saved searches:** when Stephen is on Upwork, read his saved-search list (from the Find Work / saved-searches area of the DOM, or the internal data the page already loads). Store the list `{ id, label, url }[]`. Let him toggle which saved searches to monitor on the Options page.
2. **Poll:** `chrome.alarms` on a **configurable interval (default 3 min), with random jitter (±30–60s)**. Only run while a browser session is active. For each monitored saved search, fetch its results page (background fetch with cookies, since he's logged in) and parse the job cards.
3. **Dedupe:** keep a rolling cache of seen job IDs (cap size, e.g. last 2,000) so each job is scored once.
4. **Score** each new job 1–10 (see §7), throttled through the Gemini queue.
5. **Notify** (see §9) for jobs scoring **≥ threshold (default 7, configurable slider)**.
6. Log a `job_scored` event to Supabase per job (job id hash, score, budget type, saved-search label) for the dashboard's feed stats.

**Only-while-Chrome-open is expected** — document this clearly in the UI so Stephen knows monitoring pauses when the browser is closed. (A server-side scanner is explicitly out of scope; it would require scraping infrastructure that raises ToS risk.)

---

## 7. Feature: Scoring engine (1–10)

Outputs an integer **1–10**. Compute an internal 0–100, then map to 1–10. Two **hard gates** run first and short-circuit to **1**:

### Budget gates (both editable in Settings)
- **Fixed-price:** total/effective budget **< $300** → **score = 1**. (`fixedFloor`, default 300.)
- **Hourly:** auto-1 **only if the *entire* range is below the hourly floor.** (`hourlyFloor`, default 30.)
  - Range `$20–$28` → entire range under $30 → **score = 1**.
  - Range `$25–$45` → straddles $30 → **continue scoring** (do NOT auto-1).
  - Range `$35–$60` → fully above → continue scoring.
  - Single value `$22/hr` → under floor → 1. Single value `$40/hr` → continue.
  - Use the **upper bound** of an hourly range as the test: `if (upperBound < hourlyFloor) score = 1`.
- Unspecified / hidden budget → do not auto-1; let the model weigh client history instead (see below).

### Weighted factors (only if gates pass)
Compute a weighted 0–100. All weights editable in Settings (ship these defaults):

| Factor | Default weight | How to compute |
|---|---|---|
| **Fit to profile** | 30 | Gemini compares job post ↔ analyzed profile/skills/projects → 0–1 fit. |
| **Client trust** | 25 | Payment verified (hard requirement — large penalty if not), total spent, client rating, account age. |
| **Hire rate** | 12 | Client hire rate; <40% flagged and penalized. |
| **Budget strength** | 13 | Client's *historical avg paid rate* weighed above the posted budget (a low post from a high-spend client is still strong). |
| **Competition** | 12 | Fewer existing proposals = better; many invites already sent = worse. |
| **Freshness** | 8 | Newer post scores higher (reply rates fall after ~the first hour / 10+ bids). |

- Gemini (Flash-Lite, see §10) handles the qualitative reads (fit, scope clarity — vague "need a developer" posts get docked). The numeric signals (budget, spend, proposals, verified, recency) are parsed from the job/client DOM and fed to the model as structured context so scoring is consistent and cheap.
- Return `{ score: 1-10, oneLineReason: string, factorBreakdown }`. Store the one-line reason so the feed/notification can show *why*.

Keep the rubric in a single config module so weights/gates are trivially tunable.

---

## 8. Feature: Proposal Generator

**Goal:** PouncerAI-style — read the open job post, generate a tailored cover letter, auto-fill the box. **Never submit.**

**Trigger:** a "Generate proposal" button injected on the job page and on the proposal/apply page (near the cover-letter textarea).

**Templates (block-based, managed in Settings):**
A template is an ordered list of **blocks**, each one of:
- `ai` — a Gemini-generated section driven by an editable **prompt**, with access to: the job post, the analyzed profile, and the project store. (Stephen's typical use: an opening tailored to what the client asked for.)
- `static` — fixed text Stephen writes once (e.g. *"If this sounds like a fit, reply or book a call here: <link> and let's scope it out."*).
- `dynamic_projects` — Gemini selects the **N most relevant** projects from the project store for this job and renders them as a short list with links. (This is the "links to my recent projects" behavior, automated.)

Stephen can create **multiple templates**, name them, reorder/add/remove blocks, edit each block's prompt/text, and pick which template to use per job (default template selectable). This matches: "first half AI-generated to match the post, second half standard CTA + project links."

**Generation flow:**
1. Content script parses the job post (title, description, skills, client questions if present) → worker.
2. Worker assembles the prompt from the chosen template's blocks + profile + projects, calls **Gemini 3 Flash**.
3. Returns assembled cover letter. Content script **auto-fills the cover-letter textarea** (dispatch proper `input`/`change` events so Upwork's React state registers it). Show it for review; provide a "regenerate" and "copy" action.
4. **Screening questions:** if the apply page has additional client questions, offer a per-question "draft answer" button (same pattern, never auto-submit).
5. Log a `proposal_generated` event to Supabase.

---

## 9. Feature: Browser notifications

- Use `chrome.notifications`. Fire for monitored jobs scoring **≥ threshold** (default 7).
- Notification shows: score, job title, one-line reason, budget. Click → open the job in a new tab.
- **Configurable in Settings:** score threshold (slider 1–10), enable/disable per saved search, **custom sound** (bundle a few sound files + let him pick + volume slider — play via an offscreen document or a small audio page since MV3 workers can't play audio directly), and **quiet hours** (no notifications in a time window).
- Suggested extras (build if cheap): batch/grouping so a burst of jobs doesn't spam (e.g. "5 new jobs ≥7"), and a "snooze monitoring for 1h" toggle in the Popup.

---

## 10. Gemini integration details

- **Models (free tier = Flash / Flash-Lite only; Pro is paywalled):**
  - **Proposal generation → Gemini 3 Flash** (quality).
  - **Job scoring → Gemini Flash-Lite** (cheap, high-volume).
  - Don't hardcode a brittle version string blindly — read the current free-tier Flash model names from the AI Studio dashboard / `models.list` and default to the current recommended Flash + Flash-Lite. Make the model id editable in Settings.
- **Call from the background worker** via REST: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={API_KEY}`. Declare the host in `host_permissions`.
- **Free-tier rate limits are tight (~10–15 requests/min, daily caps).** Implement a **request queue with throttling** in the worker: serialize calls, respect a configurable RPM cap, exponential backoff on HTTP 429. Scoring a flood of new jobs must drain through the queue, not fire in parallel.
- **Key storage:** `chrome.storage.local`, entered on the Options page. Validate with a test call + "Connection OK" indicator.
- **Privacy note to surface in the UI:** Google's *free* tier may use prompts for model training. Since proposals include profile data, show a one-time notice so Stephen is aware. (No action needed; just transparency.)
- Robust error handling: surface quota/429/network errors to the user instead of failing silently.

---

## 11. Feature: Connects bid normalizer + Unicode toolbar

**Connects normalizer (best-effort, must never block the apply flow):**
- On the apply page, read the job's **base connect cost**. Set the optional **boost** bid so `base + boost = target` (target default **20**, editable to 30/40/etc.).
- If `base >= target` → boost = 0. Floor at 0; never go negative.
- Example: base 13, target 20 → set boost 7. Base 6, target 20 → set boost 14.
- If the page layout/selectors don't match, **silently skip** — this is a convenience, not a core feature. Wrap in try/catch and log a console warning only.

**Unicode formatting toolbar ("Upstyler"-style):**
- Upwork's cover-letter box is plain text, so "formatting" = inserting Unicode glyphs.
- Inject a small toolbar above the cover-letter textarea: **bold**, *italic*, bullet points (• or ▸), and an emoji picker. Buttons transform the selected text into the corresponding Unicode math-alphanumeric characters (bold/italic) or wrap lines with bullet glyphs, inserting at the cursor.
- Keep it lightweight; this is a known, allowed pattern.

---

## 12. Feature: HubSpot sync (one-click)

**Goal:** when a client replies, push them into HubSpot so it serves as Stephen's sales/revenue dashboard.

- **Trigger:** inject a **"Sync to HubSpot"** button on the Upwork **messages / room page** when viewing a client reply. Manual click only.
- **Auth:** HubSpot **private-app access token** entered in Settings. Calls go through the background worker (`Authorization: Bearer <token>`).
- **What it creates:** a **Contact** and a **Deal** (associated). Pull what's visible (client/company name, job title, the conversation/job context, the proposal if linkable). Email is usually hidden pre-contract — that's fine; create the contact without it and let Stephen fill later.
- **Pipeline/stage:** there is currently **one pipeline**. Fetch its stages via the HubSpot API, pass them to **Gemini**, and let the model pick the most appropriate stage from the context (e.g. "replied/in conversation" vs "negotiation"). Use that single pipeline by default.
- **Dedupe:** before creating, search HubSpot for an existing contact/deal for this client (by name/company) to avoid duplicates; update instead of re-create where found.
- Log a `hubspot_sync` event to Supabase (timestamp, contact id, deal id, stage chosen). The dashboard surfaces these.
- Show clear success/error toasts (created vs updated vs failed).

---

## 13. Supabase event logging (shared with dashboard)

The extension is the **producer**; the dashboard is the **consumer**. Write these events. (Full schema + RLS lives in the dashboard PRD — keep them in sync.)

| Event table | When | Key fields |
|---|---|---|
| `proposals_generated` | proposal generated | ts, job_id_hash, job_title, template_used, score_at_gen |
| `proposals_sent` | **Stephen clicks Upwork's native Submit** (detected by content script) | ts, job_id_hash, job_title, score_at_send, connects_bid |
| `jobs_scored` | each scored job in monitor | ts, job_id_hash, score, budget_type, saved_search_label |
| `profile_analyses` | profile analyzed | ts, num_projects, num_skills |
| `hubspot_syncs` | HubSpot sync done | ts, contact_id, deal_id, stage |

**Auth for the extension → Supabase:** use a single **owner account**. Simplest robust path: Supabase **email/password** auth for the extension (OAuth redirects are awkward inside extensions); persist the session in `chrome.storage.local` and refresh tokens in the worker. RLS restricts every row to that user id. (The dashboard can use the same owner account; see dashboard PRD.) Store Supabase URL + anon key in Settings.

**"Proposal sent" detection:** content script attaches a listener to Upwork's native Submit/Send proposal button and logs the event **after** the user clicks it. We are observing his own action for analytics — we never trigger the click ourselves.

---

## 14. Options (Settings) page — full inventory

- **API keys:** Gemini key (+ test), HubSpot private-app token (+ test), Supabase URL/anon key, owner login.
- **Models:** Gemini model for generation, model for scoring, RPM cap.
- **Profile:** view analyzed profile JSON, "re-analyze now," last-analyzed date, project store editor (CRUD on projects: name/desc/tools/url/tags).
- **Templates:** create/edit/delete/reorder templates and their blocks (ai/static/dynamic_projects), set default, set # of projects for dynamic block.
- **Scoring:** fixed-price floor (default 300), hourly floor (default 30), factor weights (with reset-to-defaults), require-payment-verified toggle.
- **Monitor:** list of discovered saved searches with per-search monitor on/off, poll interval, jitter.
- **Notifications:** score threshold slider, sound select + volume, quiet hours, batching toggle.
- **Bidding:** connects target (default 20), normalizer on/off.
- **Privacy notice** acknowledgement (Gemini free-tier training).

---

## 15. Manifest / permissions (MV3)

- `permissions`: `storage`, `alarms`, `notifications`, `scripting`, `activeTab`, `offscreen` (for notification sounds).
- `host_permissions`: `https://*.upwork.com/*`, `https://generativelanguage.googleapis.com/*`, `https://api.hubapi.com/*`, the Supabase project URL.
- Content scripts matched to `https://*.upwork.com/*` (gate behavior by URL pattern inside the script: profile pages, job pages, apply pages, messages pages).
- Service worker as `background.service_worker` (module type).
- Keep permissions minimal; justify each in the store listing later if ever published (likely stays private/unlisted — fine for personal use via "load unpacked" or a private CRX).

---

## 16. Suggested build order (milestones)

1. **Scaffold:** Vite + CRXJS + React + Tailwind + TS; manifest; worker/content/popup/options skeletons; settings storage layer.
2. **Gemini client + queue** in the worker; Options key entry + test call.
3. **Profile Analyzer** (parse → structure → store → project editor → monthly alarm).
4. **Proposal Generator** (templates engine → parse job → generate → auto-fill → review UI). This is the highest day-one value; get it solid.
5. **Unicode toolbar** + **connects normalizer** (small, self-contained).
6. **Job Monitor + Scorer** (saved-search discovery → polling → dedupe → scoring → notifications).
7. **Supabase event logging** + submit-click detection.
8. **HubSpot sync.**
9. Polish: error states, quiet hours, batching, privacy notice, badges.

Ship 1–4 as a usable MVP; 5–9 complete the spec.

---

## 17. Edge cases & resilience

- **Upwork DOM changes:** centralize all selectors in one `selectors.ts` module so breakage is a one-file fix. Every parser must fail gracefully (skip, never throw into the page).
- **Logged-out state:** if a background fetch of a saved search returns a login page, pause monitoring and notify "Sign in to Upwork to resume monitoring."
- **Rate limits:** 429 from Gemini → backoff + user-visible "slowing down, free-tier limit hit."
- **Auto-fill safety:** after filling the cover-letter box, do nothing else — never focus+submit. Add a visible "Draft inserted — review before sending" marker.
- **No silent failures:** every network action has a success/error toast.

---

## 18. Out of scope / future

- **"Secret" agency dashboard** behind the SBS Digital agency page — future; the dashboard PRD notes a hook for this. Don't build now.
- Server-side / always-on monitoring (would need scraping infra → ToS risk). Explicitly excluded.
- Multi-freelancer/agency profiles — single user (Stephen) only for now.
- Tracking proposal *outcomes* (interviews/wins) inside the tool — Upwork + HubSpot own that; we only count sends.

---

## 19. Definition of done

- Generates a tailored, block-based proposal from real profile/project data and auto-fills the box — never submits.
- Monitors selected saved searches and scores jobs 1–10 with the gate logic exactly as specified, notifying ≥ threshold.
- Profile analyzer + monthly reminder + editable project store working.
- Connects normalizer + Unicode toolbar working (best-effort for the former).
- HubSpot one-click sync creating contact + deal in the single pipeline with Gemini-chosen stage.
- All five Supabase event types writing correctly for the dashboard.
- Every threshold/weight/key/template editable on the Options page.
- Zero code paths that programmatically submit a proposal.
