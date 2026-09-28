import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/tokens.css'
import { CaptureApp } from './CaptureApp'

const root = document.getElementById('root')
if (root === null) throw new Error('Élément #root introuvable')

createRoot(root).render(
  <StrictMode>
    <CaptureApp />
  </StrictMode>
)
