from __future__ import annotations

import html
import os
from typing import Literal

import requests
from pydantic import BaseModel

VideoProvider = Literal["youtube", "vimeo", "google_web"]

_YOUTUBE_SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search"
_VIMEO_SEARCH_ENDPOINT = "https://api.vimeo.com/videos"


class VideoProviderStatus(BaseModel):
    id: VideoProvider
    label: str
    enabled: bool
    reason: str | None = None


class VideoSearchItem(BaseModel):
    provider: VideoProvider
    source_id: str
    url: str
    title: str
    author: str
    published_at: str | None = None
    thumbnail_url: str | None = None
    embed_url: str | None = None
    playback: Literal["youtube", "iframe", "external"] = "external"
    can_queue: bool = False
    can_download: bool = False


class VideoSearchResponse(BaseModel):
    query: str
    provider: str
    providers: list[VideoProviderStatus]
    items: list[VideoSearchItem]


def _youtube_api_key() -> str:
    return os.getenv("YOUTUBE_DATA_API_KEY", "").strip()


def _vimeo_access_token() -> str:
    return os.getenv("VIMEO_ACCESS_TOKEN", "").strip()


def provider_statuses() -> list[VideoProviderStatus]:
    youtube_enabled = bool(_youtube_api_key())
    vimeo_enabled = bool(_vimeo_access_token())
    google_key = os.getenv("GOOGLE_WEB_SEARCH_API_KEY", "").strip()
    google_client = os.getenv("GOOGLE_WEB_SEARCH_CLIENT_ID", "").strip()
    return [
        VideoProviderStatus(id="youtube", label="YouTube", enabled=youtube_enabled, reason=None if youtube_enabled else "YOUTUBE_DATA_API_KEY is not configured."),
        VideoProviderStatus(id="vimeo", label="Vimeo", enabled=vimeo_enabled, reason=None if vimeo_enabled else "VIMEO_ACCESS_TOKEN is not configured."),
        VideoProviderStatus(
            id="google_web",
            label="Google Web",
            enabled=False,
            reason=(
                "Google Web Search Service requires a partner agreement/client ID; provider reserved for later enablement."
                if not (google_key and google_client)
                else "Credentials detected, but WMS keeps Google Web provider disabled until partner terms and video-result filtering are validated."
            ),
        ),
    ]


def _raise_provider_error(response: requests.Response) -> None:
    if response.status_code == 200:
        return
    error = requests.HTTPError(f"Provider search failed with HTTP {response.status_code}.")
    error.response = response
    raise error


def _thumbnail_from_youtube(snippet: dict) -> str | None:
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


def search_youtube(query: str, max_results: int) -> list[VideoSearchItem]:
    api_key = _youtube_api_key()
    if not api_key:
        return []
    response = requests.get(
        _YOUTUBE_SEARCH_ENDPOINT,
        params={"part": "snippet", "type": "video", "maxResults": max_results, "q": query, "key": api_key},
        timeout=8,
    )
    _raise_provider_error(response)
    payload = response.json()
    raw_items = payload.get("items") if isinstance(payload, dict) else None
    results: list[VideoSearchItem] = []
    if not isinstance(raw_items, list):
        return results
    for raw in raw_items:
        if not isinstance(raw, dict):
            continue
        identifier = raw.get("id")
        snippet = raw.get("snippet")
        if not isinstance(identifier, dict) or not isinstance(snippet, dict):
            continue
        video_id = identifier.get("videoId")
        title = snippet.get("title")
        if not isinstance(video_id, str) or not video_id or not isinstance(title, str) or not title:
            continue
        channel = snippet.get("channelTitle")
        results.append(VideoSearchItem(
            provider="youtube",
            source_id=video_id,
            url=f"https://www.youtube.com/watch?v={video_id}",
            title=html.unescape(title),
            author=html.unescape(channel) if isinstance(channel, str) else "YouTube",
            published_at=snippet.get("publishedAt") if isinstance(snippet.get("publishedAt"), str) else None,
            thumbnail_url=_thumbnail_from_youtube(snippet),
            playback="youtube",
            can_queue=True,
            can_download=True,
        ))
    return results


def _vimeo_thumbnail(item: dict) -> str | None:
    pictures = item.get("pictures")
    sizes = pictures.get("sizes") if isinstance(pictures, dict) else None
    if not isinstance(sizes, list):
        return None
    for size in reversed(sizes):
        if isinstance(size, dict) and isinstance(size.get("link"), str):
            return size["link"]
    return None


def search_vimeo(query: str, max_results: int) -> list[VideoSearchItem]:
    token = _vimeo_access_token()
    if not token:
        return []
    response = requests.get(
        _VIMEO_SEARCH_ENDPOINT,
        params={
            "query": query,
            "per_page": max_results,
            "sort": "relevant",
            "direction": "desc",
            "fields": "uri,name,link,user.name,pictures.sizes,release_time,player_embed_url,privacy.view",
        },
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.vimeo.*+json;version=3.4"},
        timeout=8,
    )
    _raise_provider_error(response)
    payload = response.json()
    raw_items = payload.get("data") if isinstance(payload, dict) else None
    results: list[VideoSearchItem] = []
    if not isinstance(raw_items, list):
        return results
    for raw in raw_items:
        if not isinstance(raw, dict):
            continue
        uri = raw.get("uri")
        title = raw.get("name")
        link = raw.get("link")
        if not isinstance(uri, str) or not isinstance(title, str) or not isinstance(link, str):
            continue
        source_id = uri.rstrip("/").split("/")[-1]
        if not source_id:
            continue
        user = raw.get("user")
        author = user.get("name") if isinstance(user, dict) and isinstance(user.get("name"), str) else "Vimeo"
        embed_url = raw.get("player_embed_url") if isinstance(raw.get("player_embed_url"), str) else f"https://player.vimeo.com/video/{source_id}"
        results.append(VideoSearchItem(
            provider="vimeo",
            source_id=source_id,
            url=link,
            title=title,
            author=author,
            published_at=raw.get("release_time") if isinstance(raw.get("release_time"), str) else None,
            thumbnail_url=_vimeo_thumbnail(raw),
            embed_url=embed_url,
            playback="iframe",
            can_queue=False,
            can_download=True,
        ))
    return results


def search_videos(query: str, provider: str, max_results: int) -> VideoSearchResponse:
    statuses = provider_statuses()
    enabled = {item.id for item in statuses if item.enabled}
    requested = provider if provider in {"all", "youtube", "vimeo", "google_web"} else "all"
    results: list[VideoSearchItem] = []

    if requested in {"all", "youtube"} and "youtube" in enabled:
        results.extend(search_youtube(query, max_results))
    if requested in {"all", "vimeo"} and "vimeo" in enabled:
        results.extend(search_vimeo(query, max_results))

    seen: set[str] = set()
    deduped: list[VideoSearchItem] = []
    for item in results:
        key = f"{item.provider}:{item.source_id or item.url}"
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
        if len(deduped) >= max_results:
            break

    return VideoSearchResponse(query=query, provider=requested, providers=statuses, items=deduped)
