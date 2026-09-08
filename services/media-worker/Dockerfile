FROM denoland/deno:bin-2.9.6 AS deno-bin

FROM node:22-bookworm-slim AS pot-builder

ARG BGUTIL_POT_COMMIT=7511309af023b09788dc8f2efc96cc3671291e6c

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt
RUN git init bgutil-ytdlp-pot-provider \
    && cd bgutil-ytdlp-pot-provider \
    && git remote add origin https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git \
    && git fetch --depth 1 origin ${BGUTIL_POT_COMMIT} \
    && git checkout --detach FETCH_HEAD

WORKDIR /opt/bgutil-ytdlp-pot-provider/server
RUN npm ci --no-audit --no-fund \
    && npx tsc

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    DENO_DIR=/tmp/deno-cache \
    YOUTUBE_PO_TOKEN_MODE=off \
    BGUTIL_SERVER_HOME=/opt/bgutil-ytdlp-pot-provider/server

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Primary YouTube JS challenge runtime. Deno is enabled by default by yt-dlp.
COPY --from=deno-bin /deno /usr/local/bin/deno

# Keep Node + bgutil available only for the explicit PO Token fallback experiment.
COPY --from=pot-builder /usr/local/bin/node /usr/local/bin/node
COPY --from=pot-builder /opt/bgutil-ytdlp-pot-provider /opt/bgutil-ytdlp-pot-provider

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY wms_media_worker ./wms_media_worker

RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app /opt/bgutil-ytdlp-pot-provider

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl --fail http://127.0.0.1:${PORT}/health || exit 1

CMD ["sh", "-c", "exec uvicorn wms_media_worker.main:app --host 0.0.0.0 --port ${PORT}"]
