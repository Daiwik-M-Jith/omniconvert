# Conversion Platform Architecture Plan

## Vision vs. Practicality
The stated target of "every possible" file conversion is unattainable in a single delivery because:
- File formats have proprietary/undocumented specs (e.g., PSD, DOCX rendering engines, CAD binaries) and require vendor tooling or licenses.
- Some transformations are undefined (binary blobs to structured media) or violate content protections (DRM-locked PDFs, encrypted archives).
- Many conversions need heavy native dependencies (FFmpeg, LibreOffice, Ghostscript). Shipping everything in one bundle would bloat distribution and complicate security updates.

**Approach:** deliver an extensible conversion service with a plugin registry so new format pairs can be added quickly. Ship a useful starter set covering popular document, image, archive, and text types. Document how to extend it.

## System Overview
- **Frontend:** Zero-auth single-page UI (HTML/CSS/JS) served statically by the backend. Users upload a file, select the desired target format, and monitor conversion history live via REST APIs.
- **Backend:** FastAPI app providing:
  - `/api/formats` – advertises available converters via the registry.
  - `/api/convert` – handles uploads, validates requested conversion, performs transformation synchronously for now, stores metadata in SQLite, and returns the converted file.
  - `/api/history` – paginated conversion history.
  - Static-file server for the frontend bundle.
- **Database:** SQLite via SQLModel for lightweight persistence (jobs, audit trail, converter metadata).
- **Conversion Engine:**
  - `ConversionRegistry` maps `(source_ext, target_ext)` pairs to converter callables.
  - Each converter implements `convert(input_bytes) -> (output_bytes, mime_type)` and may rely on specialized libraries (Pillow for images, python-docx/fpdf for documents, PyPDF2 for PDF parsing, pydub/ffmpeg optional hook).
  - Registry is declarative; new modules can register additional handlers automatically at import.
- **Workers:** For MVP conversions run inline. The architecture leaves room for background jobs (Celery / RQ) by swapping the executor later.

## Initial Converter Coverage
1. **Image Suite (Pillow)**: png, jpg, jpeg, webp, bmp, gif.
2. **Document/Text**:
   - docx → pdf/png/txt (text-based rendering using python-docx + fpdf / Pillow).
   - pdf → txt/docx (PyPDF2 + python-docx).
   - txt/markdown → pdf/png.
3. **Archive**:
   - zip ↔ tar.gz conversions using Python stdlib.

Each converter lists its fidelity level (e.g., "text-only" DOCX to PDF) so users know what to expect.

## Security & Integrity
- Enforce file size cap (configurable, default 25 MB) to prevent resource exhaustion.
- Only allow conversions declared in the registry.
- Store jobs with user-supplied filenames, target format, duration, status, and failure reason.
- Purge uploaded and generated artifacts after response completes (in-memory conversions, or temp files deleted).

## Extensibility Hooks
- `converters/base.py` exposes a `@register_converter` decorator.
- Each module imports `registry` at import time to register new conversions.
- Adding FFmpeg/LibreOffice integrations later only requires: install dependency, create converter module, register supported pairs.

## Deliverables
- FastAPI backend under `server/` with modular converters.
- Static frontend under `frontend/`.
- SQLite migrations auto-created on startup.
- README with setup instructions, extension guide, and roadmap for broader coverage.
- Automated tests for registry, DB models, and representative conversion paths.
