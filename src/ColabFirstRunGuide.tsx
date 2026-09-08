import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { parseYouTubeInput, youtubeWatchUrl } from './providers/youtube'

const GUIDE_DISMISSED_KEY = 'wms-colab-first-run-guide-dismissed'
const LAST_YOUTUBE_URL_KEY = 'wms-youtube-last-url'
const COLAB_LOCALIZER_URL =
  'https://colab.research.google.com/github/goroyattemiyo/web-media-studio/blob/main/colab/WMS_Colab_Localizer.ipynb'

function loadDismissed() {
  try {
    return window.localStorage.getItem(GUIDE_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function currentCanonicalUrl() {
  const input = document.querySelector<HTMLInputElement>('#youtube-provider-panel .youtube-url-form input')
  let value = input?.value ?? ''

  if (!value) {
    try {
      value = window.localStorage.getItem(LAST_YOUTUBE_URL_KEY) ?? ''
    } catch {
      // Keep the empty value when localStorage is unavailable.
    }
  }

  const parsed = parseYouTubeInput(value)
  return parsed ? youtubeWatchUrl(parsed.videoId) : null
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

export default function ColabFirstRunGuide() {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(loadDismissed)
  const [hideNextTime, setHideNextTime] = useState(true)
  const [copied, setCopied] = useState<boolean | null>(null)

  useEffect(() => {
    const interceptFirstDownload = (event: Event) => {
      if (dismissed) return
      const target = event.target
      if (!(target instanceof Element)) return
      const download = target.closest<HTMLAnchorElement>('#youtube-provider-panel .youtube-download-button')
      if (!download) return

      const canonicalUrl = currentCanonicalUrl()
      if (!canonicalUrl) return

      event.preventDefault()
      setCopied(null)
      setOpen(true)
      void copyText(canonicalUrl)
        .then((result) => setCopied(result))
        .catch(() => setCopied(false))
    }

    document.addEventListener('click', interceptFirstDownload, true)
    return () => document.removeEventListener('click', interceptFirstDownload, true)
  }, [dismissed])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const rememberChoice = () => {
    if (!hideNextTime) return
    try {
      window.localStorage.setItem(GUIDE_DISMISSED_KEY, '1')
    } catch {
      // The guide can still close even when localStorage is unavailable.
    }
    setDismissed(true)
  }

  if (!open) return null

  return createPortal(
    <div
      className="colab-guide-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false)
      }}
    >
      <section className="colab-guide-sheet" role="dialog" aria-modal="true" aria-labelledby="colab-guide-title">
        <div className="colab-guide-heading">
          <div>
            <p className="eyebrow">FIRST DOWNLOAD</p>
            <h2 id="colab-guide-title">初回だけ、Colabを準備します</h2>
          </div>
          <button type="button" className="colab-guide-close" onClick={() => setOpen(false)} aria-label="閉じる">×</button>
        </div>

        <div className="colab-guide-copy-state" data-copied={copied === true ? 'yes' : copied === false ? 'no' : 'checking'}>
          <span>{copied === true ? '✓' : copied === false ? '!' : '…'}</span>
          <strong>{copied === true ? 'YouTube URLをコピーしました' : copied === false ? 'URLをコピーできませんでした' : 'YouTube URLをコピーしています'}</strong>
        </div>

        <ol className="colab-guide-steps">
          <li><b>1</b><span>Googleログイン画面が表示されたら、Googleアカウントでログイン</span></li>
          <li><b>2</b><span>Colabの <strong>YOUTUBE_URL</strong> に貼り付け</span></li>
          <li><b>3</b><span>権利確認にチェックして <strong>▶ 実行</strong></span></li>
        </ol>

        {copied === false && <p className="colab-guide-fallback">コピーできない場合は、WMSのYouTube URL欄から手動でコピーしてください。</p>}

        <label className="colab-guide-remember">
          <input type="checkbox" checked={hideNextTime} onChange={(event) => setHideNextTime(event.target.checked)} />
          <span>次回からこの案内を表示しない</span>
        </label>

        <a
          className="colab-guide-open"
          href={COLAB_LOCALIZER_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            rememberChoice()
            setOpen(false)
          }}
        >
          Colabを開く ↗
        </a>
        <p className="colab-guide-note">Googleログイン自体はGoogle側の認証です。WMSがパスワードを取得・保存することはありません。</p>
      </section>
    </div>,
    document.body,
  )
}
