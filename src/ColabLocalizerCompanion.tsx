import { MouseEvent, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { parseYouTubeInput, youtubeWatchUrl } from './providers/youtube'

const COLAB_LOCALIZER_URL =
  'https://colab.research.google.com/github/goroyattemiyo/web-media-studio/blob/main/colab/WMS_Colab_Localizer.ipynb'
const LAST_YOUTUBE_URL_KEY = 'wms-youtube-last-url'

function currentYouTubeInput() {
  const localizerInput = document.querySelector<HTMLInputElement>(
    '#youtube-localizer-panel input[aria-label="LocalizeするYouTube URL または動画ID"]',
  )
  const current = localizerInput?.value.trim()
  if (current) return current

  try {
    return window.localStorage.getItem(LAST_YOUTUBE_URL_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
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

function ColabLocalizerCompanion() {
  const [portalTarget, setPortalTarget] = useState<Element | null>(null)
  const [message, setMessage] = useState(
    'Cloud RunがLIMITEDの場合も使える個人実行ルートです。WMSのURLをコピーして専用Colabを開きます。',
  )

  useEffect(() => {
    setPortalTarget(document.querySelector('#youtube-localizer-panel'))
  }, [])

  const handleOpen = (event: MouseEvent<HTMLAnchorElement>) => {
    const parsed = parseYouTubeInput(currentYouTubeInput())
    if (!parsed) {
      event.preventDefault()
      setMessage('先に上のYouTube URL / video IDへURLを入力してください。')
      return
    }

    const canonicalUrl = youtubeWatchUrl(parsed.videoId)
    void copyText(canonicalUrl)
      .then((copied) => {
        setMessage(
          copied
            ? 'URLをコピーしました。ColabのYOUTUBE_URLへ貼り付け、権利確認✓ → ▶で実行してください。'
            : `コピーできませんでした。ColabでこのURLを貼り付けてください: ${canonicalUrl}`,
        )
      })
      .catch(() => {
        setMessage(`コピーできませんでした。ColabでこのURLを貼り付けてください: ${canonicalUrl}`)
      })
  }

  if (!portalTarget) return null

  return createPortal(
    <div className="colab-localizer-card">
      <div className="colab-localizer-heading">
        <div>
          <strong>Colab Localizer</strong>
          <span>Googleの一時VMで実行 / WMSへのGoogle接続は不要</span>
        </div>
        <b>COMPANION</b>
      </div>
      <p>{message}</p>
      <a
        className="colab-localizer-open"
        href={COLAB_LOCALIZER_URL}
        target="_blank"
        rel="noreferrer"
        onClick={handleOpen}
      >
        URLをコピーしてColabを開く ↗
      </a>
      <small>
        Colab側は1セルだけです。URL貼り付け → 権利確認 → ▶で、Deno + EJS + yt-dlpが準備され、音声生成後に端末へダウンロードします。
      </small>
    </div>,
    portalTarget,
  )
}

export default ColabLocalizerCompanion
