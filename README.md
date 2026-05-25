# ChronoPanel

ChronoPanel is a privacy-first Chrome extension that turns Chrome history into a calm daily and weekly usage dashboard.

- Local only by default
- No account required
- No cloud analytics
- Open-source and auditable: https://github.com/rajann44/chronopanel

## Website

- Product site: https://chronopanel.vercel.app
- Privacy policy: https://chronopanel.vercel.app/privacy

The website explains the product in plain language and can be used directly in your Chrome Web Store listing.

## What You Get

- Daily summary of estimated browsing time
- 7-day activity trend view
- Top websites and category breakdowns
- Time-of-day usage pattern
- Editable category rules in Settings
- JSON export and local data controls

## How It Works

ChronoPanel estimates usage from Chrome history visit timestamps.

- It syncs a selected time window (3, 7, 14, or 30 days)
- It rebuilds daily summaries deterministically to avoid double counting
- It caps long idle gaps so totals stay realistic

Important: this is an estimate, not exact foreground screen-time measurement.

## Privacy Model

- Data stays on-device in chrome.storage.local
- No external telemetry
- No page content collection
- No password or form data collection
- Optional full URL tracking is off by default

## Quick Start (Local Development)

1. Install dependencies.

  npm install

2. Build the extension.

  npm run build

3. Load in Chrome.

  - Open chrome://extensions
  - Enable Developer mode
  - Click Load unpacked
  - Select this repository folder

4. Open the side panel from the extension action.

## Release and Web Store Submission

1. Run quality checks.

  npm run check

2. Build package zip.

  npm run package:extension

3. Use these docs during submission.

  - docs/CHROME_WEB_STORE.md
  - docs/STORE_LISTING_COPY.md
  - docs/STORE_ASSETS.md

## Project Structure

- manifest.json: extension manifest
- src/background/index.ts: history sync workflow and runtime messaging
- src/background/storage.ts: storage and aggregation helpers
- src/shared: shared constants, types, and utilities
- src/ui/sidepanel.ts: dashboard rendering and interactions
- ui/sidepanel.html: side panel entry
- ui/styles.css: extension styling
- website: static marketing site and privacy page

## Development Commands

- Type check

  npm run typecheck

- Watch mode

  npm run watch
