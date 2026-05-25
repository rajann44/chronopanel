# Chrome Web Store Submission Guide

## Single Purpose

ChronoPanel helps users review their recent browser usage with a local-only dashboard built from Chrome history.

## Permissions Justification

- `history`: required to estimate browser usage from Chrome history visit timestamps.
- `storage`: required to store local summaries, preferences, and imported history data on-device.
- `sidePanel`: required to open the dashboard from the extension action.

## Privacy Notes

- No data leaves the device.
- No analytics, accounts, remote APIs, or cloud sync are used.
- Only browsing metadata needed for summaries is stored.
- Full URL tracking is optional and disabled by default.

## Required Submission Assets

- 128x128 extension icon
- Small and large promotional images for the store listing
- Screenshots of:
  - summary dashboard
  - website breakdown
  - settings/privacy screen

## Recommended Listing Copy

### Short Description
Track browser usage locally and review a calm daily summary dashboard.

### Detailed Description
ChronoPanel helps you understand where your browsing time goes without sending data anywhere else. It uses Chrome history to estimate recent browser usage and stores summaries locally on your device.

Features:
- daily browsing summary
- 7-day activity view
- website rankings and categories
- privacy-first local storage
- export and clear-data controls

Important:
- usage is estimated from Chrome history timestamps
- it does not inspect page contents or form data
- it does not send data to external servers

## Review Notes

This extension uses the Chrome `history` permission only to estimate recent browsing time from visit timestamps and build local summaries. All processing happens locally inside the extension. No browsing data is transmitted off-device.
