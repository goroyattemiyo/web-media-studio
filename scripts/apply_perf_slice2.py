from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old[:80]!r}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


app = Path('src/App.tsx')
main = Path('src/main.tsx')
skin = Path('src/SkinVisualEnhancer.tsx')

replace_once(
    app,
    'function App() {',
    "type AppProps = {\n  libraryRevision?: number\n  onMediaLibraryChanged?: () => void\n}\n\nfunction App({ libraryRevision = 0, onMediaLibraryChanged }: AppProps) {",
)

replace_once(
    app,
    '  const resumePositionsRef = useRef<ResumePositions>(loadResumePositions())\n',
    '  const resumePositionsRef = useRef<ResumePositions>(loadResumePositions())\n  const itemsRef = useRef<MediaItem[]>([])\n',
)

replace_once(
    app,
    "  useEffect(() => {\n    folderInputRef.current?.setAttribute('webkitdirectory', '')\n    folderInputRef.current?.setAttribute('directory', '')\n  }, [])\n\n",
    "  useEffect(() => {\n    folderInputRef.current?.setAttribute('webkitdirectory', '')\n    folderInputRef.current?.setAttribute('directory', '')\n  }, [])\n\n  useEffect(() => {\n    itemsRef.current = items\n  }, [items])\n\n",
)

playlist_marker = "  useEffect(() => {\n    let cancelled = false\n\n    const restorePlaylists = async () => {"
external_sync = """  useEffect(() => {\n    if (libraryRevision <= 0) return\n    let cancelled = false\n\n    const syncExternalLibrary = async () => {\n      try {\n        const storedItems = await listMediaLibraryItems()\n        if (cancelled) return\n\n        const existingIds = new Set(itemsRef.current.map((item) => item.id))\n        const additions = storedItems\n          .filter((record) => !existingIds.has(record.id))\n          .map<MediaItem>((record) => {\n            const url = URL.createObjectURL(record.blob)\n            objectUrlsRef.current.push(url)\n            return {\n              id: record.id,\n              name: record.name,\n              kind: record.kind,\n              url,\n              mimeType: record.mimeType,\n              relativePath: record.relativePath,\n              source: 'library',\n              blob: record.blob,\n              persisted: true,\n              savedAt: record.savedAt,\n            }\n          })\n\n        if (additions.length) {\n          setItems((previous) => {\n            const currentIds = new Set(previous.map((item) => item.id))\n            return [...previous, ...additions.filter((item) => !currentIds.has(item.id))]\n          })\n          setSavedCatalog((previous) => {\n            const currentIds = new Set(previous.map((item) => item.id))\n            return [...previous, ...additions.filter((item) => !currentIds.has(item.id))]\n          })\n          setCurrentIndex((index) => (index < 0 ? 0 : index))\n          setLibraryStatus(`${additions.length}件をLibraryへ追加しました。再生は継続しています。`)\n          setLibraryError(null)\n        }\n\n        setSavedBytes(storedItems.reduce((total, item) => total + item.size, 0))\n        await refreshStorageStats()\n      } catch (error) {\n        if (!cancelled) setLibraryError(`Libraryの更新を反映できませんでした: ${errorMessage(error)}`)\n      }\n    }\n\n    void syncExternalLibrary()\n    return () => {\n      cancelled = true\n    }\n  }, [libraryRevision])\n\n"""
replace_once(app, playlist_marker, external_sync + playlist_marker)

replace_once(
    app,
    '            onRecordingChange={setRecordingActive}\n          />',
    '            onRecordingChange={setRecordingActive}\n            onMediaLibraryChanged={onMediaLibraryChanged}\n          />',
)

replace_once(
    main,
    '      <App key={libraryRevision} />',
    '      <App libraryRevision={libraryRevision} onMediaLibraryChanged={() => setLibraryRevision((value) => value + 1)} />',
)

replace_once(
    skin,
    '  const [videoActive, setVideoActive] = useState(false)\n',
    '  const [videoActive, setVideoActive] = useState(false)\n  const [visualRuntimeActive, setVisualRuntimeActive] = useState(true)\n',
)

runtime_marker = "  useEffect(() => {\n    const resumeContext = () => {"
runtime_effect = """  useEffect(() => {\n    const root = document.documentElement\n    const update = () => {\n      const activeTool = root.dataset.wmsActiveTool ?? 'player'\n      setVisualRuntimeActive(document.visibilityState === 'visible' && activeTool === 'player')\n    }\n\n    update()\n    const observer = new MutationObserver(update)\n    observer.observe(root, {\n      attributes: true,\n      attributeFilter: ['data-wms-active-tool', 'data-wms-document-visibility'],\n    })\n    document.addEventListener('visibilitychange', update)\n    return () => {\n      observer.disconnect()\n      document.removeEventListener('visibilitychange', update)\n    }\n  }, [])\n\n"""
replace_once(skin, runtime_marker, runtime_effect + runtime_marker)

replace_once(
    skin,
    '    if (!AUDIO_REACTIVE_MODES.has(visualMode) || !canvasRef.current) return',
    '    if (!AUDIO_REACTIVE_MODES.has(visualMode) || !canvasRef.current || !visualRuntimeActive) return',
)

replace_once(
    skin,
    '  }, [mediaTarget, playing, visualMode, visualTarget])\n',
    '  }, [mediaTarget, playing, visualMode, visualRuntimeActive, visualTarget])\n',
)

print('Applied performance slice 2 transforms successfully.')
