# Changelog

## vNext — OmniConvert (unreleased)

Release date: 2025-11-17

Summary
-------
Major platform refresh with a full frontend redesign, accessibility improvements, an end-to-end test scaffold, and first-class Docker support. This release modernizes the UI, hardens core converters and services, and improves developer workflows.

Highlights
----------
- Frontend redesign: updated UI, assets and styles for clarity and usability.
- Accessibility: ARIA and keyboard navigation fixes, improved semantic markup.
- E2E tests: Playwright scaffold and initial spec `tests/e2e/convert.spec.js`.
- Docker: `Dockerfile` and `docker-compose.yml` for containerized development/testing.
- Converters: improvements across `server/converters/*` (archive, audio, document, image, office, svg).
- Services: storage and registry reliability improvements (`server/services/storage.py`, `server/services/registry.py`).

Fixes & Improvements
--------------------
- Stabilized artifact handling and reduced conversion edge-case failures.
- Improved test tooling and CI readiness.

Commits included
----------------
ab94e8b 2025-11-17 ui: full frontend redesign, accessibility fixes, e2e scaffold, Docker support (Daiwik)

Notes
-----
- Large `data/originals/` artifacts are intentionally not pushed; consider `.gitignore` or Git LFS for those files.
- Coordinate with collaborators before force-updating remote branches; this import may have replaced remote history.

Upgrade & Run (quick)
---------------------
Build and run with Docker:

```powershell
docker-compose up --build
```

Local dev (venv + Playwright):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
npm install
npx playwright install
npx playwright test tests/e2e/convert.spec.js
```

---

For complete commit-by-commit details or a formatted GitHub release draft, run the repository script or ask me to create a release draft text for you.
# Changelog

## Unreleased

- Added Jobs UI and client-side job polling
- Added Prometheus metrics and /metrics endpoint
- Added simple API key auth and per-IP rate limiting
- Implemented resumable upload API and convert-from-upload endpoint
- Implemented sandboxed worker subprocess runner for safer background conversions
- Added admin artifact listing and cleanup endpoints
- CI workflow + security scan steps added
