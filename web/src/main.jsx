import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Toaster } from './components/ui/sonner'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <>
      <App />
      {/* 全局挂载 Toaster，确保所有页面都能弹出通知 */}
      <Toaster />
    </>
  </StrictMode>,
)
