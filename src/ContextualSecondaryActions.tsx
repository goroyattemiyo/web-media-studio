import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type Language = 'ja' | 'en'

function loadLanguage(): Language {
  try {
    return window.localStorage.getItem('wms-language') === 'en' ? 'en' : 'ja'
  } catch {
    return 'ja'
  }
}

function sameElements(a: HTMLElement[], b: HTMLElement[]) {
  return a.length === b.length && a.every((element, index) => element === b[index])
}

function rowId(row: HTMLElement, index: number) {
  if (!row.dataset.wmsSecondaryActionsId) {
    row.dataset.wmsSecondaryActionsId = `secondary-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`
  }
  return row.dataset.wmsSecondaryActionsId
}

function clickOriginal(button: HTMLButtonElement | undefined, close: () => void) {
  if (!button || button.disabled) return
  button.click()
  close()
}

function LocalSecondaryActions({
  row,
  index,
  openId,
  setOpenId,
  language,
}: {
  row: HTMLElement
  index: number
  openId: string | null
  setOpenId: (id: string | null) => void
  language: Language
}) {
  const id = rowId(row, index)
  const libraryAction = row.querySelector<HTMLButtonElement>('.library-item-action') ?? undefined
  const queueButtons = Array.from(row.querySelectorAll<HTMLButtonElement>('.queue-order-actions button'))
  const [moveUp, moveDown, remove] = queueButtons
  const isDelete = libraryAction?.classList.contains('is-delete') ?? false
  const isOpen = openId === id
  const close = () => setOpenId(null)

  return createPortal(
    <>
      <button
        type="button"
        className="contextual-secondary-trigger"
        aria-label={language === 'ja' ? 'その他の操作' : 'More actions'}
        aria-expanded={isOpen}
        onClick={() => setOpenId(isOpen ? null : id)}
      >
        …
      </button>
      {isOpen && (
        <div className="contextual-secondary-menu" role="menu" aria-label={language === 'ja' ? 'その他の操作' : 'More actions'}>
          <button
            type="button"
            role="menuitem"
            className={isDelete ? 'is-danger' : ''}
            disabled={!libraryAction || libraryAction.disabled}
            onClick={() => clickOriginal(libraryAction, close)}
          >
            {isDelete
              ? (language === 'ja' ? '端末ライブラリから削除' : 'Delete from device library')
              : (language === 'ja' ? '端末ライブラリへ保存' : 'Save to device library')}
          </button>
          <button type="button" role="menuitem" disabled={!moveUp || moveUp.disabled} onClick={() => clickOriginal(moveUp, close)}>
            {language === 'ja' ? '↑ 上へ移動' : '↑ Move up'}
          </button>
          <button type="button" role="menuitem" disabled={!moveDown || moveDown.disabled} onClick={() => clickOriginal(moveDown, close)}>
            {language === 'ja' ? '↓ 下へ移動' : '↓ Move down'}
          </button>
          <button type="button" role="menuitem" disabled={!remove || remove.disabled} onClick={() => clickOriginal(remove, close)}>
            {language === 'ja' ? '× 再生キューから外す' : '× Remove from queue'}
          </button>
        </div>
      )}
    </>,
    row,
  )
}

export default function ContextualSecondaryActions() {
  const [rows, setRows] = useState<HTMLElement[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [language, setLanguage] = useState<Language>(loadLanguage)

  useEffect(() => {
    let frame = 0
    const scan = () => {
      frame = 0
      const next = Array.from(document.querySelectorAll<HTMLElement>('#library-panel .playlist-row'))
      setRows((current) => sameElements(current, next) ? current : next)
    }
    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(scan)
    }

    scan()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    const handleLanguage = (event: Event) => {
      const next = (event as CustomEvent<{ language?: Language }>).detail?.language
      if (next === 'ja' || next === 'en') setLanguage(next)
    }
    window.addEventListener('wms:language-change', handleLanguage)
    return () => window.removeEventListener('wms:language-change', handleLanguage)
  }, [])

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      if (!openId) return
      const target = event.target as Element | null
      if (target?.closest('.contextual-secondary-trigger, .contextual-secondary-menu')) return
      setOpenId(null)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    return () => document.removeEventListener('pointerdown', closeOnOutside)
  }, [openId])

  return <>{rows.map((row, index) => (
    <LocalSecondaryActions
      key={rowId(row, index)}
      row={row}
      index={index}
      openId={openId}
      setOpenId={setOpenId}
      language={language}
    />
  ))}</>
}
