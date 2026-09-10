import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { requestLoadYouTubeSource } from './mediaSourceBridge'
import {
  addRemoteToPlayQueue,
  onRequestRemotePlayback,
  type QueueRemoteSource,
} from './playQueueBridge'

const DEFAULT_MEDIA_WORKER_URL = 'https://wms-media-worker-pcdbs5armq-an.a.run.app'
const MEDIA_WORKER_URL = ((import.meta.env.VITE_WMS_MEDIA_WORKER_URL as string | undefined)?.trim() || DEFAULT_MEDIA_WORKER_URL).replace(/\/$/, '')
const COLAB_LOCALIZER_URL = 'https://colab.research.google.com/github/goroyattemiyo/web-media-studio/blob/main/colab/WMS_Colab_Localizer.ipynb'

type Language = 'ja' | 'en'
type ProviderId = 'youtube' | 'vimeo' | 'google_web'
type ProviderSelection = 'all' | ProviderId

type ProviderStatus = {
  id: ProviderId
  label: string
  enabled: boolean
  reason: string | null
}

type VideoSearchItem = {
  provider: ProviderId
  source_id: string
  url: string
  title: string
  author: string
  published_at: string | null
  thumbnail_url: string | null
  embed_url: string | null
  playback: 'youtube' | 'iframe' | 'external'
  can_queue: boolean
  can_download: boolean
}

type VideoSearchResponse = {
  query: string
  provider: string
  providers: ProviderStatus[]
  items: VideoSearchItem[]
}

type EmbeddedRemote = {
  provider: ProviderId
  title: string
  url: string
  embedUrl: string
}

function currentLanguage(): Language {
  return document.documentElement.dataset.language === 'en' ? 'en' : 'ja'
}

function emitSystem(text: string, level: 'info' | 'success' | 'error' = 'info') {
  window.dispatchEvent(new CustomEvent('wms:system-message', {
    detail: { text, source: 'Video Search', level },
  }))
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return true
  }
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  return copied
}

async function responseError(response: Response) {
  try {
    const payload = await response.json() as { detail?: unknown }
    if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail.trim()
  } catch {
    // Fall through to status text.
  }
  return `Video search failed (${response.status}).`
}

function tryPlayLoadedYouTube() {
  let attempts = 0
  const tryPlay = () => {
    attempts += 1
    const playButton = document.querySelector<HTMLButtonElement>('#youtube-provider-panel .youtube-transport .primary')
    if (playButton && !playButton.disabled) {
      playButton.click()
      return
    }
    if (attempts < 24) window.setTimeout(tryPlay, 160)
  }
  window.setTimeout(tryPlay, 100)
}

function toQueueRemote(item: VideoSearchItem): QueueRemoteSource {
  return {
    provider: item.provider,
    sourceId: item.source_id,
    url: item.url,
    title: item.title,
    playback: item.playback,
    embedUrl: item.embed_url,
  }
}

export default function VideoSearchPanel() {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState<ProviderSelection>('all')
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [results, setResults] = useState<VideoSearchItem[]>([])
  const [searchedQuery, setSearchedQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState<Language>(currentLanguage)
  const [embedded, setEmbedded] = useState<EmbeddedRemote | null>(null)

  const openRemote = useCallback((item: QueueRemoteSource) => {
    if (item.playback === 'youtube' && item.provider === 'youtube') {
      requestLoadYouTubeSource({ videoId: item.sourceId, url: item.url, title: item.title })
      tryPlayLoadedYouTube()
      emitSystem(language === 'ja' ? `${item.title} をYouTube Playerへ送ります。` : `Loading ${item.title} in YouTube Player.`, 'success')
      return
    }

    if (item.playback === 'iframe' && item.embedUrl) {
      setEmbedded({ provider: item.provider, title: item.title, url: item.url, embedUrl: item.embedUrl })
      const panel = document.querySelector<HTMLElement>('#youtube-provider-panel')
      panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      window.setTimeout(() => document.querySelector('.video-search-embed')?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }), 180)
      emitSystem(language === 'ja' ? `${item.title} をWMS内で開きました。` : `Opened ${item.title} in WMS.`, 'success')
      return
    }

    window.open(item.url, '_blank', 'noopener,noreferrer')
  }, [language])

  useEffect(() => {
    let mount: HTMLDivElement | null = null
    let frame = 0
    let observer: MutationObserver | null = null
    const attach = () => {
      frame = 0
      if (mount?.isConnected) return
      const panel = document.querySelector<HTMLElement>('#youtube-provider-panel')
      const heading = panel?.querySelector<HTMLElement>('.section-heading')
      if (!panel || !heading) return
      mount = document.createElement('div')
      mount.className = 'video-search-slot'
      heading.insertAdjacentElement('afterend', mount)
      setTarget(mount)
      observer?.disconnect()
      observer = null
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(attach)
    }
    attach()
    if (!mount) {
      observer = new MutationObserver(schedule)
      observer.observe(document.body, { childList: true, subtree: true })
    }
    return () => {
      observer?.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
      mount?.remove()
    }
  }, [])

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const response = await fetch(`${MEDIA_WORKER_URL}/video/providers`, { headers: { Accept: 'application/json' }, cache: 'no-store' })
        if (!response.ok) return
        const payload = await response.json() as ProviderStatus[]
        if (Array.isArray(payload)) setProviders(payload)
      } catch {
        // Search submit will surface worker connectivity failures.
      }
    }
    void loadProviders()
  }, [])

  useEffect(() => {
    const onLanguage = (event: Event) => {
      const next = (event as CustomEvent<{ language?: Language }>).detail?.language
      if (next === 'ja' || next === 'en') setLanguage(next)
    }
    window.addEventListener('wms:language-change', onLanguage)
    return () => window.removeEventListener('wms:language-change', onLanguage)
  }, [])

  useEffect(() => onRequestRemotePlayback(openRemote), [openRemote])

  const copy = useMemo(() => language === 'ja'
    ? {
        heading: '動画を横断検索',
        placeholder: '曲名・アーティスト・動画名で検索',
        search: '検索', searching: '検索中…',
        hint: '対応プロバイダーをまとめて検索します。',
        all: 'すべて', empty: '該当する動画が見つかりませんでした。',
        play: '▶ 今すぐ再生', next: '＋ 次に再生', download: '↓ Download', open: '↗ 元サイト',
        resultLabel: '検索結果', unavailable: '未設定', close: 'プレーヤーを閉じる',
      }
    : {
        heading: 'Search video providers',
        placeholder: 'Search title, artist, or video',
        search: 'Search', searching: 'Searching…',
        hint: 'Search all configured video providers.',
        all: 'All', empty: 'No matching videos found.',
        play: '▶ Play now', next: '＋ Play next', download: '↓ Download', open: '↗ Open source',
        resultLabel: 'Search results', unavailable: 'Not configured', close: 'Close player',
      }, [language])

  const search = async (event: FormEvent) => {
    event.preventDefault()
    const value = query.trim()
    if (value.length < 2 || busy) return
    setBusy(true)
    setError(null)
    setEmbedded(null)
    try {
      const url = new URL(`${MEDIA_WORKER_URL}/video/search`)
      url.searchParams.set('q', value)
      url.searchParams.set('provider', provider)
      url.searchParams.set('max_results', '8')
      const response = await fetch(url.toString(), { headers: { Accept: 'application/json' }, cache: 'no-store' })
      if (!response.ok) throw new Error(await responseError(response))
      const payload = await response.json() as VideoSearchResponse
      setProviders(Array.isArray(payload.providers) ? payload.providers : providers)
      setResults(Array.isArray(payload.items) ? payload.items : [])
      setSearchedQuery(value)
      emitSystem(language === 'ja' ? `${value} の動画を ${payload.items?.length ?? 0}件読み込みました。` : `Loaded ${payload.items?.length ?? 0} video results for ${value}.`, 'success')
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Video search failed.')
      setResults([])
      setSearchedQuery(value)
    } finally {
      setBusy(false)
    }
  }

  const playNow = (item: VideoSearchItem) => openRemote(toQueueRemote(item))

  const playNext = (item: VideoSearchItem) => {
    if (!item.can_queue) return
    addRemoteToPlayQueue(toQueueRemote(item))
    emitSystem(language === 'ja' ? `${item.title} を次に再生へ追加しました。` : `Added ${item.title} to Play Next.`, 'success')
  }

  const prepareDownload = (item: VideoSearchItem) => {
    void copyText(item.url).then((copied) => {
      emitSystem(
        copied
          ? (language === 'ja' ? '動画URLをコピーしました。Colabで権利確認後にDownloadできます。' : 'Video URL copied. Confirm rights in Colab before Download.')
          : (language === 'ja' ? 'Colabを開きました。動画URLを貼り付けてください。' : 'Colab opened. Paste the video URL there.'),
        copied ? 'success' : 'info',
      )
    }).catch(() => undefined)
  }

  if (!target) return null
  const enabledProviders = providers.filter((item) => item.enabled)

  return createPortal(
    <section className="video-search-panel" aria-label={copy.heading}>
      <form className="video-search-form" onSubmit={(event) => void search(event)}>
        <div className="video-search-heading"><strong>{copy.heading}</strong><span>{copy.hint}</span></div>
        <div className="video-search-providers" aria-label="Video providers">
          <button type="button" className={provider === 'all' ? 'is-active' : ''} disabled={!enabledProviders.length} onClick={() => setProvider('all')}>{copy.all}</button>
          {providers.map((item) => (
            <button key={item.id} type="button" className={provider === item.id ? 'is-active' : ''} disabled={!item.enabled} title={item.reason ?? item.label} onClick={() => setProvider(item.id)}>
              {item.label}{item.enabled ? '' : ` · ${copy.unavailable}`}
            </button>
          ))}
        </div>
        <div className="video-search-input-row">
          <input type="search" value={query} minLength={2} maxLength={120} placeholder={copy.placeholder} aria-label={copy.heading} onChange={(event) => { setQuery(event.target.value); setError(null) }} />
          <button type="submit" disabled={busy || query.trim().length < 2 || !enabledProviders.length}>{busy ? copy.searching : copy.search}</button>
        </div>
      </form>

      {embedded && (
        <div className="video-search-embed" data-provider={embedded.provider}>
          <div><strong>{embedded.title}</strong><button type="button" onClick={() => setEmbedded(null)}>× {copy.close}</button></div>
          <iframe src={embedded.embedUrl} title={embedded.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        </div>
      )}

      {error && <p className="video-search-error">{error}</p>}
      {searchedQuery && !error && (
        <div className="video-search-results" aria-label={copy.resultLabel}>
          <div className="video-search-results-heading"><strong>{copy.resultLabel}</strong><span>{results.length}</span></div>
          {results.length ? results.map((item) => (
            <article className="video-search-result" key={`${item.provider}:${item.source_id}`}>
              <div className="video-search-thumb" aria-hidden="true">{item.thumbnail_url ? <img src={item.thumbnail_url} alt="" loading="lazy" /> : <span>{item.provider}</span>}</div>
              <div className="video-search-copy">
                <div><span className={`video-provider-badge is-${item.provider}`}>{item.provider}</span></div>
                <strong title={item.title}>{item.title}</strong><span>{item.author}</span>
              </div>
              <div className="video-search-actions">
                <button type="button" className="is-primary" onClick={() => playNow(item)}>{copy.play}</button>
                {item.can_queue && <button type="button" onClick={() => playNext(item)}>{copy.next}</button>}
                {item.can_download && <a href={COLAB_LOCALIZER_URL} target="_blank" rel="noreferrer" onClick={() => prepareDownload(item)}>{copy.download}</a>}
                <a href={item.url} target="_blank" rel="noreferrer">{copy.open}</a>
              </div>
            </article>
          )) : <p className="video-search-empty">{copy.empty}</p>}
        </div>
      )}
    </section>,
    target,
  )
}
