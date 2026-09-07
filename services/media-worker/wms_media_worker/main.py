from __future__ import annotations

import hmac
import os
import re
from pathlib import Path
from typing import Literal
from urllib.parse import quote

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .extractor import ExtractionError, cleanup_result, extract_audio

app = FastAPI(
    title="WMS Media Worker",
    version="0.1.0",
    description="Media preprocessing worker for Web Media Studio.",
)

_default_origins = "https://goroyattemiyo.github.io,http://localhost:5173"
_allowed_origins = [
    value.strip()
    for value in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",")
    if value.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-WMS-Worker-Key"],
    expose_headers=["Content-Disposition", "X-WMS-Title", "X-WMS-Duration"],
)

AudioFormat = Literal["mp3", "m4a", "wav"]
_ALLOWED_BITRATES = {"128", "192", "256", "320"}


class ExtractRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)
    format: AudioFormat = "mp3"
    bitrate: str = "192"


def _require_key(provided: str | None) -> None:
    expected = os.getenv("WMS_WORKER_API_KEY", "")
    if not expected:
        return
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid worker API key.")


def _download_name(title: str, suffix: str) -> str:
    clean = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', "_", title).strip(" ._")
    if not clean:
        clean = "youtube-audio"
    return f"{clean[:120]}.{suffix}"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/extract")
def extract(
    request: ExtractRequest,
    background_tasks: BackgroundTasks,
    x_wms_worker_key: str | None = Header(default=None),
):
    _require_key(x_wms_worker_key)

    if request.bitrate not in _ALLOWED_BITRATES:
        raise HTTPException(status_code=422, detail="Unsupported MP3 bitrate.")

    try:
        result = extract_audio(
            request.url,
            audio_format=request.format,
            bitrate=request.bitrate,
        )
    except ExtractionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    background_tasks.add_task(cleanup_result, result)
    headers = {
        "X-WMS-Title": quote(result.title, safe=""),
        "X-WMS-Duration": str(result.duration or ""),
        "Cache-Control": "no-store",
    }
    media_types = {
        "mp3": "audio/mpeg",
        "m4a": "audio/mp4",
        "wav": "audio/wav",
    }
    return FileResponse(
        path=Path(result.file_path),
        filename=_download_name(result.title, request.format),
        media_type=media_types[request.format],
        headers=headers,
        background=background_tasks,
    )
