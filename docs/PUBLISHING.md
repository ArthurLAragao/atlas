# Public release and GitHub Pages

`main` is the public source branch. The Pages workflow runs lint, TypeScript checks,
the unit suite and a production build before deploying `dist/`.

The workflow sets `GITHUB_PAGES=true`. This uses `/atlas/` for assets, preload links,
PWA manifest/icons/shortcuts and service-worker scope, with hash routes for static
hosting. Local builds retain BrowserRouter, root assets and the original desktop
URLs. The bottom dock and personal data schema are unchanged.

## Verification and boundaries

- Full local unit suite: **1,048 tests in 85 files**, all passed.
- Lint, strict TypeScript and the Pages production build are checked before commit.
- The unit runner uses isolated thread workers: Windows child-process workers
  stalled at collection in this environment; a real test file verified the alternate
  worker pool before the full rerun. Assertions and time limits are unchanged.
- All eight secondary routes were opened and reloaded in a clean browser context.
- Desktop and 375px layouts checked; no horizontal overflow or page exceptions.
- Screenshots use a fresh IndexedDB session, not the owner's live browser data.
- A focused publication scan found no common credential patterns or personal Notion IDs.

Data on localhost and GitHub Pages is separate. Transfer progress using explicit
JSON export/import; no background migration or automatic cloud sync is implemented.
The Lumen capture and desktop-launch integrations require the local service and
are not provided by GitHub Pages. Historical performance/human validation limits
remain in the implementation documents.

Raw historical audit reports and screenshot batches stay local. Historical
references to those artifacts are not part of the public release package.
