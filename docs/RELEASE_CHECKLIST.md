# Release Checklist

## Extension

- Run `npm run check`
- Run `npm run package:extension`
- Confirm `release/ChronoPanel-extension.zip` exists
- Load the packaged extension locally and smoke test:
  - sync history
  - change selected day
  - website breakdown filters
  - settings save/export/clear

## Privacy and Listing

- Deploy `website/` to Vercel
- Publish `privacy.html`
- Add deployed privacy policy URL in Chrome Web Store listing
- Use `docs/CHROME_WEB_STORE.md` for listing copy and permission notes

## QA

- Verify no console errors in side panel
- Verify icons render in Chrome toolbar and extensions page
- Verify empty state and populated state both look correct
- Verify keyboard focus on 7-day activity buttons

## Versioning

- Bump `manifest.json` version
- Bump `package.json` version
- Rebuild and package again
