import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { deleteBackgroundAsset, getBackgroundAsset, saveBackgroundAsset } from './appearanceDb'
import { setActivePlaybackTool, type PlaybackTool } from './playbackArbiter'

const BACKGROUND_DIM_KEY = 'wms-ui-v2-background-dim'
const BACKGROUND_BLUR_KEY = 'wms-ui-v2-background-blur'
const DETAIL_MODE_KEY = 'wms-ui-v2-detail-mode'
const MAX_BACKGROUND_BYTES = 20 * 1024 * 1024

type DetailMode = 'compact' | 'full'
type ProductSurface = 'search' | 'local' | 'player' | 'more'

type SurfaceDefinition = {
  key: ProductSurface
  playbackTool: PlaybackTool
  icon: string
  label: string
  selector: string
}

type NavigateEventDetail = {
  surface?: ProductSurface
}

const surfaces: SurfaceDefinition[] = [
  { key: 'search', playbackTool: 'youtube', icon: '⌕', label: 'Search', selector: '#youtube-provider-panel' },
  { key: 'local', playbackTool: 'library', icon: '▣', label: 'Local', selector: '#library-panel' },
  { key: 'player', playbackTool: 'player', icon: '▶', label: 'Player', selector: '#player-panel' },
  { key: 'more', playbackTool: 'device', icon: '•••', label: 'More', selector: '.device-panel' },
]

function loadNumber(key: string, fallback: number, min: number, max: number) {
  try {
    const value = Number(window.localStorage.getItem(key))
    if (Number.isFinite(value)) return Math.min(max, Math.max(min, value))
  } catch {
    // Keep the fallback when localStorage is unavailable.
  }
  return fallback
}

function loadDetailMode(): DetailMode {
  try {
    return window.localStorage.getItem(DETAIL_MODE_KEY) === 'full' ? 'full' : 'compact'
  } catch {
    return 'compact'
  }
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 MB'
  return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

function ToolDeckEnhancer() {
  const [activeSurface, setActiveSurface] = useState<ProductSurface>('search')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const [backgroundName, setBackgroundName] = useState<string | null>(null)
  const [backgroundSize, setBackgroundSize] = useState(0)
  const [backgroundDim, setBackgroundDim] = useState(() => loadNumber(BACKGROUND_DIM_KEY, 48, 0, 85))
  const [backgroundBlur, setBackgroundBlur] = useState(() => loadNumber(BACKGROUND_BLUR_KEY, 2, 0, 24))
  const [detailMode, setDetailMode] = useState<DetailMode>(loadDetailMode)
  const [appearanceStatus, setAppearanceStatus] = useState('背景画像はこの端末内だけに保存されます。')
  const [appearanceBusy, setAppearanceBusy] = useState(false)
  const backgroundUrlRef = useRef<string | null>(null)

  const replaceBackgroundUrl = (next: string | null) => {
    const previous = backgroundUrlRef.current
    if (previous && previous !== next) URL.revokeObjectURL(previous)
    backgroundUrlRef.current = next
    setBackgroundUrl(next)
  }

  useEffect(() => {
    let cancelled = false
    void getBackgroundAsset()
      .then((asset) => {
        if (cancelled || !asset) return
        const url = URL.createObjectURL(asset.blob)
        replaceBackgroundUrl(url)
        setBackgroundName(asset.name)
        setBackgroundSize(asset.size)
      })
      .catch(() => {
        if (!cancelled) setAppearanceStatus('保存済み背景を読み込めませんでした。')
      })

    return () => {
      cancelled = true
      if (backgroundUrlRef.current) URL.revokeObjectURL(backgroundUrlRef.current)
      backgroundUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(BACKGROUND_DIM_KEY, String(backgroundDim))
      window.localStorage.setItem(BACKGROUND_BLUR_KEY, String(backgroundBlur))
      window.localStorage.setItem(DETAIL_MODE_KEY, detailMode)
    } catch {
      // Appearance settings remain usable for the current page session.
    }
    document.documentElement.dataset.uiDetail = detailMode
  }, [backgroundDim, backgroundBlur, detailMode])

  useEffect(() => {
    const definition = surfaces.find((surface) => surface.key === activeSurface) ?? surfaces[0]
    document.documentElement.dataset.wmsSurface = activeSurface
    setActivePlaybackTool(definition.playbackTool)
    window.dispatchEvent(new CustomEvent('wms:surface-change', { detail: { surface: activeSurface } }))

    return () => {
      if (document.documentElement.dataset.wmsSurface === activeSurface) {
        delete document.documentElement.dataset.wmsSurface
      }
    }
  }, [activeSurface])

  useEffect(() => {
    const openAppearance = () => setSheetOpen(true)
    const navigate = (event: Event) => {
      const requested = (event as CustomEvent<NavigateEventDetail>).detail?.surface
      if (!requested || !surfaces.some((surface) => surface.key === requested)) return
      setActiveSurface(requested)
    }

    window.addEventListener('wms:open-appearance', openAppearance)
    window.addEventListener('wms:navigate', navigate)
    return () => {
      window.removeEventListener('wms:open-appearance', openAppearance)
      window.removeEventListener('wms:navigate', navigate)
    }
  }, [])

  const goToSurface = (surface: SurfaceDefinition) => {
    setActiveSurface(surface.key)
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.content-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const chooseBackground = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAppearanceStatus('画像ファイルを選択してください。')
      return
    }
    if (file.size > MAX_BACKGROUND_BYTES) {
      setAppearanceStatus(`背景画像は ${formatBytes(MAX_BACKGROUND_BYTES)} 以下にしてください。`)
      return
    }

    setAppearanceBusy(true)
    setAppearanceStatus('背景画像を端末内へ保存しています…')
    try {
      const record = await saveBackgroundAsset(file)
      replaceBackgroundUrl(URL.createObjectURL(record.blob))
      setBackgroundName(record.name)
      setBackgroundSize(record.size)
      setAppearanceStatus('背景画像を変更しました。画像はこの端末内だけに保存されています。')
    } catch (error) {
      setAppearanceStatus(error instanceof Error ? error.message : '背景画像を保存できませんでした。')
    } finally {
      setAppearanceBusy(false)
    }
  }

  const removeBackground = async () => {
    setAppearanceBusy(true)
    try {
      await deleteBackgroundAsset()
      replaceBackgroundUrl(null)
      setBackgroundName(null)
      setBackgroundSize(0)
      setAppearanceStatus('カスタム背景を解除しました。')
    } catch (error) {
      setAppearanceStatus(error instanceof Error ? error.message : '背景画像を削除できませんでした。')
    } finally {
      setAppearanceBusy(false)
    }
  }

  const backgroundLayers = createPortal(
    <>
      {backgroundUrl && (
        <div
          className="wms-user-backdrop"
          aria-hidden="true"
          style={{
            backgroundImage: `url(${JSON.stringify(backgroundUrl)})`,
            filter: `blur(${backgroundBlur}px)`,
          }}
        />
      )}
      {backgroundUrl && <div className="wms-user-backdrop-scrim" aria-hidden="true" style={{ background: `rgba(3, 5, 10, ${backgroundDim / 100})` }} />}
    </>,
    document.body,
  )

  const settingsSheet = sheetOpen
    ? createPortal(
        <div className="appearance-sheet-layer" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSheetOpen(false)
        }}>
          <section className="appearance-sheet" role="dialog" aria-modal="true" aria-labelledby="appearance-sheet-title">
            <div className="appearance-sheet-heading">
              <div>
                <p className="eyebrow">WMS</p>
                <h2 id="appearance-sheet-title">Appearance</h2>
              </div>
              <button type="button" className="appearance-close" onClick={() => setSheetOpen(false)} aria-label="閉じる">×</button>
            </div>

            <div className="appearance-setting-card">
              <div className="appearance-setting-copy">
                <strong>Background</strong>
                <span>{backgroundName ? `${backgroundName} · ${formatBytes(backgroundSize)}` : '標準のWMS背景を使用中'}</span>
              </div>
              <div className="appearance-actions">
                <label className="appearance-file-button">
                  画像を選ぶ
                  <input type="file" accept="image/*" onChange={(event) => void chooseBackground(event)} disabled={appearanceBusy} />
                </label>
                {backgroundUrl && <button type="button" onClick={() => void removeBackground()} disabled={appearanceBusy}>解除</button>}
              </div>
            </div>

            <label className="appearance-range-row">
              <span><strong>Dark overlay</strong><b>{backgroundDim}%</b></span>
              <input type="range" min="0" max="85" step="1" value={backgroundDim} onChange={(event) => setBackgroundDim(Number(event.target.value))} />
            </label>

            <label className="appearance-range-row">
              <span><strong>Background blur</strong><b>{backgroundBlur}px</b></span>
              <input type="range" min="0" max="24" step="1" value={backgroundBlur} onChange={(event) => setBackgroundBlur(Number(event.target.value))} />
            </label>

            <div className="appearance-setting-card appearance-detail-toggle">
              <div className="appearance-setting-copy">
                <strong>補足説明</strong>
                <span>普段は情報量を抑え、必要な時だけ技術的な補足を表示します。</span>
              </div>
              <div className="appearance-segmented" role="group" aria-label="補足説明の表示量">
                <button type="button" className={detailMode === 'compact' ? 'is-active' : ''} onClick={() => setDetailMode('compact')}>少なめ</button>
                <button type="button" className={detailMode === 'full' ? 'is-active' : ''} onClick={() => setDetailMode('full')}>すべて</button>
              </div>
            </div>

            <p className="appearance-status">{appearanceStatus}</p>
          </section>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      {backgroundLayers}

      <nav className="tool-deck-nav" aria-label="WMS primary navigation">
        {surfaces.map((surface) => (
          <button
            type="button"
            key={surface.key}
            className={activeSurface === surface.key ? 'is-current' : ''}
            onClick={() => goToSurface(surface)}
            aria-current={activeSurface === surface.key ? 'page' : undefined}
          >
            <span>{surface.icon}</span>
            <small>{surface.label}</small>
          </button>
        ))}
      </nav>

      {settingsSheet}
    </>
  )
}

export default ToolDeckEnhancer
