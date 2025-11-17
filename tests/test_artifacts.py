import pytest
from fastapi.testclient import TestClient
from server.app import app
import server.converters  # noqa: F401


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_conversion_artifact_is_saved_and_downloadable(client: TestClient):
    files = {"file": ("sample.txt", b"artifact test", "text/plain")}
    data = {"target_format": "pdf"}
    response = client.post("/api/convert", data=data, files=files)
    assert response.status_code == 200
    # server should return a job ID header
    job_id = int(response.headers.get("x-conversion-job"))
    assert job_id > 0

    # Now fetch artifact via job endpoint
    artifact_resp = client.get(f"/api/jobs/{job_id}/artifact")
    assert artifact_resp.status_code == 200
    assert artifact_resp.headers.get("content-type") == "application/pdf"
    assert artifact_resp.content.startswith(b"%PDF")
