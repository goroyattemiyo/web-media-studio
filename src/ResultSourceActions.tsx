import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type Language = 'ja' | 'en'
type SourceKind = 'recording' | 'ffmpeg'
type SourceTarget = {
  element: HTMLElement
  kind: SourceKind
}

type ActionMode = 'play-now' | 'play-next'

function loadLanguage(): Language {
  try {
    return window.localStorage.getItem('wms-language') === 'en' ? 'en' : 'ja'
  } catch {
    return 'ja'
  }
}

function emitSystem(text: string, source: string, level: 'info' | 'success' | 'error' = 'info') {
  window.dispatchEvent(new CustomEvent('wms:system-message', {
    detail: { text, source, level },
  }))
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes('mpeg')) return 'mp3'
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('webm')) return 'webm'
  return 'audio'
}

function hasExtension(name: string) {
  return /\.[a-z0-9]{2,8}$/i.test(name)
}

function sourceTitle(target: SourceTarget) {
  if (target.kind === 'recording') {
    return target.element.querySelector<HTMLElement>('.take-meta strong')?.textContent?.trim() || 'Recording'
  }
  return target.element.querySelector<HTMLElement>(':scope > div strong')?.textContent?.trim() || 'Converted audio'
}

function sourceAudio(target: SourceTarget) {
  return target.element.querySelector<HTMLAudioElement>('audio')
}

function queueRows() {
  return Array.from(document.querySelectorAll<HTMLElement>('#library-panel .playlist-row'))
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}

async function waitForImportedRow(previousCount: number) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    await wait(70)
    const rows = queueRows()
    if (rows.length > previousCount) return rows[rows.length - 1] ?? null
  }
  return null
}

async function placeImmediatelyAfterCurrent(row: HTMLElement) {
  const token = `result-${Date.now()}-${Math.random().toString(36).slice(2)}`
  row.dataset.wmsResultToken = token

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const rows = queueRows()
    const marked = document.querySelector<HTMLElement>(`#library-panel .playlist-row[data-wms-result-token="${token}"]`)
    if (!marked) return

    const markedIndex = rows.indexOf(marked)
    const currentIndex = rows.findIndex((candidate) => Boolean(candidate.querySelector('.playlist-item.is-current')))
    if (currentIndex < 0 || markedIndex <= currentIndex + 1) return

    const upButton = marked.querySelectorAll<HTMLButtonElement>('.queue-order-actions button')[0]
    if (!upButton || upButton.disabled) return
    upButton.click()
    await wait(35)
  }
}

async function importIntoPlayerQueue(file: File, mode: ActionMode) {
  const input = document.querySelector<HTMLInputElement>(
    '#library-panel .import-button:not(.folder-button) input[type="file"]',
  )
  if (!input) throw new Error('LOCAL_IMPORT_UNAVAILABLE')
  if (typeof DataTransfer === 'undefined') throw new Error('DATA_TRANSFER_UNAVAILABLE')

  const beforeCount = queueRows().length
  const transfer = new DataTransfer()
  transfer.items.add(file)
  input.files = transfer.files
  input.dispatchEvent(new Event('change', { bubbles: true }))

  const importedRow = await waitForImportedRow(beforeCount)
  if (!importedRow) throw new Error('QUEUE_IMPORT_TIMEOUT')

  if (mode === 'play-next') {
    await placeImmediatelyAfterCurrent(importedRow)
    return
  }

  importedRow.querySelector<HTMLButtonElement>('.playlist-item')?.click()
  await wait(90)
  const playButton = document.querySelector<HTMLButtonElement>('#player-panel .play-button')
  if (playButton && playButton.textContent?.includes('▶')) playButton.click()
  document.getElementById('player-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
}

function ResultActions({ target, language }: { target: SourceTarget; language: Language }) {
  const [busy, setBusy] = useState<ActionMode | null>(null)
  const [secondaryOpen, setSecondaryOpen] = useState(false)

  useEffect(() => {
    target.element.classList.add('wms-result-source-unified')
    return () => target.element.classList.remove('wms-result-source-unified')
  }, [target])

  useEffect(() => {
    if (!secondaryOpen) return
    const closeOutside = (event: PointerEvent) => {
      const element = event.target as Element | null
      if (element?.closest('.wms-result-secondary-trigger, .wms-result-secondary-menu')) return
      setSecondaryOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [secondaryOpen])

  const run = async (mode: ActionMode) => {
    if (busy) return
    const audio = sourceAudio(target)
    const sourceUrl = audio?.currentSrc || audio?.getAttribute('src') || ''
    if (!sourceUrl) {
      emitSystem(language === 'ja' ? 'この音声を取得できませんでした。' : 'This audio is not available.', target.kind === 'recording' ? 'Record' : 'FFmpeg', 'error')
      return
    }

    setBusy(mode)
    try {
      const response = await fetch(sourceUrl)
      if (!response.ok) throw new Error(`FETCH_${response.status}`)
      const blob = await response.blob()
      const title = sourceTitle(target)
      const mimeType = blob.type || audio?.getAttribute('type') || 'audio/webm'
      const fileName = hasExtension(title) ? title : `${title}.${extensionForMime(mimeType)}`
      const file = new File([blob], fileName, { type: mimeType, lastModified: Date.now() })

      await importIntoPlayerQueue(file, mode)
      const source = target.kind === 'recording' ? 'Record' : 'FFmpeg'
      if (mode === 'play-now') {
        emitSystem(language === 'ja' ? `${fileName} をPlayerで再生します。` : `Playing ${fileName} in Player.`, source, 'success')
      } else {
        emitSystem(language === 'ja' ? `${fileName} を次に再生へ追加しました。` : `Added ${fileName} to Play Next.`, source, 'success')
      }
    } catch {
      emitSystem(
        language === 'ja'
          ? 'Playerへ送れませんでした。ブラウザを再読み込みしてもう一度お試しください。'
          : 'Could not send this audio to Player. Reload and try again.',
        target.kind === 'recording' ? 'Record' : 'FFmpeg',
        'error',
      )
    } finally {
      setBusy(null)
    }
  }

  const download = target.element.querySelector<HTMLAnchorElement>('a[download]')
  const remove = target.kind === 'recording'
    ? target.element.querySelector<HTMLButtonElement>('.take-meta > button')
    : null

  const triggerSecondary = (element: HTMLElement | null) => {
    if (!element) return
    element.click()
    setSecondaryOpen(false)
  }

  return createPortal(
    <>
      <div className="wms-result-actions" aria-label={language === 'ja' ? '再生操作' : 'Playback actions'}>
        <button type="button" className="common-source-play" disabled={busy !== null} onClick={() => void run('play-now')}>
          {busy === 'play-now' ? '…' : language === 'ja' ? '▶ 今すぐ再生' : '▶ Play now'}
        </button>
        <button type="button" className="common-source-queue" disabled={busy !== null} onClick={() => void run('play-next')}>
          {busy === 'play-next' ? '…' : language === 'ja' ? '＋ 次に再生' : '＋ Play next'}
        </button>
      </div>
      <div className="wms-result-secondary">
        <button
          type="button"
          className="wms-result-secondary-trigger"
          aria-label={language === 'ja' ? 'その他の操作' : 'More actions'}
          aria-expanded={secondaryOpen}
          onClick={() => setSecondaryOpen((value) => !value)}
        >
          …
        </button>
        {secondaryOpen && (
          <div className="wms-result-secondary-menu" role="menu" aria-label={language === 'ja' ? 'その他の操作' : 'More actions'}>
            <button type="button" role="menuitem" disabled={!download} onClick={() => triggerSecondary(download)}>
              {language === 'ja' ? '↓ 端末へ保存' : '↓ Save to device'}
            </button>
            {target.kind === 'recording' && (
              <button type="button" role="menuitem" className="is-danger" disabled={!remove || remove.disabled} onClick={() => triggerSecondary(remove)}>
                {language === 'ja' ? '録音を削除' : 'Delete recording'}
              </button>
            )}
          </div>
        )}
      </div>
    </>,
    target.element,
  )
}

function sameTargets(a: SourceTarget[], b: SourceTarget[]) {
  return a.length === b.length && a.every((item, index) => item.element === b[index]?.element && item.kind === b[index]?.kind)
}

export default function ResultSourceActions() {
  const [targets, setTargets] = useState<SourceTarget[]>([])
  const [language, setLanguage] = useState<Language>(loadLanguage)

  useEffect(() => {
    const scan = () => {
      const next: SourceTarget[] = [
        ...Array.from(document.querySelectorAll<HTMLElement>('#recorder-panel .take-card')).map((element) => ({ element, kind: 'recording' as const })),
        ...Array.from(document.querySelectorAll<HTMLElement>('#ffmpeg-tools-panel .ffmpeg-result')).map((element) => ({ element, kind: 'ffmpeg' as const })),
      ]
      setTargets((current) => sameTargets(current, next) ? current : next)
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handleLanguage = (event: Event) => {
      const next = (event as CustomEvent<{ language?: Language }>).detail?.language
      if (next === 'ja' || next === 'en') setLanguage(next)
    }
    window.addEventListener('wms:language-change', handleLanguage)
    return () => window.removeEventListener('wms:language-change', handleLanguage)
  }, [])

  return <>{targets.map((target, index) => (
    <ResultActions key={`${target.kind}-${index}`} target={target} language={language} />
  ))}</>
}
