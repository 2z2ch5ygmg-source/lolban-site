// 공부자료 지도 장면 계산(11-26) — 시안(시안-공부자료/index.html)과 같은 계산을 한 파일로.
// 웹·iOS 자료 만들기(tools/build_study_ios.cjs)가 같이 씀. js/world.js(포탑·라인 선·snap)와 js/visiongrid.js(게임 이동 격자)가 먼저 있어야 함.
// 좌표는 맵 %(왼쪽 위 0,0 · 블루 기지 왼쪽 아래). 1칸 = 0.34% ≈ 지도 그림(2048px) 7px.
(function () {
  const W = () => window.WORLD;
  const lerp = (a, b, t) => a + (b - a) * t;
  let VG = null, PF = null;
  const grid = () => {
    if (VG) return VG;
    const G = window.VGRID, g = new Uint8Array(G.w * G.h); let k = 0;
    for (const s of G.rle.split(",")) { const [v, n] = s.split("*"); const c = n ? parseInt(n, 16) : 1; g.fill(parseInt(v, 16), k, k + c); k += c; }
    return (VG = { G, g });
  };
  const isWall = (p) => { const { G, g } = grid(); return g[Math.min(G.h - 1, Math.floor((p[1] / 100) * G.h)) * G.w + Math.min(G.w - 1, Math.floor((p[0] / 100) * G.w))] === 1; };
  const SNAP = (p) => W().snap(p);
  // 길 찾기: 벽에서 거리(칸)를 재 두고, 벽에 붙지 않는 최단 길 → 서로 바로 보이는 점만 남겨 직선으로 찍고 감
  function pf() {
    if (PF) return PF;
    const { G, g } = grid(), w = G.w, h = G.h, N = w * h, dist = new Float32Array(N).fill(1e9), q = new Int32Array(N * 4); let qh = 0, qt = 0;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = j * w + i; if (g[k] === 1 || i === 0 || j === 0 || i === w - 1 || j === h - 1) { dist[k] = 0; q[qt++] = k; } }
    while (qh < qt) { const k = q[qh++], i = k % w, j = (k - i) / w; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue; const nk = nj * w + ni, nd = dist[k] + (di && dj ? 1.4142 : 1); if (nd < dist[nk]) { dist[nk] = nd; q[qt++] = nk; } } }
    const cl = (v, n) => Math.max(0, Math.min(n - 1, v));
    const cellOf = (p) => [cl(Math.floor((p[0] / 100) * w), w), cl(Math.floor((p[1] / 100) * h), h)];
    const D = (p) => { const [i, j] = cellOf(p); return dist[j * w + i]; };
    const pt = (k) => { const i = k % w, j = (k - i) / w; return [((i + 0.5) / w) * 100, ((j + 0.5) / h) * 100]; };
    const CELL = 100 / w;
    // 직선이 벽에서 MIN칸 이상 떨어져 지나가는가(끝점 2칸 안쪽은 끝점 자리만큼만 요구)
    const los = (a, b, MIN) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 0.04));   // 0.04% 간격(지도 그림 1px보다 촘촘) — 끝점 옆 벽 모서리도 잡음
      for (let s = 0; s <= n; s++) { const p = [a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n], d = D(p);
        const near = Math.min(Math.hypot(p[0] - a[0], p[1] - a[1]), Math.hypot(p[0] - b[0], p[1] - b[1])) < CELL * 2;
        if (d < 1 || (!near && d < MIN)) return false; } return true; };
    function astar(a, b, MIN) {
      const [si, sj] = cellOf(a), [ei, ej] = cellOf(b), sk = sj * w + si, ek = ej * w + ei;
      const gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N), heap = [];
      const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const pp = (i - 1) >> 1; if (heap[pp][0] <= heap[i][0]) break; [heap[pp], heap[i]] = [heap[i], heap[pp]]; i = pp; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
      const ok = (k) => k === sk || k === ek || dist[k] >= MIN;
      gs[sk] = 0; push(0, sk);
      while (heap.length) { const [, k] = pop(); if (done[k]) continue; done[k] = 1; if (k === ek) break; const i = k % w, j = (k - i) / w;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue; const nk = nj * w + ni; if (!ok(nk)) continue; if (di && dj && (dist[j * w + ni] < 1 || dist[nj * w + i] < 1)) continue;   // 대각선은 양옆 칸이 벽이 아닐 때만(모서리 뚫기 없음)
          const ng = gs[k] + (di && dj ? 1.4142 : 1); if (ng < gs[nk]) { gs[nk] = ng; from[nk] = k; push(ng + Math.hypot(ni - ei, nj - ej), nk); } } }
      if (!done[ek]) return null;
      const cells = []; for (let k = ek; k !== -1; k = from[k]) cells.push(k); cells.reverse(); return cells;
    }
    // 도착점이 벽 건너편이라 크게 돌아가야 할 때(자료 좌표가 벽 하나 차이로 어긋난 경우): 출발점에서 짧게 닿는 칸 중 도착점에 가장 가까운 칸
    function reachNear(a, b, maxR) {
      const st = Math.hypot(b[0] - a[0], b[1] - a[1]), lim = (st * 1.5) / CELL + 4, [si, sj] = cellOf(a), sk = sj * w + si;
      const gs = new Map([[sk, 0]]), heap = [[0, sk]]; let best = null, bd = maxR;
      while (heap.length) { heap.sort((x, y) => y[0] - x[0]); const [c, k] = heap.pop(); if (c > gs.get(k) || c > lim) continue;
        const p = pt(k), dd = Math.hypot(p[0] - b[0], p[1] - b[1]); if (dd < bd && dist[k] >= 1) { bd = dd; best = p; }
        const i = k % w, j = (k - i) / w;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue; const nk = nj * w + ni;
          if (dist[nk] < 1 || (di && dj && (dist[j * w + ni] < 1 || dist[nj * w + i] < 1))) continue; const ng = c + (di && dj ? 1.4142 : 1); if (ng < (gs.has(nk) ? gs.get(nk) : Infinity)) { gs.set(nk, ng); heap.push([ng, nk]); } } }
      return best;
    }
    const memo = new Map();
    function path(a0, b0) {
      const key = a0.join(",") + ">" + b0.join(","); if (memo.has(key)) return memo.get(key);
      const a = SNAP(a0), b = SNAP(b0); let res = [a, b];
      // 벽에서 3·2·1칸 떨어진 길을 다 구한 뒤, 가장 짧은 길보다 10% 넘게 돌아가지 않는 것 중 벽에서 가장 먼 길
      // (좁은 틈을 두고 크게 돌아가지 않게 — 실제로는 그 틈으로 지나감)
      const got = [];
      for (const MIN of [3, 2, 1]) { const cells = astar(a, b, MIN); if (!cells) continue;
        const P = [a, ...cells.slice(1, -1).map(pt), b], out = [a]; let i = 0;
        while (i < P.length - 1) { let j = P.length - 1; while (j > i + 1 && !los(P[i], P[j], MIN)) j--; out.push(P[j]); i = j; }
        got.push(out.map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100])); }
      if (got.length) { const len = (q) => { let L = 0; for (let i = 1; i < q.length; i++) L += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]); return L; };
        const best = Math.min(...got.map(len)); res = got.find((q) => len(q) <= best * 1.1 + 0.3);
        const st = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (!memo.noNear && st > 0.5 && st < 10 && len(res) > st * 2.5 + 1) { const c = reachNear(a, b, 2.5);
          if (c) { memo.noNear = true; const alt = path(a, [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100]); memo.noNear = false; if (len(alt) < len(res) / 2) res = alt; } } }
      memo.set(key, res); return res;
    }
    return (PF = { path, D, CELL });
  }
  const segLen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
  function along(pts, t) {
    const tot = segLen(pts); let rest = t * tot;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (rest <= d || i === pts.length - 1) { const k = d ? Math.min(1, rest / d) : 1; return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]; } rest -= d; }
    return pts[pts.length - 1];
  }
  // 움직임·화살표는 출발점 → 도착점 최단 길(중간 자리는 쓰지 않음: 실제 플레이처럼 찍고 감)
  const route = (pts) => pf().path(pts[0], pts[pts.length - 1]);
  const merge = (base, af) => {
    if (!af) return base;
    const a = {}; Object.entries(base.a || {}).forEach(([k, o]) => (a[k] = { ...o }));
    Object.entries(af.a || {}).forEach(([k, o]) => (a[k] = { ...(a[k] || {}), ...o }));
    const w = {}; Object.entries(base.w || {}).forEach(([k, o]) => (w[k] = { ...o, d: 0 }));
    Object.entries(af.w || {}).forEach(([k, o]) => (w[k] = { ...(w[k] || {}), ...o }));
    return { ...base, a, w, p: af.p || [], hit: af.hit || [], l: af.l || base.l || [], waves: { ...(base.waves || {}), ...(af.waves || {}) }, cam: af.cam || base.cam };
  };
  // 웨이브: 라인 선(양쪽 1차 포탑 사이) 위 작은 점. 끝(p=0·1)은 포탑 자리라 포탑 앞 3%(미니언이 포탑을 치는 자리)까지만.
  // 앞줄 = 우리 미니언 맨 앞, 우리 미니언은 그 뒤(우리 쪽)로, 상대는 앞쪽으로 0.4% 간격
  function waveDots(sc) {
    const out = [];
    W().waves(sc).forEach((q) => { const L = W().LANES[q.l], tot = segLen(L), off = 3 / tot;
      const p = (sc.waves[q.l] || {}).p, front = off + Math.max(0, Math.min(1, p == null ? 0.5 : p)) * (1 - 2 * off), step = 0.4 / tot, gap = q.us && q.them ? 0.5 / tot : 0;
      for (let i = 0; i < q.us; i++) out.push([...along(L, Math.max(0, Math.min(1, front - i * step))), "us"]);
      for (let i = 0; i < q.them; i++) out.push([...along(L, Math.max(0, Math.min(1, front + gap + i * step))), "them"]); });
    return out;
  }
  // 장면 → 그릴 것(맵 %). prev가 있으면 prev 자리에서 움직인 챔프의 길(mv)을 붙임
  const r2 = (p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];
  function resolve(sc, prev) {
    const toks = Object.entries(sc.a || {}).map(([k, o]) => {
      const at = r2(SNAP(o.at)), t = { k, c: o.c, s: o.s, at };
      if (o.fog) t.fog = 1;
      const pa = prev && prev.a && prev.a[k] ? r2(SNAP(prev.a[k].at)) : null;
      if (pa && Math.hypot(pa[0] - at[0], pa[1] - at[1]) > 0.05) {
        // 들르는 곳: 자료의 경유점(via) 중 화살표 시작·끝이나 때림 자리와 겹치는 곳만(라인 밀기 → 포탑 치기 → 캠프처럼 일을 보는 자리).
        // 벽을 피하려고 찍어 둔 나머지 경유점은 버리고 그 사이는 최단 길(벽에 붙어 훑고 가지 않게)
        const keys = [...(sc.p || []).flatMap((p) => [p.pts[0], p.pts[p.pts.length - 1]]), ...(sc.hit || []).map((h) => h.at)];
        const stops = (o.via || []).filter((v) => keys.some((q) => Math.hypot(q[0] - v[0], q[1] - v[1]) < 1.5)).map((v) => r2(SNAP(v)));
        const ptsAll = [pa, ...stops, at].filter((q, i, a) => !i || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 0.05);
        let pts = [ptsAll[0]];
        for (let i = 1; i < ptsAll.length; i++) { const seg = route([pts[pts.length - 1], ptsAll[i]]); pts = pts.concat(seg.slice(1)); }
        t.mv = { pts, d: o.d || 0 }; t.at = pts[pts.length - 1];
      }
      return t; });
    const ws = Object.entries(sc.w || {}).map(([k, o]) => { const v = { at: r2(o.at), k: o.k === "ctrl" ? "ctrl" : "ward", s: o.s }; if (o.x) v.x = 1; if (o.d) v.d = o.d; return v; });
    // 화살표 중 챔프가 실제로 걸은 길(mv) 위에 시작·끝이 다 놓인 것은 뺌 — 그 이동은 챔프 길 하나로 그림(한 이동이 화살표 여러 개로 쪼개져 보이지 않게)
    const segD = (q, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2)) : 0; return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy); };
    const onPath = (q, pts) => { for (let i = 1; i < pts.length; i++) if (segD(q, pts[i - 1], pts[i]) < 1.5) return true; return false; };
    const arrows = (sc.p || []).filter((p) => !toks.some((t) => t.mv && onPath(p.pts[0], t.mv.pts) && onPath(p.pts[p.pts.length - 1], t.mv.pts)));
    return {
      cam: sc.cam, toks, w: ws,
      p: arrows.map((p) => { const v = { pts: route(p.pts), d: p.d || 0 }; if (p.k === "them") v.k = "them"; return v; }),
      waves: waveDots(sc).map((d) => [Math.round(d[0] * 100) / 100, Math.round(d[1] * 100) / 100, d[2] === "us" ? 0 : 1]),
      hit: (sc.hit || []).map((h) => ({ at: r2(h.at), r: h.r || 1.6 })),
      l: (sc.l || []).map((l) => { const v = { at: r2(l.at), t: l.t }; if (l.k) v.k = l.k; return v; }),
      down: sc.down || [],
    };
  }
  window.STUDYMAP = { merge, route, along, segLen, waveDots, resolve, isWall, snap: SNAP, D: (p) => pf().D(p), CELL: () => pf().CELL };
})();
