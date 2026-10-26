// Keeps the viewer and its 3D engine available offline. The map data is cached by the page.
var SHELL = "cde-shell-v4";
var FILES = ["./", "index.html", "map-data.js", "canonical.js", "browse.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
// The 3D engine is kept in this repository; its file name carries the version, so a saved copy never goes stale
var ENGINE = new URL("lib/3d-force-graph-1.80.1.min.js", self.location).href;
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) {
    return c.addAll(FILES.concat([ENGINE]));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("cde-shell-") === 0 && k !== SHELL; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (e.request.url === ENGINE) {
    e.respondWith(caches.match(ENGINE).then(function (m) {
      return m || fetch(e.request).then(function (r) { var copy = r.clone(); caches.open(SHELL).then(function (c) { c.put(ENGINE, copy); }); return r; });
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Network first so updates to the viewer show up right away; fall back to the saved copy offline
  e.respondWith(
    fetch(e.request).then(function (r) {
      var copy = r.clone();
      caches.open(SHELL).then(function (c) { c.put(e.request, copy); });
      return r;
    }).catch(function () {
      return caches.match(e.request).then(function (m) { return m || caches.match("index.html"); });
    })
  );
});
