from __future__ import annotations

import os
import re
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

import yt_dlp

AudioFormat = Literal["mp3", "m4a", "wav"]
_ALLOWED_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
}
_VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


class ExtractionError(RuntimeError):
    """Raised when a media source cannot be processed safely."""


@dataclass(slots=True)
class ExtractionResult:
    file_path: Path
    title: str
    duration: int | None
    source_url: str
    audio_format: AudioFormat
    work_dir: Path


def normalize_source(source: str) -> str:
    value = source.strip()
    if _VIDEO_ID_RE.fullmatch(value):
        return f"https://www.youtube.com/watch?v={value}"

    try:
        parsed = urlparse(value)
    except ValueError as exc:
        raise ExtractionError("Invalid source URL.") from exc

    if parsed.scheme not in {"http", "https"}:
        raise ExtractionError("Only http/https URLs are supported.")

    host = (parsed.hostname or "").lower()
    if host not in _ALLOWED_HOSTS:
        raise ExtractionError("This worker currently accepts YouTube URLs or video IDs only.")

    return value


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _check_limits(info: dict) -> None:
    max_duration = _int_env("MAX_DURATION_SECONDS", 1800)
    duration = info.get("duration")
    if max_duration > 0 and isinstance(duration, (int, float)) and duration > max_duration:
        raise ExtractionError(
            f"Media duration exceeds the worker limit ({max_duration} seconds)."
        )

    max_source_bytes = _int_env("MAX_SOURCE_BYTES", 750 * 1024 * 1024)
    size = info.get("filesize") or info.get("filesize_approx")
    if max_source_bytes > 0 and isinstance(size, (int, float)) and size > max_source_bytes:
        raise ExtractionError("Source media is larger than the worker limit.")


def _postprocessor(audio_format: AudioFormat, bitrate: str) -> dict:
    postprocessor: dict[str, str] = {
        "key": "FFmpegExtractAudio",
        "preferredcodec": audio_format,
    }
    if audio_format == "mp3":
        postprocessor["preferredquality"] = bitrate
    return postprocessor


def _find_output(work_dir: Path, audio_format: AudioFormat) -> Path:
    expected = work_dir / f"audio.{audio_format}"
    if expected.exists():
        return expected

    candidates = [
        item
        for item in work_dir.glob("audio.*")
        if item.is_file() and not item.name.endswith((".part", ".ytdl"))
    ]
    if not candidates:
        raise ExtractionError("yt-dlp/FFmpeg finished without producing an audio file.")
    return candidates[0]


def extract_audio(
    source: str,
    *,
    audio_format: AudioFormat = "mp3",
    bitrate: str = "192",
) -> ExtractionResult:
    if audio_format not in {"mp3", "m4a", "wav"}:
        raise ExtractionError("Unsupported output format.")

    normalized = normalize_source(source)
    work_dir = Path(tempfile.mkdtemp(prefix="wms-media-"))

    base_opts = {
        "noplaylist": True,
        "quiet": True,
        "no_warnings": False,
        "retries": 3,
        "socket_timeout": 20,
    }

    try:
        with yt_dlp.YoutubeDL(base_opts) as probe:
            info = probe.extract_info(normalized, download=False)

        if not isinstance(info, dict):
            raise ExtractionError("Could not read media metadata.")

        _check_limits(info)
        title = str(info.get("title") or info.get("id") or "youtube-audio")
        duration_raw = info.get("duration")
        duration = int(duration_raw) if isinstance(duration_raw, (int, float)) else None

        download_opts = {
            **base_opts,
            "format": "bestaudio/best",
            "outtmpl": str(work_dir / "audio.%(ext)s"),
            "postprocessors": [_postprocessor(audio_format, bitrate)],
        }
        with yt_dlp.YoutubeDL(download_opts) as downloader:
            downloader.download([normalized])

        output = _find_output(work_dir, audio_format)
        return ExtractionResult(
            file_path=output,
            title=title,
            duration=duration,
            source_url=normalized,
            audio_format=audio_format,
            work_dir=work_dir,
        )
    except ExtractionError:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise
    except Exception as exc:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise ExtractionError(str(exc)) from exc


def cleanup_result(result: ExtractionResult) -> None:
    shutil.rmtree(result.work_dir, ignore_errors=True)
