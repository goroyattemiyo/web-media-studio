import { FormEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getMediaLibraryBytes,
  MEDIA_LIBRARY_MAX_ITEM_BYTES,
  MEDIA_LIBRARY_SOFT_LIMIT_BYTES,
  saveMediaLibraryItems,
  StoredMediaLibraryItem,
} from './mediaLibraryDb'
import { parseYouTubeInput, youtubeWatchUrl } from './providers/youtube'

const WORKER_URL = 'https://wms-media-worker-pcdbs5armq-an.a.run.app'
const WORKER_KEY_STORAGE_KEY = 'wms-worker-api-key'
const LAST_YOUTUBE_URL_KEY = 'wms-youtube-last-url'

type AudioFormat = 'mp3' | 'm4a' | 'wav'
type Bitrate = '128' | '192' | '256' | '320'

type Props = {
  onMediaLocalized?: (item: StoredMediaLibraryItem) => void
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB']
  let amount = value
  let unitIndex = 0
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024
    unitIndex += 1
  }
  return `${amount.toFixed(unitIndex >= 2 && amount < 10 ? 1 : 0)} ${units[unitIndex]}`
}

function decodeWorkerTitle(value: string | null) {
  if (!value) return 'youtube-audio'
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function mediaName(title: string, format: AudioFormat) {
  const clean = title.replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').trim().replace(/[._ ]+$/g, '')
  return `${clean || 'youtube-audio'}.${format}`
}

function mediaMime(format: AudioFormat) {
  if (format === 'm4a') return 'audio/mp4'
  if (format === 'wav') return 'audio/wav'
  return 'audio/mpeg'
}

function workerItemId() {
  if ('randomUUID' in crypto) return `worker-${crypto.randomUUID()}`
  return `worker-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function responseError(response: Response) {
  try {
    const body = await response.json() as { detail?: unknown }
    if (typeof body.detail === 'string' && body.detail) return body.detail
  } catch {
    // Fall through to the HTTP status below.
  }
  return `Worker request failed (${response.status}).`
}

function YouTubeLocalizerPanel({ onMediaLocalized }: Props) {
  const [portalTarget, setPortalTarget] = useState<Element | null>(null)
  const [urlInput, setUrlInput] = useState(() => window.localStorage.getItem(LAST_YOUTUBE_URL_KEY) ?? '')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [hasStoredKey, setHasStoredKey] = useState(() => Boolean(window.localStorage.getItem(WORKER_KEY_STORAGE_KEY)))
  const [audioFormat, setAudioFormat] = useState<AudioFormat>('mp3')
  const [bitrate, setBitrate] = useState<Bitrate>('192')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Cloud Run workerで音声化し、端末内ライブラリへ保存します。')
  const [error, setError] = useState<string | null>(null)
  const [lastSavedName, setLastSavedName] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setPortalTarget(document.querySelector('.side-stack'))
    return () => abortRef.current?.abort()
  }, [])

  const currentKey = () => apiKeyInput.trim() || window.localStorage.getItem(WORKER_KEY_STORAGE_KEY)?.trim() || ''

  const saveKey = () => {
    const key = apiKeyInput.trim()
    if (!/^[0-9a-fA-F]{64}$/.test(key)) {
      setError('Worker API key は64文字の16進数で入力してください。')
      return
    }
    window.localStorage.setItem(WORKER_KEY_STORAGE_KEY, key)
    setApiKeyInput('')
    setHasStoredKey(true)
    setError(null)
    setStatus('Worker API key をこの端末に保存しました。')
  }

  const clearKey = () => {
    window.localStorage.removeItem(WORKER_KEY_STORAGE_KEY)
    setApiKeyInput('')
    setHasStoredKey(false)
    setStatus('この端末に保存した Worker API key を削除しました。')
  }

  const useCurrentYouTubeUrl = () => {
    const current = window.localStorage.getItem(LAST_YOUTUBE_URL_KEY) ?? ''
    setUrlInput(current)
    setError(null)
    setStatus(current ? 'Official playerで最後に読み込んだURLをセットしました。' : 'Official player側に保存されたURLがありません。')
  }

  const localize = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return

    const parsed = parseYouTubeInput(urlInput)
    if (!parsed) {
      setError('YouTubeの動画URL、Shorts URL、youtu.be URL、または11文字の動画IDを入力してください。')
      return
    }

    const workerKey = currentKey()
    if (!/^[0-9a-fA-F]{64}$/.test(workerKey)) {
      setError('Worker API key を入力するか、この端末に保存してください。')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setError(null)
    setLastSavedName(null)
    setStatus('Cloud Runで音声を生成しています。動画の長さによって数分かかることがあります…')

    try {
      const response = await fetch(`${WORKER_URL}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WMS-Worker-Key': workerKey,
        },
        body: JSON.stringify({
          url: youtubeWatchUrl(parsed.videoId),
          format: audioFormat,
          bitrate,
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(await responseError(response))

      setStatus('音声を受信しました。端末内ライブラリへ保存しています…')
      const blob = await response.blob()
      if (!blob.size) throw new Error('Workerから空の音声ファイルが返されました。')
      if (blob.size > MEDIA_LIBRARY_MAX_ITEM_BYTES) {
        throw new Error(`生成ファイルが1ファイル上限 ${formatBytes(MEDIA_LIBRARY_MAX_ITEM_BYTES)} を超えています。`)
      }

      const currentBytes = await getMediaLibraryBytes()
      if (currentBytes + blob.size > MEDIA_LIBRARY_SOFT_LIMIT_BYTES) {
        throw new Error(`保存ライブラリの上限 ${formatBytes(MEDIA_LIBRARY_SOFT_LIMIT_BYTES)} を超えるため保存できません。`)
      }

      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate()
        const usage = estimate.usage ?? 0
        const quota = estimate.quota ?? 0
        if (quota > 0 && usage + blob.size > quota * 0.9) {
          throw new Error('ブラウザの保存容量が少なくなっています。不要な保存メディアを削除してから再試行してください。')
        }
      }

      if (navigator.storage?.persist) {
        try {
          await navigator.storage.persist()
        } catch {
          // Persistence is controlled by the browser. IndexedDB can still be used when denied.
        }
      }

      const title = decodeWorkerTitle(response.headers.get('X-WMS-Title'))
      const name = mediaName(title, audioFormat)
      const record: StoredMediaLibraryItem = {
        id: workerItemId(),
        name,
        kind: 'audio',
        mimeType: blob.type || mediaMime(audioFormat),
        relativePath: null,
        savedAt: Date.now(),
        size: blob.size,
        blob,
      }

      await saveMediaLibraryItems([record])
      setLastSavedName(name)
      setStatus(`${name} を端末内ライブラリへ保存しました。ローカルプレーヤーに反映しています…`)
      onMediaLocalized?.(record)
      window.setTimeout(() => document.getElementById('library-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 180)
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') {
        setStatus('音声化をキャンセルしました。')
      } else {
        setError(requestError instanceof Error ? requestError.message : '音声化に失敗しました。')
        setStatus('音声化または保存に失敗しました。')
      }
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }

  const cancel = () => abortRef.current?.abort()

  if (!portalTarget) return null

  return createPortal(
    <section id="youtube-localizer-panel" className="glass-panel youtube-localizer-panel">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">YOUTUBE → LOCAL</p>
          <p className="tool-description">Cloud Run workerで音声化し、WMSの保存ライブラリへ追加します。</p>
          <h2>Localize audio</h2>
        </div>
        <span className="localizer-worker-badge">CLOUD RUN</span>
      </div>

      <div className="localizer-key-card">
        <div>
          <strong>Worker API key</strong>
          <span>{hasStoredKey ? 'この端末に保存済み' : '未保存'}</span>
        </div>
        <div className="localizer-key-row">
          <input
            type="password"
            autoComplete="off"
            placeholder={hasStoredKey ? '保存済みキーを使用します' : '64文字のAPI key'}
            value={apiKeyInput}
            onChange={(event) => setApiKeyInput(event.target.value)}
            aria-label="Worker API key"
          />
          <button type="button" onClick={saveKey} disabled={!apiKeyInput.trim() || busy}>Save key</button>
          {hasStoredKey && <button type="button" className="secondary" onClick={clearKey} disabled={busy}>Clear</button>}
        </div>
        <small>キーはこのブラウザの localStorage にだけ保存します。公開GitHubリポジトリには書き込みません。</small>
      </div>

      <form className="localizer-form" onSubmit={localize}>
        <label>
          <span>YouTube URL / video ID</span>
          <div className="localizer-url-row">
            <input
              type="text"
              inputMode="url"
              placeholder="YouTube URL または動画ID"
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              aria-label="LocalizeするYouTube URL または動画ID"
            />
            <button type="button" className="secondary" onClick={useCurrentYouTubeUrl} disabled={busy}>Use current</button>
          </div>
        </label>

        <div className="localizer-options">
          <label>
            <span>Format</span>
            <select value={audioFormat} disabled={busy} onChange={(event) => setAudioFormat(event.target.value as AudioFormat)}>
              <option value="mp3">MP3</option>
              <option value="m4a">M4A</option>
              <option value="wav">WAV</option>
            </select>
          </label>
          <label>
            <span>MP3 bitrate</span>
            <select value={bitrate} disabled={busy || audioFormat !== 'mp3'} onChange={(event) => setBitrate(event.target.value as Bitrate)}>
              <option value="128">128 kbps</option>
              <option value="192">192 kbps</option>
              <option value="256">256 kbps</option>
              <option value="320">320 kbps</option>
            </select>
          </label>
        </div>

        <div className="localizer-actions">
          <button type="submit" className="primary" disabled={busy || !urlInput.trim()}>{busy ? 'Processing…' : 'Localize & Save'}</button>
          {busy && <button type="button" className="secondary" onClick={cancel}>Cancel</button>}
        </div>
      </form>

      <div className="localizer-status">
        <span className={lastSavedName ? 'supported' : busy ? 'working' : ''}>{lastSavedName ? 'SAVED' : busy ? 'WORKING' : 'READY'}</span>
        <small>{status}</small>
      </div>
      {error && <p className="youtube-error">{error}</p>}

      <div className="localizer-flow">
        <span>URL</span><b>→</b><span>Cloud Run</span><b>→</b><span>Audio Blob</span><b>→</b><span>IndexedDB</span><b>→</b><span>Local Player</span>
      </div>
      <p className="youtube-policy-note">自分が権利を持つ、または保存・変換の許可を得ているコンテンツだけに使用してください。開始位置付きURLでも音声化するのは動画全体です。</p>
    </section>,
    portalTarget,
  )
}

export default YouTubeLocalizerPanel
