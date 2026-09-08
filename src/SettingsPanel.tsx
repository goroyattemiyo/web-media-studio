import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { getMediaLibraryBytes, listMediaLibraryItems } from './mediaLibraryDb'

type CapabilityState = 'available' | 'limited' | 'unavailable'
type DetailMode = 'compact' | 'full'

type Capability = {
  icon: string
  label: string
  state: CapabilityState
  tech: string
  note?: string
}

type MediaDevicesWithDisplay = MediaDevices & {
  getDisplayMedia?: (constraints?: DisplayMediaStreamOptions) => Promise<MediaStream>
}

type WakeNavigator = Navigator & {
  wakeLock?: unknown
}

const DETAIL_MODE_KEY = 'wms-ui-v2-detail-mode'

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB']
  let amount = value
  let unit = 0
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024
    unit += 1
  }
  return `${amount.toFixed(unit >= 2 && amount < 10 ? 1 : 0)} ${units[unit]}`
}

function loadDetailMode(): DetailMode {
  try {
    return window.localStorage.getItem(DETAIL_MODE_KEY) === 'full' ? 'full' : 'compact'
  } catch {
    return 'compact'
  }
}

function statusLabel(state: CapabilityState) {
  if (state === 'available') return '利用可能'
  if (state === 'limited') return 'ブラウザ依存'
  return '利用不可'
}

export default function SettingsPanel() {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [detailMode, setDetailMode] = useState<DetailMode>(loadDetailMode)
  const [savedCount, setSavedCount] = useState(0)
  const [savedBytes, setSavedBytes] = useState(0)
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(null)
  const [skin, setSkin] = useState('')
  const [visual, setVisual] = useState('')
  const [skinOptions, setSkinOptions] = useState<Array<{ value: string; label: string }>>([])
  const [visualOptions, setVisualOptions] = useState<Array<{ value: string; label: string }>>([])

  useEffect(() => {
    const resolve = () => {
      const next = document.querySelector<HTMLElement>('.device-panel')
      if (next) next.classList.add('wms-settings-panel')
      setTarget((current) => current === next ? current : next)
    }
    resolve()
    const observer = new MutationObserver(resolve)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const refreshAppearance = () => {
      const skinSelect = document.querySelector<HTMLSelectElement>('.wms-theme-picker select')
      const visualSelect = document.querySelector<HTMLSelectElement>('.wms-player-visual-toolbar select')
      if (skinSelect) {
        setSkin(skinSelect.value)
        setSkinOptions(Array.from(skinSelect.options).map((option) => ({ value: option.value, label: option.textContent || option.value })))
      }
      if (visualSelect) {
        setVisual(visualSelect.value)
        setVisualOptions(Array.from(visualSelect.options).map((option) => ({ value: option.value, label: option.textContent || option.value })))
      }
    }
    refreshAppearance()
    const timer = window.setInterval(refreshAppearance, 1200)
    window.addEventListener('wms:language-change', refreshAppearance)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('wms:language-change', refreshAppearance)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const refreshStorage = async () => {
      try {
        const [items, bytes] = await Promise.all([listMediaLibraryItems(), getMediaLibraryBytes()])
        if (cancelled) return
        setSavedCount(items.length)
        setSavedBytes(bytes)
        if (navigator.storage?.persisted) setStoragePersistent(await navigator.storage.persisted())
      } catch {
        // Existing system message paths report storage errors.
      }
    }
    void refreshStorage()
    const timer = window.setInterval(() => void refreshStorage(), 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.uiDetail = detailMode
    try {
      window.localStorage.setItem(DETAIL_MODE_KEY, detailMode)
    } catch {
      // Current session still reflects the selected density.
    }
  }, [detailMode])

  const capabilities = useMemo<Capability[]>(() => {
    const displayMedia = Boolean((navigator.mediaDevices as MediaDevicesWithDisplay | undefined)?.getDisplayMedia)
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false
    const microphone = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices && 'MediaRecorder' in window
    return [
      { icon: '🎧', label: '音声・動画の再生', state: 'available', tech: 'HTMLMediaElement' },
      { icon: '📱', label: 'ロック画面操作', state: 'mediaSession' in navigator ? 'limited' : 'unavailable', tech: 'Media Session', note: '表示や画面OFF継続はOS・ブラウザに依存します。' },
      { icon: '🎙', label: 'マイク録音', state: microphone ? 'available' : 'unavailable', tech: 'getUserMedia / MediaRecorder' },
      { icon: '🖥', label: 'ブラウザタブ音声録音', state: displayMedia ? 'limited' : 'unavailable', tech: 'getDisplayMedia', note: 'PC版Chrome / Edgeが主な対応環境です。' },
      { icon: '🌈', label: '音反応ビジュアライザ', state: 'AudioContext' in window || 'webkitAudioContext' in window ? 'available' : 'limited', tech: 'Web Audio AnalyserNode' },
      { icon: '🎞', label: '動画 → 音声変換', state: 'WebAssembly' in window ? 'available' : 'unavailable', tech: 'WebAssembly / FFmpeg' },
      { icon: '☀', label: '画面を消さない', state: Boolean((navigator as WakeNavigator).wakeLock) ? 'available' : 'unavailable', tech: 'Screen Wake Lock' },
      { icon: '💾', label: '端末内ライブラリ保存', state: 'indexedDB' in window ? 'available' : 'unavailable', tech: 'IndexedDB' },
      { icon: '📁', label: 'フォルダ選択', state: 'showDirectoryPicker' in window ? 'available' : 'limited', tech: 'File System Access / directory input', note: '非対応端末では複数ファイル選択を使います。' },
      { icon: '📋', label: 'URLコピー', state: 'clipboard' in navigator ? 'available' : 'limited', tech: 'Clipboard API' },
      { icon: '⚙', label: 'PWA / オフライン基盤', state: 'serviceWorker' in navigator ? (standalone ? 'available' : 'limited') : 'unavailable', tech: 'Service Worker / PWA', note: standalone ? 'インストール済み表示で起動しています。' : 'ブラウザから利用中です。' },
      { icon: '🔒', label: '安全なブラウザ機能', state: window.isSecureContext ? 'available' : 'unavailable', tech: 'Secure Context' },
    ]
  }, [])

  const setLanguage = (language: 'ja' | 'en') => {
    const buttons = document.querySelectorAll<HTMLButtonElement>('.language-switch button')
    const button = language === 'ja' ? buttons[0] : buttons[1]
    button?.click()
  }

  const changeSelect = (selector: string, value: string) => {
    const select = document.querySelector<HTMLSelectElement>(selector)
    if (!select) return
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  }

  if (!target) return null

  return createPortal(
    <div className="settings-panel-content">
      <div className="settings-heading">
        <div><p className="eyebrow">WMS SETTINGS</p><h2>設定</h2></div>
        <span className="settings-version">UI v2</span>
      </div>

      <section className="settings-group">
        <h3>見た目</h3>
        <div className="settings-grid">
          <div className="settings-card">
            <span>表示言語</span>
            <div className="settings-segmented">
              <button type="button" onClick={() => setLanguage('ja')}>日本語</button>
              <button type="button" onClick={() => setLanguage('en')}>EN</button>
            </div>
          </div>
          <label className="settings-card">
            <span>スキン</span>
            <select value={skin} onChange={(event) => { setSkin(event.target.value); changeSelect('.wms-theme-picker select', event.target.value) }}>
              {skinOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="settings-card">
            <span>ビジュアライザ</span>
            <select value={visual} disabled={!visualOptions.length} onChange={(event) => { setVisual(event.target.value); changeSelect('.wms-player-visual-toolbar select', event.target.value) }}>
              {visualOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <div className="settings-card">
            <span>補足説明</span>
            <div className="settings-segmented">
              <button type="button" className={detailMode === 'compact' ? 'is-active' : ''} onClick={() => setDetailMode('compact')}>少なめ</button>
              <button type="button" className={detailMode === 'full' ? 'is-active' : ''} onClick={() => setDetailMode('full')}>すべて</button>
            </div>
          </div>
          <button type="button" className="settings-background-button" onClick={() => document.querySelector<HTMLButtonElement>('.appearance-trigger')?.click()}>
            ▧ 背景を変更
          </button>
        </div>
      </section>

      <section className="settings-group">
        <div className="settings-group-heading"><h3>保存・データ</h3><b>{savedCount}件</b></div>
        <div className="settings-storage-summary">
          <span>WMSライブラリ</span>
          <strong>{formatBytes(savedBytes)}</strong>
          <small>{storagePersistent === true ? '永続ストレージ許可済み' : storagePersistent === false ? 'ブラウザ管理ストレージ' : '保存状態を確認中'}</small>
        </div>
      </section>

      <section className="settings-group settings-capabilities">
        <div className="settings-group-heading"><h3>この端末でできること</h3><span>ⓘ 技術名は小さく表示</span></div>
        <div className="settings-capability-list">
          {capabilities.map((item) => (
            <div className="settings-capability" key={item.label}>
              <span className="settings-capability-icon">{item.icon}</span>
              <span className="settings-capability-copy"><strong>{item.label}</strong><small>{item.tech}{item.note ? ` · ${item.note}` : ''}</small></span>
              <b className={`is-${item.state}`}>{statusLabel(item.state)}</b>
            </div>
          ))}
        </div>
      </section>
    </div>,
    target,
  )
}
