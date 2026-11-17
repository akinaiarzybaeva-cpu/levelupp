import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './design.css'
import './mobile.css'
import './light.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
