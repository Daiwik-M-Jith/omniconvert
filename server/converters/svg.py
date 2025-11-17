from io import BytesIO
from typing import Tuple

from .base import register_converter

try:
    import cairosvg  # type: ignore
    _CAIRO_AVAILABLE = True
except Exception:  # pragma: no cover - will be runtime dependent
    cairosvg = None  # type: ignore
    _CAIRO_AVAILABLE = False


if _CAIRO_AVAILABLE:
    @register_converter("svg", "png", note="Render SVG to PNG via CairoSVG")
    def svg_to_png(content: bytes, target: str = "png") -> Tuple[bytes, str]:
        output = cairosvg.svg2png(bytestring=content)
        return output, "image/png"


    @register_converter("svg", "pdf", note="Render SVG to PDF via CairoSVG")
    def svg_to_pdf(content: bytes, target: str = "pdf") -> Tuple[bytes, str]:
        output = cairosvg.svg2pdf(bytestring=content)
        return output, "application/pdf"
else:
    def _svg_unavailable(_: bytes, __: str):
        raise RuntimeError("SVG conversion requires Cairo/CairoSVG to be installed on the host system")

    # Register to make the route visible but produce informative error when used
    @register_converter("svg", "png", note="Requires Cairo/CairoSVG installed on host")
    def svg_to_png_stub(content: bytes, target: str = "png") -> Tuple[bytes, str]:
        return _svg_unavailable(content, target)

    @register_converter("svg", "pdf", note="Requires Cairo/CairoSVG installed on host")
    def svg_to_pdf_stub(content: bytes, target: str = "pdf") -> Tuple[bytes, str]:
        return _svg_unavailable(content, target)
