/* 보조금 레이더 서비스 워커 — 앱 셸 + 정책 데이터 캐시
 * 전략
 *  - 내비게이션(index.html): 네트워크 우선 → 실패 시 캐시
 *  - data/*.json: stale-while-revalidate (항상 빠르게, 뒤에서 갱신)
 *  - 정적 자산(js/css/이미지): 캐시 우선
 */
const VERSION = 'v1.0.3'
const SHELL_CACHE = `grant-radar-shell-${VERSION}`
const DATA_CACHE = `grant-radar-data-${VERSION}`

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      await Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url).catch(() => undefined)))
      self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith('grant-radar-') && key !== SHELL_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response && response.ok) cache.put(request, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    const shell = await caches.open(SHELL_CACHE)
    const fallback = await shell.match('./index.html')
    if (fallback) return fallback
    throw error
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => undefined)
  return cached || (await network) || Response.error()
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && response.ok) cache.put(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE))
    return
  }
  if (url.pathname.includes('/data/')) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE))
    return
  }
  if (/\.(js|css|png|jpg|jpeg|svg|webp|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
  }
})
