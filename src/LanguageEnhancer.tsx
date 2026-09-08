import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Language = 'ja' | 'en'

const LANGUAGE_KEY = 'wms-language'

function loadLanguage(): Language {
  try {
    return window.localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'ja'
  } catch {
    return 'ja'
  }
}

function setText(selector: string, text: string) {
  const element = document.querySelector<HTMLElement>(selector)
  if (element && element.textContent !== text) element.textContent = text
}

function setDirectText(selector: string, text: string) {
  const element = document.querySelector<HTMLElement>(selector)
  if (!element) return
  const node = Array.from(element.childNodes).find((child) => child.nodeType === Node.TEXT_NODE)
  if (node) {
    if (node.textContent !== text) node.textContent = text
  } else {
    element.insertBefore(document.createTextNode(text), element.firstChild)
  }
}

function setPlaceholder(selector: string, text: string) {
  const input = document.querySelector<HTMLInputElement>(selector)
  if (input && input.placeholder !== text) input.placeholder = text
}

function translateSelectOptions(
  selector: string,
  language: Language,
  jaLabels: Record<string, string>,
  enLabels: Record<string, string> = {},
) {
  const select = document.querySelector<HTMLSelectElement>(selector)
  if (!select) return
  Array.from(select.options).forEach((option) => {
    const english = enLabels[option.value] ?? option.dataset.wmsEnglishLabel ?? option.textContent ?? option.value
    option.dataset.wmsEnglishLabel = english
    const next = language === 'ja' ? jaLabels[option.value] ?? english : english
    if (option.textContent !== next) option.textContent = next
  })
}

function translateQuickControls(language: Language) {
  const buttons = document.querySelectorAll<HTMLButtonElement>('#player-panel .quick-controls > button')
  const shuffle = buttons[0]
  const repeat = buttons[1]

  if (shuffle) shuffle.textContent = language === 'ja' ? '🔀 シャッフル' : '🔀 Shuffle'

  if (repeat) {
    const current = repeat.textContent?.toLowerCase() ?? ''
    const mode = current.includes('repeat 1') || current.includes('1曲')
      ? 'one'
      : current.includes('all') || current.includes('全曲')
        ? 'all'
        : 'off'
    repeat.textContent = language === 'ja'
      ? `🔁 ${mode === 'one' ? '1曲リピート' : mode === 'all' ? '全曲リピート' : 'リピートOFF'}`
      : `🔁 ${mode === 'one' ? 'Repeat 1' : mode === 'all' ? 'Repeat All' : 'Repeat Off'}`
  }
}

function translateYouTubeControls(language: Language) {
  const ja = language === 'ja'
  const options = document.querySelectorAll<HTMLButtonElement>('#youtube-provider-panel .youtube-playback-options button')
  const repeat = options[0]
  const awake = options[1]

  if (repeat) {
    const on = repeat.classList.contains('is-active')
    repeat.textContent = ja ? `🔁 ${on ? '1曲リピート' : 'リピートOFF'}` : `🔁 ${on ? 'Repeat 1' : 'Repeat Off'}`
  }
  if (awake) {
    const on = awake.classList.contains('is-active')
    awake.textContent = ja ? `☀ 画面を消さない ${on ? 'ON' : 'OFF'}` : `☀ Keep screen on ${on ? 'On' : 'Off'}`
  }
}

function translateToolDeck(language: Language) {
  const ja = ['再生', 'ライブラリ', 'YouTube', '録音', '変換', '端末']
  const en = ['Player', 'Library', 'YouTube', 'Record', 'Tools', 'Device']
  document.querySelectorAll<HTMLElement>('.tool-deck-nav button small').forEach((element, index) => {
    const next = (language === 'ja' ? ja : en)[index]
    if (next && element.textContent !== next) element.textContent = next
  })

  const pager = document.querySelector<HTMLElement>('.tool-deck-pager strong')
  if (!pager) return
  const current = pager.textContent?.trim().toLowerCase() ?? ''
  const mapJa: Record<string, string> = {
    player: '再生', library: 'ライブラリ', youtube: 'YouTube', recorder: '録音', record: '録音',
    'audio tools': '音声変換', tools: '音声変換', 'device check': '端末確認', device: '端末確認',
  }
  const mapEn: Record<string, string> = {
    '再生': 'Player', 'ライブラリ': 'Library', youtube: 'YouTube', '録音': 'Recorder',
    '変換': 'Audio tools', '音声変換': 'Audio tools', '端末': 'Device check', '端末確認': 'Device check',
  }
  const next = language === 'ja' ? mapJa[current] : mapEn[current]
  if (next && pager.textContent !== next) pager.textContent = next
}

function translateInterface(language: Language) {
  document.documentElement.lang = language
  document.documentElement.dataset.language = language
  const ja = language === 'ja'

  setText('.topbar h1', ja ? 'メディアプレイヤー' : 'Player Lab')
  setText('.theme-picker > span', ja ? 'スキン' : 'Skin')
  setText('.player-visual-toolbar > span', ja ? 'ビジュアル' : 'Visual')

  translateSelectOptions('.wms-theme-picker select', language, {
    'midnight-neon': '深夜ネオン', obsidian: '黒曜石', 'studio-light': 'スタジオライト', 'analog-warm': 'アナログウォーム',
    'cyber-blue': 'サイバーブルー', 'aurora-purple': 'オーロラパープル', 'emerald-night': 'エメラルドナイト',
    'crimson-noir': 'クリムゾンノワール', 'sunset-glow': 'サンセット', sakura: 'さくら',
    'pixel-arcade': '8-bit アーケード', 'led-marquee': '電光掲示板', 'retro-terminal': 'レトロ端末', 'cassette-deck': 'カセットデッキ',
  }, {
    'midnight-neon': 'Midnight Neon', obsidian: 'Obsidian', 'studio-light': 'Studio Light', 'analog-warm': 'Analog Warm',
    'cyber-blue': 'Cyber Blue', 'aurora-purple': 'Aurora Purple', 'emerald-night': 'Emerald Night',
    'crimson-noir': 'Crimson Noir', 'sunset-glow': 'Sunset Glow', sakura: 'Sakura',
    'pixel-arcade': '8-bit Arcade', 'led-marquee': 'LED Marquee', 'retro-terminal': 'Retro Terminal', 'cassette-deck': 'Cassette Deck',
  })
  translateSelectOptions('.wms-player-visual-toolbar select', language, {
    'rainbow-ring': 'レインボーリング', oscilloscope: 'オシロスコープ', 'spectrum-city': 'スペクトラムシティ',
    'neon-tunnel': 'ネオントンネル', kaleido: 'カレイド', particles: 'パーティクル',
    emblem: 'ロゴ回転', pulse: 'パルスリング', orbit: 'オービット', bars: 'ネオンバー', wave: 'ウェーブ', minimal: 'ミニマル',
  }, {
    'rainbow-ring': 'Rainbow Ring', oscilloscope: 'Oscilloscope', 'spectrum-city': 'Spectrum City',
    'neon-tunnel': 'Neon Tunnel', kaleido: 'Kaleido', particles: 'Particle Field',
    emblem: 'Emblem Spin', pulse: 'Pulse Rings', orbit: 'Orbit', bars: 'Neon Bars', wave: 'Wave Grid', minimal: 'Minimal',
  })

  setText('#library-panel .library-heading h2', ja ? '端末のメディア' : 'Device media')
  setDirectText('#library-panel .import-button:not(.folder-button)', ja ? '＋ ファイル追加' : '＋ Add files')
  setDirectText('#library-panel .folder-button', ja ? '▣ フォルダ' : '▣ Folder')
  setText('#library-panel .all-media-button', ja ? 'すべて表示' : 'All media')
  setPlaceholder('#library-panel .playlist-create-row input', ja ? '例：朝のBGM / 練習用' : 'e.g. Morning / Practice')
  setText('#library-panel .playlist-create-row button:first-of-type', ja ? '＋ プレイリスト保存' : '＋ Save playlist')
  setText('.device-library-primary b', ja ? '端末の曲を選ぶ' : 'Choose device audio')
  setText('.device-library-list-heading strong', ja ? '保存済みの曲' : 'Saved audio')
  setText('.device-library-empty', ja ? '端末の音声を複数選択すると、ここからまとめて選曲できます。' : 'Choose multiple audio files from your device to browse them here.')
  const updatePlaylist = document.querySelector<HTMLButtonElement>('#library-panel .update-playlist-button')
  if (updatePlaylist) updatePlaylist.textContent = ja ? '更新' : 'Update'

  setText('.unified-play-queue-heading .eyebrow', ja ? '再生キュー' : 'PLAY QUEUE')
  setText('.unified-play-queue-heading h3', ja ? '次に再生' : 'Up next')
  const queueSub = document.querySelector<HTMLElement>('.unified-play-queue-heading span')
  if (queueSub && !queueSub.textContent?.startsWith('Saved Playlist')) queueSub.textContent = ja ? '選んだ曲をここに集約' : 'Selected media appears here'
  const queueCount = document.querySelector<HTMLElement>('.unified-play-queue-heading > b')
  if (queueCount) {
    const number = queueCount.textContent?.match(/\d+/)?.[0] ?? '0'
    queueCount.textContent = ja ? `${number}件` : `${number} items`
  }
  setText('.unified-play-queue-empty strong', ja ? 'キューは空です' : 'Queue is empty.')
  setText('.unified-play-queue-empty span', ja ? 'ライブラリ・YouTube・録音などから追加できます。' : 'Add media from Library, YouTube, Record, and more.')

  setText('#youtube-provider-panel .section-heading h2', ja ? '再生 / ダウンロード' : 'Play / Download')
  setPlaceholder('#youtube-provider-panel .youtube-url-form input', ja ? 'YouTube URLをここに貼り付け' : 'Paste a YouTube URL here')
  setText('.youtube-paste-prompt strong', 'YouTube URL')
  setText('.youtube-paste-prompt small', ja ? 'ここに貼り付けるだけ' : 'Paste it here')
  setText('#youtube-provider-panel .youtube-url-form button[type="submit"]', ja ? '読み込む' : 'Load')
  const clear = document.querySelector<HTMLButtonElement>('#youtube-provider-panel .youtube-url-form .secondary')
  if (clear) clear.textContent = ja ? 'クリア' : 'Clear'
  setText('#youtube-provider-panel .youtube-download-button', ja ? '↓ ダウンロード' : '↓ Download')
  setDirectText('#youtube-provider-panel .youtube-import-button', ja ? '＋ ダウンロード音声を取り込む' : '＋ Import downloaded audio')
  setText('#youtube-provider-panel .youtube-transport .primary', ja ? '▶ 再生' : '▶ Play')
  const ytPause = document.querySelectorAll<HTMLButtonElement>('#youtube-provider-panel .youtube-transport button')[2]
  if (ytPause) ytPause.textContent = ja ? 'Ⅱ 一時停止' : 'Ⅱ Pause'
  translateYouTubeControls(language)

  setText('#recorder-panel .section-heading h2', ja ? '録音' : 'Mic / browser tab audio')
  const recorderModes = document.querySelectorAll<HTMLElement>('#recorder-panel .record-mode-picker button')
  if (recorderModes[0]) {
    const strong = recorderModes[0].querySelector('strong')
    const span = recorderModes[0].querySelector('span')
    if (strong) strong.textContent = ja ? 'マイク' : 'Mic'
    if (span) span.textContent = ja ? 'マイク録音' : 'Microphone'
  }
  if (recorderModes[1]) {
    const strong = recorderModes[1].querySelector('strong')
    if (strong) strong.textContent = ja ? 'ブラウザタブ' : 'Browser tab'
  }
  if (recorderModes[2]) {
    const strong = recorderModes[2].querySelector('strong')
    if (strong) strong.textContent = ja ? 'タブ + マイク' : 'Tab + Mic'
  }
  const recorderActions = document.querySelectorAll<HTMLButtonElement>('#recorder-panel .record-actions button')
  recorderActions.forEach((button) => {
    const raw = button.textContent ?? ''
    if (raw.includes('Record mic') || raw.includes('マイク録音')) button.textContent = ja ? '● マイク録音' : '● Record mic'
    if (raw.includes('Play & Record') || raw.includes('再生しながら録音')) button.textContent = ja ? '▶ + ● 再生しながら録音' : '▶ + ● Play & Record'
  })

  setText('#ffmpeg-tools-panel .section-heading h2', ja ? '動画 → 音声' : 'Video → Audio')
  const ffmpegRun = document.querySelector<HTMLButtonElement>('#ffmpeg-tools-panel .ffmpeg-run')
  if (ffmpegRun && !ffmpegRun.textContent?.includes('Processing')) ffmpegRun.textContent = ja ? '音声化する' : 'Convert to audio'

  setText('.device-panel .section-heading h2', ja ? 'この端末で使える機能' : 'Browser capabilities')

  setText('.appearance-trigger b', ja ? '背景' : 'Backdrop')
  setText('.appearance-sheet-heading h2', ja ? '見た目の設定' : 'Appearance')
  setText('.appearance-setting-card .appearance-setting-copy strong', ja ? '背景画像' : 'Background')
  setText('.appearance-range-row:nth-of-type(1) strong', ja ? '暗さ' : 'Dark overlay')
  setText('.appearance-range-row:nth-of-type(2) strong', ja ? 'ぼかし' : 'Background blur')

  const mixLabels = document.querySelectorAll<HTMLElement>('#player-panel .mix-controls label > span')
  if (mixLabels[0]) mixLabels[0].textContent = ja ? '速度' : 'Speed'
  if (mixLabels[1]) {
    const amount = mixLabels[1].textContent?.match(/\d+%/)?.[0] ?? ''
    mixLabels[1].textContent = ja ? `音量 ${amount}` : `Volume ${amount}`
  }

  const ytMixLabels = document.querySelectorAll<HTMLElement>('#youtube-provider-panel .youtube-mix-controls label > span')
  if (ytMixLabels[0]) ytMixLabels[0].textContent = ja ? '速度' : 'Speed'
  if (ytMixLabels[1]) {
    const amount = ytMixLabels[1].textContent?.match(/\d+%/)?.[0] ?? ''
    ytMixLabels[1].textContent = ja ? `音量 ${amount}` : `Volume ${amount}`
  }

  translateQuickControls(language)
  translateToolDeck(language)
  window.dispatchEvent(new CustomEvent('wms:language-change', { detail: { language } }))
}

export default function LanguageEnhancer() {
  const [language, setLanguage] = useState<Language>(loadLanguage)
  const [target, setTarget] = useState<Element | null>(null)
  const applyingRef = useRef(false)

  useEffect(() => {
    setTarget(document.querySelector('.topbar'))
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_KEY, language)
    } catch {
      // Language selection still works for the current session.
    }

    let frame = 0
    const apply = () => {
      frame = 0
      if (applyingRef.current) return
      applyingRef.current = true
      translateInterface(language)
      applyingRef.current = false
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply)
    }

    apply()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [language])

  if (!target) return null

  return createPortal(
    <div className="language-switch" role="group" aria-label="表示言語 / Language">
      <button type="button" className={language === 'ja' ? 'is-active' : ''} onClick={() => setLanguage('ja')}>日本語</button>
      <button type="button" className={language === 'en' ? 'is-active' : ''} onClick={() => setLanguage('en')}>EN</button>
    </div>,
    target,
  )
}
