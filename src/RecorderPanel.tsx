import { useEffect, useRef, useState } from 'react'

type RecordingTake = {
  id: string
  name: string
  url: string
  mimeType: string
  durationMs: number
  sourceName: string | null
  sourcePosition: number
  createdAt: Date
}

type RecorderPanelProps = {
  sourceName: string | null
  getSourcePosition: () => number
  startSourcePlayback: () => Promise<void>
  onRecordingChange?: (recording: boolean) => void
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

export default function RecorderPanel({
  sourceName,
  getSourcePosition,
  startSourcePlayback,
  onRecordingChange,
}: RecorderPanelProps) {
  const [takes, setTakes] = useState<RecordingTake[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const sourceNameRef = useRef<string | null>(null)
  const sourcePositionRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const takeUrlsRef = useRef<string[]>([])

  useEffect(() => {
    onRecordingChange?.(isRecording)
  }, [isRecording, onRecordingChange])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
      if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      takeUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const releaseMic = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const startRecording = async (playSource: boolean) => {
    if (isRecording || starting) return
    setStarting(true)
    setError(null)

    if (!navigator.mediaDevices?.getUserMedia || !('MediaRecorder' in window)) {
      setError('このブラウザではマイク録音を利用できません。Chrome / PWA で確認してください。')
      setStarting(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      streamRef.current = stream
      sourceNameRef.current = sourceName
      sourcePositionRef.current = getSourcePosition()

      if (playSource && sourceName) {
        await startSourcePlayback()
        sourcePositionRef.current = getSourcePosition()
      }

      const mimeType = chooseMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      startedAtRef.current = Date.now()
      setElapsedMs(0)

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      })

      recorder.addEventListener('stop', () => {
        stopTimer()
        const durationMs = Math.max(0, Date.now() - startedAtRef.current)
        const finalMime = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: finalMime })

        if (blob.size > 0) {
          const url = URL.createObjectURL(blob)
          takeUrlsRef.current.push(url)
          const now = new Date()
          const stamp = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          const takeNumber = takes.length + 1

          setTakes((previous) => [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              name: `Take ${String(takeNumber).padStart(2, '0')} · ${stamp}`,
              url,
              mimeType: finalMime,
              durationMs,
              sourceName: sourceNameRef.current,
              sourcePosition: sourcePositionRef.current,
              createdAt: now,
            },
            ...previous,
          ])
        }

        chunksRef.current = []
        recorderRef.current = null
        releaseMic()
        setElapsedMs(durationMs)
        setIsRecording(false)
      })

      recorder.addEventListener('error', () => {
        setError('録音中にエラーが発生しました。マイク権限とブラウザ状態を確認してください。')
        stopTimer()
        releaseMic()
        setIsRecording(false)
      })

      recorder.start(1000)
      setIsRecording(true)
      timerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current)
      }, 200)
    } catch (cause) {
      releaseMic()
      const name = cause instanceof DOMException ? cause.name : ''
      if (name === 'NotAllowedError') {
        setError('マイク権限が許可されていません。サイト設定からマイクを許可してください。')
      } else {
        setError('マイクを開始できませんでした。別のブラウザまたはPWAでも確認してください。')
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

  const removeTake = (id: string) => {
    setTakes((previous) => {
      const target = previous.find((take) => take.id === id)
      if (target) {
        URL.revokeObjectURL(target.url)
        takeUrlsRef.current = takeUrlsRef.current.filter((url) => url !== target.url)
      }
      return previous.filter((take) => take.id !== id)
    })
  }

  return (
    <section id="recorder-panel" className="glass-panel recorder-panel">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">MIC RECORDER</p>
          <h2>Practice takes</h2>
        </div>
        <span className={`record-status ${isRecording ? 'is-recording' : ''}`}>
          {isRecording ? 'REC' : 'READY'}
        </span>
      </div>

      <div className="record-source-card">
        <span>Source</span>
        <strong>{sourceName ?? 'No playback source'}</strong>
        <small>{sourceName ? `current ${formatPosition(getSourcePosition())}` : 'マイク単体で録音できます'}</small>
      </div>

      <div className={`record-clock ${isRecording ? 'is-recording' : ''}`}>
        <span className="record-dot" aria-hidden="true" />
        <strong>{formatDuration(elapsedMs)}</strong>
      </div>

      <div className="record-actions">
        {!isRecording ? (
          <>
            <button type="button" onClick={() => void startRecording(false)} disabled={starting}>
              {starting ? 'Starting…' : '● Record mic'}
            </button>
            <button
              type="button"
              className="record-primary"
              onClick={() => void startRecording(true)}
              disabled={starting || !sourceName}
            >
              ▶ + ● Play & Record
            </button>
          </>
        ) : (
          <button type="button" className="record-stop" onClick={stopRecording}>
            ■ Stop & Save
          </button>
        )}
      </div>

      {error && <p className="record-error" role="alert">{error}</p>}
      <p className="record-note">伴奏を録音へ直接ミックスせず、端末マイクだけを保存します。練習録音ではイヤホン推奨です。</p>

      <div className="take-list">
        <div className="take-list-heading">
          <strong>Saved takes</strong>
          <span>{takes.length}</span>
        </div>

        {takes.length ? takes.map((take) => (
          <article className="take-card" key={take.id}>
            <div className="take-meta">
              <div>
                <strong>{take.name}</strong>
                <span>{formatDuration(take.durationMs)} · {take.mimeType.split(';')[0]}</span>
              </div>
              <button type="button" onClick={() => removeTake(take.id)} aria-label={`${take.name}を削除`}>×</button>
            </div>
            {take.sourceName && (
              <p className="take-source">{take.sourceName} · {formatPosition(take.sourcePosition)} から</p>
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
          <div className="take-empty">録音を停止すると、この端末上にテイクが表示されます。</div>
        )}
      </div>
    </section>
  )
}
