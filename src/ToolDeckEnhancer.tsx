import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { deleteBackgroundAsset, getBackgroundAsset, saveBackgroundAsset } from './appearanceDb'
import { setActivePlaybackTool, type PlaybackTool } from './playbackArbiter'

const BACKGROUND_DIM_KEY = 'wms-ui-v2-background-dim'
const BACKGROUND_BLUR_KEY = 'wms-ui-v2-background-blur'
const DETAIL_MODE_KEY = 'wms-ui-v2-detail-mode'
const MAX_BACKGROUND_BYTES = 20 * 1024 * 1024

type DetailMode = 'compact' | 'full'

type ToolDefinition = {
  key: PlaybackTool
  selector: string
  icon: string
  label: string
  shortLabel: string
}

const tools: ToolDefinition[] = [
  { key: 'player', selector: '#player-panel', icon: '▶', label: 'Player', shortLabel: 'Player' },
  { key: 'library', selector: '#library-panel', icon: '▣', label: 'Library', shortLabel: 'Library' },
  { key: 'youtube', selector: '#youtube-provider-panel', icon: 'YT', label: 'YouTube', shortLabel: 'YouTube' },
  { key: 'record', selector: '#recorder-panel', icon: '●', label: 'Recorder', shortLabel: 'Record' },
  { key: 'tools', selector: '#ffmpeg-tools-panel', icon: '✦', label: 'Audio tools', shortLabel: 'Tools' },
  { key: 'device', selector: '.device-panel', icon: '◇', label: 'Device check', shortLabel: 'Device' },
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
  const [activeTool, setActiveTool] = useState<PlaybackTool>('player')
  const [topbarTarget, setTopbarTarget] = useState<Element | null>(null)
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
    setTopbarTarget(document.querySelector('.topbar'))

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
    setActivePlaybackTool(activeTool)
  }, [activeTool])

  useEffect(() => {
    const container = document.querySelector<HTMLElement>('.content-grid')
    if (!container) return

    let frame = 0
    let lastKey = ''

    const updateActiveTool = () => {
      frame = 0
      const containerRect = container.getBoundingClientRect()
      const center = containerRect.left + containerRect.width / 2
      let best: { key: PlaybackTool; distance: number } | null = null

      for (const tool of tools) {
        const element = document.querySelector<HTMLElement>(tool.selector)
        if (!element) continue
        element.dataset.toolDeckPanel = tool.key
        const rect = element.getBoundingClientRect()
        const distance = Math.abs(rect.left + rect.width / 2 - center)
        if (!best || distance < best.distance) best = { key: tool.key, distance }
      }

      if (best && best.key !== lastKey) {
        lastKey = best.key
        setActiveTool(best.key)
      }
    }

    const scheduleUpdate = () => {
      if (frame) return
      frame = window.requestAnimationFrame(updateActiveTool)
    }

    const observer = new MutationObserver(scheduleUpdate)
    observer.observe(container, { childList: true, subtree: true })
    container.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    scheduleUpdate()

    return () => {
      observer.disconnect()
      container.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const goToTool = (tool: ToolDefinition) => {
    const element = document.querySelector<HTMLElement>(tool.selector)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    setActiveTool(tool.key)
  }

  const moveTool = (offset: number) => {
    const currentIndex = Math.max(0, tools.findIndex((tool) => tool.key === activeTool))
    const nextIndex = Math.min(tools.length - 1, Math.max(0, currentIndex + offset))
    goToTool(tools[nextIndex])
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

  const activeIndex = Math.max(0, tools.findIndex((tool) => tool.key === activeTool))
  const activeDefinition = tools[activeIndex]

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
                <p className="eyebrow">WMS UI v2</p>
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
      {topbarTarget && createPortal(
        <button type="button" className="appearance-trigger" onClick={() => setSheetOpen(true)} aria-label="背景と表示設定を開く" title="背景と表示設定">
          <span>▧</span><b>Backdrop</b>
        </button>,
        topbarTarget,
      )}

      <div className="tool-deck-pager" aria-live="polite">
        <button type="button" onClick={() => moveTool(-1)} disabled={activeIndex === 0} aria-label="前のツール">‹</button>
        <span><strong>{activeDefinition.label}</strong><small>{activeIndex + 1} / {tools.length}</small></span>
        <button type="button" onClick={() => moveTool(1)} disabled={activeIndex === tools.length - 1} aria-label="次のツール">›</button>
      </div>

      <nav className="tool-deck-nav" aria-label="WMS tools">
        {tools.map((tool) => (
          <button
            type="button"
            key={tool.key}
            className={activeTool === tool.key ? 'is-current' : ''}
            onClick={() => goToTool(tool)}
            aria-current={activeTool === tool.key ? 'page' : undefined}
          >
            <span>{tool.icon}</span>
            <small>{tool.shortLabel}</small>
          </button>
        ))}
      </nav>

      {settingsSheet}
    </>
  )
}

export default ToolDeckEnhancer
