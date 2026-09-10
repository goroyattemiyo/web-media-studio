#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.parse import urlparse

import gradio as gr

APP_TITLE = "WMS Colab Companion"
OUTPUT_ROOT = Path(
    os.environ.get("WMS_COMPANION_OUTPUT_ROOT", "/content/wms-colab-companion-output")
).expanduser().resolve()
OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

MAX_DURATION_SECONDS = 1800
ALLOWED_FORMATS = ("mp3", "m4a", "wav")
MP3_BITRATES = ("128", "192", "256", "320")


def _load_css() -> str:
    css_path = Path(__file__).with_name("wms_colab_companion.css")
    try:
        return css_path.read_text(encoding="utf-8")
    except OSError:
        return "body, .gradio-container { background: #06111d !important; color: #eaf6ff !important; }"


def _query_params(request: gr.Request | None) -> dict[str, str]:
    if request is None:
        return {}
    try:
        raw = dict(request.query_params)
    except Exception:
        return {}
    result: dict[str, str] = {}
    for key, value in raw.items():
        if isinstance(key, str) and isinstance(value, str):
            result[key] = value
    return result


def _validate_source(raw_source: str) -> str:
    source = (raw_source or "").strip()[:2000]
    if not source:
        raise gr.Error("Source URLを入力してください。")

    parsed = urlparse(source)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise gr.Error("http:// または https:// のメディアURLを入力してください。")
    if parsed.username or parsed.password:
        raise gr.Error("認証情報を含むURLは使用できません。")
    return source


def _validate_format(raw_format: str, raw_bitrate: str) -> tuple[str, str]:
    media_format = (raw_format or "").strip().lower()
    bitrate = (raw_bitrate or "").strip()
    if media_format not in ALLOWED_FORMATS:
        raise gr.Error("Formatは MP3 / M4A / WAV から選択してください。")
    if bitrate not in MP3_BITRATES:
        raise gr.Error("MP3 bitrateを選択してください。")
    return media_format, bitrate


def _runtime_ready() -> tuple[bool, str]:
    if shutil.which("ffmpeg") is None:
        return False, "FFmpegが見つかりません。Notebookの準備セルを再実行してください。"
    if shutil.which("deno") is None:
        return False, "Denoが見つかりません。Notebookの準備セルを再実行してください。"
    try:
        result = subprocess.run(
            [sys.executable, "-m", "yt_dlp", "--version"],
            check=False,
            capture_output=True,
            text=True,
            timeout=15,
        )
    except Exception:
        return False, "yt-dlpを確認できません。Notebookの準備セルを再実行してください。"
    if result.returncode != 0:
        return False, "yt-dlpを確認できません。Notebookの準備セルを再実行してください。"
    return True, "ready"


def _cleanup_old_jobs(keep: int = 3) -> None:
    try:
        job_dirs = [p for p in OUTPUT_ROOT.iterdir() if p.is_dir()]
    except OSError:
        return
    job_dirs.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    for old in job_dirs[keep:]:
        shutil.rmtree(old, ignore_errors=True)


def _safe_failure_message(stderr: str, stdout: str) -> str:
    text = f"{stderr}\n{stdout}".lower()
    if "duration" in text and ("does not pass filter" in text or "match filter" in text):
        return "30分を超えるメディアはこのCompanionでは処理できません。"
    if "unsupported url" in text:
        return "このURLは現在のyt-dlpでは処理できません。"
    if "private video" in text or "video unavailable" in text:
        return "このメディアは現在取得できません。公開状態やURLを確認してください。"
    if "sign in" in text or "login" in text or "cookies" in text:
        return "ログインを要求するメディアはこのCompanionでは処理しません。"
    if "drm" in text:
        return "DRMで保護されたメディアは処理できません。"
    return "Localizeに失敗しました。URL、公開状態、対応形式を確認してください。"


def load_context(request: gr.Request):
    params = _query_params(request)
    source = params.get("wms_source", "").strip()[:2000]
    title = params.get("wms_title", "").strip()[:240]
    provider = params.get("wms_provider", "").strip()[:64] or "unknown"
    preferred_format = params.get("wms_format", "").strip().lower()
    media_format = preferred_format if preferred_format in ALLOWED_FORMATS else "mp3"

    if source:
        status = "WMSからSource URLを受け取りました。権利確認後にLocalizeを実行できます。"
    else:
        status = "Source URLを入力し、権利確認後にLocalizeを実行してください。"
    return source, title, provider, media_format, "192", False, None, status


def localize_media(
    source: str,
    title: str,
    provider: str,
    media_format: str,
    mp3_bitrate: str,
    rights_confirmed: bool,
    progress=gr.Progress(),
):
    if not rights_confirmed:
        raise gr.Error("権利を持つ、または保存・変換の許可を得ていることを確認してください。")

    source = _validate_source(source)
    media_format, mp3_bitrate = _validate_format(media_format, mp3_bitrate)

    ready, message = _runtime_ready()
    if not ready:
        raise gr.Error(message)

    _cleanup_old_jobs()
    job_dir = OUTPUT_ROOT / f"job-{uuid.uuid4().hex[:12]}"
    job_dir.mkdir(parents=True, exist_ok=False)

    progress(0.08, desc="入力を確認しています")
    output_template = str(job_dir / "%(title).160B [%(id)s].%(ext)s")
    cmd = [
        sys.executable,
        "-m",
        "yt_dlp",
        "--js-runtimes",
        "deno",
        "--no-playlist",
        "--match-filter",
        f"duration <= {MAX_DURATION_SECONDS}",
        "--extract-audio",
        "--audio-format",
        media_format,
        "--output",
        output_template,
        "--no-write-thumbnail",
        "--no-write-info-json",
        "--newline",
    ]
    if media_format == "mp3":
        cmd.extend(["--audio-quality", f"{mp3_bitrate}K"])
    cmd.append(source)

    progress(0.18, desc="yt-dlp + FFmpegでLocalizeしています")
    try:
        result = subprocess.run(
            cmd,
            check=False,
            capture_output=True,
            text=True,
            timeout=2100,
        )
    except subprocess.TimeoutExpired:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise gr.Error("処理がタイムアウトしました。より短いメディアで再試行してください。")
    except Exception:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise gr.Error("Localize処理を開始できませんでした。")

    if result.returncode != 0:
        message = _safe_failure_message(result.stderr, result.stdout)
        shutil.rmtree(job_dir, ignore_errors=True)
        raise gr.Error(message)

    progress(0.9, desc="生成ファイルを確認しています")
    candidates = [
        p
        for p in job_dir.iterdir()
        if p.is_file()
        and not p.name.endswith((".part", ".ytdl", ".temp"))
        and p.suffix.lower().lstrip(".") in ALLOWED_FORMATS
    ]
    if len(candidates) != 1:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise gr.Error("生成ファイルを一意に確認できませんでした。再試行してください。")

    output_file = candidates[0]
    size_mb = output_file.stat().st_size / 1024 / 1024
    display_title = (title or "").strip()[:240]
    provider_label = (provider or "unknown").strip()[:64]
    label = display_title or output_file.stem
    progress(1.0, desc="完了")
    status = (
        f"完了: **{label}** / {provider_label} / {media_format.upper()} / "
        f"{size_mb:.1f} MB。下のFileからDownloadしてください。"
    )
    return str(output_file), status


def reset_form():
    return "", "", "unknown", "mp3", "192", False, None, "フォームを初期化しました。"


def build_demo() -> gr.Blocks:
    with gr.Blocks(title=APP_TITLE, analytics_enabled=False) as demo:
        gr.Markdown(
            """
# WMS COLAB COMPANION

WMSから受け取ったメディアURLを、Colab上の **yt-dlp + Deno + FFmpeg** でLocalizeします。

**自分が権利を持つ、または保存・変換の許可を得ているコンテンツだけに使用してください。**
"""
        )

        with gr.Group(elem_classes=["wms-card"]):
            source = gr.Textbox(label="Source URL", placeholder="WMSから自動入力、または手入力")
            title = gr.Textbox(label="Title", interactive=True)
            provider = gr.Textbox(label="Provider", value="unknown", interactive=False)
            with gr.Row():
                media_format = gr.Dropdown(
                    choices=[("MP3", "mp3"), ("M4A", "m4a"), ("WAV", "wav")],
                    value="mp3",
                    label="Format",
                )
                mp3_bitrate = gr.Dropdown(
                    choices=[("128 kbps", "128"), ("192 kbps", "192"), ("256 kbps", "256"), ("320 kbps", "320")],
                    value="192",
                    label="MP3 bitrate",
                )
            rights = gr.Checkbox(
                label="このメディアを保存・変換する権利または許可があります",
                value=False,
            )

        status = gr.Markdown("Companionを準備しています…", elem_classes=["wms-status"])

        with gr.Row():
            localize_button = gr.Button("LocalizeしてDownload", variant="primary")
            reset_button = gr.Button("Reset")

        output_file = gr.File(label="Localized File", interactive=False)
        gr.Markdown(
            "30分以内 / 1ジョブずつ / playlist無効 / Drive mountなし / account cookies・proxy・DRM回避なし",
            elem_classes=["wms-note"],
        )

        localize_button.click(
            localize_media,
            inputs=[source, title, provider, media_format, mp3_bitrate, rights],
            outputs=[output_file, status],
            concurrency_limit=1,
            api_visibility="private",
        )
        reset_button.click(
            reset_form,
            inputs=None,
            outputs=[source, title, provider, media_format, mp3_bitrate, rights, output_file, status],
            queue=False,
            api_visibility="private",
        )
        demo.load(
            load_context,
            inputs=None,
            outputs=[source, title, provider, media_format, mp3_bitrate, rights, output_file, status],
            queue=False,
            api_visibility="private",
        )

    return demo


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=APP_TITLE)
    parser.add_argument("--server-name", default="0.0.0.0")
    parser.add_argument("--server-port", type=int, default=7860)
    parser.add_argument("--share", action="store_true")
    parser.add_argument("--debug", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    demo = build_demo()
    demo.queue(default_concurrency_limit=1, max_size=2)
    demo.launch(
        server_name=args.server_name,
        server_port=args.server_port,
        share=bool(args.share),
        debug=bool(args.debug),
        show_error=True,
        allowed_paths=[str(OUTPUT_ROOT)],
        css=_load_css(),
    )


if __name__ == "__main__":
    main()
