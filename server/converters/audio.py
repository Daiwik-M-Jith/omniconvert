from io import BytesIO
from typing import Tuple

from .base import register_converter

# optional pydub backend
try:
    from pydub import AudioSegment
    _PYDUB_AVAILABLE = True
except Exception:
    AudioSegment = None  # type: ignore
    _PYDUB_AVAILABLE = False


if _PYDUB_AVAILABLE:
    @register_converter("mp3", "wav", note="Convert MP3 to WAV via pydub/ffmpeg")
    def mp3_to_wav(content: bytes, target: str = "wav") -> Tuple[bytes, str]:
        audio = AudioSegment.from_file(BytesIO(content), format="mp3")
        buf = BytesIO()
        audio.export(buf, format="wav")
        buf.seek(0)
        return buf.getvalue(), "audio/wav"

    @register_converter("wav", "mp3", note="Convert WAV to MP3 via pydub/ffmpeg")
    def wav_to_mp3(content: bytes, target: str = "mp3") -> Tuple[bytes, str]:
        audio = AudioSegment.from_file(BytesIO(content), format="wav")
        buf = BytesIO()
        audio.export(buf, format="mp3")
        buf.seek(0)
        return buf.getvalue(), "audio/mpeg"
else:
    def _missing_audio(content: bytes, target: str):
        raise RuntimeError("Audio conversions require pydub and FFmpeg installed on the host")

    @register_converter("mp3", "wav", note="Requires pydub + FFmpeg on host")
    def mp3_to_wav_stub(content: bytes, target: str = "wav") -> Tuple[bytes, str]:
        return _missing_audio(content, target)

    @register_converter("wav", "mp3", note="Requires pydub + FFmpeg on host")
    def wav_to_mp3_stub(content: bytes, target: str = "mp3") -> Tuple[bytes, str]:
        return _missing_audio(content, target)
