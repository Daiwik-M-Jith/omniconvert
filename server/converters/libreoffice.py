from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from io import BytesIO
from pathlib import Path
from typing import Tuple

from .base import register_converter


def _find_soffice() -> str | None:
    # soffice, libreoffice, or full path
    for name in ("soffice", "libreoffice"):
        path = shutil.which(name)
        if path:
            return path
    # Windows common install
    program_files = os.environ.get("PROGRAMFILES", "C:\\Program Files")
    candidates = [
        Path(program_files) / "LibreOffice" / "program" / "soffice.exe",
        Path(program_files) / "LibreOffice" / "program" / "soffice" / "soffice.exe",
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return None


_SOFFICE_BINARY = _find_soffice()


def _libreoffice_convert(content: bytes, input_ext: str, out_ext: str) -> bytes:
    if not _SOFFICE_BINARY:
        raise RuntimeError("LibreOffice not installed or not on PATH; install LibreOffice to enable this converter")
    with tempfile.TemporaryDirectory() as tmpdir:
        in_path = Path(tmpdir) / f"input.{input_ext}"
        out_path = Path(tmpdir) / f"input.{out_ext}"
        in_path.write_bytes(content)
        # soffice command: --headless --invisible --convert-to pdf --outdir <dir> <file>
        args = [
            _SOFFICE_BINARY,
            "--headless",
            "--convert-to",
            out_ext,
            "--outdir",
            str(tmpdir),
            str(in_path),
        ]
        proc = subprocess.run(args, capture_output=True, text=True)
        if proc.returncode != 0:
            raise RuntimeError(f"LibreOffice conversion failed: {proc.stderr.strip() or proc.stdout.strip()}")
        # find output file by replacing ext
        if not out_path.exists():
            # some conversions may produce another filename; find first with extension
            matches = list(Path(tmpdir).glob(f"*.{out_ext}"))
            if not matches:
                raise RuntimeError("LibreOffice did not produce output file")
            out_path = matches[0]
        return out_path.read_bytes()


if _SOFFICE_BINARY:
    @register_converter("docx", "pdf", note="High-fidelity DOCX->PDF via LibreOffice")
    def libre_docx_to_pdf(content: bytes, target: str = "pdf") -> Tuple[bytes, str]:
        data = _libreoffice_convert(content, "docx", "pdf")
        return data, "application/pdf"

    @register_converter("pptx", "pdf", note="High-fidelity PPTX->PDF via LibreOffice")
    def libre_pptx_to_pdf(content: bytes, target: str = "pdf") -> Tuple[bytes, str]:
        data = _libreoffice_convert(content, "pptx", "pdf")
        return data, "application/pdf"

    @register_converter("xlsx", "pdf", note="High-fidelity XLSX->PDF via LibreOffice")
    def libre_xlsx_to_pdf(content: bytes, target: str = "pdf") -> Tuple[bytes, str]:
        data = _libreoffice_convert(content, "xlsx", "pdf")
        return data, "application/pdf"
else:
    def _lo_missing(content: bytes, target: str):
        raise RuntimeError("LibreOffice is not installed on the host; install it to use high-fidelity Office conversions")

    @register_converter("docx", "pdf", note="Requires LibreOffice installed on host")
    def libre_docx_to_pdf_stub(content: bytes, target: str = "pdf") -> Tuple[bytes, str]:
        return _lo_missing(content, target)

    @register_converter("pptx", "pdf", note="Requires LibreOffice installed on host")
    def libre_pptx_to_pdf_stub(content: bytes, target: str = "pdf") -> Tuple[bytes, str]:
        return _lo_missing(content, target)

    @register_converter("xlsx", "pdf", note="Requires LibreOffice installed on host")
    def libre_xlsx_to_pdf_stub(content: bytes, target: str = "pdf") -> Tuple[bytes, str]:
        return _lo_missing(content, target)
