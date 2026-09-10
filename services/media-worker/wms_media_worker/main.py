from __future__ import annotations

import html
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

app = FastAPI(
    title="WMS Media Worker",
    version="0.4.0",
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
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Content-Disposition", "X-WMS-Title", "X-WMS-Duration"],
)

AudioFormat = Literal["mp3", "m4a", "wav"]
_ALLOWED_BITRATES = {"128", "192", "256", "320"}
_YOUTUBE_SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search"


class ExtractRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)
    format: AudioFormat = "mp3"
    bitrate: str = "192"


class AuthenticatedUser(BaseModel):
    email: str
    name: str | None = None


class YouTubeSearchItem(BaseModel):
    video_id: str
    url: str
    title: str
    channel_title: str
    published_at: str | None = None
    thumbnail_url: str | None = None


class YouTubeSearchResponse(BaseModel):
    query: str
    items: list[YouTubeSearchItem]


def _google_client_id() -> str:
    return os.getenv("GOOGLE_CLIENT_ID", "").strip()


def _allowed_google_emails() -> set[str]:
    raw = os.getenv("ALLOWED_GOOGLE_EMAILS", "")
    return {value.strip().lower() for value in raw.split(",") if value.strip()}


def _youtube_data_api_key() -> str:
    return os.getenv("YOUTUBE_DATA_API_KEY", "").strip()


def _require_search_origin(origin: str | None) -> None:
    if not origin or origin not in _allowed_origins:
        raise HTTPException(status_code=403, detail="YouTube search is only available from an allowed WMS origin.")


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

    # Local development remains authless when Google auth is not configured.
    return None


def _download_name(title: str, suffix: str) -> str:
    clean = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', "_", title).strip(" ._")
    if not clean:
        clean = "youtube-audio"
    return f"{clean[:120]}.{suffix}"


def _youtube_api_error(response: requests.Response) -> str:
    try:
        body = response.json()
    except ValueError:
        return f"YouTube search request failed with HTTP {response.status_code}."

    error = body.get("error") if isinstance(body, dict) else None
    message = error.get("message") if isinstance(error, dict) else None
    if isinstance(message, str) and message.strip():
        return message.strip()
    return f"YouTube search request failed with HTTP {response.status_code}."


def _thumbnail_url(snippet: dict) -> str | None:
    thumbnails = snippet.get("thumbnails")
    if not isinstance(thumbnails, dict):
        return None
    for key in ("medium", "high", "default"):
        item = thumbnails.get(key)
        if isinstance(item, dict):
            value = item.get("url")
            if isinstance(value, str) and value:
                return value
    return None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/youtube/search", response_model=YouTubeSearchResponse)
def youtube_search(
    q: str = Query(min_length=2, max_length=120),
    max_results: int = Query(default=8, ge=1, le=8),
    origin: str | None = Header(default=None),
) -> YouTubeSearchResponse:
    _require_search_origin(origin)
    api_key = _youtube_data_api_key()
    if not api_key:
        raise HTTPException(status_code=503, detail="YouTube search is not configured on the WMS worker yet.")

    try:
        response = requests.get(
            _YOUTUBE_SEARCH_ENDPOINT,
            params={
                "part": "snippet",
                "type": "video",
                "maxResults": max_results,
                "q": q.strip(),
                "key": api_key,
            },
            timeout=8,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="YouTube search service could not be reached.") from exc

    if response.status_code != 200:
        message = _youtube_api_error(response)
        if response.status_code in {403, 429}:
            raise HTTPException(status_code=503, detail=f"YouTube search quota or API configuration rejected the request: {message}")
        raise HTTPException(status_code=502, detail=message)

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="YouTube search returned an invalid response.") from exc

    raw_items = payload.get("items") if isinstance(payload, dict) else None
    results: list[YouTubeSearchItem] = []
    if isinstance(raw_items, list):
        for raw in raw_items:
            if not isinstance(raw, dict):
                continue
            identifier = raw.get("id")
            snippet = raw.get("snippet")
            if not isinstance(identifier, dict) or not isinstance(snippet, dict):
                continue
            video_id = identifier.get("videoId")
            title = snippet.get("title")
            channel_title = snippet.get("channelTitle")
            if not isinstance(video_id, str) or not video_id:
                continue
            if not isinstance(title, str) or not title:
                continue
            results.append(
                YouTubeSearchItem(
                    video_id=video_id,
                    url=f"https://www.youtube.com/watch?v={video_id}",
                    title=html.unescape(title),
                    channel_title=html.unescape(channel_title) if isinstance(channel_title, str) else "YouTube",
                    published_at=snippet.get("publishedAt") if isinstance(snippet.get("publishedAt"), str) else None,
                    thumbnail_url=_thumbnail_url(snippet),
                )
            )

    return YouTubeSearchResponse(query=q.strip(), items=results)


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
