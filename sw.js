// Permette di aprire l'app anche senza connessione (le funzioni IA richiedono comunque internet).
// Il numero di versione cambia a ogni aggiornamento: deve essere uguale a quello in index.html e app.js.
const VERSION = "11";
const CACHE = "zaino-v" + VERSION;
const SHELL = ["./", "index.html", "styles.css", "app.js", "mate.js", "fisica.js", "schede.js", "autori.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"]
  .map((u) => (/\.(css|js)$/.test(u) ? u + "?v=" + VERSION : u));

self.addEventListener("install", (e) => {
  // "reload": scarica davvero dal server, senza passare dalla cache del browser
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// File dell'app: sempre dalla rete, controllando che siano aggiornati; la copia salvata serve solo senza connessione.
// Chiamate alle API (Gemini, Groq): mai salvate.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  if (!same && !/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(url.host)) return;
  const net = same ? fetch(req.url, { cache: "no-cache", credentials: "same-origin" }) : fetch(req);
  e.respondWith(
    net.then((res) => {
      if (res.ok || res.type === "opaque") {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: false })
      .then((r) => r || caches.match(req, { ignoreSearch: true }))
      .then((r) => r || caches.match("index.html")))
  );
});
