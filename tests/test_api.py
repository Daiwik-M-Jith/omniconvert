import pytest
from fastapi.testclient import TestClient

from server.app import app
import server.converters  # noqa: F401


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_formats_endpoint_lists_entries(client: TestClient):
    response = client.get("/api/formats")
    assert response.status_code == 200
    body = response.json()
    assert any(entry["source"] == "txt" for entry in body)


def test_txt_to_pdf_conversion_succeeds(client: TestClient):
    files = {"file": ("sample.txt", b"hello world", "text/plain")}
    data = {"target_format": "pdf"}
    response = client.post("/api/convert", data=data, files=files)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")
