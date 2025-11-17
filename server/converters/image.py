from io import BytesIO
from typing import Tuple

from PIL import Image

from .base import register_converter

IMAGE_FORMATS = ["png", "jpg", "jpeg", "webp", "bmp", "gif"]


def _normalize_format(fmt: str) -> str:
    if fmt.lower() == "jpg":
        return "jpeg"
    return fmt.lower()


def _convert_image(content: bytes, target: str) -> Tuple[bytes, str]:
    with Image.open(BytesIO(content)) as img:
        img = img.convert("RGBA") if target.lower() in {"png", "webp"} else img.convert("RGB")
        buffer = BytesIO()
        save_format = "JPEG" if target.lower() in {"jpg", "jpeg"} else target.upper()
        img.save(buffer, format=save_format)
    return buffer.getvalue(), f"image/{_normalize_format(target)}"


def _register_pair(source: str, target: str) -> None:
    @register_converter(source, target, note="Lossless re-encode via Pillow")
    def _converter(content: bytes, target_format: str = target):
        return _convert_image(content, target_format)


for source in IMAGE_FORMATS:
    for target in IMAGE_FORMATS:
        if source == target:
            continue
        _register_pair(source, target)


@register_converter("png", "pdf", note="Embeds image into single-page PDF")
def png_to_pdf(content: bytes, target: str = "pdf") -> Tuple[bytes, str]:
    with Image.open(BytesIO(content)) as img:
        pdf_img = img.convert("RGB")
        buffer = BytesIO()
        pdf_img.save(buffer, format="PDF")
    return buffer.getvalue(), "application/pdf"
