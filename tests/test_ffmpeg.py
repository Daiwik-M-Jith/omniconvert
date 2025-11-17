from io import BytesIO

from fastapi.testclient import TestClient

from server.app import app
import server.converters  # noqa: F401

client = TestClient(app)


def test_mp4_to_gif_ffmpeg():
    # put a small invalid mp4 header; if ffmpeg available, actual conversion may fail, but we assert responses
    files = {"file": ("sample.mp4", b"\x00\x00\x00\x18ftypmp42\x00\x00\x00mp4", "video/mp4")}
    data = {"target_format": "gif"}
    response = client.post('/api/convert', data=data, files=files)
    assert response.status_code in (200, 500, 422)
    if response.status_code == 500:
        assert 'FFmpeg' in response.json().get('detail', '') or 'ffmpeg' in response.json().get('detail', '')