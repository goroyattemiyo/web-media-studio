# WMS Media Worker

`Youtubeから自動文字おこし.ipynb` のうち、Colab 固有の処理を外し、`yt-dlp + FFmpeg` の音声生成を通常の Python / FastAPI / Docker で再利用する worker です。

> 利用するメディアについて、必要な権利・許可を確認してください。この worker は認証 Cookie、DRM 回避、アクセス制限回避の仕組みを持ちません。

## 1. CLI

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

Colab の最終 MP3 セルにあった基本方針を引き継いでいます。

- `bestaudio/best`
- `FFmpegExtractAudio`
- MP3 192 kbps を既定値
- playlist 全体は処理しない

## 2. FastAPI

```bash
cd services/media-worker
uvicorn wms_media_worker.main:app --host 0.0.0.0 --port 8080
```

Health:

```bash
curl http://localhost:8080/health
```

Google認証を有効にした本番環境では、`POST /extract` と `GET /auth/me` に Google Identity Services が発行した ID token を `Authorization: Bearer ...` で送ります。

```bash
curl -X POST http://localhost:8080/extract \
  -H "Authorization: Bearer GOOGLE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=VIDEO_ID","format":"mp3","bitrate":"192"}' \
  --output output.mp3
```

Worker は次を検証します。

- Google署名付きID token
- `aud` が `GOOGLE_CLIENT_ID` と一致
- `email_verified=true`
- メールアドレスが `ALLOWED_GOOGLE_EMAILS` に含まれる

ローカル開発では Google 認証が未設定なら認証なしで動きます。本番 Cloud Run では Google 認証を必須にします。

## 3. YouTube側の取得制限

Cloud Run から YouTube へアクセスした際、YouTube 側が Bot 確認や追加認証を要求する場合があります。この worker は Cookie、Proxy、YouTube アカウント認証、Bot 判定回避を追加しません。

そのため、yt-dlp が次のようなアクセス制限を返した場合は、内部エラー文や Cookie 利用手順をそのままフロントエンドへ返さず、HTTP 409 と次の案内へ変換します。

> YouTube側で取得が制限されました。この動画はCloud処理から直接Local化できません。手元の音声・動画ファイルをLocal Libraryへ追加してください。

この制限は Google login の成功・失敗とは別です。Google login は WMS → Worker の利用者認証、YouTube 側の制限は Worker → YouTube の取得可否です。

## 4. 環境変数

Cloud Run:

- `GOOGLE_CLIENT_ID` — Web application OAuth client ID
- `ALLOWED_GOOGLE_EMAILS` — 許可する Google メールアドレス。複数はカンマ区切り
- `ALLOWED_ORIGINS=https://goroyattemiyo.github.io`
- `MAX_DURATION_SECONDS=1800`
- `MAX_SOURCE_BYTES=786432000`

GitHub Pages build:

- `VITE_GOOGLE_CLIENT_ID` — Repository variable `GOOGLE_CLIENT_ID` から注入

`GOOGLE_CLIENT_ID` は公開クライアント識別子であり秘密鍵ではありません。秘密値をフロントエンドへ埋め込まないでください。

## 5. Google Cloud / GitHub setup

Repository variables:

- `GOOGLE_CLIENT_ID`
- `ALLOWED_GOOGLE_EMAILS`

Google Cloud Console では OAuth 2.0 Client ID を **Web application** として作り、Authorized JavaScript origins に次を登録します。

- `https://goroyattemiyo.github.io`
- ローカル開発する場合は `http://localhost:5173`

Cloud Run の公開 HTTP 呼び出しは許可したまま、アプリレベルで Google ID token を検証します。CORS は認証の代わりではありません。

## 6. Docker

```bash
docker build -t wms-media-worker .
docker run --rm -p 8080:8080 wms-media-worker
```

コンテナには FFmpeg を含めています。

## 7. GitHub Actions

`.github/workflows/media-worker-ci.yml`:

1. Python 3.12 で pytest
2. Docker image build
3. コンテナ起動
4. `/health` が 200 を返すこと

ネットワーク依存の YouTube 実取得は PR CI では行いません。

`.github/workflows/media-worker-cloudrun.yml` は `services/media-worker` を Cloud Run へ source deploy します。

主な設定:

- runtime service account 固定
- concurrency 1
- timeout 15 minutes
- max instances 2
- 1 CPU / 1 GiB
- Google auth config を Repository variables から注入
- 旧 `WMS_WORKER_API_KEY` は Cloud Run へ設定しない

## 8. Colab からの移植対応表

| Colab | Worker |
|---|---|
| `!pip install yt-dlp` | `requirements.txt` |
| `apt install ffmpeg` | `Dockerfile` |
| `extract_and_download_youtube_mp3()` | `extract_audio()` |
| `files.download()` | CLI ファイル出力 / FastAPI `FileResponse` |
| `input()` | CLI arguments / `POST /extract` |
| Colab `/content` | 一時 job directory |

Whisper / SRT / 翻訳は今回の WMS 音源 worker には含めていません。既存 Colab の文字起こし機能は独立機能として残します。
