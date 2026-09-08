import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import YouTubeProviderPanel from './YouTubeProviderPanel'
import ToolDeckEnhancer from './ToolDeckEnhancer'
import { installPlaybackArbitration } from './playbackArbiter'
import './styles.css'
import './mobile-overrides.css'
import './recorder.css'
import './tab-recorder.css'
import './ffmpeg-tools.css'
import './library.css'
import './tool-descriptions.css'
import './player-visuals.css'
import './reorder-resume.css'
import './named-playlists.css'
import './youtube-provider.css'
import './ui-v2.css'

installPlaybackArbitration()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
  })
}

function Root() {
  const [libraryRevision, setLibraryRevision] = useState(0)

  return (
    <>
      <App key={libraryRevision} />
      <YouTubeProviderPanel onMediaImported={() => setLibraryRevision((value) => value + 1)} />
      <ToolDeckEnhancer />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
