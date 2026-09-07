from fastapi.testclient import TestClient

import wms_media_worker.main as main_module
from wms_media_worker.extractor import (
    ExtractionResult,
    YouTubeAccessRestrictedError,
)

client = TestClient(main_module.app)


def clear_auth_env(monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("ALLOWED_GOOGLE_EMAILS", raising=False)


def configure_google_auth(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com")
    monkeypatch.setenv("ALLOWED_GOOGLE_EMAILS", "allowed@example.com")


def mock_allowed_google_user(monkeypatch):
    monkeypatch.setattr(
        main_module.google_id_token,
        "verify_oauth2_token",
        lambda token, request, audience: {
            "email": "allowed@example.com",
            "email_verified": True,
            "name": "Allowed User",
            "aud": audience,
        },
    )


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_google_auth_requires_bearer(monkeypatch):
    clear_auth_env(monkeypatch)
    configure_google_auth(monkeypatch)

    response = client.get("/auth/me")
    assert response.status_code == 401


def test_extract_requires_google_auth_when_configured(monkeypatch):
    clear_auth_env(monkeypatch)
    configure_google_auth(monkeypatch)

    response = client.post(
        "/extract",
        json={"url": "dQw4w9WgXcQ", "format": "mp3", "bitrate": "192"},
    )
    assert response.status_code == 401


def test_google_auth_allows_configured_email(monkeypatch):
    clear_auth_env(monkeypatch)
    configure_google_auth(monkeypatch)
    mock_allowed_google_user(monkeypatch)

    response = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer valid-token"},
    )
    assert response.status_code == 200
    assert response.json() == {"email": "allowed@example.com", "name": "Allowed User"}


def test_google_auth_rejects_other_email(monkeypatch):
    clear_auth_env(monkeypatch)
    configure_google_auth(monkeypatch)
    monkeypatch.setattr(
        main_module.google_id_token,
        "verify_oauth2_token",
        lambda token, request, audience: {
            "email": "other@example.com",
            "email_verified": True,
            "aud": audience,
        },
    )

    response = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer valid-token"},
    )
    assert response.status_code == 403


def test_youtube_access_restriction_is_friendly(monkeypatch):
    clear_auth_env(monkeypatch)

    def blocked_extract_audio(url, *, audio_format, bitrate):
        raise YouTubeAccessRestrictedError(
            "YouTube側で取得が制限されました。この動画はCloud処理から直接Local化できません。"
            "手元の音声・動画ファイルをLocal Libraryへ追加してください。"
        )

    monkeypatch.setattr(main_module, "extract_audio", blocked_extract_audio)

    response = client.post(
        "/extract",
        json={"url": "dQw4w9WgXcQ", "format": "mp3", "bitrate": "192"},
    )
    assert response.status_code == 409
    assert "YouTube側で取得が制限されました" in response.json()["detail"]
    assert "cookies" not in response.json()["detail"].lower()


def test_extract_returns_file(monkeypatch, tmp_path):
    clear_auth_env(monkeypatch)
    work_dir = tmp_path / "job"
    work_dir.mkdir()
    output = work_dir / "audio.mp3"
    output.write_bytes(b"fake-mp3")

    def fake_extract_audio(url, *, audio_format, bitrate):
        return ExtractionResult(
            file_path=output,
            title="Test title",
            duration=123,
            source_url=url,
            audio_format=audio_format,
            work_dir=work_dir,
        )

    monkeypatch.setattr(main_module, "extract_audio", fake_extract_audio)
    monkeypatch.setattr(main_module, "cleanup_result", lambda result: None)

    response = client.post(
        "/extract",
        json={"url": "dQw4w9WgXcQ", "format": "mp3", "bitrate": "192"},
    )
    assert response.status_code == 200
    assert response.content == b"fake-mp3"
    assert response.headers["content-type"].startswith("audio/mpeg")
    assert response.headers["x-wms-duration"] == "123"
