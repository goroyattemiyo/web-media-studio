# WMS Media Worker

`Youtubeから自動文字おこし.ipynb` のうち、Colab 固有の処理を外し、`yt-dlp + FFmpeg` の音声生成を通常の Python / FastAPI / Docker で再利用する worker です。

> 利用するメディアについて、必要な権利・許可を確認してください。この worker は認証 Cookie、YouTube アカウント Cookie、Proxy、DRM 回避を使用しません。

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

通常のローカル CLI では PO Token mode は既定で OFF です。

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

`POST /extract` は権利・許可確認も必須です。

```bash
curl -X POST http://localhost:8080/extract \
  -H "Authorization: Bearer GOOGLE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=VIDEO_ID","format":"mp3","bitrate":"192","rights_confirmed":true}' \
  --output output.mp3
```

Worker は次を検証します。

- Google署名付きID token
- `aud` が `GOOGLE_CLIENT_ID` と一致
- `email_verified=true`
- メールアドレスが `ALLOWED_GOOGLE_EMAILS` に含まれる
- `rights_confirmed=true`

ローカル開発では Google 認証が未設定なら認証なしで動きます。本番 Cloud Run では Google 認証を必須にします。権利確認は認証設定の有無にかかわらず必須です。

WMS本体では通常導線を次のようにします。

`Download -> 形式選択 -> 権利確認 -> Google認証 -> /extract -> ブラウザ保存`

Colab / Gradio URL登録は通常導線では使用しません。

## 3. YouTube PO Token mode

YouTube は一部クライアントの再生用リクエストで Proof of Origin (PO) Token を要求します。Cloud Run では `bgutil-ytdlp-pot-provider` を使う診断用 fallback もイメージ内に保持しています。

明示的に試す場合の設定:

```text
YOUTUBE_PO_TOKEN_MODE=bgutil-script-mweb
```

Docker image には次を固定して含めます。

- `bgutil-ytdlp-pot-provider==1.3.2`
- provider source commit `7511309af023b09788dc8f2efc96cc3671291e6c`
- Node.js runtime
- provider の生成 script

PO Token は動画ごとに provider が生成します。手動で token を貼り付けたり、YouTube account Cookie を保存したりしません。

この mode は YouTube 側の 403 / Bot 判定を必ず解決するものではありません。Cloud Run の出口 IP 自体が制限されている場合などは、PO Token を使っても取得できない場合があります。

現在の本番デプロイ標準は、Deno + yt-dlp標準クライアント選択を使う `YOUTUBE_PO_TOKEN_MODE=off` です。

## 4. YouTube側の取得制限

Cloud Run から YouTube へアクセスした際、YouTube 側が Bot 確認や追加認証を要求する場合があります。

取得できない場合は、内部エラー文や Cookie 利用手順をそのままフロントエンドへ返さず、HTTP 409 と次の案内へ変換します。

> YouTube側で取得が制限されました。この動画はCloud処理から直接Local化できません。手元の音声・動画ファイルをLocal Libraryへ追加してください。

この制限は Google login の成功・失敗とは別です。Google login は WMS → Worker の利用者認証、YouTube 側の制限は Worker → YouTube の取得可否です。

## 5. 環境変数

Cloud Run:

- `GOOGLE_CLIENT_ID` — Web application OAuth client ID
- `ALLOWED_GOOGLE_EMAILS` — 許可する Google メールアドレス。複数はカンマ区切り
- `ALLOWED_ORIGINS=https://goroyattemiyo.github.io`
- `MAX_DURATION_SECONDS=1800`
- `MAX_SOURCE_BYTES=786432000`
- `YOUTUBE_PO_TOKEN_MODE=off` — 現在の本番標準
- `BGUTIL_SERVER_HOME` — optional PO Token fallback用。Docker image では `/opt/bgutil-ytdlp-pot-provider/server` を既定値として設定

GitHub Pages build:

- `VITE_GOOGLE_CLIENT_ID` — Repository variable `GOOGLE_CLIENT_ID` から注入

`GOOGLE_CLIENT_ID` は公開クライアント識別子であり秘密鍵ではありません。秘密値をフロントエンドへ埋め込まないでください。

## 6. Google Cloud / GitHub setup

Repository variables:

- `GOOGLE_CLIENT_ID`
- `ALLOWED_GOOGLE_EMAILS`

Google Cloud Console では OAuth 2.0 Client ID を **Web application** として作り、Authorized JavaScript origins に次を登録します。

- `https://goroyattemiyo.github.io`
- ローカル開発する場合は `http://localhost:5173`

Cloud Run の公開 HTTP 呼び出しは許可したまま、アプリレベルで Google ID token を検証します。CORS は認証の代わりではありません。

## 7. Docker

```bash
docker build -t wms-media-worker .
docker run --rm -p 8080:8080 wms-media-worker
```

コンテナには FFmpeg、Deno、Node.js、bgutil PO Token provider を含めています。PO Token provider の利用自体は `YOUTUBE_PO_TOKEN_MODE` で制御します。

## 8. GitHub Actions

`.github/workflows/media-worker-ci.yml`:

1. Python 3.12 で pytest
2. Docker image build
3. コンテナ起動
4. `/health` が 200 を返すこと
5. FFmpeg / Deno / Node.js / bgutil plugin / provider script の存在確認

ネットワーク依存の YouTube 実取得は PR CI では行いません。

`.github/workflows/media-worker-cloudrun.yml` は `services/media-worker` を Cloud Run へ source deploy します。

主な設定:

- runtime service account 固定
- concurrency 1
- timeout 15 minutes
- max instances 2
- 1 CPU / 1 GiB
- Google auth config を Repository variables から注入
- `YOUTUBE_PO_TOKEN_MODE=off`
- 旧 `WMS_WORKER_API_KEY` は Cloud Run へ設定しない

## 9. Colab からの移植対応表

| Colab | Worker |
|---|---|
| `!pip install yt-dlp` | `requirements.txt` |
| `apt install ffmpeg` | `Dockerfile` |
| `extract_and_download_youtube_mp3()` | `extract_audio()` |
| `files.download()` | CLI ファイル出力 / FastAPI `FileResponse` |
| `input()` | CLI arguments / `POST /extract` |
| Colab `/content` | 一時 job directory |

Whisper / SRT / 翻訳は今回の WMS 音源 worker には含めていません。既存 Colab の文字起こし機能は独立機能として残します。
