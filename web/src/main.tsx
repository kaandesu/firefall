import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { useMission } from './live/store'

// Dev hook for automated walkthroughs (screenshots / GIFs).
if (import.meta.env.DEV) (window as unknown as { __mission: typeof useMission }).__mission = useMission

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
