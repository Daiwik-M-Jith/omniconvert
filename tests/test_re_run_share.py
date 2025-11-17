import pytest
from fastapi.testclient import TestClient
from server.app import app
import server.converters  # noqa: F401


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_rerun_and_share(client: TestClient):
    # upload a simple txt -> pdf
    files = {"file": ("sample.txt", b"Hello Omni", "text/plain")}
    data = {"target_format": "pdf"}
    res = client.post('/api/convert', data=data, files=files)
    assert res.status_code == 200
    jid = int(res.headers.get('X-Conversion-Job'))

    # re-run it
    res2 = client.post(f'/api/jobs/{jid}/reconvert')
    assert res2.status_code == 200
    body = res2.json()
    assert body['job_id'] == jid
    assert body['artifact'] is not None

    # share token
    res3 = client.post(f'/api/jobs/{jid}/share')
    assert res3.status_code == 200
    data = res3.json()
    assert 'share_url' in data
    share_url = data['share_url']
    # GET using share token should work
    res4 = client.get(share_url)
    assert res4.status_code == 200
    # binary PDF content
    assert res4.content.startswith(b"%PDF")
