import os
import tarfile
import tempfile
import zipfile
from io import BytesIO
from pathlib import Path

from .base import register_converter


def _collect_paths(root: Path) -> list[Path]:
    paths: list[Path] = []
    for folder, _, files in os.walk(root):
        for file in files:
            path = Path(folder) / file
            paths.append(path)
    return paths


@register_converter("zip", "tar.gz", note="Repackages ZIP entries into tar.gz")
def zip_to_targz(content: bytes, target: str = "tar.gz"):
    with tempfile.TemporaryDirectory() as tmpdir:
        with zipfile.ZipFile(BytesIO(content)) as archive:
            archive.extractall(tmpdir)
        buffer = BytesIO()
        with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
            for path in _collect_paths(Path(tmpdir)):
                tar.add(path, arcname=path.relative_to(tmpdir))
    return buffer.getvalue(), "application/gzip"


@register_converter("tar.gz", "zip", note="Repackages tar.gz entries into ZIP")
def targz_to_zip(content: bytes, target: str = "zip"):
    with tempfile.TemporaryDirectory() as tmpdir:
        with tarfile.open(fileobj=BytesIO(content), mode="r:gz") as archive:
            archive.extractall(tmpdir)
        buffer = BytesIO()
        with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zip_file:
            for path in _collect_paths(Path(tmpdir)):
                zip_file.write(path, arcname=path.relative_to(tmpdir))
    return buffer.getvalue(), "application/zip"
