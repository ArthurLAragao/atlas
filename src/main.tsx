import './app/register-pwa'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { usePreferences } from './app/preferences-store'
import { reduceEffect, resolveTheme } from './lib/preferences'

// Apply saved appearance before the first React paint.
const { preferences } = usePreferences.getState()
document.documentElement.dataset.theme = resolveTheme(
  preferences.theme,
  window.matchMedia('(prefers-color-scheme: dark)').matches,
)
document.documentElement.dataset.accent = preferences.accent
document.documentElement.dataset.solid = String(
  reduceEffect(
    preferences.transparency,
    window.matchMedia('(prefers-reduced-transparency: reduce)').matches,
  ),
)
document.documentElement.dataset.motion = preferences.motion
document.documentElement.dataset.transparency = preferences.transparency

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
