from fastapi.testclient import TestClient

import wms_media_worker.main as main_module
import wms_media_worker.video_search as search_module

client = TestClient(main_module.app)
ORIGIN = {"Origin": "https://goroyattemiyo.github.io"}


def test_video_search_requires_allowed_origin(monkeypatch):
    monkeypatch.setenv("YOUTUBE_DATA_API_KEY", "test-key")
    response = client.get("/video/search", params={"q": "jazz"})
    assert response.status_code == 403


def test_provider_statuses(monkeypatch):
    monkeypatch.setenv("YOUTUBE_DATA_API_KEY", "test-key")
    monkeypatch.setenv("VIMEO_ACCESS_TOKEN", "vimeo-token")
    response = client.get("/video/providers", headers=ORIGIN)
    assert response.status_code == 200
    payload = {item["id"]: item for item in response.json()}
    assert payload["youtube"]["enabled"] is True
    assert payload["vimeo"]["enabled"] is True
    assert payload["google_web"]["enabled"] is False


def test_video_search_youtube_result(monkeypatch):
    monkeypatch.setenv("YOUTUBE_DATA_API_KEY", "test-key")
    monkeypatch.delenv("VIMEO_ACCESS_TOKEN", raising=False)

    class FakeResponse:
        status_code = 200

        def json(self):
            return {
                "items": [
                    {
                        "id": {"videoId": "abc123xyz09"},
                        "snippet": {
                            "title": "Jazz &amp; Night",
                            "channelTitle": "WMS &amp; Friends",
                            "publishedAt": "2026-09-01T00:00:00Z",
                            "thumbnails": {"medium": {"url": "https://img.example/youtube.jpg"}},
                        },
                    }
                ]
            }

    monkeypatch.setattr(search_module.requests, "get", lambda *args, **kwargs: FakeResponse())
    response = client.get("/video/search", params={"q": "jazz", "provider": "youtube"}, headers=ORIGIN)
    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["provider"] == "youtube"
    assert item["source_id"] == "abc123xyz09"
    assert item["title"] == "Jazz & Night"
    assert item["playback"] == "youtube"
    assert item["can_queue"] is True
    assert item["can_download"] is True


def test_video_search_vimeo_result(monkeypatch):
    monkeypatch.delenv("YOUTUBE_DATA_API_KEY", raising=False)
    monkeypatch.setenv("VIMEO_ACCESS_TOKEN", "vimeo-token")

    class FakeResponse:
        status_code = 200

        def json(self):
            return {
                "data": [
                    {
                        "uri": "/videos/123456789",
                        "name": "Vimeo Sample",
                        "link": "https://vimeo.com/123456789",
                        "user": {"name": "Vimeo Creator"},
                        "release_time": "2026-09-01T00:00:00+00:00",
                        "player_embed_url": "https://player.vimeo.com/video/123456789",
                        "pictures": {"sizes": [{"link": "https://img.example/small.jpg"}, {"link": "https://img.example/large.jpg"}]},
                    }
                ]
            }

    def fake_get(url, *, params, headers, timeout):
        assert url == search_module._VIMEO_SEARCH_ENDPOINT
        assert params["query"] == "sample"
        assert headers["Authorization"] == "Bearer vimeo-token"
        assert timeout == 8
        return FakeResponse()

    monkeypatch.setattr(search_module.requests, "get", fake_get)
    response = client.get("/video/search", params={"q": "sample", "provider": "vimeo"}, headers=ORIGIN)
    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["provider"] == "vimeo"
    assert item["source_id"] == "123456789"
    assert item["embed_url"] == "https://player.vimeo.com/video/123456789"
    assert item["playback"] == "iframe"
    assert item["can_queue"] is True
    assert item["can_download"] is True


def test_google_web_provider_is_reserved(monkeypatch):
    monkeypatch.setenv("GOOGLE_WEB_SEARCH_API_KEY", "google-key")
    monkeypatch.setenv("GOOGLE_WEB_SEARCH_CLIENT_ID", "partner-example-wss-standard")
    response = client.get("/video/search", params={"q": "video", "provider": "google_web"}, headers=ORIGIN)
    assert response.status_code == 503
    assert "reserved" in response.json()["detail"].lower()
