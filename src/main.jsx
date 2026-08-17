import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { ExecutionProvider } from './context/ExecutionContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <ExecutionProvider>
        <App />
      </ExecutionProvider>
    </ThemeProvider>
  </StrictMode>,
)
