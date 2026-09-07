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
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel, Field

from .extractor import ExtractionError, cleanup_result, extract_audio

app = FastAPI(
    title="WMS Media Worker",
    version="0.2.0",
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
    allow_headers=["Authorization", "Content-Type", "X-WMS-Worker-Key"],
    expose_headers=["Content-Disposition", "X-WMS-Title", "X-WMS-Duration"],
)

AudioFormat = Literal["mp3", "m4a", "wav"]
_ALLOWED_BITRATES = {"128", "192", "256", "320"}


class ExtractRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)
    format: AudioFormat = "mp3"
    bitrate: str = "192"


class AuthenticatedUser(BaseModel):
    email: str
    name: str | None = None


def _google_client_id() -> str:
    return os.getenv("GOOGLE_CLIENT_ID", "").strip()


def _allowed_google_emails() -> set[str]:
    raw = os.getenv("ALLOWED_GOOGLE_EMAILS", "")
    return {value.strip().lower() for value in raw.split(",") if value.strip()}


def _legacy_key_matches(provided: str | None) -> bool:
    expected = os.getenv("WMS_WORKER_API_KEY", "").strip()
    return bool(expected and provided and hmac.compare_digest(provided, expected))


def _verify_google_token(authorization: str | None) -> AuthenticatedUser:
    client_id = _google_client_id()
    allowed_emails = _allowed_google_emails()

    if not client_id or not allowed_emails:
        raise HTTPException(
            status_code=503,
            detail="Google authentication is not configured on the worker.",
        )

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Google sign-in is required.")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Google sign-in is required.")

    try:
        payload = google_id_token.verify_oauth2_token(
            token,
            GoogleAuthRequest(),
            client_id,
        )
    except (ValueError, GoogleAuthError) as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired Google ID token.") from exc

    email = payload.get("email")
    email_verified = payload.get("email_verified")
    if not isinstance(email, str) or email_verified is not True:
        raise HTTPException(status_code=403, detail="A verified Google email is required.")

    normalized_email = email.lower()
    if normalized_email not in allowed_emails:
        raise HTTPException(status_code=403, detail="This Google account is not allowed to use the worker.")

    name = payload.get("name")
    return AuthenticatedUser(
        email=email,
        name=name if isinstance(name, str) and name else None,
    )


def _authorize(
    authorization: str | None,
    x_wms_worker_key: str | None,
) -> AuthenticatedUser | None:
    # Google auth is the preferred production path. The API key remains as a
    # temporary migration fallback until the Google login flow is verified on devices.
    if authorization and authorization.startswith("Bearer "):
        return _verify_google_token(authorization)

    if _legacy_key_matches(x_wms_worker_key):
        return None

    if _google_client_id() or _allowed_google_emails():
        return _verify_google_token(authorization)

    if os.getenv("WMS_WORKER_API_KEY", "").strip():
        raise HTTPException(status_code=401, detail="Invalid worker API key.")

    # Local development remains authless when neither auth mechanism is configured.
    return None


def _download_name(title: str, suffix: str) -> str:
    clean = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', "_", title).strip(" ._")
    if not clean:
        clean = "youtube-audio"
    return f"{clean[:120]}.{suffix}"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/auth/me", response_model=AuthenticatedUser)
def auth_me(
    authorization: str | None = Header(default=None),
    x_wms_worker_key: str | None = Header(default=None),
) -> AuthenticatedUser:
    user = _authorize(authorization, x_wms_worker_key)
    if user is None:
        raise HTTPException(
            status_code=409,
            detail="Legacy API-key authentication does not expose a Google user.",
        )
    return user


@app.post("/extract")
def extract(
    request: ExtractRequest,
    background_tasks: BackgroundTasks,
    authorization: str | None = Header(default=None),
    x_wms_worker_key: str | None = Header(default=None),
):
    _authorize(authorization, x_wms_worker_key)

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
