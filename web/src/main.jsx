import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Inter, the face Starlit sets lyrics in; its optical-size axis gives the Display cut at headline sizes
import '@fontsource-variable/inter/opsz.css'
// static Inter for the outlined wordmark: its letters are single shapes, so an outline has no inner lines
import '@fontsource/inter/800.css'
import './styles.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
