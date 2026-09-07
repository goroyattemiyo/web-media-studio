import pytest

from wms_media_worker.extractor import ExtractionError, _check_limits, normalize_source


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
