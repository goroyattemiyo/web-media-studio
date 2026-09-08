import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import YouTubeProviderPanel from './YouTubeProviderPanel'
import YouTubePlaylistActions from './YouTubePlaylistActions'
import YouTubeQueueActions from './YouTubeQueueActions'
import UnifiedPlaybackQueue from './UnifiedPlaybackQueue'
import ToolDeckEnhancer from './ToolDeckEnhancer'
import SkinVisualEnhancer from './SkinVisualEnhancer'
import InfoTipsEnhancer from './InfoTipsEnhancer'
import { installPlaybackArbitration } from './playbackArbiter'
import './styles.css'
import './mobile-overrides.css'
import './recorder.css'
import './tab-recorder.css'
import './ffmpeg-tools.css'
import './library.css'
import './tool-descriptions.css'
import './player-visuals.css'
import './skin-visual-enhancer.css'
import './reorder-resume.css'
import './named-playlists.css'
import './youtube-provider.css'
import './youtube-playlist-actions.css'
import './mixed-playlists.css'
import './unified-play-queue.css'
import './info-tips.css'
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
      <YouTubePlaylistActions />
      <YouTubeQueueActions />
      <UnifiedPlaybackQueue />
      <ToolDeckEnhancer />
      <SkinVisualEnhancer />
      <InfoTipsEnhancer />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
