#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from datetime import datetime, timezone
from pathlib import Path

import gradio as gr

APP_TITLE = "WMS Colab Companion — Gate 0"
OUTPUT_ROOT = Path(
    os.environ.get("WMS_COMPANION_GATE0_OUTPUT_ROOT", "/tmp/wms-colab-companion-gate0")
).expanduser().resolve()
OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)


def _load_css() -> str:
    css_path = Path(__file__).with_name("wms_colab_companion_gate0.css")
    try:
        return css_path.read_text(encoding="utf-8")
    except OSError:
        return """
body, .gradio-container { background: #06111d !important; color: #eaf6ff !important; }
"""


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


def load_context(request: gr.Request):
    params = _query_params(request)
    source = params.get("wms_source", "").strip()[:2000]
    title = params.get("wms_title", "").strip()[:240]
    provider = params.get("wms_provider", "").strip()[:64] or "unknown"

    if source:
        status = "WMSからURLを受け取りました。Gate 0では通信・埋め込み・ファイル保存だけを検証します。"
    else:
        status = "WMSからのURLはまだありません。直接入力してもGate 0を確認できます。"
    return source, title, provider, status


def create_test_file(source: str, title: str, provider: str):
    source = (source or "").strip()
    title = (title or "").strip()
    provider = (provider or "unknown").strip()
    if not source:
        raise gr.Error("テスト用URLを入力してください。")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
    output_path = OUTPUT_ROOT / f"wms-companion-gate0-{stamp}.txt"
    output_path.write_text(
        "\n".join(
            [
                "WMS Colab Companion Gate 0",
                f"source={source}",
                f"title={title}",
                f"provider={provider}",
                "",
                "This file proves that the Gradio File output can be downloaded.",
                "No media download or yt-dlp execution happened in Gate 0.",
            ]
        ),
        encoding="utf-8",
    )
    return str(output_path), "テストファイルを生成しました。DownloadできればFile出力GateはPASSです。"


def reset_form():
    return "", "", "unknown", None, "Gate 0フォームを初期化しました。"


def build_demo() -> gr.Blocks:
    with gr.Blocks(
        title=APP_TITLE,
        analytics_enabled=False,
    ) as demo:
        gr.Markdown(
            """
# WMS COLAB COMPANION — GATE 0

これは**接続テスト専用**です。動画のDownload処理はまだ行いません。

確認対象: **WMS→URL受け渡し / iframe表示 / ボタン操作 / Gradio File Download**
"""
        )

        with gr.Group(elem_classes=["wms-card"]):
            source = gr.Textbox(label="Source URL", placeholder="WMSから自動入力、または手入力")
            title = gr.Textbox(label="Title", interactive=True)
            provider = gr.Textbox(label="Provider", value="unknown", interactive=True)

        status = gr.Markdown("Gate 0を準備しています…", elem_classes=["wms-status"])

        with gr.Row():
            test_button = gr.Button("テストファイルを作る", variant="primary")
            reset_button = gr.Button("Reset")

        output_file = gr.File(label="Gate 0 Test File", interactive=False)

        test_button.click(
            create_test_file,
            inputs=[source, title, provider],
            outputs=[output_file, status],
            concurrency_limit=1,
            api_visibility="private",
        )
        reset_button.click(
            reset_form,
            inputs=None,
            outputs=[source, title, provider, output_file, status],
            queue=False,
            api_visibility="private",
        )
        demo.load(
            load_context,
            inputs=None,
            outputs=[source, title, provider, status],
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
    demo.queue(default_concurrency_limit=1, max_size=4)
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
