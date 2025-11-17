from io import BytesIO

from PIL import Image

from server.services.registry import registry
import server.converters  # noqa: F401 - ensures registration


def test_docx_to_pdf_registered():
    converter = registry.resolve("docx", "pdf")
    assert converter is not None


def test_image_conversion_round_trip():
    converter = registry.resolve("png", "jpg")
    img = Image.new("RGB", (10, 10), color="red")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    output_bytes, mime = converter(buffer.getvalue(), "jpg")
    assert output_bytes
    assert mime == "image/jpeg"
