/* Aevy service worker — makes the site installable and usable offline.
   - Navigations: network first, then cached copy, then offline.html.
   - Same-origin CSS / JS / images / fonts: stale-while-revalidate.
   - Never touched: other origins (Supabase API, auth, storage, CDNs), non-GET requests,
     anything sent with a Range header.
   Bump VERSION to force every visitor onto fresh files. */
const VERSION = 'aevy-v2';
const SHELL = VERSION + '-shell';
const RUNTIME = VERSION + '-rt';
const PAGES = ['index.html','apps.html','games.html','scripts.html','community.html','messages.html','dashboard.html','profile.html','user.html','login.html','signup.html','support.html'];
const EXTRA = ['offline.html','manifest.webmanifest','assets/logo.svg','assets/logo.png','assets/icons/icon-192.png','assets/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll(EXTRA);                                     /* must succeed */
    /* pages + the same-origin css/js/images they reference (best effort) */
    const wanted = new Set();
    await Promise.all(PAGES.map(async (p) => {
      try {
        const res = await fetch(p, { cache: 'reload' });
        if (!res.ok) return;
        await cache.put(p, res.clone());
        const html = await res.text();
        const re = /(?:href|src)=["']([^"'#:]+?\.(?:css|js|svg|png|jpg|webp)(?:\?[^"']*)?)["']/gi;
        let m; while ((m = re.exec(html))) wanted.add(m[1]);
      } catch (e) { /* offline during install of one page: skip */ }
    }));
    await Promise.all([...wanted].map((u) => cache.add(u).catch(() => {})));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = [SHELL, RUNTIME];
    for (const k of await caches.keys()) if (k.startsWith('aevy-') && !keep.includes(k)) await caches.delete(k);
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                 /* APIs and CDNs go straight to the network */

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const pre = await event.preloadResponse;
        const res = pre || await fetch(req);
        if (res && res.ok) { const c = await caches.open(RUNTIME); c.put(req, res.clone()); }
        return res;
      } catch (e) {
        return (await caches.match(req, { ignoreSearch: true })) || (await caches.match('offline.html'));
      }
    })());
    return;
  }

  const dest = req.destination;
  if (['style', 'script', 'image', 'font', 'manifest'].includes(dest)) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const hit = (await cache.match(req)) || (await caches.match(req));
      const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
});
