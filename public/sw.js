// Offline: pré-cache do build (precache.json gerado no vite.config) + cache em runtime.
const C = 'equilibrinho-v1'
self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(C).then(async (c) => {
      const files = await fetch('precache.json').then((r) => r.json()).catch(() => [])
      await c.addAll(['./', 'manifest.webmanifest', 'icon.svg', ...files])
    }),
  )
})
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => {
  const r = e.request
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return
  const put = (res) => {
    if (res.ok) {
      const copy = res.clone()
      caches.open(C).then((c) => c.put(r.mode === 'navigate' ? './' : r, copy))
    }
    return res
  }
  // HTML: rede primeiro (pega versão nova), cache se offline. Assets têm hash: cache primeiro.
  e.respondWith(
    r.mode === 'navigate'
      ? fetch(r).then(put).catch(() => caches.match('./'))
      : caches.match(r).then((hit) => hit || fetch(r).then(put)),
  )
})
