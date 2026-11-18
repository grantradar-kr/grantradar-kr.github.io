import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// PWA 서비스 워커 등록 (프로덕션 빌드 + https/localhost 환경에서만)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', document.baseURI).toString()
    navigator.serviceWorker.register(swUrl).catch(() => {
      /* 오프라인 캐시는 있으면 좋은 기능 — 실패해도 앱 동작에는 영향 없음 */
    })
  })
}
