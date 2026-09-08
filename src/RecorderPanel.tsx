import { useEffect, useRef, useState } from 'react'
import {
  deleteRecordingTake,
  listRecordingTakes,
  saveRecordingTake,
  type StoredRecordingTake,
} from './recordingDb'
import {
  MEDIA_LIBRARY_MAX_ITEM_BYTES,
  saveMediaLibraryItems,
  type StoredMediaLibraryItem,
} from './mediaLibraryDb'

type RecordingTake = Omit<StoredRecordingTake, 'blob'> & {
  url: string
}

type CaptureMode = 'mic' | 'tab' | 'mix'

type RecorderPanelProps = {
  sourceName: string | null
  getSourcePosition: () => number
  startSourcePlayback: () => Promise<void>
  onRecordingChange?: (recording: boolean) => void
  onMediaLibraryChanged?: () => void
}

type TabCaptureSupport = {
  supported: boolean
  status: string
  detail: string
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatPosition(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const minutes = Math.floor(safe / 60)
  const rest = Math.floor(safe % 60)
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

function chooseMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]

  if (!('MediaRecorder' in window)) return ''
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

function extensionFor(mimeType: string) {
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'webm'
}

function makePlaybackTake(stored: StoredRecordingTake): RecordingTake {
  return {
    id: stored.id,
    name: stored.name,
    mimeType: stored.mimeType,
    durationMs: stored.durationMs,
    sourceName: stored.sourceName,
    sourcePosition: stored.sourcePosition,
    createdAt: stored.createdAt,
    url: URL.createObjectURL(stored.blob),
  }
}

function microphoneConstraints(): MediaTrackConstraints {
  return {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  }
}

function captureModeLabel(mode: CaptureMode) {
  if (mode === 'tab') return 'Current tab audio'
  if (mode === 'mix') return 'Current tab + microphone'
  return 'Microphone'
}

function detectTabCaptureSupport(): TabCaptureSupport {
  if (!window.isSecureContext) {
    return {
      supported: false,
      status: 'HTTPS接続が必要です',
      detail: 'タブ音声キャプチャには安全なHTTPS接続が必要です。GitHub PagesなどのHTTPS環境で開いてください。',
    }
  }

  if (!navigator.mediaDevices?.getDisplayMedia) {
    return {
      supported: false,
      status: 'この端末では利用できません',
      detail: 'この端末・ブラウザには画面共有APIがありません。Android Chrome / PWAなどでは利用できない場合があります。PC版Chrome / Edgeでの利用を推奨します。',
    }
  }

  return {
    supported: true,
    status: '利用可能',
    detail: '画面共有APIを検出しました。録音開始後に「このタブ」と「タブの音声を共有」を選択してください。',
  }
}

export default function RecorderPanel({
  sourceName,
  getSourcePosition,
  startSourcePlayback,
  onRecordingChange,
  onMediaLibraryChanged,
}: RecorderPanelProps) {
  const [takes, setTakes] = useState<RecordingTake[]>([])
  const [captureMode, setCaptureMode] = useState<CaptureMode>('mic')
  const [isRecording, setIsRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [loadingTakes, setLoadingTakes] = useState(true)
  const [storageReady, setStorageReady] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const captureStreamsRef = useRef<MediaStream[]>([])
  const mixContextRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const sourceNameRef = useRef<string | null>(null)
  const sourcePositionRef = useRef(0)
  const captureModeRef = useRef<CaptureMode>('mic')
  const timerRef = useRef<number | null>(null)
  const takeUrlsRef = useRef<string[]>([])
  const takeCountRef = useRef(0)

  const tabCaptureSupport = detectTabCaptureSupport()
  const tabCaptureSupported = tabCaptureSupport.supported

  useEffect(() => {
    onRecordingChange?.(isRecording)
  }, [isRecording, onRecordingChange])

  useEffect(() => {
    let cancelled = false

    const restoreTakes = async () => {
      if (!('indexedDB' in window)) {
        setLoadingTakes(false)
        setStorageReady(false)
        return
      }

      try {
        const storedTakes = await listRecordingTakes()
        if (cancelled) return

        const restored = storedTakes.map(makePlaybackTake)
        takeUrlsRef.current = restored.map((take) => take.url)
        takeCountRef.current = restored.length
        setTakes(restored)
        setStorageReady(true)
      } catch {
        if (!cancelled) {
          setError('保存済み録音を読み込めませんでした。録音はこの画面では利用できますが、再読み込み後に残らない可能性があります。')
          setStorageReady(false)
        }
      } finally {
        if (!cancelled) setLoadingTakes(false)
      }
    }

    void restoreTakes()

    return () => {
      cancelled = true
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
      if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop()
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
      captureStreamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()))
      void mixContextRef.current?.close()
      takeUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const releaseCapture = () => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
    recordingStreamRef.current = null
    captureStreamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()))
    captureStreamsRef.current = []
    const context = mixContextRef.current
    mixContextRef.current = null
    if (context && context.state !== 'closed') void context.close()
  }

  const getMicStream = async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('MIC_UNAVAILABLE')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: microphoneConstraints() })
    captureStreamsRef.current.push(stream)
    return stream
  }

  const getTabStream = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('TAB_UNAVAILABLE')
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    })
    captureStreamsRef.current.push(stream)

    if (!stream.getAudioTracks().length) {
      stream.getTracks().forEach((track) => track.stop())
      captureStreamsRef.current = captureStreamsRef.current.filter((item) => item !== stream)
      throw new Error('NO_TAB_AUDIO')
    }
    return stream
  }

  const buildRecordingStream = async (mode: CaptureMode): Promise<MediaStream> => {
    if (mode === 'mic') return getMicStream()

    const tabStream = await getTabStream()
    if (mode === 'tab') return new MediaStream(tabStream.getAudioTracks())

    const micStream = await getMicStream()
    const context = new AudioContext()
    mixContextRef.current = context
    const destination = context.createMediaStreamDestination()
    context.createMediaStreamSource(tabStream).connect(destination)
    context.createMediaStreamSource(micStream).connect(destination)
    if (context.state === 'suspended') await context.resume()
    return destination.stream
  }

  const saveTabCaptureToLibrary = async (
    storedTake: StoredRecordingTake,
    mode: CaptureMode,
  ) => {
    if (mode === 'mic') return false
    if (storedTake.blob.size > MEDIA_LIBRARY_MAX_ITEM_BYTES) {
      setError('録音は作成できましたが、Local Libraryの1ファイル上限を超えたためLibraryには追加していません。')
      return false
    }

    const extension = extensionFor(storedTake.mimeType)
    const label = mode === 'mix' ? 'Tab + mic capture' : 'Tab audio capture'
    const libraryItem: StoredMediaLibraryItem = {
      id: `recording-${storedTake.id}`,
      name: `${label} · ${new Date(storedTake.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.${extension}`,
      kind: 'audio',
      mimeType: storedTake.mimeType,
      relativePath: null,
      savedAt: storedTake.createdAt,
      size: storedTake.blob.size,
      blob: storedTake.blob,
    }

    try {
      await saveMediaLibraryItems([libraryItem])
      setNotice('タブ音声をLocal Libraryへ追加しました。Playerから画面OFF再生できます。')
      onMediaLibraryChanged?.()
      return true
    } catch {
      setError('録音は作成できましたが、Local Libraryへの追加に失敗しました。Save to deviceで退避してください。')
      return false
    }
  }

  const startRecording = async (mode: CaptureMode, playSource: boolean) => {
    if (isRecording || starting) return
    setStarting(true)
    setError(null)
    setNotice(null)

    if (!('MediaRecorder' in window)) {
      setError('このブラウザではMediaRecorderを利用できません。PC版Chrome / Edgeまたは対応PWAで確認してください。')
      setStarting(false)
      return
    }

    if ((mode === 'tab' || mode === 'mix') && !tabCaptureSupported) {
      setError(`タブ音声キャプチャを利用できません。${tabCaptureSupport.detail}`)
      setStarting(false)
      return
    }

    try {
      captureModeRef.current = mode
      const stream = await buildRecordingStream(mode)
      recordingStreamRef.current = stream

      if (!stream.getAudioTracks().length) throw new Error('NO_AUDIO')

      if (mode === 'mic') {
        sourceNameRef.current = playSource && sourceName ? sourceName : null
        sourcePositionRef.current = getSourcePosition()
        if (playSource && sourceName) {
          await startSourcePlayback()
          sourcePositionRef.current = getSourcePosition()
        }
      } else {
        sourceNameRef.current = captureModeLabel(mode)
        sourcePositionRef.current = 0
      }

      const mimeType = chooseMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      startedAtRef.current = Date.now()
      setElapsedMs(0)

      captureStreamsRef.current.forEach((captureStream) => {
        captureStream.getTracks().forEach((track) => {
          track.addEventListener('ended', () => {
            const activeRecorder = recorderRef.current
            if (activeRecorder && activeRecorder.state !== 'inactive') activeRecorder.stop()
          }, { once: true })
        })
      })

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      })

      recorder.addEventListener('stop', () => {
        void (async () => {
          stopTimer()
          const durationMs = Math.max(0, Date.now() - startedAtRef.current)
          const finalMime = recorder.mimeType || mimeType || 'audio/webm'
          const blob = new Blob(chunksRef.current, { type: finalMime })

          if (blob.size > 0) {
            const now = Date.now()
            const stamp = new Date(now).toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
            const takeNumber = takeCountRef.current + 1
            const mode = captureModeRef.current
            const prefix = mode === 'tab' ? 'Tab' : mode === 'mix' ? 'Mix' : 'Take'
            const storedTake: StoredRecordingTake = {
              id: `${now}-${Math.random().toString(36).slice(2)}`,
              name: `${prefix} ${String(takeNumber).padStart(2, '0')} · ${stamp}`,
              mimeType: finalMime,
              durationMs,
              sourceName: sourceNameRef.current,
              sourcePosition: sourcePositionRef.current,
              createdAt: now,
              blob,
            }

            if ('indexedDB' in window) {
              try {
                await saveRecordingTake(storedTake)
                setStorageReady(true)
              } catch {
                setStorageReady(false)
                setError('録音は作成できましたが、端末内への永続保存に失敗しました。Save to deviceで退避してください。')
              }
            }

            const playbackTake = makePlaybackTake(storedTake)
            takeUrlsRef.current.push(playbackTake.url)
            takeCountRef.current += 1
            setTakes((previous) => [playbackTake, ...previous])
            await saveTabCaptureToLibrary(storedTake, mode)
          }

          chunksRef.current = []
          recorderRef.current = null
          releaseCapture()
          setElapsedMs(durationMs)
          setIsRecording(false)
        })()
      })

      recorder.addEventListener('error', () => {
        setError('録音中にエラーが発生しました。共有・マイク権限とブラウザ状態を確認してください。')
        stopTimer()
        releaseCapture()
        setIsRecording(false)
      })

      recorder.start(1000)
      setIsRecording(true)
      timerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current)
      }, 200)
    } catch (cause) {
      releaseCapture()
      const name = cause instanceof DOMException ? cause.name : ''
      const message = cause instanceof Error ? cause.message : ''
      if (message === 'NO_TAB_AUDIO') {
        setError('共有した画面に音声トラックがありません。「このタブ」を選び、「タブの音声を共有」をONにして再試行してください。')
      } else if (message === 'TAB_UNAVAILABLE') {
        setError(`タブ音声キャプチャを利用できません。${tabCaptureSupport.detail}`)
      } else if (message === 'MIC_UNAVAILABLE') {
        setError('このブラウザではマイク録音を利用できません。')
      } else if (name === 'NotAllowedError') {
        setError(mode === 'mic' ? 'マイク権限が許可されていません。サイト設定からマイクを許可してください。' : '画面共有がキャンセルされたか許可されませんでした。現在のタブを選択して音声共有を有効にしてください。')
      } else {
        setError(mode === 'mic' ? 'マイクを開始できませんでした。別のブラウザまたはPWAでも確認してください。' : 'タブ音声録音を開始できませんでした。PC版Chrome / Edgeで「このタブ」と音声共有を選択してください。')
      }
    } finally {
      setStarting(false)
    }
  }

  const stopRecording = () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
  }

  const removeTake = async (id: string) => {
    setError(null)
    const target = takes.find((take) => take.id === id)
    if (!target) return

    if ('indexedDB' in window) {
      try {
        await deleteRecordingTake(id)
      } catch {
        setError('端末内の録音を削除できませんでした。再読み込み後に再表示される可能性があります。')
        return
      }
    }

    URL.revokeObjectURL(target.url)
    takeUrlsRef.current = takeUrlsRef.current.filter((url) => url !== target.url)
    takeCountRef.current = Math.max(0, takeCountRef.current - 1)
    setTakes((previous) => previous.filter((take) => take.id !== id))
  }

  return (
    <section id="recorder-panel" className="glass-panel recorder-panel">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">LOCAL RECORDER</p>
          <h2>Mic / tab audio</h2>
        </div>
        <span className={`record-status ${isRecording ? 'is-recording' : ''}`}>
          {isRecording ? 'REC' : storageReady ? 'SAVED' : 'READY'}
        </span>
      </div>

      <div className="record-mode-picker" role="group" aria-label="録音ソース">
        <button type="button" className={captureMode === 'mic' ? 'is-active' : ''} disabled={isRecording || starting} onClick={() => setCaptureMode('mic')}>
          <strong>Mic</strong><span>マイク</span>
        </button>
        <button
          type="button"
          className={captureMode === 'tab' ? 'is-active' : ''}
          disabled={isRecording || starting || !tabCaptureSupported}
          onClick={() => setCaptureMode('tab')}
          aria-describedby="tab-capture-status"
          title={!tabCaptureSupported ? tabCaptureSupport.detail : undefined}
        >
          <strong>Tab audio</strong><span>{tabCaptureSupported ? 'PCタブ音声' : '利用不可'}</span>
        </button>
        <button
          type="button"
          className={captureMode === 'mix' ? 'is-active' : ''}
          disabled={isRecording || starting || !tabCaptureSupported}
          onClick={() => setCaptureMode('mix')}
          aria-describedby="tab-capture-status"
          title={!tabCaptureSupported ? tabCaptureSupport.detail : undefined}
        >
          <strong>Tab + Mic</strong><span>{tabCaptureSupported ? 'ミックス' : '利用不可'}</span>
        </button>
      </div>

      <div id="tab-capture-status" className={`tab-capture-capability ${tabCaptureSupported ? 'is-supported' : 'is-unavailable'}`} role="status">
        <strong>Tab audio · {tabCaptureSupport.status}</strong>
        <span>{tabCaptureSupport.detail}</span>
      </div>

      <div className="record-source-card">
        <span>Source</span>
        <strong>{captureMode === 'mic' ? sourceName ?? 'Microphone only' : captureModeLabel(captureMode)}</strong>
        <small>
          {captureMode === 'mic'
            ? sourceName ? `local player current ${formatPosition(getSourcePosition())}` : 'マイク単体で録音できます'
            : tabCaptureSupported ? 'PCで現在のタブ＋「タブの音声を共有」を選択' : '上のTab audio対応状況を確認してください'}
        </small>
      </div>

      <div className={`record-clock ${isRecording ? 'is-recording' : ''}`}>
        <span className="record-dot" aria-hidden="true" />
        <strong>{formatDuration(elapsedMs)}</strong>
      </div>

      <div className="record-actions">
        {!isRecording ? (
          captureMode === 'mic' ? (
            <>
              <button type="button" onClick={() => void startRecording('mic', false)} disabled={starting}>
                {starting ? 'Starting…' : '● Record mic'}
              </button>
              <button
                type="button"
                className="record-primary"
                onClick={() => void startRecording('mic', true)}
                disabled={starting || !sourceName}
              >
                ▶ + ● Play & Record
              </button>
            </>
          ) : (
            <button
              type="button"
              className="record-primary record-tab-primary"
              onClick={() => void startRecording(captureMode, false)}
              disabled={starting || !tabCaptureSupported}
            >
              {starting ? 'Choose tab…' : captureMode === 'mix' ? '▣ Record tab + mic' : '▣ Record current tab audio'}
            </button>
          )
        ) : (
          <button type="button" className="record-stop" onClick={stopRecording}>
            ■ Stop & Save
          </button>
        )}
      </div>

      {error && <p className="record-error" role="alert">{error}</p>}
      {notice && <p className="record-notice">{notice}</p>}
      <p className="record-note">
        Tab audioはPC版Chrome / Edge向けです。YouTubeを公式プレーヤーで再生しながら「このタブ」と「タブの音声を共有」を選ぶと、再生音を端末内で録音できます。Tab / Tab + Mic録音はSaved takesに加えてLocal Libraryにも保存します。Androidではブラウザ実装により利用できない場合があります。保存・録音は権利または許可のあるコンテンツに限ってください。
      </p>

      <div className="take-list">
        <div className="take-list-heading">
          <strong>Saved takes</strong>
          <span>{loadingTakes ? '…' : takes.length}</span>
        </div>

        {loadingTakes ? (
          <div className="take-empty">端末内の録音を読み込んでいます…</div>
        ) : takes.length ? takes.map((take) => (
          <article className="take-card" key={take.id}>
            <div className="take-meta">
              <div>
                <strong>{take.name}</strong>
                <span>{formatDuration(take.durationMs)} · {take.mimeType.split(';')[0]}</span>
              </div>
              <button type="button" onClick={() => void removeTake(take.id)} aria-label={`${take.name}を削除`}>×</button>
            </div>
            {take.sourceName && (
              <p className="take-source">{take.sourceName}{take.sourcePosition > 0 ? ` · ${formatPosition(take.sourcePosition)} から` : ''}</p>
            )}
            <audio controls preload="metadata" src={take.url} />
            <a
              className="take-download"
              href={take.url}
              download={`web-media-studio-${take.id}.${extensionFor(take.mimeType)}`}
            >
              ↓ Save to device
            </a>
          </article>
        )) : (
          <div className="take-empty">録音を停止すると、この端末内にテイクを保存します。</div>
        )}
      </div>
    </section>
  )
}
