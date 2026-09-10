from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Literal
from urllib.parse import quote

import requests
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel, Field

from .extractor import (
    ExtractionError,
    YouTubeAccessRestrictedError,
    cleanup_result,
    extract_audio,
)
from .video_search import (
    VideoProviderStatus,
    VideoSearchResponse,
    provider_statuses,
    search_videos,
)

app = FastAPI(
    title="WMS Media Worker",
    version="0.5.0",
    description="Media preprocessing and provider-based video search worker for Web Media Studio.",
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
    allow_headers=["Authorization", "Content-Type"],
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


def _require_search_origin(origin: str | None) -> None:
    if not origin or origin not in _allowed_origins:
        raise HTTPException(status_code=403, detail="Video search is only available from an allowed WMS origin.")


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


def _authorize(authorization: str | None) -> AuthenticatedUser | None:
    if _google_client_id() or _allowed_google_emails():
        return _verify_google_token(authorization)
    return None


def _download_name(title: str, suffix: str) -> str:
    clean = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', "_", title).strip(" ._")
    if not clean:
        clean = "media-audio"
    return f"{clean[:120]}.{suffix}"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/video/providers", response_model=list[VideoProviderStatus])
def video_providers(origin: str | None = Header(default=None)) -> list[VideoProviderStatus]:
    _require_search_origin(origin)
    return provider_statuses()


@app.get("/video/search", response_model=VideoSearchResponse)
def video_search(
    q: str = Query(min_length=2, max_length=120),
    provider: str = Query(default="all"),
    max_results: int = Query(default=8, ge=1, le=8),
    origin: str | None = Header(default=None),
) -> VideoSearchResponse:
    _require_search_origin(origin)
    try:
        response = search_videos(q.strip(), provider, max_results)
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else 502
        if status in {401, 403, 429}:
            raise HTTPException(status_code=503, detail="A configured video provider rejected the search request.") from exc
        raise HTTPException(status_code=502, detail="A configured video provider search failed.") from exc
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="A configured video provider could not be reached.") from exc

    if provider != "google_web" and not any(item.enabled for item in response.providers if provider in {"all", item.id}):
        raise HTTPException(status_code=503, detail="No requested video search provider is configured on the WMS worker yet.")
    if provider == "google_web":
        raise HTTPException(status_code=503, detail="Google Web Search provider is reserved but not enabled until partner configuration and video filtering are validated.")
    return response


# Compatibility endpoint for existing deployed clients while UX-3 moves to /video/search.
@app.get("/youtube/search")
def youtube_search_compat(
    q: str = Query(min_length=2, max_length=120),
    max_results: int = Query(default=8, ge=1, le=8),
    origin: str | None = Header(default=None),
):
    _require_search_origin(origin)
    response = search_videos(q.strip(), "youtube", max_results)
    if not any(item.enabled for item in response.providers if item.id == "youtube"):
        raise HTTPException(status_code=503, detail="YouTube search is not configured on the WMS worker yet.")
    return {
        "query": response.query,
        "items": [
            {
                "video_id": item.source_id,
                "url": item.url,
                "title": item.title,
                "channel_title": item.author,
                "published_at": item.published_at,
                "thumbnail_url": item.thumbnail_url,
            }
            for item in response.items
            if item.provider == "youtube"
        ],
    }


@app.get("/auth/me", response_model=AuthenticatedUser)
def auth_me(
    authorization: str | None = Header(default=None),
) -> AuthenticatedUser:
    user = _authorize(authorization)
    if user is None:
        raise HTTPException(
            status_code=503,
            detail="Google authentication is not configured on the worker.",
        )
    return user


@app.post("/extract")
def extract(
    request: ExtractRequest,
    background_tasks: BackgroundTasks,
    authorization: str | None = Header(default=None),
):
    _authorize(authorization)

    if request.bitrate not in _ALLOWED_BITRATES:
        raise HTTPException(status_code=422, detail="Unsupported MP3 bitrate.")

    try:
        result = extract_audio(
            request.url,
            audio_format=request.format,
            bitrate=request.bitrate,
        )
    except YouTubeAccessRestrictedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
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
