// Service worker di Milo Flow: consultazione offline in sola lettura.
// Le pagine visitate e gli asset si salvano in cache; senza rete si serve
// l'ultima versione vista. Le scritture (POST) non passano mai di qui.
const CACHE = "miloflow-v1";

const PAGINA_OFFLINE = `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offline · Milo Flow</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #f5f5f7;
         display: grid; place-items: center; min-height: 100svh; margin: 0; color: #1d1d1f; }
  main { text-align: center; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  p { color: #6e6e73; margin: 0; }
</style></head>
<body><main><h1>Sei offline</h1>
<p>Questa pagina non è ancora in cache. Riapri Milo Flow quando torni in rete.</p>
</main></body></html>`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const chiavi = await caches.keys();
      await Promise.all(chiavi.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Solo letture della stessa origine; login e callback sempre dalla rete.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname === "/login" || url.pathname.startsWith("/auth")) return;

  // Asset con hash nel nome: immutabili, prima la cache.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(dallaCachePoiRete(req));
    return;
  }
  // Pagine e dati: prima la rete (sempre freschi), la cache solo offline.
  event.respondWith(dallaRetePoiCache(req));
});

async function dallaCachePoiRete(req) {
  const inCache = await caches.match(req);
  if (inCache) return inCache;
  const res = await fetch(req);
  if (res.ok) {
    const cache = await caches.open(CACHE);
    cache.put(req, res.clone());
  }
  return res;
}

async function dallaRetePoiCache(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    // Si salvano solo risposte piene della nostra origine (niente redirect al login).
    if (res.ok && res.type === "basic") await cache.put(req, res.clone());
    return res;
  } catch {
    const inCache = await caches.match(req);
    if (inCache) return inCache;
    if (req.mode === "navigate") {
      // La stessa pagina con parametri diversi è meglio di niente.
      const simile = await caches.match(req, { ignoreSearch: true });
      if (simile) return simile;
      return new Response(PAGINA_OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return Response.error();
  }
}
