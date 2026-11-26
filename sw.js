// lolban 웹앱(11-21): 다시 열 때 빠르게 + 연결이 잠깐 끊겨도 마지막 화면은 열리게
// - 화면(HTML): 먼저 서버, 안 되면 저장해 둔 것
// - 앱 파일(js·css·그림, ?v=판 번호가 붙음): 저장해 둔 것 먼저(판이 바뀌면 주소가 달라져 새로 받음)
// - 챔프 그림·글꼴(다른 주소): 저장해 둔 것 먼저
// - 팀 자료·실시간 밴픽(Worker)·로그인은 건드리지 않음 — 늘 서버로
const V = new URL(self.location.href).searchParams.get("v") || "0";
const CACHE = "lolban-" + V;
const KEEP = [CACHE, "lolban-img"];

// 설치 때 첫 화면이 쓰는 파일(?v= 붙은 js·css)까지 저장 — 첫 방문 파일은 워커가 켜지기 전에 받아서 저장되지 않았음
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    try {
      const res = await fetch("/index.html", { cache: "no-store" }); const html = await res.clone().text();
      await c.put("/index.html", res);
      const files = [...html.matchAll(/(?:href|src)="([^"]+\?v=[^"]+)"/g)].map((m) => new URL(m[1], self.location.origin).href).filter((u) => u.startsWith(self.location.origin));
      await c.addAll(["/manifest.webmanifest", "/img/app/icon-192.png", ...new Set(files)]);
    } catch (err) { /* 연결이 없으면 다음 기회에 */ }
  }).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("lolban-") && !KEEP.includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const IMG_HOSTS = ["ddragon.leagueoflegends.com", "cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    if (!IMG_HOSTS.includes(url.hostname)) return;   // Worker(팀 자료·실시간 밴픽)·로그인 공급자는 그대로
    e.respondWith(caches.open("lolban-img").then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }))));
    return;
  }
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("/index.html", copy)); return res; })
      .catch(() => caches.match("/index.html").then((hit) => hit || caches.match("/"))));
    return;
  }
  if (url.pathname.startsWith("/privacy") || url.pathname.startsWith("/terms")) return;
  e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok && url.search.includes("v=")) c.put(req, res.clone()); return res; }))).catch(() => fetch(req)));   // 저장소가 막 지워진 순간 등 실패하면 서버에서 바로(11-26 지도 깨짐)
});
