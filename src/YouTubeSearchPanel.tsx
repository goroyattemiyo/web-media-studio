import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { requestLoadYouTubeSource } from './mediaSourceBridge'
import { addYouTubeToPlayQueue } from './playQueueBridge'

const DEFAULT_MEDIA_WORKER_URL = 'https://wms-media-worker-pcdbs5armq-an.a.run.app'
const MEDIA_WORKER_URL = ((import.meta.env.VITE_WMS_MEDIA_WORKER_URL as string | undefined)?.trim() || DEFAULT_MEDIA_WORKER_URL).replace(/\/$/, '')
const COLAB_LOCALIZER_URL = 'https://colab.research.google.com/github/goroyattemiyo/web-media-studio/blob/main/colab/WMS_Colab_Localizer.ipynb'

type Language = 'ja' | 'en'

type YouTubeSearchItem = {
  video_id: string
  url: string
  title: string
  channel_title: string
  published_at: string | null
  thumbnail_url: string | null
}

type YouTubeSearchResponse = {
  query: string
  items: YouTubeSearchItem[]
}

function currentLanguage(): Language {
  return document.documentElement.dataset.language === 'en' ? 'en' : 'ja'
}

function emitSystem(text: string, level: 'info' | 'success' | 'error' = 'info') {
  window.dispatchEvent(new CustomEvent('wms:system-message', {
    detail: { text, source: 'YouTube', level },
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
    // Fall back to the status message below.
  }
  return `YouTube search failed (${response.status}).`
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

export default function YouTubeSearchPanel() {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<YouTubeSearchItem[]>([])
  const [searchedQuery, setSearchedQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState<Language>(currentLanguage)

  useEffect(() => {
    const panel = document.querySelector<HTMLElement>('#youtube-provider-panel')
    const heading = panel?.querySelector<HTMLElement>('.section-heading')
    if (!panel || !heading) return

    const mount = document.createElement('div')
    mount.className = 'youtube-search-slot'
    heading.insertAdjacentElement('afterend', mount)
    setTarget(mount)

    return () => {
      setTarget(null)
      mount.remove()
    }
  }, [])

  useEffect(() => {
    const onLanguage = (event: Event) => {
      const next = (event as CustomEvent<{ language?: Language }>).detail?.language
      if (next === 'ja' || next === 'en') setLanguage(next)
    }
    window.addEventListener('wms:language-change', onLanguage)
    return () => window.removeEventListener('wms:language-change', onLanguage)
  }, [])

  const copy = useMemo(() => language === 'ja'
    ? {
        heading: '動画を検索',
        placeholder: '曲名・アーティスト・動画名で検索',
        search: '検索',
        searching: '検索中…',
        hint: '検索した動画をそのまま再生・キュー追加・Downloadできます。',
        empty: '該当する動画が見つかりませんでした。',
        play: '▶ 今すぐ再生',
        next: '＋ 次に再生',
        download: '↓ Download',
        resultLabel: '検索結果',
      }
    : {
        heading: 'Search videos',
        placeholder: 'Search title, artist, or video',
        search: 'Search',
        searching: 'Searching…',
        hint: 'Play, queue, or Download a search result directly in WMS.',
        empty: 'No matching videos found.',
        play: '▶ Play now',
        next: '＋ Play next',
        download: '↓ Download',
        resultLabel: 'Search results',
      }, [language])

  const search = async (event: FormEvent) => {
    event.preventDefault()
    const value = query.trim()
    if (value.length < 2 || busy) return

    setBusy(true)
    setError(null)
    try {
      const url = new URL(`${MEDIA_WORKER_URL}/youtube/search`)
      url.searchParams.set('q', value)
      url.searchParams.set('max_results', '8')
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(await responseError(response))

      const payload = await response.json() as YouTubeSearchResponse
      const items = Array.isArray(payload.items) ? payload.items : []
      setResults(items)
      setSearchedQuery(value)
      emitSystem(
        language === 'ja'
          ? `${value} の検索結果を ${items.length}件読み込みました。`
          : `Loaded ${items.length} results for ${value}.`,
        'success',
      )
    } catch (searchError) {
      const message = searchError instanceof Error ? searchError.message : 'YouTube search failed.'
      setError(message.includes('not configured')
        ? (language === 'ja' ? 'YouTube検索APIの設定がまだ完了していません。' : 'YouTube search API is not configured yet.')
        : message)
      setResults([])
      setSearchedQuery(value)
    } finally {
      setBusy(false)
    }
  }

  const playNow = (item: YouTubeSearchItem) => {
    requestLoadYouTubeSource({
      videoId: item.video_id,
      url: item.url,
      title: item.title,
    })
    tryPlayLoadedYouTube()
    emitSystem(language === 'ja' ? `${item.title} をYouTube Playerへ送ります。` : `Loading ${item.title} in YouTube Player.`, 'success')
  }

  const playNext = (item: YouTubeSearchItem) => {
    addYouTubeToPlayQueue({
      videoId: item.video_id,
      url: item.url,
      title: item.title,
    })
    emitSystem(language === 'ja' ? `${item.title} を次に再生へ追加しました。` : `Added ${item.title} to Play Next.`, 'success')
  }

  const prepareDownload = (item: YouTubeSearchItem) => {
    void copyText(item.url)
      .then((copied) => {
        emitSystem(
          copied
            ? (language === 'ja' ? '動画URLをコピーしました。Colabで権利確認後にDownloadできます。' : 'Video URL copied. Confirm rights in Colab before Download.')
            : (language === 'ja' ? 'Colabを開きました。動画URLを貼り付けてください。' : 'Colab opened. Paste the video URL there.'),
          copied ? 'success' : 'info',
        )
      })
      .catch(() => emitSystem(language === 'ja' ? 'Colabを開きました。動画URLを貼り付けてください。' : 'Colab opened. Paste the video URL there.'))
  }

  if (!target) return null

  return createPortal(
    <section className="youtube-search-panel" aria-label={copy.heading}>
      <form className="youtube-search-form" onSubmit={(event) => void search(event)}>
        <div className="youtube-search-heading">
          <strong>{copy.heading}</strong>
          <span>{copy.hint}</span>
        </div>
        <div className="youtube-search-input-row">
          <input
            type="search"
            value={query}
            minLength={2}
            maxLength={120}
            placeholder={copy.placeholder}
            aria-label={copy.heading}
            onChange={(event) => {
              setQuery(event.target.value)
              setError(null)
            }}
          />
          <button type="submit" disabled={busy || query.trim().length < 2}>{busy ? copy.searching : copy.search}</button>
        </div>
      </form>

      {error && <p className="youtube-search-error">{error}</p>}

      {searchedQuery && !error && (
        <div className="youtube-search-results" aria-label={copy.resultLabel}>
          <div className="youtube-search-results-heading">
            <strong>{copy.resultLabel}</strong>
            <span>{results.length}</span>
          </div>

          {results.length ? results.map((item) => (
            <article className="youtube-search-result" key={item.video_id}>
              <div className="youtube-search-thumb" aria-hidden="true">
                {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" loading="lazy" /> : <span>YT</span>}
              </div>
              <div className="youtube-search-copy">
                <strong title={item.title}>{item.title}</strong>
                <span>{item.channel_title}</span>
              </div>
              <div className="youtube-search-actions">
                <button type="button" className="is-primary" onClick={() => playNow(item)}>{copy.play}</button>
                <button type="button" onClick={() => playNext(item)}>{copy.next}</button>
                <a href={COLAB_LOCALIZER_URL} target="_blank" rel="noreferrer" onClick={() => prepareDownload(item)}>{copy.download}</a>
              </div>
            </article>
          )) : <p className="youtube-search-empty">{copy.empty}</p>}
        </div>
      )}
    </section>,
    target,
  )
}
