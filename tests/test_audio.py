from io import BytesIO

from fastapi.testclient import TestClient

from server.app import app
import server.converters  # noqa: F401

client = TestClient(app)


def test_mp3_to_wav_stub_fails_with_message():
    # a minimal MP3 header won't be a valid MP3 file, but converter should fail with nice message
    files = {"file": ("sample.mp3", b"ID3\x00\x00\x00\x00", "audio/mpeg")}
    data = {"target_format": "wav"}
    response = client.post("/api/convert", data=data, files=files)
    assert response.status_code == 500
    assert "FFmpeg" in response.json()["detail"] or "pydub" in response.json()["detail"]
