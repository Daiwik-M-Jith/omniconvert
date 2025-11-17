from __future__ import annotations

import shutil
import subprocess
import tempfile
from io import BytesIO
from pathlib import Path
from typing import Tuple

from .base import register_converter


def _find_ffmpeg() -> str | None:
    return shutil.which("ffmpeg")


_FFMPEG_BIN = _find_ffmpeg()


def _run_ffmpeg(in_bytes: bytes, in_ext: str, out_ext: str, extra_args=None) -> bytes:
    if not _FFMPEG_BIN:
        raise RuntimeError("FFmpeg not found on PATH; install FFmpeg to enable these conversions")
    with tempfile.TemporaryDirectory() as tmpdir:
        in_path = Path(tmpdir) / f"input.{in_ext}"
        out_path = Path(tmpdir) / f"output.{out_ext}"
        in_path.write_bytes(in_bytes)
        args = [
            _FFMPEG_BIN,
            "-y",
            "-i",
            str(in_path),
        ]
        if extra_args:
            args.extend(extra_args)
        args.append(str(out_path))
        proc = subprocess.run(args, capture_output=True, text=True)
        if proc.returncode != 0:
            raise RuntimeError(f"FFmpeg conversion failed: {proc.stderr.strip() or proc.stdout.strip()}")
        if not out_path.exists():
            raise RuntimeError("FFmpeg did not produce output file")
        return out_path.read_bytes()


if _FFMPEG_BIN:
    @register_converter("mp4", "gif", note="Convert MP4 to GIF using FFmpeg")
    def mp4_to_gif(content: bytes, target: str = "gif") -> Tuple[bytes, str]:
        # default frame rate and scale (keep it simple)
        out = _run_ffmpeg(content, "mp4", "gif", extra_args=["-r", "10"])
        return out, "image/gif"

    @register_converter("mp4", "mp3", note="Extract audio from MP4 via FFmpeg")
    def mp4_to_mp3(content: bytes, target: str = "mp3") -> Tuple[bytes, str]:
        out = _run_ffmpeg(content, "mp4", "mp3")
        return out, "audio/mpeg"
else:
    def _ffmpeg_missing(content: bytes, target: str):
        raise RuntimeError("FFmpeg is not installed on the host; install it to use video/audio conversion")

    @register_converter("mp4", "gif", note="Requires FFmpeg installed on host")
    def mp4_to_gif_stub(content: bytes, target: str = "gif") -> Tuple[bytes, str]:
        return _ffmpeg_missing(content, target)

    @register_converter("mp4", "mp3", note="Requires FFmpeg installed on host")
    def mp4_to_mp3_stub(content: bytes, target: str = "mp3") -> Tuple[bytes, str]:
        return _ffmpeg_missing(content, target)
