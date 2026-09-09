import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { listMediaLibraryItems, type StoredMediaLibraryItem } from './mediaLibraryDb'

function emitSystem(text: string, source = 'WMS', level: 'info' | 'success' | 'error' = 'info') {
  window.dispatchEvent(new CustomEvent('wms:system-message', { detail: { text, source, level } }))
}

function findCanonicalRow(record: StoredMediaLibraryItem) {
  const rows = Array.from(document.querySelectorAll<HTMLElement>('#library-panel .playlist-row'))
  const matches = rows.filter((row) => row.querySelector<HTMLElement>('.playlist-name')?.textContent?.trim() === record.name)
  return matches.length === 1 ? matches[0] : null
}

export default function InterfaceSimplifier() {
  const [libraryTarget, setLibraryTarget] = useState<Element | null>(null)
  const [youtubeTarget, setYoutubeTarget] = useState<Element | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openSavedId, setOpenSavedId] = useState<string | null>(null)
  const [savedMedia, setSavedMedia] = useState<StoredMediaLibraryItem[]>([])

  useEffect(() => {
    setLibraryTarget(document.querySelector('#library-panel'))
    setYoutubeTarget(document.querySelector('#youtube-provider-panel .youtube-url-form'))
  }, [])

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const records = await listMediaLibraryItems()
        if (!cancelled) setSavedMedia(records)
      } catch {
        // The existing library error path will surface failures in the system bar.
      }
    }

    void refresh()
    const timer = window.setInterval(() => void refresh(), 1800)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  useEffect(() => {
    const form = youtubeTarget instanceof HTMLFormElement ? youtubeTarget : null
    const input = form?.querySelector<HTMLInputElement>('input')
    if (!form || !input) return

    form.classList.add('wms-paste-simplified')
    const onPaste = () => {
      window.setTimeout(() => {
        if (input.value.trim()) {
          form.requestSubmit()
          emitSystem('URLを受け取りました。YouTubeを読み込みます。', 'YouTube', 'success')
        }
      }, 40)
    }
    input.addEventListener('paste', onPaste)
    return () => {
      input.removeEventListener('paste', onPaste)
      form.classList.remove('wms-paste-simplified')
    }
  }, [youtubeTarget])

  const audioRecords = useMemo(
    () => savedMedia.map((record, index) => ({ record, index })).filter(({ record }) => record.kind === 'audio'),
    [savedMedia],
  )

  const clickLibraryInput = (folder = false) => {
    const selector = folder ? '.folder-button input[type="file"]' : '.import-button:not(.folder-button) input[type="file"]'
    document.querySelector<HTMLInputElement>(`#library-panel ${selector}`)?.click()
    if (!folder) emitSystem('端末から複数の音声ファイルを選べます。', 'Library')
  }

  const clickHiddenAction = (selector: string) => {
    const button = document.querySelector<HTMLButtonElement>(`#library-panel ${selector}`)
    if (button && !button.disabled) button.click()
    setMenuOpen(false)
  }

  const playSavedRecord = (catalogIndex: number, name: string) => {
    setOpenSavedId(null)
    document.querySelector<HTMLButtonElement>('#library-panel .all-media-button')?.click()
    window.setTimeout(() => {
      const rows = document.querySelectorAll<HTMLButtonElement>('#library-panel .playlist-list .playlist-item')
      const button = rows[catalogIndex]
      if (button) {
        button.click()
        document.getElementById('player-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        emitSystem(`${name} を選択しました。保存済みライブラリを再生キューへ読み込みました。`, 'Library', 'success')
      }
    }, 80)
  }

  const runSavedAction = (record: StoredMediaLibraryItem, action: 'library' | 'up' | 'down' | 'remove') => {
    const row = findCanonicalRow(record)
    if (!row) {
      emitSystem(`${record.name} は現在の再生キューにないため、この操作はPlayer側から行ってください。`, 'Library')
      setOpenSavedId(null)
      return
    }

    const libraryAction = row.querySelector<HTMLButtonElement>('.library-item-action')
    const queueButtons = Array.from(row.querySelectorAll<HTMLButtonElement>('.queue-order-actions button'))
    const target = action === 'library'
      ? libraryAction
      : action === 'up'
        ? queueButtons[0]
        : action === 'down'
          ? queueButtons[1]
          : queueButtons[2]

    if (target && !target.disabled) target.click()
    setOpenSavedId(null)
  }

  const libraryUi = libraryTarget
    ? createPortal(
        <section className="device-library-browser" aria-label="端末内ライブラリ">
          <div className="device-library-actions">
            <button type="button" className="device-library-primary" onClick={() => clickLibraryInput(false)}>
              <span>♫</span><b>端末の曲を選ぶ</b>
            </button>
            <div className="device-library-more-wrap">
              <button
                type="button"
                className="device-library-more"
                onClick={() => {
                  setOpenSavedId(null)
                  setMenuOpen((value) => !value)
                }}
                aria-label="その他のライブラリ操作"
              >⋯</button>
              {menuOpen && (
                <div className="device-library-menu">
                  <button type="button" onClick={() => { clickLibraryInput(true); setMenuOpen(false) }}>📁 フォルダから選ぶ</button>
                  <button type="button" onClick={() => clickHiddenAction('.save-library-button')}>端末内に保存</button>
                  <button type="button" onClick={() => clickHiddenAction('.clear-library-button')}>一時追加をクリア</button>
                </div>
              )}
            </div>
          </div>

          <div className="device-library-list-heading">
            <strong>保存済みの曲</strong>
            <span>{audioRecords.length}曲</span>
          </div>

          {audioRecords.length ? (
            <div className="device-library-list">
              {audioRecords.map(({ record, index }) => {
                const isOpen = openSavedId === record.id
                return (
                  <div className="device-library-item" key={record.id}>
                    <button type="button" className="device-library-item-main" onClick={() => playSavedRecord(index, record.name)}>
                      <span>▶</span>
                      <strong>{record.name}</strong>
                    </button>
                    <button
                      type="button"
                      className="device-library-item-more"
                      aria-label={`${record.name} のその他の操作`}
                      aria-expanded={isOpen}
                      onClick={() => {
                        setMenuOpen(false)
                        setOpenSavedId(isOpen ? null : record.id)
                      }}
                    >…</button>
                    {isOpen && (
                      <div className="device-library-item-menu" role="menu" aria-label={`${record.name} のその他の操作`}>
                        <button type="button" role="menuitem" className="is-danger" onClick={() => runSavedAction(record, 'library')}>端末ライブラリから削除</button>
                        <button type="button" role="menuitem" onClick={() => runSavedAction(record, 'up')}>↑ 上へ移動</button>
                        <button type="button" role="menuitem" onClick={() => runSavedAction(record, 'down')}>↓ 下へ移動</button>
                        <button type="button" role="menuitem" onClick={() => runSavedAction(record, 'remove')}>× 再生キューから外す</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <button type="button" className="device-library-empty" onClick={() => clickLibraryInput(false)}>
              端末の音声を複数選択すると、ここからまとめて選曲できます。
            </button>
          )}
        </section>,
        libraryTarget,
      )
    : null

  const youtubePrompt = youtubeTarget
    ? createPortal(
        <div className="youtube-paste-prompt" aria-hidden="true">
          <span>🔗</span>
          <div><strong>YouTube URL</strong><small>ここに貼り付けるだけ</small></div>
        </div>,
        youtubeTarget,
      )
    : null

  return <>{libraryUi}{youtubePrompt}</>
}
