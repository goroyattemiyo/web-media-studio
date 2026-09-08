import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import YouTubeProviderPanel from './YouTubeProviderPanel'
import YouTubeQueueActions from './YouTubeQueueActions'
import UnifiedPlaybackQueue from './UnifiedPlaybackQueue'
import PlayerPlaylistActions from './PlayerPlaylistActions'
import SettingsPanel from './SettingsPanel'
import ResultSourceActions from './ResultSourceActions'
import ToolDeckEnhancer from './ToolDeckEnhancer'
import SkinVisualEnhancer from './SkinVisualEnhancer'
import InfoTipsEnhancer from './InfoTipsEnhancer'
import ABLoopLabelsEnhancer from './ABLoopLabelsEnhancer'
import LanguageEnhancer from './LanguageEnhancer'
import ColabFirstRunGuide from './ColabFirstRunGuide'
import SystemMessageCenter from './SystemMessageCenter'
import InterfaceSimplifier from './InterfaceSimplifier'
import VisualPolishEnhancer from './VisualPolishEnhancer'
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
import './immersive-skins.css'
import './reorder-resume.css'
import './named-playlists.css'
import './youtube-provider.css'
import './youtube-playlist-actions.css'
import './mixed-playlists.css'
import './unified-play-queue.css'
import './info-tips.css'
import './ab-loop-labels.css'
import './language-switch.css'
import './colab-first-run-guide.css'
import './system-message-center.css'
import './interface-simplifier.css'
import './ui-v2.css'
import './visual-polish.css'
import './operation-system.css'
import './result-source-actions.css'

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
      <YouTubeQueueActions />
      <UnifiedPlaybackQueue />
      <PlayerPlaylistActions />
      <ToolDeckEnhancer />
      <SkinVisualEnhancer />
      <InfoTipsEnhancer />
      <ABLoopLabelsEnhancer />
      <LanguageEnhancer />
      <ColabFirstRunGuide />
      <SystemMessageCenter />
      <InterfaceSimplifier />
      <VisualPolishEnhancer />
      <SettingsPanel />
      <ResultSourceActions />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
