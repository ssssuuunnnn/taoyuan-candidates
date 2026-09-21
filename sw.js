/* Service worker：頁面與資料走「網路優先」，離線時退回快取，所以資料更新後不需改版本號。
   只有改動這個檔案的快取策略或預快取清單時，才需要把 VER 往上加。 */
var VER = "v1";
var CACHE = "tyc-" + VER;
var CORE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf("tyc-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function put(req, res) {
  if (res && (res.ok || res.type === "opaque")) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); });
  }
  return res;
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  var fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !fonts) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (res) { return put(req, res); })
        .catch(function () { return caches.match(req).then(function (r) { return r || caches.match("index.html"); }); })
    );
    return;
  }

  // 其餘資源：先回快取、背景更新（stale-while-revalidate）
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) { return put(req, res); }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
