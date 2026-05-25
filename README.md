# ChronoPanel

ChronoPanel is a local-only Chrome extension MVP that estimates browser usage from Chrome history and presents a calm daily dashboard inspired by Screen Time style reporting.

## Features

- Manifest V3 + TypeScript implementation
- Service worker history sync engine using:
  - `chrome.history`
  - `chrome.storage.local`
- Side panel dashboard with three screens:
  - Summary
  - Website breakdown
  - Settings
- First-run onboarding card with quick privacy/tracking guidance
- Weekly insights card (most intentional hour and most distracting site)
- Daily aggregates:
  - total usage
  - session count
  - top domain
  - top category
  - longest session
  - hourly usage buckets
- Rule-based category mapping defaults (editable in code)
- Rule-based category mappings editable in Settings
- History sync from Chrome data (estimate)
- Local export as JSON
- No backend, no cloud sync, no account system

## Sync Rules

- Data is estimated from Chrome history visit timestamps.
- Unsupported/internal URLs are filtered out using the exclusion rules.
- Daily summaries are rebuilt deterministically for the selected sync range to avoid duplicate counting.
- Session duration is capped to prevent long idle gaps from inflating totals.

## Data Storage

All data is stored in `chrome.storage.local` under:

- `settings`
- `currentSession`
- `dailySummariesByDate`
- `recentSessions`
- `categoryRules`
- `backfillMeta`

Recent session history is capped for compact local usage.

## Project Structure

- `manifest.json` - extension manifest
- `src/background/index.ts` - tracking engine and lifecycle
- `src/background/storage.ts` - storage and aggregation helpers
- `src/shared/*` - types/constants/utils
- `src/ui/sidepanel.ts` - dashboard rendering and interactions
- `ui/sidepanel.html` - side panel entry
- `ui/styles.css` - visual style
- `scripts/build.mjs` - esbuild bundling

## Setup

1. Install dependencies:

   npm install

2. Build TypeScript bundles:

   npm run build

3. Load unpacked extension in Chrome:

   - Open `chrome://extensions`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select this project folder

4. Click the extension icon to open the side panel dashboard.

## Release

- Run `npm run check` before packaging.
- Run `npm run package:extension` to generate `release/ChronoPanel-extension.zip`.
- For Chrome Web Store submission details, see `docs/CHROME_WEB_STORE.md`.
- For listing copy and screenshot/promo guidance, see `docs/STORE_LISTING_COPY.md` and `docs/STORE_ASSETS.md`.

## Website

- A static marketing site lives in `website/`.
- Deploy it on Vercel by setting the project Root Directory to `website`.
- The site includes a privacy policy page you can use for Chrome Web Store submission.

## Development

- Type check:

  npm run typecheck

- Rebuild continuously:

  npm run watch

## Privacy

- No external network telemetry is used for tracking
- No page content is collected
- No form data, credentials, or personal message content is collected
- Only browsing metadata required for local summaries is stored on-device

## History Sync

- In Settings, you can sync estimated usage from the last 3, 7, 14, or 30 days.
- The top action button can also sync using your default sync window.
- Sync output is approximate because Chrome history does not provide exact foreground dwell time.
