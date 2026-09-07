from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from .extractor import ExtractionError, cleanup_result, extract_audio


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Extract audio with the same yt-dlp + FFmpeg flow used by the WMS worker."
    )
    parser.add_argument("source", help="YouTube URL or 11-character video ID")
    parser.add_argument("-o", "--output", default=".", help="Output directory")
    parser.add_argument("--format", choices=["mp3", "m4a", "wav"], default="mp3")
    parser.add_argument("--bitrate", choices=["128", "192", "256", "320"], default="192")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    result = None
    try:
        result = extract_audio(
            args.source,
            audio_format=args.format,
            bitrate=args.bitrate,
        )
        output_dir = Path(args.output).expanduser().resolve()
        output_dir.mkdir(parents=True, exist_ok=True)
        target = output_dir / f"{result.file_path.stem}.{args.format}"
        shutil.copy2(result.file_path, target)
        print(target)
        return 0
    except ExtractionError as exc:
        print(f"ERROR: {exc}")
        return 1
    finally:
        if result is not None:
            cleanup_result(result)


if __name__ == "__main__":
    raise SystemExit(main())
