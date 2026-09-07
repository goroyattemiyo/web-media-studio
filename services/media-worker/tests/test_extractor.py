import pytest

from wms_media_worker.extractor import (
    ExtractionError,
    YouTubeAccessRestrictedError,
    _check_limits,
    _normalize_extraction_error,
    _youtube_provider_opts,
    normalize_source,
    youtube_po_token_mode,
)


def test_video_id_normalizes_to_watch_url():
    assert normalize_source("dQw4w9WgXcQ") == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def test_youtube_url_is_accepted():
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    assert normalize_source(url) == url


def test_non_youtube_url_is_rejected():
    with pytest.raises(ExtractionError):
        normalize_source("https://example.com/audio.mp3")


def test_duration_guard(monkeypatch):
    monkeypatch.setenv("MAX_DURATION_SECONDS", "10")
    with pytest.raises(ExtractionError):
        _check_limits({"duration": 11})


def test_source_size_guard(monkeypatch):
    monkeypatch.setenv("MAX_SOURCE_BYTES", "100")
    with pytest.raises(ExtractionError):
        _check_limits({"duration": 1, "filesize_approx": 101})


def test_po_token_mode_is_off_by_default(monkeypatch):
    monkeypatch.delenv("YOUTUBE_PO_TOKEN_MODE", raising=False)
    assert youtube_po_token_mode() == "off"
    assert _youtube_provider_opts() == {}


def test_bgutil_mweb_provider_opts(monkeypatch):
    monkeypatch.setenv("YOUTUBE_PO_TOKEN_MODE", "bgutil-script-mweb")
    monkeypatch.setenv("BGUTIL_SERVER_HOME", "/opt/provider/server")

    assert _youtube_provider_opts() == {
        "extractor_args": {
            "youtube": {"player_client": ["mweb"]},
            "youtubepot-bgutilscript": {"server_home": ["/opt/provider/server"]},
        }
    }


def test_unknown_po_token_mode_is_rejected(monkeypatch):
    monkeypatch.setenv("YOUTUBE_PO_TOKEN_MODE", "unknown")
    with pytest.raises(ExtractionError):
        _youtube_provider_opts()


def test_bot_challenge_is_translated_without_cookie_instructions():
    error = _normalize_extraction_error(
        RuntimeError(
            "ERROR: [youtube] abc: Sign in to confirm you're not a bot. "
            "Use --cookies-from-browser or --cookies for the authentication."
        )
    )

    assert isinstance(error, YouTubeAccessRestrictedError)
    assert "YouTube側で取得が制限されました" in str(error)
    assert "cookies" not in str(error).lower()


def test_unrelated_extraction_error_keeps_original_message():
    error = _normalize_extraction_error(RuntimeError("network timeout"))
    assert type(error) is ExtractionError
    assert str(error) == "network timeout"
