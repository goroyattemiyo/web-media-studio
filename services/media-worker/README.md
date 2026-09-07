# WMS Media Worker

`Youtubeから自動文字おこし.ipynb` のうち、Colab 固有の `google.colab.files` と対話セルを外し、`yt-dlp + FFmpeg` の音声生成処理を通常の Python / FastAPI / Docker で再利用するための worker です。

> 利用するメディアについて、必要な権利・許可を確認してください。この worker は認証 Cookie、DRM 回避、アクセス制限回避の仕組みを持ちません。

## 1. 通常の Python スクリプトとして実行

必要条件:

- Python 3.12+
- FFmpeg
- `pip install -r requirements.txt`

```bash
cd services/media-worker
python -m wms_media_worker.cli "https://www.youtube.com/watch?v=VIDEO_ID" \
  --format mp3 \
  --bitrate 192 \
  --output ./out
```

Colab の最終 MP3 セルにあった基本設定をそのまま引き継いでいます。

- `bestaudio/best`
- `FFmpegExtractAudio`
- MP3 192 kbps を既定値
- playlist 全体は処理しない

## 2. API として実行

```bash
cd services/media-worker
uvicorn wms_media_worker.main:app --host 0.0.0.0 --port 8080
```

Health:

```bash
curl http://localhost:8080/health
```

Extract:

```bash
curl -X POST http://localhost:8080/extract \
  -H "Content-Type: application/json" \
  -H "X-WMS-Worker-Key: YOUR_KEY" \
  -d '{"url":"https://www.youtube.com/watch?v=VIDEO_ID","format":"mp3","bitrate":"192"}' \
  --output output.mp3
```

`WMS_WORKER_API_KEY` が未設定ならローカル開発用に認証なし、設定されていれば `X-WMS-Worker-Key` が必須です。

## 3. 制限値

Cloud Run を無制限の変換サーバーにしないため、既定で以下を制限します。

- `MAX_DURATION_SECONDS=1800`
- `MAX_SOURCE_BYTES=786432000`
- `ALLOWED_ORIGINS=https://goroyattemiyo.github.io,http://localhost:5173`

必要なら Cloud Run 環境変数で変更できます。

## 4. Docker

```bash
docker build -t wms-media-worker .
docker run --rm -p 8080:8080 \
  -e WMS_WORKER_API_KEY=change-me \
  wms-media-worker
```

コンテナには FFmpeg を含めています。

## 5. GitHub Actions

`.github/workflows/media-worker-ci.yml` が以下を自動確認します。

1. Python 3.12 で pytest
2. Docker image build
3. コンテナ起動
4. `/health` が 200 を返すこと

ネットワーク依存の YouTube 実取得は PR CI では行いません。CI が YouTube 側の一時的な制限で不安定になることを避けるためです。

## 6. Cloud Run

`.github/workflows/media-worker-cloudrun.yml` は Dockerfile を含む `services/media-worker` を Cloud Run へ source deploy します。

GitHub repository secrets:

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `WMS_WORKER_API_KEY`

Repository variable:

- `GCP_REGION` — 未設定時は `asia-northeast1`

Google Cloud 側では Workload Identity Federation を構成し、デプロイ用サービスアカウントへ Cloud Run / build に必要な権限を付与してください。

Cloud Run service name:

`wms-media-worker`

デプロイ時の主な設定:

- unauthenticated HTTP は許可（WMS PWA から呼ぶため）
- worker API key でアプリレベル認証
- concurrency 1
- timeout 15 minutes
- max instances 2
- 1 CPU / 1 GiB

### Secret Manager に移す場合

初期版は GitHub Secret の値を Cloud Run 環境変数へ設定します。運用を固めた後は Secret Manager へ `WMS_WORKER_API_KEY` を移し、`google-github-actions/deploy-cloudrun` の `secrets` 入力へ切り替えられます。

## 7. Colab からの移植対応表

| Colab | Worker |
|---|---|
| `!pip install yt-dlp` | `requirements.txt` |
| `apt install ffmpeg` | `Dockerfile` |
| `extract_and_download_youtube_mp3()` | `extract_audio()` |
| `files.download()` | CLI ファイル出力 / FastAPI `FileResponse` |
| `input()` | CLI arguments / `POST /extract` |
| Colab `/content` | 一時 job directory |

Whisper / SRT / 翻訳は今回の WMS 音源 worker には含めていません。既存 Colab の文字起こし機能は独立機能としてそのまま残します。
