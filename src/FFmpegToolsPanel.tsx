import { ChangeEvent, useRef, useState } from 'react'
import type { FFmpeg } from '@ffmpeg/ffmpeg'

type OutputMode = 'original' | 'mp3' | 'wav'

type ConversionResult = {
  name: string
  url: string
  mimeType: string
  size: number
}

const CORE_BASE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'
const MAX_MOBILE_FILE_BYTES = 250 * 1024 * 1024

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(exponent === 0 ? 0 : value >= 10 ? 1 : 2)} ${units[exponent]}`
}

function safeBaseName(name: string) {
  const withoutExtension = name.replace(/\.[^.]+$/, '') || 'audio'
  return withoutExtension.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'audio'
}

function inputExtension(file: File) {
  const match = file.name.toLowerCase().match(/\.([a-z0-9]{1,8})$/)
  return match?.[1] ?? (file.type.includes('mp4') ? 'mp4' : 'media')
}

function originalOutput(file: File, baseName: string) {
  const lower = file.name.toLowerCase()

  if (file.type.includes('mp4') || file.type.includes('quicktime') || /\.(mp4|mov|m4v)$/.test(lower)) {
    return { fileName: `${baseName}.m4a`, mimeType: 'audio/mp4' }
  }

  if (file.type.includes('webm') || /\.webm$/.test(lower)) {
    return { fileName: `${baseName}.webm`, mimeType: 'audio/webm' }
  }

  return { fileName: `${baseName}.mka`, mimeType: 'audio/x-matroska' }
}

export default function FFmpegToolsPanel() {
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [outputMode, setOutputMode] = useState<OutputMode>('original')
  const [engineState, setEngineState] = useState<'idle' | 'loading' | 'ready'>('idle')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('FFmpegは必要になるまで読み込みません。')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ConversionResult | null>(null)

  const ffmpegRef = useRef<FFmpeg | null>(null)
  const resultUrlRef = useRef<string | null>(null)

  const clearResult = () => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = null
    setResult(null)
  }

  const selectSource = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    clearResult()
    setError(null)
    setProgress(0)

    if (!file) {
      setSourceFile(null)
      return
    }

    if (file.size > MAX_MOBILE_FILE_BYTES) {
      setSourceFile(null)
      setError(`現在のモバイルMVPでは ${formatBytes(MAX_MOBILE_FILE_BYTES)} 以下のファイルを選んでください。`)
      event.target.value = ''
      return
    }

    setSourceFile(file)
    setStatus(`${file.name} を選択しました。変換方式を選んで実行してください。`)
  }

  const ensureEngine = async () => {
    if (ffmpegRef.current?.loaded) return ffmpegRef.current

    setEngineState('loading')
    setStatus('FFmpeg engineを読み込んでいます。初回は約30MBのダウンロードがあります…')

    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      import('@ffmpeg/util'),
    ])

    const ffmpeg = new FFmpeg()

    ffmpeg.on('progress', ({ progress: nextProgress }) => {
      if (Number.isFinite(nextProgress)) {
        setProgress(Math.max(0, Math.min(1, nextProgress)))
      }
    })

    ffmpeg.on('log', ({ message }) => {
      if (message.trim()) setStatus(message)
    })

    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    })

    ffmpegRef.current = ffmpeg
    setEngineState('ready')
    setStatus('FFmpeg engine ready.')
    return ffmpeg
  }

  const convert = async () => {
    if (!sourceFile || processing) return

    setProcessing(true)
    setError(null)
    setProgress(0)
    clearResult()

    const baseName = safeBaseName(sourceFile.name)
    const inputName = `input-${Date.now()}.${inputExtension(sourceFile)}`
    let outputName = ''
    let outputMimeType = ''

    try {
      const ffmpeg = await ensureEngine()
      const { fetchFile } = await import('@ffmpeg/util')
      await ffmpeg.writeFile(inputName, await fetchFile(sourceFile))

      let args: string[]

      if (outputMode === 'mp3') {
        outputName = `${baseName}.mp3`
        outputMimeType = 'audio/mpeg'
        args = ['-i', inputName, '-map', '0:a:0', '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', outputName]
      } else if (outputMode === 'wav') {
        outputName = `${baseName}.wav`
        outputMimeType = 'audio/wav'
        args = ['-i', inputName, '-map', '0:a:0', '-vn', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', outputName]
      } else {
        const original = originalOutput(sourceFile, baseName)
        outputName = original.fileName
        outputMimeType = original.mimeType
        args = ['-i', inputName, '-map', '0:a:0', '-vn', '-c:a', 'copy', outputName]
      }

      setStatus('音声を抽出しています…')
      const exitCode = await ffmpeg.exec(args)
      if (exitCode !== 0) throw new Error(`FFmpeg exited with code ${exitCode}`)

      const data = await ffmpeg.readFile(outputName)
      if (typeof data === 'string') throw new Error('Unexpected text output from FFmpeg')

      const bytes = new Uint8Array(data)
      const blob = new Blob([bytes.buffer.slice(0)], { type: outputMimeType })
      const url = URL.createObjectURL(blob)
      resultUrlRef.current = url
      setResult({ name: outputName, url, mimeType: outputMimeType, size: blob.size })
      setProgress(1)
      setStatus('音声化が完了しました。再生確認または端末へ保存できます。')

      await Promise.allSettled([
        ffmpeg.deleteFile(inputName),
        ffmpeg.deleteFile(outputName),
      ])
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(
        outputMode === 'original'
          ? `無変換抽出に失敗しました。この動画の音声コーデックと出力コンテナが合わない可能性があります。MP3またはWAVを試してください。 (${message})`
          : `音声化に失敗しました。ファイル形式・空きメモリ・ブラウザ状態を確認してください。 (${message})`,
      )
      setStatus('FFmpeg処理を完了できませんでした。')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <section id="ffmpeg-tools-panel" className="glass-panel ffmpeg-panel">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">FFMPEG AUDIO TOOLS</p>
          <h2>Video → Audio</h2>
        </div>
        <span className={`ffmpeg-status ${engineState}`}>{engineState === 'ready' ? 'READY' : engineState === 'loading' ? 'LOADING' : 'ON DEMAND'}</span>
      </div>

      <label className="ffmpeg-dropzone">
        <span className="ffmpeg-drop-icon" aria-hidden="true">✦</span>
        <strong>{sourceFile ? sourceFile.name : 'スマホ動画を選択'}</strong>
        <small>{sourceFile ? `${sourceFile.type || 'unknown type'} · ${formatBytes(sourceFile.size)}` : 'MP4 / MOV / WebM など · 現在は250MBまで'}</small>
        <input type="file" accept="video/*,audio/*" onChange={selectSource} />
      </label>

      <div className="ffmpeg-presets" role="radiogroup" aria-label="出力形式">
        <button type="button" className={outputMode === 'original' ? 'is-active' : ''} onClick={() => setOutputMode('original')}>
          <strong>Original</strong>
          <span>再圧縮なし</span>
        </button>
        <button type="button" className={outputMode === 'mp3' ? 'is-active' : ''} onClick={() => setOutputMode('mp3')}>
          <strong>MP3</strong>
          <span>192 kbps</span>
        </button>
        <button type="button" className={outputMode === 'wav' ? 'is-active' : ''} onClick={() => setOutputMode('wav')}>
          <strong>WAV</strong>
          <span>48kHz / 16bit</span>
        </button>
      </div>

      <button className="ffmpeg-run" type="button" onClick={() => void convert()} disabled={!sourceFile || processing}>
        {processing ? 'Processing…' : '音声化する'}
      </button>

      {(processing || progress > 0) && (
        <div className="ffmpeg-progress" aria-live="polite">
          <div><span>Progress</span><strong>{Math.round(progress * 100)}%</strong></div>
          <progress max="1" value={progress} />
        </div>
      )}

      <p className="ffmpeg-message">{status}</p>
      {error && <p className="ffmpeg-error" role="alert">{error}</p>}

      {result && (
        <div className="ffmpeg-result">
          <div>
            <span>OUTPUT</span>
            <strong>{result.name}</strong>
            <small>{result.mimeType} · {formatBytes(result.size)}</small>
          </div>
          <audio controls preload="metadata" src={result.url} />
          <a href={result.url} download={result.name}>↓ Save to device</a>
        </div>
      )}

      <p className="ffmpeg-note">
        処理は端末内ブラウザで行い、選んだ動画をサーバーへアップロードしません。GitHub PagesではSingle-thread版FFmpegを使用します。
      </p>
    </section>
  )
}
