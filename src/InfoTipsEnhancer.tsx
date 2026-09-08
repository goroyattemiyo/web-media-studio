import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

type InfoTip = {
  key: string
  targetSelector: string
  title: string
  summary: string
  bullets: string[]
}

const tips: InfoTip[] = [
  {
    key: 'player',
    targetSelector: '#player-panel .track-heading',
    title: 'Player',
    summary: '再生中のメディアを操作する中心画面です。',
    bullets: [
      '再生・一時停止・前後移動・速度・音量をここで操作します。',
      '「区間開始」→「区間終了」を押すと、その区間だけを繰り返し再生できます。区間解除で通常再生へ戻ります。',
      '下のPlay Queueから次に聴くLocal音声やYouTubeを選べます。',
    ],
  },
  {
    key: 'queue',
    targetSelector: '.unified-play-queue-heading',
    title: 'Play Queue',
    summary: '各カードで選んだメディアを、Player下へ集約します。',
    bullets: [
      'Local音声は押すとPlayerで再生します。',
      'YouTubeは公式IFrame Playerへ送って再生します。',
      '↑ ↓で順番変更、×で現在のQueueから外せます。',
    ],
  },
  {
    key: 'library',
    targetSelector: '#library-panel .library-heading',
    title: 'Local Library',
    summary: '端末内の音声・動画を読み込み、必要なものを保存します。',
    bullets: [
      'Multiple filesで複数の音声・動画を追加できます。',
      'SaveしたメディアはIndexedDBへ保存され、次回起動時も復元されます。',
      'Clear tempは未保存の一時追加だけを消します。',
    ],
  },
  {
    key: 'playlist',
    targetSelector: '#library-panel .named-playlists-heading',
    title: 'Saved Playlist',
    summary: '保存済みメディアの組み合わせを名前付きで呼び出します。',
    bullets: [
      '現在の保存曲からPlaylistを作成できます。',
      'YouTube URLも同じSaved Playlistへ追加できます。',
      'Playlistを選ぶと内容がPlayer下のPlay Queueへ展開されます。',
    ],
  },
  {
    key: 'youtube',
    targetSelector: '#youtube-provider-panel .section-heading',
    title: 'YouTube',
    summary: '公式再生・Queue追加・Colab Downloadを同じURLから使います。',
    bullets: [
      'URLをLoadするとYouTube公式IFrameで再生できます。',
      '＋ QueueでPlayer下のPlay Queueへ追加できます。',
      'DownloadはColab Companionを開き、権利または許可のあるメディアを音声化します。',
    ],
  },
  {
    key: 'recorder',
    targetSelector: '#recorder-panel .section-heading',
    title: 'Recorder',
    summary: 'マイク、または選択したブラウザタブの音声を録音します。',
    bullets: [
      'Micはマイク単体、またはLocal Playerを流しながら録音できます。',
      'ブラウザタブは録音開始後に音を流しているタブを選び、タブ音声共有をONにします。',
      'Tab + Micは選択したタブ音声とマイクを同時録音します。PC版Chrome / Edge向けです。',
    ],
  },
  {
    key: 'ffmpeg',
    targetSelector: '#ffmpeg-tools-panel .section-heading',
    title: 'Audio Tools',
    summary: '端末内の動画や音声をFFmpegで変換します。',
    bullets: [
      'Originalは可能な場合に再圧縮せず音声を取り出します。',
      'MP3は192kbps、WAVは48kHz / 16bitです。',
      '処理はブラウザ内で行い、選択したファイルをWMSサーバーへアップロードしません。',
    ],
  },
  {
    key: 'device',
    targetSelector: '.device-panel .section-heading',
    title: 'Device Check',
    summary: 'この端末・ブラウザで利用できる主要APIを確認します。',
    bullets: [
      'DetectedはAPIが見つかったことを示します。',
      '実際の画面OFF再生や録音可否はOS・ブラウザごとに差があります。',
      'タブ音声録音はPC版Chrome / Edgeが主な対応環境です。',
    ],
  },
]

function sameTargets(a: Record<string, Element | null>, b: Record<string, Element | null>) {
  return tips.every((tip) => a[tip.key] === b[tip.key])
}

function InfoTipsEnhancer() {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [targets, setTargets] = useState<Record<string, Element | null>>({})

  useEffect(() => {
    let frame = 0

    const resolveTargets = () => {
      frame = 0
      const next = Object.fromEntries(tips.map((tip) => [tip.key, document.querySelector(tip.targetSelector)]))
      setTargets((current) => sameTargets(current, next) ? current : next)
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(resolveTargets)
    }

    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    resolveTargets()

    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    if (!activeKey) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveKey(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeKey])

  const activeTip = useMemo(() => tips.find((tip) => tip.key === activeKey) ?? null, [activeKey])

  return (
    <>
      {tips.map((tip) => {
        const target = targets[tip.key]
        if (!target) return null
        return createPortal(
          <button
            type="button"
            className="wms-info-button"
            aria-label={`${tip.title}の説明を開く`}
            title={`${tip.title}の説明`}
            onClick={() => setActiveKey(tip.key)}
          >
            i
          </button>,
          target,
        )
      })}

      {activeTip && createPortal(
        <div
          className="wms-info-layer"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveKey(null)
          }}
        >
          <section className="wms-info-sheet" role="dialog" aria-modal="true" aria-labelledby="wms-info-title">
            <div className="wms-info-sheet-heading">
              <div>
                <p className="eyebrow">INFORMATION</p>
                <h2 id="wms-info-title">{activeTip.title}</h2>
              </div>
              <button type="button" className="wms-info-close" onClick={() => setActiveKey(null)} aria-label="閉じる">×</button>
            </div>
            <p className="wms-info-summary">{activeTip.summary}</p>
            <ul>
              {activeTip.bullets.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}

export default InfoTipsEnhancer
