import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
// Self-hosted: a third-party font stylesheet is a render-blocking round trip
// on every cold open. Imported before index.css so the faces are registered
// before the tokens that reference them.
import '@fontsource-variable/outfit'
import '@fontsource-variable/inter'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
