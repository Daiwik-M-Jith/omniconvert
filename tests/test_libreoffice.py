from io import BytesIO

from docx import Document
from fastapi.testclient import TestClient

from server.app import app
import server.converters  # noqa: F401

client = TestClient(app)


def test_docx_to_pdf_libreoffice():
    # create simple docx in memory
    doc = Document()
    doc.add_paragraph('Hello LibreOffice')
    buf = BytesIO()
    doc.save(buf)
    buf.seek(0)

    files = {"file": ("sample.docx", buf.read(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    data = {"target_format": "pdf"}
    response = client.post('/api/convert', data=data, files=files)
    if response.status_code == 422 or response.status_code == 500:
        # Host probably doesn't have LibreOffice; assert message shows helpful note
        assert 'LibreOffice' in response.json().get('detail', '') or 'not installed' in response.json().get('detail', '')
    else:
        assert response.status_code == 200
        assert response.content.startswith(b"%PDF")
