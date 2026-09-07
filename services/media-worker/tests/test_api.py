from fastapi.testclient import TestClient

import wms_media_worker.main as main_module
from wms_media_worker.extractor import ExtractionResult

client = TestClient(main_module.app)


def clear_auth_env(monkeypatch):
    monkeypatch.delenv("WMS_WORKER_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("ALLOWED_GOOGLE_EMAILS", raising=False)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_key(monkeypatch):
    clear_auth_env(monkeypatch)
    monkeypatch.setenv("WMS_WORKER_API_KEY", "secret")
    response = client.post(
        "/extract",
        json={"url": "dQw4w9WgXcQ", "format": "mp3", "bitrate": "192"},
    )
    assert response.status_code == 401


def test_google_auth_requires_bearer(monkeypatch):
    clear_auth_env(monkeypatch)
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com")
    monkeypatch.setenv("ALLOWED_GOOGLE_EMAILS", "allowed@example.com")

    response = client.get("/auth/me")
    assert response.status_code == 401


def test_google_auth_allows_configured_email(monkeypatch):
    clear_auth_env(monkeypatch)
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com")
    monkeypatch.setenv("ALLOWED_GOOGLE_EMAILS", "allowed@example.com")
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

    response = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer valid-token"},
    )
    assert response.status_code == 200
    assert response.json() == {"email": "allowed@example.com", "name": "Allowed User"}


def test_google_auth_rejects_other_email(monkeypatch):
    clear_auth_env(monkeypatch)
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com")
    monkeypatch.setenv("ALLOWED_GOOGLE_EMAILS", "allowed@example.com")
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
