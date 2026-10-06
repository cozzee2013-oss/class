/* Network-first keeps lessons current; saved copies are used when offline. */
const CACHE = 'class-textbook-v1';
const ROOT = new URL('./', self.location.href);
const SHELL = ['./', 'index.html', 'assets/textbook.css', 'assets/textbook.js',
  'assets/pwa.css', 'assets/pwa.js', 'manifest.webmanifest',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
  'assets/icons/icon-180.png', 'assets/icons/icon-32.png', 'ch/01-2-essence.html'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL.map(path => new URL(path, ROOT).href))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('class-textbook-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === 'basic') await cache.put(event.request, response.clone());
      return response;
    } catch (error) {
      const saved = await cache.match(event.request, {ignoreSearch: true});
      if (saved) return saved;
      if (event.request.mode === 'navigate') return new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>오프라인</title><body><h1>인터넷 연결이 필요해요</h1><p>이 페이지는 아직 저장되지 않았습니다. 인터넷에 연결한 뒤 다시 열어 주세요.</p><a href="' + ROOT.pathname + '">교재 목차로</a></body></html>', {headers: {'Content-Type':'text/html; charset=utf-8'}, status:503});
      return Response.error();
    }
  })());
});
