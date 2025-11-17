# OmniConvert

OmniConvert is a zero-auth, self-hosted file conversion hub powered by FastAPI + SQLite. It focuses on a clean UX, testable conversion registry, and an extension-friendly plugin model so you can keep adding new format pairs over time.

## Highlights
- ⚡ FastAPI backend with CORS-safe streaming responses and SQLite persistence via SQLModel.
- 🧩 Conversion registry + decorator-based plugins (`server/converters`) so each `(source,target)` pair is explicit and testable.
- 🖼️ Launch set covers popular text, document, image, and archive conversions with graceful capability discovery via `/api/formats`.
- 🗂️ Frontend SPA (vanilla HTML/CSS/JS) served statically by the backend—no auth, no analytics.
- 🧾 A minimal UI is available at the root for a distraction-free conversion experience. The minimal UI loads a lightweight script (`/static/app.clean.js`).
- 📊 `/api/formats/expanded` exposes every reachable conversion (direct or chained) with chain length + path metadata that powers the new “All Conversions” grid.
- ✅ Pytest suite verifying registry wiring and a live TXT → PDF conversion flow.

## Current Conversion Coverage
| Source | Targets | Notes |
| --- | --- | --- |
| `png,jpg,jpeg,webp,bmp,gif` | All other listed image formats + `pdf` (png only) | Pillow-backed re-encodes; PNG→PDF embeds first frame. |
| `docx` | `txt,pdf,png` | Text-only render using `python-docx`, FPDF, and Pillow. |
| `pdf` | `txt,docx` | PyPDF2 text extraction; best on text PDFs. |
| `txt` | `pdf,png` | Plain-text rendering to FPDF / Pillow. |
| `zip` | `tar.gz` | Repackage via stdlib. |
| `tar.gz` | `zip` | Repackage via stdlib. |

> **Limitations:** Binary-perfect or layout-faithful conversions (e.g., DOCX → PNG with full styling, DRM-protected PDFs, CAD formats) are out of scope for this MVP. The registry pattern is meant to make adding specialized tooling (LibreOffice, FFmpeg, etc.) straightforward later.

Additional (optional) format support (requires host libraries):
| Source | Targets | Notes |
| --- | --- | --- |
| `svg` | `png,pdf` | Requires Cairo/CairoSVG to render vector images. |
| `mp3,wav` | `wav,mp3` | MP3/WAV convert via `pydub` and FFmpeg (FFmpeg binary required). |
| `xlsx` | `csv` | Extracts first sheet via `openpyxl`. |
| `pptx` | `txt` | Extract slides text via `python-pptx`.

## All Conversions Grid
`frontend/index.html` now features a FreeConvert-inspired conversions grid backed by `/api/formats/expanded`. Every source extension lists all reachable targets (direct or chained) including chain length badges. Clicking a target pre-fills the conversion form—even for chained outputs—so you can trigger any supported path immediately.

## Project Structure
```
server/
  app.py            # FastAPI app + routes/static hosting
  config.py         # Settings via pydantic-settings
  database.py       # SQLModel engine/session helpers
  models.py         # ConversionJob ORM
  schemas.py        # API schemas
  converters/       # Converter plugins (base/image/document/archive)
  services/registry.py # ConversionRegistry singleton
frontend/
  index.html, app.clean.js, styles.css
tests/
  test_api.py, test_registry.py
```

## Prerequisites
- Python 3.11+ (dev environment uses 3.13.7)
- Windows, macOS, or Linux with build tools for Pillow (prebuilt wheels used on Windows/macOS)

## Setup
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## Run the Server
```powershell
uvicorn server.app:app --reload
```
Browse to `http://localhost:8000` for the UI. `/api/formats`, `/api/convert`, and `/api/history` are available for programmatic use.

API: Download stored artifact
```
GET /api/jobs/{job_id}/artifact
```
Returns the stored artifact for a completed job (if artifacts are enabled and the artifact is present on disk). The response will be a file stream with the appropriate `Content-Type` and `Content-Disposition` headers.

## Running Tests
```powershell
python -m pytest
```

## Extending Converters
1. Create a module under `server/converters/` (or extend an existing one).
2. Import `register_converter` and decorate a callable with `(source_ext, target_ext)` plus an optional note.
3. Return `(bytes, mime_type)` from the converter.
4. Add dependencies to `requirements.txt` and document constraints.

The `ConversionRegistry` automatically tracks new entries when the module is imported. You can fan out background work or streaming storage later by swapping the executor that `registry.resolve` returns.

## Operational Notes
- Uploaded bytes are held in memory; enforce file-size caps via `Settings.max_upload_size_mb`.
- Converted artifacts are optionally persisted and available for download via the API. By default, artifacts are saved to disk in `./data/artifacts` and are referenced in the database by job id.
  - Configure these options in `server/config.py` with `artifacts_enabled`, `artifacts_dir`, and `artifacts_retention_days`.
  - Artifacts are stored with a filename prefix of `{job_id}_<originalname>` and cleaned up on startup if older than the retention period.

  Additional features
  - Re-run: If originals are stored (config `store_originals`), you can re-run a conversion using the same uploaded file via endpoint:
    - `POST /api/jobs/{job_id}/reconvert` — re-runs conversion using the stored original and saves a new artifact.
  - Share tokens: You can create a short-lived public share URL for a saved artifact with: `POST /api/jobs/{job_id}/share`. The response includes `share_url` and copyable token.
  - S3 storage: Optional S3 storage is supported. Set `server/config.py` `artifacts_storage='s3'` with S3 credentials and `s3_bucket`.
  - Background cleanup: The server runs a daily cleanup job to remove old artifacts & originals. At startup it also runs a best-effort cleanup.
- To avoid blocking or heavy CPU work, consider offloading conversions to a task queue (RQ/Celery) and returning job IDs—`ConversionJob` already captures status and duration.

## Roadmap Ideas
- Integrate FFmpeg + Libsndfile adapters for audio/video conversions.
- Add LibreOffice/Unoconv bridge for richer DOCX/PPTX/PDF permutations.
- Background worker mode + WebSocket notifications for multi-minute jobs.
- User-selectable retention + S3/Blob export of converted artifacts.

### Optional native dependencies & installation notes

Some converters require optional native libraries to be installed on the host. This project can detect and register converters for these flows, but the host must provide the native tools (and Python bindings) as required:

- Cairo / CairoSVG (SVG rendering):
  - macOS: `brew install cairo libffi` then `pip install cairosvg`
  - Debian/Ubuntu: `sudo apt install libcairo2 libpango1.0-0 libgdk-pixbuf2.0-0` then `pip install cairosvg`
  - Windows: Install GTK/LibCairo or use MSYS2 to obtain cairo libs.
- FFmpeg (audio/video conversions):
  - Install FFmpeg binary on PATH. On macOS: `brew install ffmpeg`. On Debian/Ubuntu: `sudo apt install ffmpeg`.
  - `pip install pydub` to expose pydub support.

If these libraries are not present, the registry still advertises the converter but the conversion will return an instructive error rather than failing silently.
