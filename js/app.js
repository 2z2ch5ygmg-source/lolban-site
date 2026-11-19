(function () {
  // ---------- 주소 이전(11-19: sentrixlink.kr/draft → lolban.com) ----------
  // 브라우저 저장은 주소마다 따로라, 옛 주소에서 「가지고 이동」을 누르면 이 브라우저 자료(설정·저장 밴픽·팀 공간 열쇠)를
  // gzip → base64url로 주소 # 뒤(#move=…)에 실어 새 주소로 보낸다. # 뒤는 서버로 가지 않는다. 새 주소는 받아서 저장하고 # 를 지운 뒤 다시 연다.
  const MOVE_KEYS = ["sentrix-draft.v1", "sentrix-draft.saved.v1", "sentrix-draft.space.v1"];
  const b64u = (bytes) => { let s = ""; bytes.forEach((b) => (s += String.fromCharCode(b))); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const unb64u = (t) => Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  async function packMove() {
    const data = {}; MOVE_KEYS.forEach((k) => { try { const v = localStorage.getItem(k); if (v) data[k] = v; } catch (e) { /* 무시 */ } });
    const raw = new TextEncoder().encode(JSON.stringify({ v: 1, data }));
    if (typeof CompressionStream !== "function") return "j" + b64u(raw);
    const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
    return "z" + b64u(z);
  }
  async function unpackMove(t) {
    const bytes = unb64u(t.slice(1));
    const raw = t[0] === "z" ? new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()) : bytes;
    const d = JSON.parse(new TextDecoder().decode(raw));
    if (!d || d.v !== 1 || typeof d.data !== "object") throw new Error("형식");
    return d.data;
  }
  {
    const mv = location.hash.match(/^#move=([zj][A-Za-z0-9_-]{8,})$/);
    if (mv) {
      unpackMove(mv[1]).then((data) => {
        const had = (() => { try { return !!localStorage.getItem(MOVE_KEYS[0]); } catch (e) { return false; } })();
        if (!had || confirm("이 주소에 이미 저장된 자료가 있습니다. 옛 주소에서 가져온 자료로 바꿀까요?")) {
          MOVE_KEYS.forEach((k) => { try { if (data[k]) localStorage.setItem(k, data[k]); } catch (e) { /* 무시 */ } });
        }
      }).catch(() => alert("옮겨 온 자료를 읽지 못했습니다. 옛 주소에서 다시 눌러 주세요."))
        .finally(() => location.replace(location.pathname + location.search));
      return;   // 다시 열 때까지 그리지 않음
    }
  }
  if (window.NEW_HOME && /(^|\.)sentrixlink\.kr$/.test(location.hostname)) {
    const bar = document.createElement("div");
    bar.className = "move-bar"; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "주소 이전");
    bar.innerHTML = `<span>밴픽 보드 주소가 <b>${window.NEW_HOME.replace(/^https?:\/\//, "").replace(/\/$/, "")}</b>로 바뀌었습니다.</span><button class="btn sm primary" type="button">이 브라우저 자료 가지고 이동</button>`;
    bar.querySelector("button").addEventListener("click", async () => { location.href = `${window.NEW_HOME}#move=${await packMove()}`; });
    document.body.prepend(bar);
  }
  const { ROLES, ROLE_KO, COMPS, ORDER, LEVEL_KO, STYLE_KO } = window.KB;
  const E = window.Engine;
  // 휴대폰 화면(폭 760px 이하): 화면마다 따로 그린다(PC 화면은 그대로)
  const MOB = matchMedia("(max-width: 760px)");
  // ---------- 팀 공간(사용자 결정 11-19: 팀장 Riot 인증 + 초대 링크) ----------
  // 초대 링크 #join=공간.열쇠 를 열면 이 브라우저에 열쇠를 두고 주소에서 지운다. 팀 자료(노트·자기평가·준비일 바꾸기·실시간 갱신)는 열쇠가 있어야 서버가 준다.
  const KEY_SPACE = "sentrix-draft.space.v1";
  let SPACE = null;
  try { SPACE = JSON.parse(localStorage.getItem(KEY_SPACE) || "null"); } catch (e) { SPACE = null; }
  if (SPACE && !(SPACE.id && SPACE.key)) SPACE = null;
  const saveSpace = () => { try { if (SPACE && SPACE.viaLogin) return; if (SPACE) localStorage.setItem(KEY_SPACE, JSON.stringify(SPACE)); else localStorage.removeItem(KEY_SPACE); } catch (e) { /* 무시 */ } };
  {
    const m = location.hash.match(/^#join=([a-z0-9][a-z0-9-]{1,31})\.([A-Za-z0-9_-]{20,100})$/);
    if (m) { SPACE = { id: m[1], key: m[2], name: "", joined: true }; saveSpace(); history.replaceState(null, "", location.pathname + location.search); }
  }
  // ---- 로그인 세션: #login=토큰 으로 돌아오면 저장하고 주소에서 지움. 로그인한 사람의 팀은 서버(/auth/me) 기준 ----
  const KEY_SESS = "lolban.sess.v1", KEY_AUTH = "lolban.auth.v1";
  let SESS = ""; try { SESS = localStorage.getItem(KEY_SESS) || ""; } catch (e) { SESS = ""; }
  let LOGIN_ERR = "", JUST_LOGGED = false;
  {
    const m = location.hash.match(/^#login=([A-Za-z0-9_-]{30,80})$/), e = location.hash.match(/^#login_error=([a-z_]{2,20})$/);
    if (m) { SESS = m[1]; JUST_LOGGED = true; try { localStorage.setItem(KEY_SESS, SESS); } catch (er) { /* 이번만 */ } history.replaceState(null, "", location.pathname + location.search); }
    if (e) { LOGIN_ERR = e[1]; history.replaceState(null, "", location.pathname + location.search); }
  }
  const AUTH = { user: null, spaces: [], providers: null, msg: "", busy: false };
  try { const c = JSON.parse(localStorage.getItem(KEY_AUTH) || "null"); if (c && SESS) { AUTH.user = c.user; AUTH.spaces = c.spaces || []; } } catch (e) { /* 없음 */ }
  // 로그인한 팀이 있으면 그 팀 공간을 SPACE로(열쇠 없이 세션으로)
  function loginSpace() {
    if (!SESS || !AUTH.spaces.length) return null;
    let want = null; try { want = localStorage.getItem("lolban.space.v1"); } catch (e) { want = null; }
    const sp = AUTH.spaces.find((x) => x.id === want) || AUTH.spaces[0];
    return { id: sp.id, key: "", name: sp.name, viaLogin: true, isOwner: !!sp.owner, code: sp.code || "", codeExp: sp.codeExp || "", members: sp.members || 0 };
  }
  if (SESS && AUTH.spaces.length) SPACE = loginSpace();
  const WURL = () => (window.RECENT_LIVE_URL || "").replace(/\/$/, "");
  const spaceQ = () => (SPACE ? `space=${encodeURIComponent(SPACE.id)}` : "");
  // 팀 자료 요청: 공간·열쇠를 붙이고, 401이면 열쇠가 바뀐 것으로 표시
  async function wfetch(path, opts) {
    const o = opts || {};
    const url = `${WURL()}${path}${SPACE ? (path.includes("?") ? "&" : "?") + spaceQ() : ""}`;
    const res = await fetch(url, { cache: "no-store", credentials: "omit", ...o, headers: { ...(o.headers || {}), ...(SPACE && SPACE.key ? { "X-Team-Key": SPACE.key } : {}), ...(SESS ? { "X-Session": SESS } : {}) } });
    if (res.status === 401 && SPACE && !SPACE.bad && !SPACE.viaLogin) { SPACE.bad = true; saveSpace(); setTimeout(() => render(), 0); }
    if (res.status === 401 && SPACE && SPACE.viaLogin) setTimeout(() => loadMe(), 0);   // 세션이 끝났거나 팀에서 빠짐
    return res;
  }
  const KEY = "sentrix-draft.v1";
  const CH = {};
  window.CHAMPIONS.forEach((c) => (CH[c.id] = c));

  // ---------- state ----------
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const emptySteps = () => ORDER.map(() => ({ champ: null, role: null, skip: false }));
  // 솔랭·자랭: 팀 자료 없이 쓰는 빈 팀(챔프폭·전적 없음 → 메타·상성·조합으로만 추천)
  const SOLO = { our: "solo-our", enemy: "solo-enemy" };
  const soloTeam = (id, name) => ({ id, name, solo: true, players: Object.fromEntries(ROLES.map((r) => [r, { riot: "", tier: "", pts: 50, pool: [] }])) });
  function ensureSolo(st) {
    if (!st.teams.find((t) => t.id === SOLO.our)) st.teams.push(soloTeam(SOLO.our, "솔랭·자랭 우리팀"));
    if (!st.teams.find((t) => t.id === SOLO.enemy)) st.teams.push(soloTeam(SOLO.enemy, "솔랭·자랭 상대팀"));
    return st;
  }
  const isSolo = (id) => id === SOLO.our || id === SOLO.enemy;
  // 상대가 솔랭·자랭이면 랭크 드래프트 순서(밴 10 → 픽 1-2-2-2-2-1), 아니면 대회 순서
  function syncQueue(resetDraft) {
    const kind = isSolo(S.enemyTeam) ? "ranked" : "tournament";
    if (ORDER.kind !== kind) {
      window.KB.useOrder(kind, S.draft.ourSide);
      if (resetDraft) { S.draft.steps = emptySteps(); S.draft.idx = 0; }
      // 솔랭·자랭은 피어리스 끔, 대회로 돌아오면 전에 쓰던 피어리스 설정으로
      if (kind === "ranked") { S.series.prevMode = S.series.mode; S.series.mode = "off"; }
      else if (S.series.prevMode) { S.series.mode = S.series.prevMode; delete S.series.prevMode; }
    }
  }
  // 빈 팀(새 팀 공간·엑셀로 만든 팀): 라인마다 계정·티어·챔프폭 비움
  const blankTeam = (id, name) => ({ id, name, players: Object.fromEntries(ROLES.map((r) => [r, { riot: "", alts: [], tier: "", pts: 50, pool: [] }])) });
  // 처음 상태(11-19 정식 배포): 새 사용자는 빈 명단에서 시작(다른 팀 자료가 우리팀에 뜨지 않게). 처음 쓴 팀 공간(subin)만 예전 대회 명단을 이어받음
  function fresh() {
    const legacy = !!(SPACE && SPACE.id === "subin");
    const teams = legacy ? clone(window.SEED_TEAMS) : [];
    if (SPACE && !legacy) teams.push(blankTeam(SPACE.id, SPACE.name || "우리 팀"));
    const our = legacy ? window.SEED_OUR_TEAM : SPACE ? SPACE.id : SOLO.our;
    return {
      seed: window.SEED_VERSION, teams, ourTeam: our,
      enemyTeam: (teams.find((t) => t.id !== our) || { id: SOLO.enemy }).id, tab: legacy ? "live" : "our",
      draft: { ourSide: "B", steps: emptySteps(), idx: 0 },
      series: { game: 1, mode: "hard", locked: [] },
      ui: { q: "", role: "", onlyPool: false },
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.teams && s.draft) {
          // 기본 명단이 바뀌면(계정·티어) 저장된 팀에도 반영하고, 직접 넣은 챔프폭은 유지
          if (s.seed !== window.SEED_VERSION) {
            window.SEED_TEAMS.forEach((st) => {
              const t = s.teams.find((x) => x.id === st.id);
              if (!t) return;
              Object.keys(st.players).forEach((r) => { const p = t.players[r] || (t.players[r] = { pool: [] }); Object.assign(p, { riot: st.players[r].riot, tier: st.players[r].tier, pts: st.players[r].pts }); });
            });
            s.seed = window.SEED_VERSION;
          }
          return Object.assign(fresh(), s);
        }
      }
    } catch (e) { /* 저장소를 못 쓰는 환경: 기본값 */ }
    return fresh();
  }
  let S = ensureSolo(load());
  const JUST_JOINED = !!(SPACE && SPACE.joined);
  if (SPACE && SPACE.joined) { delete SPACE.joined; saveSpace(); }
  E.setOurTeam(S.ourTeam);
  if (isSolo(S.enemyTeam)) window.KB.useOrder("ranked", S.draft.ourSide);
  S.ui.sheet = false;
  S.ui.predRole = "";
  S.ui.ourRole = "";
  S.ui.endAsk = false;
  if (S.ui.tut && S.ui.tut.k != null) S.ui.tut.pk = S.ui.tut.k;
  S.ui.ans = {};   // 새로 열면 문제는 처음부터 다시 푼다(맞힌 기록 dScore는 진행률로 남김)
  if (S.ui.tut && S.ui.tut.step === "quiz") S.ui.tut = { ...S.ui.tut, k: 0 };   // 새로 열면 장면은 마지막 모습으로(다시 보기로 재생)
  if (S.ui.tut && S.ui.tut.u && !(window.VISION && window.VISION.units.some((u) => u.id === S.ui.tut.u && u.scenes))) S.ui.tut = {};
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 무시 */ } rosterChanged(); }

  // ---------- 팀 명단 서버 동기화(11-19): 팀 이름·우리팀·계정·부계정을 팀 공간에 하나로 — 팀원끼리 같고, 0시 수집기가 이 명단으로 기록을 모음 ----
  const RS = { last: "", timer: null, loaded: false, msg: "" };
  const rosterCan = () => !!(SPACE && !SPACE.bad && WURL() && SPACE.id !== "subin");
  function rosterOf() {
    const ok = (v) => /^[^#<>"'`\\]{1,32}#[^#<>"'`\\]{1,8}$/.test(String(v || "").trim());
    return { teams: S.teams.filter((t) => !t.solo).slice(0, 40).map((t) => ({ id: t.id, name: String(t.name || "팀").replace(/[<>"`\\]/g, "").slice(0, 30) || "팀", our: t.id === S.ourTeam,
      players: Object.fromEntries(ROLES.map((r) => { const p = t.players[r] || {}; return [r, { riot: ok(p.riot) ? String(p.riot).trim() : "", alts: (p.alts || []).filter(ok).map((a) => String(a).trim()).slice(0, 2) }]; })) })) };
  }
  function rosterChanged() {
    if (!rosterCan() || !RS.loaded) return;
    const sig = JSON.stringify(rosterOf());
    if (sig === RS.last) return;
    clearTimeout(RS.timer); RS.timer = setTimeout(pushRoster, 1000);
  }
  async function pushRoster() {
    RS.timer = null; if (!rosterCan()) return;
    const body = rosterOf(), sig = JSON.stringify(body);
    try { const res = await wfetch(`/roster`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: sig }); const d = await res.json().catch(() => ({})); if (res.ok && d.status === "ok") { RS.last = sig; RS.msg = ""; } else RS.msg = "명단 저장 실패: " + (d.reason || res.status); }
    catch (e) { RS.msg = "명단 저장 실패 — 다시 바꾸면 또 올립니다"; }
  }
  async function loadRoster() {
    if (!rosterCan() || RS.timer) return;   // 올리기를 기다리는 동안에는 받지 않음(내 입력을 덮지 않게)
    try {
      const res = await wfetch(`/roster`); const d = await res.json().catch(() => ({}));
      if (!res.ok || d.status !== "ok") return;
      const R = d.roster;
      if (!R || !Array.isArray(R.teams)) { RS.loaded = true; RS.last = ""; rosterChanged(); return; }   // 서버에 아직 없음 → 이 브라우저 명단을 올림
      let changed = false;
      const ids = new Set(R.teams.map((t) => t.id));
      R.teams.forEach((rt) => {
        let t = S.teams.find((x) => x.id === rt.id);
        if (!t) { t = blankTeam(rt.id, rt.name); S.teams.push(t); changed = true; }
        if (t.name !== rt.name && rt.id !== SPACE.id) { t.name = rt.name; changed = true; }
        ROLES.forEach((r) => { const p = t.players[r] || (t.players[r] = { riot: "", alts: [], tier: "", pts: 50, pool: [] }), q = rt.players[r] || {};
          if ((p.riot || "") !== (q.riot || "") || JSON.stringify((p.alts || []).filter(Boolean)) !== JSON.stringify(q.alts || [])) { p.riot = q.riot || ""; p.alts = (q.alts || []).slice(); changed = true; } });
      });
      const before = S.teams.length;
      S.teams = S.teams.filter((t) => t.solo || ids.has(t.id) || t.id === SPACE.id);
      if (S.teams.length !== before) changed = true;
      if (!team(S.enemyTeam)) S.enemyTeam = (S.teams.find((x) => !x.solo && x.id !== S.ourTeam) || { id: SOLO.enemy }).id;
      RS.loaded = true; RS.last = JSON.stringify(rosterOf());
      if (changed) { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 무시 */ } render(); }
      rosterChanged();
    } catch (e) { /* 다음에 */ }
  }

  // ---------- 밴픽 저장(버튼으로만) ----------
  // 저장 목록은 따로 두어 「처음 상태로」·「시리즈 초기화」가 지우지 않는다. 같은 시리즈를 다시 저장하면 그 칸을 덮어쓴다.
  const KEY_SAVED = "sentrix-draft.saved.v1";
  function loadSaved() { try { const v = JSON.parse(localStorage.getItem(KEY_SAVED) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function writeSaved(list) { try { localStorage.setItem(KEY_SAVED, JSON.stringify(list)); return true; } catch (e) { return false; } }
  const teamName = (id) => { const t = S.teams.find((x) => x.id === id); return t ? t.name : id; };
  const nowKST = () => new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  // 지금 판(진행 중이어도) 전체 순서: 진영·밴/픽·챔프·라인
  function gameRecord(game) {
    return { game, ourSide: S.draft.ourSide, enemyTeam: S.enemyTeam, kind: ORDER.kind,
      steps: ORDER.map((o, i) => { const s = S.draft.steps[i] || {}; return { side: o[0], t: o[1], champ: s.champ || null, role: s.role || null, skip: !!s.skip }; }) };
  }
  const hasSteps = (g) => g.steps.some((s) => s.champ);
  // 끝난 세트는 다음 세트로 넘길 때 남긴 기록, 그 기능 전에 넘긴 세트는 피어리스 잠금(픽만)으로
  function seriesRecord() {
    const done = S.series.games || [];
    const games = [];
    for (let g = 1; g < S.series.game; g++) {
      const full = done.find((x) => x.game === g);
      if (full) games.push(full);
      else { const ps = S.series.locked.filter((x) => x.game === g); if (ps.length) games.push({ game: g, partial: true, picks: ps.map((x) => ({ id: x.id, who: x.who })) }); }
    }
    const cur = gameRecord(S.series.game);
    if (hasSteps(cur)) games.push(Object.assign(cur, S.draft.idx < ORDER.length ? { live: true } : {}));
    return games;
  }
  function saveSeries() {
    const games = seriesRecord();
    if (!games.length) { alert("저장할 밴픽이 없습니다."); return; }
    if (!S.series.sid) S.series.sid = "s" + Date.now().toString(36);
    const rec = { sid: S.series.sid, at: nowKST(), ourTeam: S.ourTeam, ourName: teamName(S.ourTeam), enemyTeam: S.enemyTeam, enemyName: teamName(S.enemyTeam), mode: S.series.mode, games };
    games.forEach((g) => { if (g.enemyTeam) g.enemyName = teamName(g.enemyTeam); });
    const prev = loadSaved().find((x) => x.sid === rec.sid);   // 저장 목록에서 고른 승·패는 다시 저장해도 유지
    if (prev) games.forEach((g) => { const o = prev.games.find((x) => x.game === g.game); if (!g.result && o && o.result) g.result = o.result; });
    const list = loadSaved().filter((x) => x.sid !== rec.sid);
    list.unshift(rec);
    if (!writeSaved(list.slice(0, 200))) { alert("이 브라우저 저장소에 쓰지 못했습니다."); return; }
    save(); S.ui.savedOpen = rec.sid; render();
    alert(`${games.length}세트 밴픽을 저장했습니다. 아래 「저장한 밴픽」에서 볼 수 있습니다.`);
  }

  // ---------- helpers ----------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const IMG = (id) => `https://ddragon.leagueoflegends.com/cdn/${window.DDRAGON_VERSION}/img/champion/${id}.png`;
  // 선 아이콘(24 격자, currentColor): 글 대신 상태를 보여 주는 배지·태그용
  const ICO = {
    sword: "M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2",
    link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3",
    alert: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
    eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
    layers: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    flag: "M4 22V4M4 4h12l-2 4 2 4H4",
    cut: "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12",
    target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    down: "M12 5v14M19 12l-7 7-7-7",
    map: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15",
    swap: "M7 16V4M3 8l4-4 4 4M17 8v12M21 16l-4 4-4-4",
    // 버튼 아이콘(11-19: 글자 버튼 → 아이콘, 이름은 툴팁·화면 낭독으로)
    x: "M6 6l12 12M18 6 6 18",
    undo: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
    refresh: "M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6",
    pencil: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z",
    trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
    copy: "M9 9h11v11H9zM5 15H4V4h11v1",
    plus: "M12 5v14M5 12h14",
    back: "M19 12H5M12 19l-7-7 7-7",
    left: "M15 18l-6-6 6-6",
    right: "M9 18l6-6-6-6",
    skip: "M5 4l10 8-10 8V4zM19 5v14",
    replay: "M3 12a9 9 0 1 0 2.64-6.36M3 3v6h6",
    note: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5",
    notePlus: "M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M17.5 2.5a2.1 2.1 0 0 1 3 3L12 14l-4 1 1-4 8.5-8.5z",
    gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  };
  const ico = (n) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICO[n] || ICO.alert}"/></svg>`;
  // 픽 순서 이유 종류 → 아이콘·색
  const KIND = { safe: ["shield", "good"], counter: ["sword", "good"], grab: ["flag", "good"], set: ["link", "good"], meta: ["trophy", "info"],
    core: ["layers", "info"], flex: ["swap", "info"], wait: ["eye", "warn"], risk: ["alert", "bad"], thin: ["alert", "bad"], cut: ["cut", "bad"], sylas: ["alert", "bad"] };
  // 배지: 짧은 말만 보이고, 누르면(PC는 마우스도) 전체 이유가 펼쳐짐
  function badge(t) {
    const [ic, tone] = KIND[t.k] || ["alert", "info"];
    // 챔프가 걸린 배지는 글 대신 초상화 + 한 줄(cap). 전체 문장은 화면 낭독용으로만 둔다
    const pop = t.ids && t.ids.length
      ? `<div class="bdg-pop"><div class="bdg-ch">${t.ids.map((id) => `<span class="pc">${icon(id).replace(/ title="[^"]*"/, "")}<span>${esc(CH[id].ko)}</span></span>`).join("")}</div>${t.cap ? `<p class="bdg-cap">${esc(t.cap)}</p>` : ""}<span class="sr-only">${esc(t.d)}</span></div>`
      : `<div class="bdg-pop"><p class="bdg-cap">${esc(t.d)}</p></div>`;
    return `<details class="bdg t-${tone}"><summary>${ico(ic)}<span>${esc(t.t)}</span></summary>${pop}</details>`;
  }
  // 추천 카드 장단점 문장 → 아이콘 + 짧은 말
  function shortTag(g, good) {
    let m;
    if (good) {
      if ((m = g.match(/^(.+?) 상대 강함(.*)$/))) return ["sword", m[1] + m[2]];
      if ((m = g.match(/^(.+) 조합에 맞음$/))) return ["layers", m[1]];
      if (g === "갱 버팀") return ["shield", "갱 버팀"];
      if (g === "앞라인 보강") return ["shield", "앞라인"];
      if ((m = g.match(/^팀 경기 (.+)$/))) return ["users", "팀원과 " + m[1]];
      if (g === "상대 주력 뺏기") return ["target", "주력 뺏기"];
      if (g === "대회 메타 픽") return ["trophy", "메타"];
      if (g === "상대 궁 뺏어 쓰기") return ["target", "궁 뺏기"];
      if ((m = g.match(/^(.+?)[과와] 세트$/))) return ["link", m[1]];
      if ((m = g.match(/^(\S+) 시나리오 \S+ (주 픽|대체 픽)$/))) return ["map", m[1] + " " + (m[2] === "주 픽" ? "주 픽" : "대체")];
      return ["layers", g];
    }
    if (/사일러스 밴 필요/.test(g)) return ["alert", "사일러스 밴"];
    if (/사일러스에 궁/.test(g)) return ["alert", "사일러스"];
    if ((m = g.match(/^(.+) 조합에 약함$/))) return ["down", m[1]];   // 빨간 아래 화살표 = 약함
    if ((m = g.match(/^(.+?) 상대 불리(.*)$/))) return ["alert", m[1] + " 불리" + m[2]];
    return ["down", g];
  }
  const tagHtml = (g, good) => { const [i, t] = shortTag(g, good); return `<span class="tg ${good ? "good" : "bad"}" title="${esc(g)}">${ico(i)}${esc(t)}<span class="sr-only"> (${esc(g)})</span></span>`; };
  function icon(id, cls) {
    const c = CH[id];
    if (!c) return `<span class="ic ${cls || ""}"></span>`;
    return `<span class="ic ${cls || ""}" title="${esc(c.ko)}">${esc(c.ko.slice(0, 2))}<img src="${IMG(id)}" alt="" loading="lazy" onerror="this.remove()"></span>`;
  }
  const team = (id) => S.teams.find((t) => t.id === id);
  const nick = (riot) => String(riot || "").split("#")[0].trim();
  const lvTag = (e) => (e.one ? `<span class="lv lvone">원챔</span>` : `<span class="lv lv${e.lv}">${LEVEL_KO[e.lv]}</span>`);
  function poolChips(t, r, opts) {
    if (!(opts && opts.edit)) {
      // 보기용: 직접 입력 + op.gg 전적을 합친 챔프폭 (숙련 점수 순)
      const pm = E.poolMap(t, r);
      const list = Object.entries(pm).sort((a, b) => E.lvScore(b[1]) - E.lvScore(a[1])).slice(0, (opts && opts.max) || 8);
      if (!list.length) return `<span class="dim">챔프폭·전적 없음</span>`;
      return list.map(([id, e]) => `<span class="chip" title="${esc(CH[id] ? CH[id].ko : id)}${e.kda ? " · KDA " + e.kda : ""}${e.mp ? " · 숙련도 " + e.mp.toLocaleString() : ""}">${icon(id, "sm")}${esc(CH[id] ? CH[id].ko : id)} ${lvTag({ lv: e.lv, one: e.one })}${e.g ? `<span class="st">${e.g}판 ${Math.round(e.wr)}%</span>` : ""}</span>`).join("");
    }
    const pool = (t.players[r].pool || []).slice().sort((a, b) => (b[2] ? 4 : b[1]) - (a[2] ? 4 : a[1]));
    // 기록에서 자동으로 잡힌 챔프(사용자 지적 11-19: 홈엔 보이는데 편집 화면엔 없음) — 누르면 고정해서 숙련도를 바꿀 수 있음
    const mine = new Set(pool.map((x) => x[0]));
    const recMap = (tt, rr) => E.poolMap({ ...tt, players: { ...tt.players, [rr]: { ...tt.players[rr], pool: [] } } }, rr);   // 직접 넣은 챔프를 뺀 기록만(우리 팀은 직접 넣으면 기록을 안 씀)
    const auto = Object.entries(recMap(t, r)).filter(([id, e]) => !mine.has(id) && CH[id] && (e.g || e.rg || e.scout)).sort((a, b) => E.lvScore(b[1]) - E.lvScore(a[1])).slice(0, 8);
    const autoHtml = auto.length ? `<span class="auto-h">${pool.length && t.id === S.ourTeam ? "기록에만 있는 챔프 · 분석엔 직접 넣은 챔프만 씀(눌러서 넣기)" : "기록에서 자동 · 눌러서 고정하면 숙련도를 바꿀 수 있음"}</span>${auto.map(([id, e]) => `<button class="chip auto-chip" data-act="pinrec" data-team="${t.id}" data-role="${r}" data-id="${id}" data-lv="${e.lv}" data-one="${e.one ? 1 : ""}" title="눌러서 이 숙련도로 고정${e.g ? ` · ${e.g}판 ${Math.round(e.wr)}%` : ""}">${icon(id, "sm")}${esc(CH[id].ko)} ${lvTag({ lv: e.lv, one: e.one })}${e.g || e.rg ? `<span class="st">${e.g || e.rg}판</span>` : ""}</button>`).join("")}${auto.length > 1 ? `<button class="auto-all" data-act="pinrecall" data-team="${t.id}" data-role="${r}">모두 고정</button>` : ""}` : "";
    if (!pool.length) return autoHtml || `<span class="dim">챔프폭·기록 없음 — 챔프를 직접 넣거나, 다음 수집 때 기록으로 채워집니다</span>`;
    return autoHtml ? pool.map(([id, lv, one]) => `<span class="chip ${opts && opts.edit ? "ed-chip" : ""}" ${opts && opts.edit ? `data-act="cycle" data-team="${t.id}" data-role="${r}" data-id="${id}"` : ""}>${icon(id, "sm")}${esc(CH[id] ? CH[id].ko : id)} ${lvTag({ lv, one })}${opts && opts.edit ? `<span class="del" data-act="del" data-team="${t.id}" data-role="${r}" data-id="${id}" title="삭제" role="button" aria-label="삭제"><svg class="ico-x" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>` : ""}</span>`).join("") + `<span class="auto-sep"></span>` + autoHtml : poolHtml(pool, t, r, opts);
  }
  function poolHtml(pool, t, r, opts) {
    return pool.map(([id, lv, one]) => `<span class="chip ${opts && opts.edit ? "ed-chip" : ""}" ${opts && opts.edit ? `data-act="cycle" data-team="${t.id}" data-role="${r}" data-id="${id}"` : ""}>${icon(id, "sm")}${esc(CH[id] ? CH[id].ko : id)} ${lvTag({ lv, one })}${opts && opts.edit ? `<span class="del" data-act="del" data-team="${t.id}" data-role="${r}" data-id="${id}" title="삭제" role="button" aria-label="삭제"><svg class="ico-x" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>` : ""}</span>`).join("");
  }
  const TIER_KO = { IRON: "아이언", BRONZE: "브론즈", SILVER: "실버", GOLD: "골드", PLATINUM: "플래티넘", EMERALD: "에메랄드", DIAMOND: "다이아", MASTER: "마스터", GRANDMASTER: "그랜드마스터", CHALLENGER: "챌린저" };
  function totalTxt(t, r) {
    const sc = E.scoutOf(t, r);
    if (!sc || !sc.total || !sc.total.g) return "";
    const tierTxt = sc.tier ? ` · 솔랭 ${TIER_KO[sc.tier.tier] || sc.tier.tier}${sc.tier.rank && !/MASTER|CHALLENGER/.test(sc.tier.tier) ? " " + ({ I: 1, II: 2, III: 3, IV: 4 }[sc.tier.rank] || sc.tier.rank) : ""}` : "";
    return `${tierTxt} · 랭크 ${sc.total.g}판 ${Math.round((sc.total.w / sc.total.g) * 100)}%`;
  }
  function opgg(riot) {
    const [n, tag] = String(riot).split("#");
    return `https://op.gg/ko/lol/summoners/kr/${encodeURIComponent((n || "").trim() + "-" + (tag || "KR1").trim())}`;
  }
  function findChamp(q) {
    q = String(q || "").trim().toLowerCase().replace(/\s+/g, "");
    if (!q) return null;
    const norm = (s) => s.toLowerCase().replace(/\s+/g, "");
    return window.CHAMPIONS.find((c) => norm(c.ko) === q || c.id.toLowerCase() === q || c.al.split(" ").includes(q))
      || window.CHAMPIONS.find((c) => norm(c.ko).startsWith(q) || c.id.toLowerCase().startsWith(q))
      || null;
  }
  // 초성: "ㅁㅍ" → 말파이트. 글자 조합 중인 끝 자음(예: "말ㅍ")도 초성으로 비교
  const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  const cho = (s) => [...s].map((ch) => { const k = ch.charCodeAt(0) - 0xac00; return k >= 0 && k <= 11171 ? CHO[Math.floor(k / 588)] : ch; }).join("");
  function matches(c, q) {
    if (!q) return true;
    q = q.toLowerCase().replace(/\s+/g, "");
    const names = [c.ko.replace(/\s+/g, ""), c.al.replace(/\s+/g, "")].filter(Boolean);
    if (names.some((n) => n.includes(q)) || c.id.toLowerCase().includes(q)) return true;
    if (/[ㄱ-ㅎ]/.test(q)) {
      // 앞부분은 글자 그대로, 자음만 친 부분은 초성으로
      return names.some((n) => { for (let i = 0; i + q.length <= n.length; i++) { const part = n.slice(i, i + q.length); if ([...q].every((ch, k) => ch === part[k] || (/[ㄱ-ㅎ]/.test(ch) && cho(part[k]) === ch))) return true; } return false; });
    }
    return false;
  }

  // ---------- 새 디자인(PC) 전용 아이콘 — 한 점 서명(2px 선 + 보라 점), 실시간 밴픽·주의만 글자 표식 ----------
  const LBG = {
    home: '<path d="M4 11 12 4l8 7v9H4z"/><circle class="dot" cx="12" cy="15" r="1.8"/>',
    scout: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/><circle class="dot" cx="10.5" cy="10.5" r="1.8"/>',
    vision: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3.2"/><circle class="dot" cx="12" cy="12" r="1.4"/>',
    note: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 8.5h7M8.5 12.5h4.5"/><circle class="dot" cx="15.5" cy="16.5" r="1.8"/>',
    undo: '<path d="M9 6 4 11l5 5"/><path d="M4 11h10a5.5 5.5 0 0 1 0 11h-2"/><circle class="dot" cx="4" cy="11" r="1.8"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4.5h-4.5"/><circle class="dot" cx="12" cy="12" r="1.8"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/><circle class="dot" cx="12" cy="16" r="1.8"/>',
    invite: '<circle cx="9" cy="8.5" r="3.5"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><path class="hil" d="M19 7v6M16 10h6"/>',
    settings: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="var(--bg)"/><circle class="dot" cx="15.5" cy="12" r="2"/><circle cx="7" cy="17" r="2" fill="var(--bg)"/>',
    comp: '<circle cx="12" cy="6" r="2.6"/><circle cx="6" cy="17" r="2.6"/><circle cx="18" cy="17" r="2.6"/><path d="M10.6 8.2 7.4 14.8M13.4 8.2l3.2 6.6M8.6 17h6.8"/><circle class="dot" cx="12" cy="6" r="1.2"/>',
    mastery: '<path d="M5 13l7-5 7 5"/><path d="M5 19l7-5 7 5"/><circle class="dot" cx="12" cy="4.5" r="1.8"/>',
    counter: '<circle cx="12" cy="12" r="7"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><circle class="dot" cx="12" cy="12" r="1.8"/>',
    meta: '<path d="M5 20v-5M12 20v-9M19 20V6"/><circle class="dot" cx="19" cy="3.5" r="1.8"/>',
    check: '<path d="M5 12.5 10 17.5 19.5 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/><circle class="dot" cx="19" cy="5" r="1.8"/>',
    chev: '<path d="m8 10 4 4 4-4"/>',
  };
  // 로고(11-19 사용자 결정 「04 두 진영 · A 균형」, tmp/lol-draft-design/DECISIONS.md): 원을 위·아래로 잘라 왼쪽 괄호 = 우리 팀 파랑, 오른쪽 = 상대 빨강, 가운데 점 = 강조색
  // 색은 CSS 변수(--blue·--red·--hi)라 라이트·다크를 그대로 따라감
  const LOGO_MARK = `<svg class="lb-mark" viewBox="0 0 64 64" aria-hidden="true"><path d="M19.81 12.50A23 23 0 0 0 19.81 51.50" fill="none" stroke="var(--blue)" stroke-width="9" stroke-linecap="round"/><path d="M44.19 12.50A23 23 0 0 1 44.19 51.50" fill="none" stroke="var(--red)" stroke-width="9" stroke-linecap="round"/><circle cx="32" cy="32" r="7" fill="var(--hi)"/></svg>`;
  function lbi(k, size) {
    const z = size || 22;
    if (k === "draft" || k === "warn") { const [t, bg] = k === "draft" ? ["BP", "var(--hi)"] : ["!", "var(--red)"];
      return `<svg class="lbi" width="${z}" height="${z}" viewBox="0 0 24 24" aria-hidden="true"><rect x=".5" y=".5" width="23" height="23" rx="7" fill="${bg}"/><text x="12" y="12.6" text-anchor="middle" dominant-baseline="middle" font-family="Pretendard Variable, Pretendard, sans-serif" font-weight="800" font-size="${t.length > 1 ? 9 : 13}" fill="${k === "draft" ? "var(--on-gold, #fff)" : "#fff"}">${t}</text></svg>`; }
    return `<svg class="lbi" width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LBG[k] || ""}</svg>`;
  }
  const crestOf = (t, cls) => `<span class="crest ${cls || ""}" aria-hidden="true">${esc([...String((t && t.name) || "?")][0] || "?")}</span>`;
  // ---------- 새 디자인(PC) 사이드바·머리줄 ----------
  const guest = () => !(SPACE && !SPACE.bad);
  const GUEST_TABS = ["live", "our"];   // our = 로그인·팀 만들기 화면
  const SIDE_MENU = [["our", "home", "홈"], ["live", "draft", "실시간 밴픽"], ["vision", "vision", "시야 공부"], ["notes", "note", "피드백 노트"]];
  function renderSideNav() {
    const el = document.getElementById("side");
    if (!el) return;
    const sp = spaceTeamId(), ourT = team(S.ourTeam);
    const our = ourT && !ourT.solo ? ourT : sp ? team(sp) : null;
    const opp = S.teams.filter((t) => !t.solo && (!our || t.id !== our.id));
    const curOpp = S.tab === "enemy" || S.tab === "live" ? S.enemyTeam : "";
    if (guest()) {
      el.innerHTML = `<a class="sd-logo tab" data-tab="our" href="/" aria-label="lolban 홈으로">${LOGO_MARK}<span>lolban<i>.</i></span></a>
        <button class="tab sd-mi" data-tab="live" aria-selected="${S.tab === "live"}">${lbi("draft", 22)}실시간 밴픽</button>
        <div class="sd-sec">팀으로 쓰기</div>
        <button class="tab sd-tm sd-new" data-tab="our" aria-current="${S.tab === "our"}">${lbi("plus", 20)}<span class="nm">${SESS ? "팀 만들기 · 들어가기" : "로그인 · 팀 만들기"}</span></button>
        ${SESS && AUTH.user ? `<p class="help sd-guest">${esc(AUTH.user.nick || "로그인됨")}님 로그인됨</p>` : ""}
        <p class="help sd-guest">팀을 등록하면 우리 팀 홈 · 상대 분석 · 피드백 노트 · 시야 공부를 씁니다. 지금은 솔랭·자랭 기준 밴픽만</p>
        <div class="sd-foot">${meRow()}${themeBtn()}</div>`;
      return;
    }
    el.innerHTML = `<a class="sd-logo tab" data-tab="our" href="/" aria-label="lolban 홈으로">${LOGO_MARK}<span>lolban<i>.</i></span></a>
      ${SIDE_MENU.map(([k, ic, n]) => `<button class="tab sd-mi" data-tab="${k}" aria-selected="${S.tab === k}">${lbi(ic, 22)}${n}</button>`).join("")}
      <div class="sd-sec">우리 팀</div>
      ${our ? `<div class="sd-tmw our-w"><button class="tab sd-tm our" data-tab="team" aria-current="${S.tab === "team"}">${crestOf(our, "b")}<span class="nm" title="${esc(our.name)}">${esc(our.name)}</span></button>${sp ? `<button class="sd-tm-inv" data-act="invite" aria-label="${SPACE && SPACE.viaLogin ? "초대 코드 복사" : "팀원 초대 링크 복사"}">${lbi("invite", 20)}</button>` : ""}</div>`
        : `<button class="sd-tm sd-new" data-act="team">${lbi("plus", 20)}<span class="nm">팀 만들기</span></button>`}
      <div class="sd-sec">상대 팀 <button data-act="import" aria-label="상대 팀 등록(엑셀)" title="상대 팀 등록(엑셀)">${lbi("plus", 18)}</button></div>
      ${opp.map((t) => `<div class="sd-tmw"><button class="sd-tm" data-act="pickenemy" data-id="${t.id}" aria-current="${t.id === curOpp}">${crestOf(t, t.id === curOpp ? "r" : "")}<span class="nm" title="${esc(t.name)}">${esc(t.name)}</span></button><button class="sd-tm-x" data-act="delteam" data-id="${t.id}" aria-label="「${esc(t.name)}」 팀 삭제">×</button></div>`).join("")
        || `<span class="help" style="padding:4px 12px">아직 없음 · 위 + 로 등록</span>`}
      <button class="sd-tm" data-act="pickenemy" data-id="${SOLO.enemy}" aria-current="${curOpp === SOLO.enemy}"><span class="crest" aria-hidden="true">솔</span><span class="nm" style="color:var(--muted)">솔랭·자랭</span></button>
      <div class="sd-foot">${meRow()}<button class="sd-mi" data-act="settings" aria-selected="${S.tab === "settings"}">${lbi("settings", 22)}설정</button>${themeBtn()}</div>`;
  }
  // 글자 없는 아이콘 버튼에 이름표: aria-label(없으면 title)을 data-tip으로, 브라우저 기본 툴팁(늦게 뜸)은 지움
  function tipIcons() {
    document.querySelectorAll("#side button, #mhead button, #view button, #view a.ib").forEach((b) => {
      if (b.textContent.replace(/\s/g, "")) return;
      const t = b.getAttribute("aria-label") || b.getAttribute("title"); if (!t) return;
      b.dataset.tip = t; if (!b.getAttribute("aria-label")) b.setAttribute("aria-label", t); b.removeAttribute("title");
    });
  }
  // 다크·라이트: 처음엔 기기 설정을 따르고, 누르면 반대로 고정(이 브라우저에 저장)
  const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
  const SUN = `<svg class="lbi" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>`;
  const MOON = `<svg class="lbi" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>`;
  // 토글 스위치(사용자 지시 11-19): 켜짐 = 다크 모드
  // 사이드바 아래: 로그인한 사람 · 로그아웃(어디서든 보이게, 11-19 사용자 지적)
  function meRow() { return SESS ? `<div class="sd-me"><span title="${esc(AUTH.user && AUTH.user.nick || "")}">${esc((AUTH.user && AUTH.user.nick) || "로그인됨")}<small>${PROVIDER_KO[AUTH.user && AUTH.user.provider] || ""}</small></span><button class="nc-a" data-act="lgout">로그아웃</button></div>` : ""; }
  function themeBtn() { const d = isDark(); return `<button class="sd-mi sd-theme" role="switch" aria-checked="${d}" data-act="theme">${d ? MOON : SUN}<span>다크 모드</span><span class="sw" aria-hidden="true"><i></i></span></button>`; }
  function renderHead() {
    const el = document.getElementById("mhead");
    if (!el) return;
    const ourT = team(S.ourTeam), en = team(S.enemyTeam);
    const ourName = ourT && !ourT.solo ? ourT.name : "솔랭·자랭";
    const vsOpen = S.ui.vsOpen || "";
    const pickList = (k) => {
      const sp = spaceTeamId();
      const teams = k === "our" ? S.teams.filter((t) => !t.solo && (sp ? t.id === sp : t.id === S.ourTeam)) : S.teams.filter((t) => !t.solo && t.id !== S.ourTeam);
      const cur = k === "our" ? S.ourTeam : S.enemyTeam, solo = k === "our" ? SOLO.our : SOLO.enemy;
      const item = (id, name, crest) => `<button role="option" data-act="vspick" data-k="${k}" data-id="${id}" aria-selected="${cur === id}">${crest}<span>${esc(name)}</span>${cur === id ? lbi("check", 16) : ""}</button>`;
      return `<div class="vs-pop ${k}" role="listbox" aria-label="${k === "our" ? "우리 팀 고르기" : "상대 고르기"}">${teams.length ? `<small>${k === "our" ? "우리 팀" : "상대 팀"}</small>${teams.map((t) => item(t.id, t.name, crestOf(t, k === "our" ? "b" : "r"))).join("")}` : ""}
        <small>팀 없이</small>${item(solo, "솔랭·자랭", `<span class="crest" aria-hidden="true">솔</span>`)}${k === "enemy" && !guest() ? `<button class="vs-add" data-act="import">${lbi("plus", 16)}상대 팀 등록</button>` : ""}</div>`;
    };
    const side = (k, name, crest, cls) => `<span class="vs-side"><button class="vs-btn ${cls}" data-act="vsopen" data-k="${k}" aria-haspopup="listbox" aria-expanded="${vsOpen === k}">${k === "our" ? crest : ""}<span>${esc(name)}</span>${k === "enemy" ? crest : ""}<svg class="vs-car" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>${vsOpen === k ? pickList(k) : ""}</span>`;
    const vs = `<span class="mh-t">${side("our", ourName, crestOf(ourT && !ourT.solo ? ourT : { name: "솔" }, "b"), "tb")}<span class="vs">VS</span>${side("enemy", en && !en.solo ? en.name : "솔랭·자랭", crestOf(en && !en.solo ? en : { name: "솔" }, "r"), "tr")}</span>`;
    const since = md(PREP.since || (window.RECENT && window.RECENT.since) || "2026-11-10");
    let c;
    if (S.tab === "live") c = `${vs}<span class="mh-s">${S.series.game}세트${S.series.mode !== "off" ? ` · 피어리스 잠금 ${(S.series.locked || []).length}` : " · 피어리스 끔"}</span>`;
    else if (S.tab === "enemy") c = `${vs}<span class="mh-s">${S.ui.enView === "comps" ? "예상 조합 · 상황별" : "상대 분석"} · ${since}~ 랭크 기준</span>`;
    else if (S.tab === "our" && needOnboard()) c = `<b class="mh-t">${SESS ? "팀 만들기 · 들어가기" : "로그인"}</b><span class="mh-s">${SESS ? "팀장은 팀을 만들고 6자리 초대 코드를 팀원에게" : "구글·네이버로 로그인 · 팀원은 초대 코드로 들어옴"}</span>`;
    else if (S.tab === "our") {
      const g = ourT && !ourT.solo && window.RECENT && window.RECENT.status === "ok" ? E.groupsOf(ourT) : null;
      c = `<span class="mh-t">${crestOf(ourT && !ourT.solo ? ourT : { name: "솔" }, "b")}<span class="tb">${esc(ourName)}</span></span><span class="mh-s">연습 기간 ${since}~${g ? ` · 함께 한 경기 ${g.length}판 ${g.filter((x) => x.win).length}승` : ""}</span>`;
    } else {
      const VS = window.VISION, nD = typeof allDrills === "function" && VS ? allDrills().length : 0, nOk = Object.values(S.ui.dScore || {}).filter(Boolean).length;
      const T = { team: ["우리 팀", `${esc(ourName)} · 선수·챔프폭 · 팀원 초대`], vision: ["시야 공부", VS ? `맞힘 ${nOk} / ${nD} · 출처 ${esc(VS.source.author)}` : "배우기 · 문제 · 한눈에 보기"], notes: ["피드백 노트", `${esc(ourName)} · 팀원 모두에게 공유${NT.list ? ` · ${NT.list.length}개` : ""}`], settings: ["설정", SPACE && !SPACE.bad ? `${esc(SPACE.name || "")} 팀 공간 · 바꾼 내용은 팀원 모두에게 적용` : "팀 공간 없음 — 이 브라우저에만 저장"], import: ["명단 등록", "사진 · 엑셀 · 텍스트 아무거나 넣으면 명단으로"] }[S.tab] || ["", ""];
      c = `<b class="mh-t">${T[0]}</b><span class="mh-s">${T[1]}</span>`;
    }
    el.innerHTML = `<div class="mh-l">${S.tab === "live" ? liveLeftPC() : ""}</div><div class="mh-c">${c}</div><div class="mh-r" id="mheadR">${S.tab === "live" ? liveSetBarPC() : ""}</div>`;
  }

  // ---------- header ----------
  function renderTop() {
    document.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === S.tab)));
    // 대회 팀 목록 아래에 「솔랭·자랭」(팀 자료 없음)
    const opts = (sel, excl, soloId) => S.teams.filter((t) => t.id !== excl && !t.solo).map((t) => `<option value="${t.id}" ${t.id === sel ? "selected" : ""}>${esc(t.name)}</option>`).join("")
      + `<optgroup label="팀 자료 없이"><option value="${soloId}" ${sel === soloId ? "selected" : ""}>솔랭·자랭</option></optgroup>`;
    const sp = spaceTeamId();
    document.getElementById("ourSel").innerHTML = sp
      ? S.teams.filter((t) => t.id === sp).map((t) => `<option value="${t.id}" ${t.id === S.ourTeam ? "selected" : ""}>${esc(t.name)}</option>`).join("") + `<option value="${SOLO.our}" ${S.ourTeam === SOLO.our ? "selected" : ""}>솔랭·자랭</option>`
      : opts(S.ourTeam, null, SOLO.our);
    const cta = document.getElementById("topCta"); if (cta) cta.innerHTML = topCta();
    const tb = document.getElementById("teamBtn");
    if (tb) { tb.innerHTML = `${ico("gear")}<span>설정</span>`; tb.title = SPACE && !SPACE.bad ? `설정 · ${SPACE.name || "팀 공간"}` : "설정"; tb.setAttribute("aria-pressed", String(S.tab === "settings")); }
    document.getElementById("enemySel").innerHTML = opts(S.enemyTeam, S.ourTeam, SOLO.enemy);
  }

  // ---------- live draft ----------
  // 단계 이름: 대회 = 1차 밴·1차 픽·2차 밴·2차 픽, 솔랭·자랭 = 밴·픽
  function phaseName(i) {
    const t = ORDER[i][1];
    if (ORDER.kind === "ranked") return (t === "ban" ? "밴" : "픽") + " 단계";
    let n = 0;
    for (let k = 0; k <= i; k++) if (ORDER[k][1] === t && (k === 0 || ORDER[k - 1][1] !== t)) n++;
    return `${n}차 ${t === "ban" ? "밴" : "픽"}`;
  }
  const curStep = () => (S.draft.idx < ORDER.length ? ORDER[S.draft.idx] : null);
  function sideIdx(side, type) { return ORDER.map((o, i) => (o[0] === side && o[1] === type ? i : -1)).filter((i) => i >= 0); }

  function renderSide(side, planned) {
    const who = E.whoOfSide(S, side);
    const t = E.teamOf(S, who);
    const bans = sideIdx(side, "ban").map((i) => {
      const s = S.draft.steps[i];
      const now = i === S.draft.idx ? "now" : "";
      return `<div class="slot-ban ${now}">${s.champ ? `<img src="${IMG(s.champ)}" alt="${esc(CH[s.champ].ko)}" title="${esc(CH[s.champ].ko)}" onerror="this.remove()"><span class="x"><svg class="ico-x" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>` : s.skip ? `<span class="dim">없음</span>` : ""}</div>`;
    }).join("");
    const picks = sideIdx(side, "pick").map((i) => {
      const s = S.draft.steps[i];
      const now = i === S.draft.idx ? "now" : "";
      if (!s.champ) {
        const pr = who === "our" && planned ? planned[i] : null;
        return `<div class="slot-pick empty ${now}"><span class="ic"></span><div class="who"><div class="cn">${now ? "선택 중" : pr ? ROLE_KO[pr] : "대기"}</div><div class="pn">${pr ? (now ? ROLE_KO[pr] + " 차례" : "예정") : ""}</div></div></div>`;
      }
      // 라인 '모름': 다른 픽으로 좁혀진 라인(자동) 또는 남은 후보를 보여 준다
      const ep = s.role === "?" ? E.picks(S, who).find((x) => x.i === i) : null;
      const eff = ep ? ep.role : s.role;
      const p = eff ? t.players[eff] : null;
      const unk = who === "enemy" || s.role === "?"
        ? `<option value="?" ${s.role === "?" ? "selected" : ""}>${ep && ep.role ? `모름→${ROLE_KO[ep.role]}` : "모름"}</option>` : "";
      const sel = `<select data-act="role" data-i="${i}" aria-label="라인">${unk}${ROLES.map((r) => `<option value="${r}" ${r === s.role ? "selected" : ""}>${ROLE_KO[r]}</option>`).join("")}</select>`;
      const pn = ep && !ep.role ? `<span class="unk">${ep.cands.map((r) => ROLE_KO[r]).join("·")} 중</span>` : p ? esc(nick(p.riot)) + (ep && ep.guessed ? " (추정)" : "") : "";
      // 마우스를 올리면: 상대 픽 → 우리 대응 픽, 우리 픽 → 상대가 꺼낼 대응 픽(남은 라인·챔프폭 기준)
      return `<div class="slot-pick ${now}" data-hov="${s.champ}" data-hwho="${who}" data-hrole="${eff || ""}" tabindex="0">${icon(s.champ)}<div class="who"><div class="cn">${esc(CH[s.champ].ko)}</div><div class="pn">${pn}</div></div>${sel}</div>`;
    }).join("");
    return `<section class="side ${side}"><div class="side-h"><span class="nm">${esc(t.name)}</span><span class="tag">${side === "B" ? "블루" : "레드"} · ${who === "our" ? "우리" : "상대"}</span></div><div class="bans">${bans}</div><div class="picks">${picks}</div></section>`;
  }

  // 근거 줄: 분류 이름표 + 한 문장 (전체·라인 칸 모두 같은 모양)
  // PC(새 디자인): 「시즌 5판 60%」처럼 분류가 앞에 붙은 근거는 분류 칸 + 값으로 나눠 왼쪽 정렬 한 줄씩
  const PILL_K = /^(시즌|연습|팀원과|대회|자기평가)\s+(.+)$/;
  const pillsHtml = (ps) => `<span class="cpills">${ps.map((p) => { const m = !MOB.matches && String(p.t).match(PILL_K);
    return m ? `<span class="cp kv ${p.c}"><i>${esc(m[1] === "팀원과" ? "팀원" : m[1])}</i>${esc(m[1] === "팀원과" ? "함께 " + m[2] : m[2])}</span>` : `<span class="cp ${p.c}">${esc(p.t)}</span>`; }).join("")}</span>`;
  const factHtml = (lines) => `<span class="fx">${lines.map((x) => `<span class="fx-r"><span class="fx-l fx-${x.k}">${esc(x.l)}</span><span class="fx-t">${esc(x.t)}</span></span>`).join("")}</span>`;
  // 추천·예상 카드(PC 새 디자인, 시안 그대로): 순위·이름·라인 → 이유 두 줄(아이콘 + 짧은 말) → 경고 한 줄(빨강) → 장단점 한 줄 · 상대는 선수 기록 한 줄 + 우리 대응
  // 계산은 운영 엔진(reasons·good·bad·answers) 그대로, 길게 늘어놓던 근거를 시안 모양으로 줄인다. 전체 근거는 마우스를 올리면(title)
  const REASON_SKIP = /^(픽 순서|나중에)$/;
  function reasonIcon(t) { return /조합|세트|설계/.test(t) ? "comp" : /숙련도|원챔|목표|자기평가/.test(t) ? "mastery" : /카운터|맞대응|대비|차단|버팀|녹이기|뺏기/.test(t) ? "counter" : "meta"; }
  function reasonShort(x) {
    const vs = x.d && x.d.match(/^vs (\S+)/);
    if (/카운터 픽/.test(x.t) && vs) return `${vs[1]} 카운터`;
    if (x.t === "주의") return x.d.replace(/\(.*\)$/, "").replace(/ 상대로 /, " 상대 ").trim();
    return x.t.replace(/\(\d+판\)$/, "");
  }
  // 카드 아래 상세 줄(사용자 결정 11-19): 카드에 줄인 근거 전체를 마우스·키보드 초점이 간 카드 기준으로 한 줄에. 카운터·시너지는 기존 떠 있는 창 그대로
  const REC_DET = {};
  // 기록 숫자 강조 기준(사용자 요청 11-19): 기준 이상이면 강조(우리 = 보라 굵게, 상대 = 빨강 굵게 = 위협), 우리 쪽이 기준 아래면 옅은 빨강
  //   시즌 20판 이상·승률 55% 이상 / 연습 3판 이상·승률 60% 이상 / 팀원과 함께 2판 이상·승률 60% 이상 / 대회 밴픽 우선도 30% 이상
  //   약함(우리만): 시즌 10판 이상·승률 45% 이하, 연습 3판 이상·승률 35% 이하
  const KV_RULE = { 시즌: [20, 55, 10, 45, "20판 이상·승률 55% 이상"], 연습: [3, 60, 3, 35, "3판 이상·승률 60% 이상"], 팀원과: [2, 60, 99, 0, "함께 2판 이상·승률 60% 이상"] };
  function kvLevel(k, v) {
    if (k === "대회") { const p = +(String(v).match(/(\d+)%/) || [])[1]; return p >= 30 ? ["hot", "대회 밴픽 우선도 30% 이상"] : ["", ""]; }
    const R = KV_RULE[k]; if (!R) return ["", ""];
    const g = +(String(v).match(/(\d+)판/) || [])[1] || 0;
    const pm = String(v).match(/(\d+)%/), wm = String(v).match(/(\d+)승/);
    const wr = pm ? +pm[1] : g && wm ? Math.round((+wm[1] / g) * 100) : null;
    if (wr == null) return ["", ""];
    if (g >= R[0] && wr >= R[1]) return ["hot", R[4]];
    if (g >= R[2] && wr <= R[3]) return ["weak", `${R[2]}판 이상·승률 ${R[3]}% 이하`];
    return ["", ""];
  }
  // 상세 줄은 카드에 없는 것만, 한 줄로(사용자 지적 11-19 「잡다하고 많음」): 기록 숫자 · 카드에 안 나온 이유 이름 · 카드에 안 나온 장단점
  function recDetailHtml(r, type, muted, fx) {
    let pills = fx;
    if (!pills && r.role) { try { pills = E.cardPills(E.teamOf(S, muted ? "enemy" : "our"), r.role, r.id, r.reasons, !!muted); } catch (e) { pills = null; } }
    const kv = (pills || []).map((x) => String(x.t).match(PILL_K)).filter((m) => m && m[1] !== "자기평가");
    const rs = (r.reasons || []).filter((x) => !REASON_SKIP.test(x.t));
    const shown = new Set([...rs.filter((x) => x.v > 0).slice(0, 2), rs.filter((x) => x.v < 0).sort((a, b) => a.v - b.v)[0]].filter(Boolean).map((x) => x.t));
    const more = rs.filter((x) => !shown.has(x.t)).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 3);
    const goodShown = muted ? [] : (r.good || []).filter((g) => !/조합에 맞음$/.test(g)).slice(0, 2);
    const extraBad = (r.bad || []).slice(muted ? 0 : 1, 3);
    const parts = [];
    if (kv.length) parts.push(`<span class="rd-p">${kv.map((m) => { const [lv, why] = kvLevel(m[1], m[2]); const cls = lv === "hot" ? (muted ? "kv-threat" : "kv-hot") : lv === "weak" && !muted ? "kv-weak" : "";
      return `<span class="${cls}" ${why ? `title="기준: ${esc(why)}"` : ""}><i>${esc(m[1] === "팀원과" ? "팀원" : m[1])}</i><em>${esc(m[2])}</em></span>`; }).join("")}</span>`);
    if (more.length) parts.push(`<span class="rd-p">${more.map((x) => `<span class="${x.v < 0 ? "bad" : ""}">${lbi(x.v < 0 ? "warn" : reasonIcon(x.t), 14)}${esc(reasonShort(x))}</span>`).join("")}</span>`);
    if (extraBad.length) parts.push(`<span class="rd-p">${extraBad.map((b) => `<span class="bad">${esc(b)}</span>`).join("")}</span>`);
    return parts.length ? `<b class="rd-n">${esc(CH[r.id].ko)}</b>${parts.join(`<span class="rd-sep"></span>`)}` : "";
  }
  function recCardPC(r, type, muted, rank, fx) {
    REC_DET[r.id] = recDetailHtml(r, type, muted, fx);
    const rs = (r.reasons || []).filter((x) => !REASON_SKIP.test(x.t));
    const pos = rs.filter((x) => x.v > 0).slice(0, 2), neg = rs.filter((x) => x.v < 0).sort((a, b) => a.v - b.v)[0];
    const full = rs.map((x) => `${x.t}: ${x.d}`).join("\n");
    const line = (ic, txt, cls) => `<span class="rl ${cls || ""}">${lbi(ic, 15)}<span>${esc(txt)}</span></span>`;
    let lines = "";
    if (muted) {   // 상대 예상: 그 선수 기록 한 줄 + 이유 한 줄
      const top = pos[0];
      const rec = top && top.d ? top.d.replace(/^(탑|정글|미드|원딜|서폿)\s+/, "").split(" · ").slice(1, 3).join(" · ") : "";   // 선수 이름은 빼고 기록만(사용자 지시 11-19)
      lines = (rec ? `<span class="rl rec-who">${esc(rec)}</span>` : "") + (pos[1] ? line(reasonIcon(pos[1].t), reasonShort(pos[1])) : "");
    } else lines = pos.map((x) => line(reasonIcon(x.t), reasonShort(x))).join("");
    if (neg) lines += line("warn", reasonShort(neg), "bad");
    const lab = r.comp || r.label;
    const goods = muted ? [] : (r.good || []).filter((g) => !/조합에 맞음$/.test(g) && !pos.some((x) => x.t === g)).slice(0, 2), bads = muted ? [] : (r.bad || []).slice(0, 1);
    return `<button class="rec ${type} ${muted ? "muted" : ""} ${rank === 1 || r.comp ? "first" : ""} ${r.comp ? "comp" : ""}" data-act="pick" data-id="${r.id}" ${r.role ? `data-role="${r.role}"` : ""} aria-label="${esc(CH[r.id].ko + (full ? " · " + full.replace(/\n/g, " · ") : ""))}">
      <span class="hero">${icon(r.id, "hero").replace(/ title="[^"]*"/, "")}${rank ? `<b class="rk3" aria-label="${rank}순위">${rank}</b>` : ""}${lab ? `<span class="lab">${esc(lab)}</span>` : ""}</span>
      <span class="nm"><span class="cn">${esc(CH[r.id].ko)}</span>${r.role || r.tgt ? `<span class="pos">${ROLE_KO[r.role || r.tgt]}</span>` : ""}</span>
      <span class="why">${lines}${goods.length ? `<span class="rl gd">${esc(goods.join(" · "))}</span>` : ""}${bads.length && !neg ? `<span class="rl bd">${esc(bads[0])}</span>` : ""}</span>
      ${r.answers && r.answers.length ? `<span class="ans">${lbi("counter", 15)}우리 대응 ${r.answers.slice(0, 2).map((id) => esc(CH[id].ko)).join("·")}</span>` : ""}</button>`;
  }
  function recCard(r, type, muted, rank, fx) {
    if (!MOB.matches) return recCardPC(r, type, muted, rank, fx);
    // 우리 픽: 무엇에 좋고 무엇에 약한지만 짧게. 밴·상대 예상: 근거 두 줄
    // 이름표와 같은 말(예: '한타 조합' + '한타 조합에 맞음')은 한 번만
    const goods = r.good ? r.good.filter((g) => !(r.label && / 조합$/.test(r.label) && g === r.label + "에 맞음")) : null;
    const why = fx ? pillsHtml(fx) : r.good ? `<span class="tgs">${goods.map((g) => tagHtml(g, true)).join("")}${r.bad.map((b) => tagHtml(b, false)).join("")}</span>`
      : r.reasons.filter((x) => x.v > 0 && !x.order).slice(0, 2).map((x) => esc(x.d)).join("<br>");
    return `<button class="rec ${type} ${muted ? "muted" : ""} ${rank === 1 || r.comp ? "first" : ""} ${r.comp ? "comp" : ""}" data-act="pick" data-id="${r.id}" ${r.role ? `data-role="${r.role}"` : ""}>
      <span class="hero">${icon(r.id, "hero").replace(/ title="[^"]*"/, "")}${rank ? `<span class="rk" aria-label="추천 ${rank}순위">${rank}</span>` : ""}<span class="lab">${esc(r.comp || r.label)}</span></span>
      <span class="nm"><span class="cn">${esc(CH[r.id].ko)}</span>${r.role || r.tgt ? `<span class="pos">${ROLE_KO[r.role || r.tgt]}</span>` : ""}</span><span class="why${fx ? " has-fx" : ""}">${why}</span>
      ${r.answers && r.answers.length ? `<span class="ans">대응 ${r.answers.map((id) => `<b>${esc(CH[id].ko)}</b>`).join("·")}</span>` : ""}</button>`;
  }

  let NOW_HEAD = null;   // PC: 머리 줄(차례 제목·라인 칸·조합 방향)을 따로 두려고
  function renderNow(split) {
    const st = curStep();
    if (!st) return `<div class="now-box"><div class="now-h"><span class="what">밴픽 완료</span><span class="step">아래 전략을 확인하세요</span></div></div>`;
    const [side, type] = st;
    const who = E.whoOfSide(S, side);
    const t = E.teamOf(S, who);
    let list = type === "ban" ? E.recommendBan(S, who) : E.recommendPick(S, who);
    // 우리 픽: 추천 조합 1순위가 남은 라인에 쓰는 챔프도 같은 금색으로(이름표 「OO 추천 조합」). 6장 안에 없으면 마지막 칸에 넣는다
    if (type === "pick" && who === "our") {
      const GP = goalPlanNow();
      const top = GP ? GP.sel : null;
      if (top) {
        // 금색은 이번 차례(연속 픽 칸) 라인의 조합 주 픽만 — 뒤 차례 라인(예: 19번 탑)은 금색·앞자리에서 뺀다
        const turnRoles = [];
        for (let i = S.draft.idx; i < ORDER.length && ORDER[i][0] === side && ORDER[i][1] === "pick"; i++) { const x = GP.steps.find((y) => y.i === i && y.who === "our"); if (x && x.r) turnRoles.push(x.r); }
        ROLES.forEach((r) => {
          const sl = top.slots[r];
          if (!sl || sl.done || !sl.id || (turnRoles.length && !turnRoles.includes(r))) return;
          let card = list.find((x) => x.id === sl.id);
          if (!card && !list.some((x) => x.comp)) { card = E.recommendPick(S, "our", r).find((x) => x.id === sl.id); if (card) list = list.slice(0, 5).concat([card]); }
          if (card && !card.comp) card.comp = `${top.short} 추천 조합`;
        });
        const ps = GP.steps.find((x) => x.i === S.draft.idx && x.who === "our" && x.id);
        const pc = ps && list.find((x) => x.id === ps.id);
        if (pc) pc.comp = "밴픽 설계 픽";
        // 금색(밴픽 설계 픽 → 조합 주 픽)은 앞에 모아서: 순서 번호와 금색이 따로 놀지 않게
        list = (pc ? [pc] : []).concat(list.filter((x) => x.comp && x !== pc), list.filter((x) => !x.comp));
      }
    }
    // 우리 밴: 밴픽 설계의 이번 밴을 맨 앞에 금색으로(설계 = 목표 조합의 카운터 막기)
    if (type === "ban" && who === "our") {
      const GP = goalPlanNow();
      const ps = GP && GP.steps.find((x) => x.i === S.draft.idx && x.who === "our" && x.id);
      if (ps) {
        let card = list.find((x) => x.id === ps.id);
        if (!card) card = { id: ps.id, tgt: ps.er, reasons: [{ t: "밴픽 설계", d: ps.notes.map((x) => x.t).join(" · "), v: 1 }] };
        list = [card].concat(list.filter((x) => x !== card)).slice(0, 6);
        card.comp = "밴픽 설계";
      }
    }
    // 우리 쪽 방향 = 추천 조합 카드에서 고른 조합(없으면 1순위) — 밴픽 설계·추천 순서와 같은 조합
    const GPd = who === "our" ? goalPlanNow() : null;
    const dir = GPd ? null : E.direction(S, who);
    const dirTxt = GPd ? `우리 조합 방향 <b>${esc(GPd.sel.name)}</b>${S.ui.scen === GPd.sel.id ? " · 고름" : ""}` : dir ? `${who === "our" ? "우리" : "상대"} 조합 방향 <b>${COMPS[dir].name}</b>` : "";
    const title = `${who === "our" ? "우리팀" : esc(t.name)} ${type === "ban" ? "밴" : "픽"} 차례${who === "enemy" ? " · 예상" : ""}`;
    let body;
    // 라인별 칸: 상대 차례 = 그 라인 선수 예상, 우리 픽 차례 = 그 라인 우리 추천, 우리 밴 차례 = 상대 그 라인 선수가 꺼낼 챔프(밴 후보)
    const pr = (who === "enemy" ? S.ui.predRole : S.ui.ourRole) || "";
    const tabSide = who === "our" && type === "pick" ? "our" : "enemy";
    const donePicks = E.picks(S, tabSide);
    const roleTabs = `<div class="seg pred-seg" role="group" aria-label="${who === "our" ? "라인별 추천" : "라인별 예상"}">${[["", "전체"]].concat(ROLES.map((r) => [r, ROLE_KO[r]])).map(([r, n]) => {
      const done = r && donePicks.find((p) => p.role === r);
      return `<button data-act="${who === "enemy" ? "pred" : "ourrole"}" data-r="${r}" aria-pressed="${pr === r}" ${done ? `disabled title="${esc(CH[done.champ].ko)} 픽 완료"` : ""}>${n}</button>`; }).join("")}</div>`;
    if (pr && who === "our" && type === "pick") {
      const ol = E.recommendPick(S, "our", pr);
      body = ol.length ? `<p class="help pred-h">${ROLE_KO[pr]} ${esc(nick(t.players[pr].riot))} 선수 추천 · 눌러서 ${ROLE_KO[pr]} 픽으로 기록</p><div class="recs">${ol.map((r, i) => recCard(r, type, false, i + 1)).join("")}</div>`
        : `<div class="empty-recs">${ROLE_KO[pr]} 추천 챔프가 없습니다. 아래에서 직접 고르세요.</div>`;
    } else if (pr) {
      const et = E.teamOf(S, "enemy");
      const pl = E.predictRole(S, "enemy", pr);
      const p = et.players[pr];
      const act = who === "our" ? "우리 밴" : `상대 ${type === "ban" ? "밴" : "픽"}`;
      body = pl.length ? `<p class="help pred-h">상대 ${ROLE_KO[pr]} ${esc(nick(p.riot))} 선수가 꺼낼 수 있는 챔프 · 눌러서 ${act}으로 기록</p><div class="recs">${pl.map((x) => `<button class="rec muted pred" data-act="pick" data-id="${x.id}">
        <span class="hero">${icon(x.id, "hero").replace(/ title="[^"]*"/, "")}<span class="lab">${esc(x.label)}</span></span><span class="nm"><span class="cn">${esc(CH[x.id].ko)}</span><span class="pos">${ROLE_KO[pr]}</span></span><span class="why has-fx">${pillsHtml(E.cardPills(et, pr, x.id, x.now.map((n) => ({ t: "", d: n.t, v: 1 })), true))}</span>
        ${x.answers.length ? `<span class="ans">우리 대응 ${x.answers.map((id) => `<b>${esc(CH[id].ko)}</b>`).join("·")}</span>` : ""}</button>`).join("")}</div>`
        : `<div class="empty-recs">상대 ${ROLE_KO[pr]} 예상 챔프가 없습니다.</div>`;
    } else if (list.length) {
      // 밴: 노리는 상대 선수(tgt)의 기록, 상대 픽 예상: 그 라인 상대 선수의 기록 — 라인 칸과 같은 줄 모양. 우리 픽은 장단점 태그 그대로
      const opp = E.teamOf(S, who === "our" ? "enemy" : "our");
      const fxOf = (r) => type === "ban" ? E.cardPills(opp, r.tgt, r.id, r.reasons, who === "our")
        : who === "enemy" ? E.cardPills(t, r.role, r.id, r.reasons, true) : null;
      body = `<div class="recs">${list.map((r, i) => recCard(r, type, who === "enemy", who === "our" || !MOB.matches ? i + 1 : 0, fxOf(r))).join("")}</div>`;
    }
    else body = `<div class="empty-recs">${who === "enemy" && !E.teamHasPools(t) ? "상대 챔프폭이 비어 있어 예상이 어렵습니다. 「상대팀 분석」에서 챔프폭을 넣으면 예상이 나옵니다." : "추천할 챔프가 없습니다. 아래에서 직접 고르세요."}</div>`;
    NOW_HEAD = { step: title, tabs: roleTabs, dir: dirTxt };
    if (split) return `<div class="now-box">${body}</div>`;
    return `<div class="now-box"><div class="now-h"><span class="what ${side}">${who === "our" ? "추천 순서" : "상대 예상"}</span><span class="step">${title}</span>${roleTabs}<span class="dir">${dirTxt}</span></div>${body}</div>`;
  }

  function renderStatus(extra) {
    const st = curStep();
    const done = !st;
    const side = st ? st[0] : null;
    const who = st ? E.whoOfSide(S, side) : null;
    const t = st ? E.teamOf(S, who) : null;
    const what = done ? "밴픽 완료" : `${who === "our" ? "우리팀" : esc(t.name)} ${st[1] === "ban" ? "밴" : "픽"}`;
    const phase = done ? "아래 전략 확인" : phaseName(S.draft.idx);
    return `<div class="dstat ${side || ""} ${extra || ""}"><div class="dstat-top"><span class="dstat-n">${done ? 20 : S.draft.idx + 1}<small>/20</small></span><span class="dstat-ph">${phase}</span></div>
      <div class="dstat-what">${what}</div>
      <div class="dstat-act">${st && st[1] === "ban" ? `<button class="ib btn sm ghost" data-act="skip" aria-label="밴 넘기기" title="밴 넘기기">${ico("skip")}</button>` : ""}<button class="ib btn sm" data-act="undo" ${S.draft.idx ? "" : "disabled"} aria-label="되돌리기" title="되돌리기">${ico("undo")}</button>${done ? "" : `<button class="btn sm primary m-only" data-act="sheet">고르기</button>`}</div></div>`;
  }

  // 챔피언 버튼 목록만 따로 만든다: 검색 입력 중에는 이것만 바꿔서 한글 조합(ㄹ+ㅜ→루)이 끊기지 않게
  function champButtons() {
    const st = curStep();
    const who = st ? E.whoOfSide(S, st[0]) : "our";
    const taken = E.taken(S);
    const locked = E.lockedFor(S, who);
    const ourPool = new Set();
    const ot = E.teamOf(S, "our");
    ROLES.forEach((r) => (ot.players[r].pool || []).forEach((p) => ourPool.add(p[0])));
    const u = S.ui;
    const list = window.CHAMPIONS.filter((c) => matches(c, u.q) && (!u.role || c.pos.includes(u.role)) && (!u.onlyPool || MOB.matches || ourPool.has(c.id)));
    return list.map((c) => {
      const dis = !st || taken.has(c.id) || locked.has(c.id);
      return `<button class="cbtn ${ourPool.has(c.id) ? "mine" : ""} ${locked.has(c.id) ? "locked" : ""}" data-act="pick" data-id="${c.id}" ${dis ? "disabled" : ""} aria-label="${esc(c.ko)}">${icon(c.id).replace(/ title="[^"]*"/, "")}<span>${esc(c.ko)}</span></button>`;
    }).join("") || `<span class="muted champs-empty">검색 결과 없음</span>`;
  }
  function renderGrid() {
    const u = S.ui;
    const btns = champButtons();
    const roleBtns = [["", "전체"]].concat(ROLES.map((r) => [r, ROLE_KO[r]])).map(([r, n]) => `<button aria-pressed="${u.role === r}" data-act="frole" data-r="${r}">${n}</button>`).join("");
    return `<div class="pool"><div class="sheet-h m-only"><b>챔피언 고르기</b><button class="ib btn sm" data-act="sheet" aria-label="닫기" title="닫기">${ico("x")}</button></div><div class="pool-bar"><input id="q" class="input" placeholder="챔피언 검색 (예: 말파, 오리)" value="${esc(u.q)}" autocomplete="off">
      <div class="seg">${roleBtns}</div>
      <button class="btn sm ${u.onlyPool ? "primary" : ""}" data-act="onlypool">우리 챔프폭만</button></div>
      <div class="champs" id="champs">${btns}</div></div>`;
  }

  function renderFearless() {
    const L = S.series.locked;
    if (!L.length) return "";
    const games = [...new Set(L.map((x) => x.game))];
    const rows = games.map((g) => `<span class="g">${g}세트</span>` + L.filter((x) => x.game === g).map((x) => `<span class="chip" title="${x.who === "our" ? "우리 픽" : "상대 픽"}">${icon(x.id, "sm")}${esc(CH[x.id].ko)}<span class="lv ${x.who === "our" ? "lv2" : "lvone"}">${x.who === "our" ? "우리" : "상대"}</span></span>`).join("")).join("");
    return `<div class="card" style="margin-top:12px"><h3>피어리스 잠금 · ${S.series.mode === "hard" ? "양 팀 모두 사용 불가" : S.series.mode === "soft" ? "자기 팀만 사용 불가" : "꺼짐"}</h3><div class="fearless">${rows}</div></div>`;
  }

  // 저장한 밴픽: 시리즈마다 접었다 펴기, 세트마다 우리·상대 밴과 픽(라인)
  function renderSaved() {
    // 지금 고른 상대와 한 시리즈만(다른 상대 기록은 그 상대를 고르면 보임)
    const all = loadSaved(), list = all.filter((x) => x.enemyTeam === S.enemyTeam || x.sid === S.ui.savedOpen);
    if (!list.length) return "";
    const others = all.length - list.length;
    const chip = (id, extra) => CH[id] ? `<span class="chip">${icon(id, "sm")}${esc(CH[id].ko)}${extra || ""}</span>` : "";
    const none = `<span class="help">없음</span>`;
    const side = (s) => (s === "B" ? "블루" : "레드");
    let sid = "", cur = null;   // gameRow가 쓰는 지금 시리즈
    const fb = (g) => noteBtns({ k: "saved", sid, g: g.game, label: `${cur.enemyName} ${g.game}세트`.slice(0, 60), win: g.result === "W" ? true : g.result === "L" ? false : null });
    const res = (g) => `<span class="seg sv-res" role="group" aria-label="${g.game}세트 결과">${[["W", "승"], ["L", "패"]].map(([v, n]) => `<button class="res-${v.toLowerCase()}" data-act="savedRes" data-sid="${esc(sid)}" data-g="${g.game}" data-v="${v}" aria-pressed="${g.result === v}">${n}</button>`).join("")}</span>`;
    const score = (r) => { const w = r.games.filter((g) => g.result === "W").length, l = r.games.filter((g) => g.result === "L").length; return w || l ? ` · ${w}승 ${l}패` : ""; };
    const focusG = (g) => (S.ui.savedFocus && S.ui.savedFocus.sid === sid && S.ui.savedFocus.g === g.game ? "focus" : "");
    const gameRow = (g) => {
      if (g.partial) {
        const p = (w) => g.picks.filter((x) => x.who === w).map((x) => chip(x.id)).join("") || none;
        return `<div class="sv-g ${focusG(g)}" id="sv-${esc(sid)}-${g.game}"><div class="sv-h"><b>${g.game}세트</b>${res(g)}${fb(g)}<span class="help">밴·라인 기록 없음(저장 기능 전에 넘긴 세트, 픽만)</span></div>
          <div class="sv-r"><span class="sv-l">우리 픽</span>${p("our")}</div><div class="sv-r"><span class="sv-l">상대 픽</span>${p("enemy")}</div></div>`;
      }
      const of = (who, t) => g.steps.filter((s) => s.t === t && (s.side === g.ourSide) === (who === "our"));
      const bans = (who) => of(who, "ban").map((s) => (s.champ ? chip(s.champ) : s.skip ? `<span class="chip">밴 없음</span>` : "")).join("") || none;
      const picks = (who) => of(who, "pick").filter((s) => s.champ).map((s) => chip(s.champ, s.role ? `<span class="lv lvone">${esc(ROLE_KO[s.role])}</span>` : "")).join("") || none;
      return `<div class="sv-g ${focusG(g)}" id="sv-${esc(sid)}-${g.game}"><div class="sv-h"><b>${g.game}세트</b>${res(g)}${fb(g)}<span class="help">우리 ${side(g.ourSide)}${g.enemyName ? ` · 상대 ${esc(g.enemyName)}` : ""}${g.live ? " · 진행 중에 저장" : ""}</span></div>
        <div class="sv-r"><span class="sv-l">우리 밴</span>${bans("our")}</div><div class="sv-r"><span class="sv-l">상대 밴</span>${bans("enemy")}</div>
        <div class="sv-r"><span class="sv-l">우리 픽</span>${picks("our")}</div><div class="sv-r"><span class="sv-l">상대 픽</span>${picks("enemy")}</div></div>`;
    };
    const items = list.map((r) => { sid = r.sid; cur = r; return `<details class="sv" ${S.ui.savedOpen === r.sid ? "open" : ""}><summary><b>${esc(r.at)}</b> · ${esc(r.ourName)} vs ${esc(r.enemyName)} · ${r.games.length}세트${score(r)}</summary>
      ${r.games.map(gameRow).join("")}<div class="dnav"><button class="ib btn sm ghost" data-act="savedDel" data-sid="${esc(r.sid)}" aria-label="이 기록 지우기" title="이 기록 지우기">${ico("trash")}</button></div></details>`; }).join("");
    return `<div class="card" style="margin-top:12px"><h3>저장한 밴픽 · ${esc(teamName(S.enemyTeam))} 상대 ${list.length}개</h3><p class="help">이 브라우저에만 저장됩니다.${others ? ` 다른 상대와 한 기록 ${others}개는 그 상대를 고르면 보입니다.` : ""}</p>${items}</div>`;
  }

  function renderStrategy() {
    if (E.picks(S, "our").length < 5 || E.picks(S, "enemy").length < 5) return "";
    const g = E.buildStrategy(S);
    const lanes = g.lanes.map((l) => `<div class="lane"><span class="r">${ROLE_KO[l.r]}</span>
      <span class="c">${l.a ? icon(l.a, "sm") + esc(CH[l.a].ko) : "-"}</span><span class="vs">vs</span>
      <span class="c right">${l.b ? esc(CH[l.b].ko) + icon(l.b, "sm") : "-"}</span>
      <span class="t"><span class="pill ${l.sc > 0 ? "good" : l.sc < 0 ? "bad" : ""}">${l.tone === "good" ? "유리" : l.tone === "bad" ? "불리" : l.sc > 0 ? "약간 유리" : l.sc < 0 ? "약간 불리" : "비슷"}</span> ${esc(l.t)}${l.plan ? ` — ${esc(l.plan)}` : ""}</span></div>`).join("");
    return `<div class="section-title"><h2>운영 전략 · 시나리오</h2><p>${S.series.game}세트 밴픽 결과 기준</p></div>
    <div class="strat">
      <div class="banner ${g.matchup.tone} wide">우리 ${esc(g.O.name)} vs 상대 ${esc(g.E.name)} — ${esc(g.matchup.t)}${g.answer ? `<div style="font-weight:500;margin-top:6px">대처: ${esc(g.answer)}</div>` : ""}${g.alt ? `<div style="font-weight:500;margin-top:6px">다른 방향: ${esc(g.alt.name)} — ${esc(g.alt.win)}</div>` : ""}</div>
      <div class="card plan"><h3>우리 승리 플랜</h3><dl>
        <dt>승리 조건</dt><dd>${esc(g.O.win)}</dd>
        <dt>초반 (0~14분)</dt><dd>${esc(g.O.early)}</dd>
        <dt>중반 (14~25분)</dt><dd>${esc(g.O.mid)}</dd>
        <dt>후반</dt><dd>${esc(g.O.late)}</dd>
        <dt>주의</dt><dd>${esc(g.O.risk)}</dd></dl></div>
      <div class="card"><h3>라인별 구도</h3><div class="lanes">${lanes}</div></div>
      ${jungleCard(g.jungle)}
      <div class="card"><h3>초반 동선 · 타이밍</h3><dl class="kv"><dt>정글</dt><dd>${esc(g.jungle.jgDuel)}</dd><dt>타이밍</dt><dd>${esc(g.timing)}</dd><dt>상대 위협</dt><dd>${esc(g.threats.join(", ") || "-")}</dd><dt>집중 대상</dt><dd>${esc(CH[g.enCarry.champ].ko)}</dd></dl></div>
      <div class="card"><h3>상황별 시나리오</h3><ol class="steps">${g.scenarios.map((s) => `<li><b>${esc(s.t)}</b> — ${esc(s.d)}</li>`).join("")}</ol>
        <p class="help" style="margin-top:10px">상대 ${esc(g.E.name)}의 약점: ${esc(g.E.risk)}</p></div>
    </div>`;
  }

  function jungleCard(j) {
    const cls = { "집중 투자": "good", "기회 갱": "blue", "최소 관리": "", "커버": "bad" };
    const ranks = j.ranks.map((x, i) => `<div class="jr"><span class="jn">${i + 1}</span><div><div><b>${esc(x.name)}</b> <span class="pill ${cls[x.verdict]}">${esc(x.verdict)}</span></div>
      <div class="help">${esc(x.reasons.join(" · ") || "특이 사항 없음")}</div></div></div>`).join("");
    return `<div class="card wide jungle"><h3>정글 기준 운영 — ${esc(j.ourJg)}</h3>
      <div class="jgrid"><div><div class="sub">풀어 줄 라인 우선순위</div>${ranks}<p class="help" style="margin-top:8px">시작: ${esc(j.startSide)}</p></div>
      <div><div class="sub">힘을 뿌리는 타이밍</div><ol class="steps">${j.timeline.map((t) => `<li><b>${esc(t.when)}</b> — ${esc(t.what)}</li>`).join("")}</ol>
      <div class="sub" style="margin-top:12px">이득을 퍼뜨리는 방법</div><ul class="plain">${j.spread.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div></div></div>`;
  }

  function renderThreat(compact) {
    if (!E.teamHasPools(E.teamOf(S, "enemy")) && !E.picks(S, "enemy").length) return "";   // 솔랭·자랭: 상대 정보가 없으면 픽이 나온 뒤부터
    const k = E.keyThreats(S, "our");
    if (!k || !k.top) return "";
    const th = k.top, a = k.advice;
    const typeTxt = { gank: "갱킹형 정글", jungle: "정글", carry: "핵심 딜러", lane: "라이너" }[th.type];
    const opts = a.opts.map((o) => `<div class="th-opt"><div class="th-ot"><b title="${esc(o.d)}">${esc(o.t)}</b>${compact ? "" : ` <span class="help">${esc(o.d)}</span>`}</div>
      <div class="row-chips">${o.picks.map((id) => `<span class="chip">${icon(id, "sm")}${esc(CH[id].ko)}</span>`).join("")}</div></div>`).join("");
    const lanes = ROLES.filter((r) => a.lanes[r]).map((r) => `<li><b>${ROLE_KO[r]}</b> ${esc(a.lanes[r])}</li>`).join("");
    const second = k.second && k.second.champ ? `<span class="help">다음: ${ROLE_KO[k.second.r]} ${esc(k.second.p.riot.split("#")[0])} · ${esc(CH[k.second.champ].ko)}</span>` : "";
    return `<section class="threat-box ${compact ? "compact" : ""}">
      <div class="now-h th-head"><span class="what th-title">요주의 인물</span><span class="pill bad">${typeTxt}</span><span class="pill">${th.picked ? "픽 확정" : "예상 픽"}</span></div>
      <div class="th-h">${th.champ ? icon(th.champ, "lg") : ""}<div class="th-who">
        <div class="th-n">${ROLE_KO[th.r]} ${esc(th.p.riot.split("#")[0])} · ${esc(th.champ ? CH[th.champ].ko : "-")}</div>
        <div class="help">${esc(th.why.join(" · "))}</div>${second}</div></div>
      <p class="th-comp">${esc(a.comp)}</p>
      ${opts ? `<div class="th-opts">${opts}</div>` : ""}
      <details class="th-lanes" ${compact ? "" : "open"}><summary>라인별 움직임</summary><ul class="plain">${lanes}</ul></details></section>`;
  }

  // 상대팀 분석(시안 A): 왼쪽 목차 + 오른쪽 한 섹션
  function enemySections(list) {
    const key = list.some(([k]) => k === S.ui.enSec) ? S.ui.enSec : list[0][0];
    const cur = list.find(([k]) => k === key);
    return `<div class="ensec"><nav class="ensec-nav" role="tablist" aria-label="상대팀 분석 목차">${list.map(([k, n]) => `<button role="tab" data-act="ensec" data-k="${k}" aria-selected="${k === key}">${n}</button>`).join("")}</nav>
      <div class="ensec-body">${cur[2]() || `<p class="help">보여 줄 내용이 없습니다.</p>`}</div></div>`;
  }
  // 상대 분석 탭: 밴픽 전 상태 기준으로 요주의 인물 보기
  function renderThreatFor(enemyId) {
    const keep = { enemyTeam: S.enemyTeam, draft: S.draft, series: S.series };
    S.enemyTeam = enemyId; S.draft = { ourSide: keep.draft.ourSide, steps: emptySteps(), idx: 0 }; S.series = { game: 1, mode: "off", locked: [] };
    try { return renderThreat(false); } finally { Object.assign(S, keep); }
  }

  const cutChips = (lost) => (lost || []).map((l) => `<span class="chip cut" title="${esc(CH[l.id].ko)} ${esc(l.st)}">${icon(l.id, "sm")}<s>${esc(CH[l.id].ko)}</s><span class="st">${esc(l.st)}</span></span>`).join("");
  // 큰 그림: 1차 밴 뒤 남은 챔프로 만들 수 있는 우리 조합 시나리오 (픽마다 갱신, 칸마다 대체 픽)
  // 실시간 추천 조합: 「우리팀 전략」에 있던 조합 카드와 같은 모양, 밴픽마다 남은 챔프·확정 픽으로 다시 짠다
  // ---- 목표 챔프 · 밴픽 설계(사용자 요청 11-19) ----
  // 「블리츠 뽑아보자」처럼 목표 챔프를 넣으면 추천 조합이 그 챔프를 넣고 짜이고, 고른 조합(없으면 1순위)을 만드는 우리 남은 밴·픽 순서를 보여 준다.
  let GPC;   // 한 번 그릴 때 한 번만 계산
  const goalPlanNow = () => (GPC === undefined ? (GPC = E.goalPlan(S)) : GPC);
  const XICO = `<svg class="ico-x" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
  function goalBar() {
    const g = ((S.ui.goal && S.ui.goal.ids) || []).filter((id) => CH[id]);
    const chips = g.map((id) => `<span class="chip gl-chip">${icon(id, "sm")}${esc(CH[id].ko)}<button class="gl-x" data-act="goaldel" data-id="${id}" aria-label="${esc(CH[id].ko)} 목표에서 빼기">${XICO}</button></span>`).join("");
    return `<div class="gl-bar"><span class="gl-l">목표 챔프</span>${chips}<span class="gl-add"><input class="input" id="goalIn" list="champList" placeholder="${g.length ? "더 넣기" : "뽑고 싶은 챔프 (예: 블리츠)"}" autocomplete="off" enterkeyhint="done" aria-label="목표 챔프 넣기"><button class="ib btn sm" data-act="goaladd" aria-label="넣기" title="넣기">${ico("plus")}</button></span>
      ${g.length ? `<button class="ib btn sm ghost" data-act="goalclr" aria-label="비우기" title="비우기">${ico("trash")}</button>` : `<span class="help gl-help">넣으면 그 챔프를 뽑는 밴·픽 순서를 짭니다</span>`}<span class="help" id="goalMsg" role="status"></span></div>`;
  }
  function goalPlanHtml(P) {
    const st = curStep();
    const tile = (s) => {
      const now = s.i === S.draft.idx;
      if (s.who === "enemy") return `<li class="gp-t en ${s.kind} ${now ? "now" : ""} ${s.risk ? "risk" : ""}" title="${s.i + 1}. 상대 ${s.kind === "ban" ? "밴" : "픽"}${s.risk ? ` · ${esc(CH[s.risk].ko)}를 먼저 가져갈 수 있음` : ""}"><span class="gp-n">${s.i + 1}</span><span class="gp-k">상대<br>${s.kind === "ban" ? "밴" : "픽"}</span>${s.risk ? icon(s.risk, "sm") : ""}</li>`;
      const head = `<span class="gp-n">${s.i + 1}</span><span class="gp-k">${s.kind === "ban" ? "우리 밴" : `우리 픽${s.r ? ` · ${ROLE_KO[s.r]}` : ""}`}</span>`;
      if (!s.id) return `<li class="gp-t our ${s.kind} ${now ? "now" : ""}">${head}<span class="dim">-</span></li>`;
      const body = `${head}${icon(s.id, "gp")}<b>${esc(CH[s.id].ko)}</b>${pillsHtml(s.notes.slice(0, 2))}`;
      // 지금 차례 칸은 눌러서 바로 기록
      const act = now && st ? `<button class="gp-t our ${s.kind} now ${s.goal ? "goal" : ""}" data-act="pick" data-id="${s.id}" ${s.r ? `data-role="${s.r}"` : ""} aria-label="${s.kind === "ban" ? "밴" : "픽"} ${esc(CH[s.id].ko)} 기록">${body}</button>` : "";
      return act ? `<li class="gp-li">${act}</li>` : `<li class="gp-t our ${s.kind} ${s.goal ? "goal" : ""}">${body}</li>`;
    };
    const warn = P.lost.map((l) => `<span class="cp bad">${esc(CH[l.id].ko)} ${esc(l.st)}</span>`).concat(P.risks.map((r) => `<span class="cp bad" title="${esc(r.d)}">${esc(r.t)}</span>`)).join("");
    return `<div class="gp"><div class="gp-h"><b>밴픽 설계</b><span class="help">${esc(P.sel.name)} · ${P.side === "B" ? "블루" : "레드"} 진영 · 남은 차례</span>${warn ? `<span class="cpills gp-w">${warn}</span>` : ""}</div>
      <ol class="gp-strip drag-x" id="gpStrip" aria-label="우리 남은 밴·픽 순서">${P.steps.map(tile).join("")}</ol></div>`;
  }
  // 실시간 추천 조합: 「우리팀 전략」에 있던 조합 카드와 같은 모양, 밴픽마다 남은 챔프·확정 픽으로 다시 짠다
  // 조합 유형 카드 + 숙련도 우선·바텀 세트·팀 경기 카드를 옆으로 끌어서 넘긴다(휴대폰은 밀어서)
  function renderLiveComps() {
    const t = team(S.ourTeam);
    if (!t || !E.teamHasPools(t)) return "";
    const n = E.picks(S, "our").length;
    if (n >= 5) { const fin = E.liveComps(S)[0]; return fin ? `<section class="live-comps"><div class="section-title"><h2>우리 조합</h2><p>픽 완료 · 운영 방향은 「운영 전략」 탭</p></div>
      <div class="comps">${compCard(fin, null, `<span class="pill gold">확정</span>`)}</div></section>` : ""; }
    const list = E.scenarios(S, "our", true) || [];
    if (!list.length) return goalBar();
    const GP = goalPlanNow();
    const selId = GP ? GP.sel.id : "";
    const st = curStep();
    const ourTurn = st && st[1] === "pick" && E.whoOfSide(S, st[0]) === "our";
    const chip = (id, r) => `<button class="chip pp-c" ${ourTurn ? `data-act="pick" data-id="${id}" data-role="${r}"` : "disabled"}>${icon(id, "sm")}${esc(CH[id].ko)}</button>`;
    const cards = list.map((sc, i) => {
      const c = { key: sc.key, slots: Object.fromEntries(ROLES.filter((r) => sc.slots[r] && sc.slots[r].id).map((r) => { const x = sc.slots[r]; return [r, { id: x.id, lv: x.lv || 0, fixed: !!x.done, goal: !!x.goal }]; })) };
      const alts = ROLES.filter((r) => sc.slots[r] && !sc.slots[r].done && !sc.slots[r].goal && sc.slots[r].alts && sc.slots[r].alts.length)
        .map((r) => `<div class="lc-alt"><span class="pp-role">${ROLE_KO[r]}</span>${sc.slots[r].alts.map((a) => chip(a.id, r)).join("")}</div>`).join("");
      const on = selId === sc.id;
      const why = sc.why.map((w) => `<span class="cp ${/잡는 방향/.test(w) ? "good" : "bad"}">${esc(w.replace(/^상대 (\S+) 조합을 잡는 방향$/, "$1 상대 유리").replace(/ — .*$/, ""))}</span>`).join("");
      const extra = `<p class="ct-win">${esc(COMPS[sc.key].win)}</p>${why ? `<div class="cpills lc-why">${why}</div>` : ""}${alts ? `<div class="lc-alts"><span class="help">대체 픽</span>${alts}</div>` : ""}
        <div class="dnav"><button class="btn sm ${on ? "primary" : "ghost"}" data-act="scen" data-k="${sc.id}" aria-pressed="${S.ui.scen === sc.id}">${on ? "이 조합으로 밴픽 설계 중" : "이 조합으로 밴픽 설계"}</button></div>`;
      return `<div class="ct-card ${on ? "on" : ""}">${compCard(c, sc.name, `<span class="pill ${i === 0 ? "gold" : ""}">${i === 0 ? "주력" : "대안 " + i}</span>${sc.tag ? `<span class="pill">${esc(sc.tag)}</span>` : ""}`, true, false, extra)}</div>`;
    }).join("");
    return `<section class="live-comps">${goalBar()}${GP ? goalPlanHtml(GP) : ""}
      <div class="section-title"><h2>추천 조합</h2><p>${n ? `우리 픽 ${n}개 고정 · ` : ""}${list.length}개 · 옆으로 끌어서 넘김 · 고른 조합으로 위 밴픽 설계가 바뀝니다</p></div>
      <div class="ctrack-wrap"><button class="ct-nav prev" data-act="ctnav" data-d="-1" aria-label="이전 조합">‹</button><div class="comps ctrack drag-x" id="ctrack">${cards}</div><button class="ct-nav next" data-act="ctnav" data-d="1" aria-label="다음 조합">›</button></div></section>`;
  }
  // 실시간 벤픽 아래 섹션을 탭 하나로(시안 A): 한 번에 하나만 보여 스크롤을 줄인다.
  // 차례에 맞춰 자동으로 고르고(밴 → 요주의 인물, 우리 픽 → 추천 조합, 상대 픽 → 상대 연습 픽, 끝 → 운영 전략), 직접 누르면 그 차례 동안 유지
  const DOCK = [["comps", "추천 조합"], ["threat", "요주의 인물"], ["prac", "상대 연습 픽"], ["plan", "픽 순서"], ["strat", "운영 전략"], ["series", "피어리스·저장"]];
  function dockAuto() {
    const st = curStep();
    if (!st) return "strat";
    if (st[1] === "ban") return "threat";
    return E.whoOfSide(S, st[0]) === "our" ? "comps" : "prac";
  }
  function renderDock() {
    const key = S.ui.dock && S.ui.dockAt === S.draft.idx && DOCK.some((d) => d[0] === S.ui.dock) ? S.ui.dock : dockAuto();
    const body = { comps: renderLiveComps, threat: () => renderThreat(true), prac: renderPractice, plan: renderPlan, strat: renderStrategy,
      series: () => renderFearless() + renderSaved() }[key]();
    const tabs = DOCK.map(([k, n]) => `<button role="tab" data-act="dock" data-k="${k}" aria-selected="${k === key}">${n}${k === dockAuto() && k !== key ? `<span class="dk-dot" aria-label="지금 차례 추천"></span>` : ""}</button>`).join("");
    return `<section class="dock"><div class="dock-tabs" role="tablist" aria-label="밴픽 도움 정보">${tabs}</div>
      <div class="dock-body">${body || `<p class="help dock-empty">${esc((DOCK.find((d) => d[0] === key) || ["", ""])[1])} — 지금 보여 줄 내용이 없습니다.</p>`}</div></section>`;
  }
  function renderScenarios() {
    const list = E.scenarios(S, "our");
    if (!list || !list.length) return "";
    const cur = list.find((x) => x.key === S.ui.scen) || list[0];
    const st = curStep();
    const ourTurn = st && st[1] === "pick" && E.whoOfSide(S, st[0]) === "our";
    const tabs = list.map((x, k) => `<button data-act="scen" data-k="${x.key}" aria-pressed="${x === cur}">${"ABC"[k]} ${esc(x.short)}</button>`).join("");
    const chip = (id, r, notes, main) => `<button class="chip pp-c ${main ? "sc-main" : ""}" data-act="${ourTurn ? "pick" : ""}" data-id="${id}" data-role="${r}" ${notes && notes.length ? `title="${esc(notes.join(" · "))}"` : ""}>${icon(id, "sm")}${esc(CH[id].ko)}</button>`;
    const rows = ROLES.map((r) => {
      const x = cur.slots[r];
      if (!x) return "";
      if (x.done) return `<div class="sc-row done"><span class="pp-role">${ROLE_KO[r]}</span><span class="sc-pick">${icon(x.id, "sm")}<b>${esc(CH[x.id].ko)}</b><span class="dim">확정</span></span></div>`;
      const main = x.id ? chip(x.id, r, x.notes, true) : `<span class="dim">남은 챔프폭 없음</span>`;
      const alts = x.alts && x.alts.length ? `<span class="sc-alt-l">대체</span>${x.alts.map((a) => chip(a.id, r, a.notes)).join("")}` : x.id ? `<span class="sc-warn">대체 없음</span>` : "";
      const notes = (x.notes || []).map((n) => {
        let m;
        if ((m = n.match(/^(.+?) 상대 강함(\(라인 모름\))?$/))) return `<span class="tg good" title="${esc(n)}">${ico("sword")}${esc(m[1])}${m[2] ? "?" : ""}</span>`;
        if ((m = n.match(/^(.+?) 상대 불리(\(라인 모름\))?$/))) return `<span class="tg bad" title="${esc(n)}">${ico("alert")}${esc(m[1])} 불리${m[2] ? "?" : ""}</span>`;
        if ((m = n.match(/^(.+?)[과와] 세트$/))) return `<span class="tg good" title="${esc(n)}">${ico("link")}${esc(m[1])}</span>`;
        if (n === "사일러스 주의") return `<span class="tg bad" title="사일러스가 남아 있어 궁을 뺏길 수 있음">${ico("alert")}사일러스</span>`;
        return `<span class="tg" title="${esc(n)}">${esc(n)}</span>`;
      }).join("");
      return `<div class="sc-row"><span class="pp-role">${ROLE_KO[r]}</span><div class="sc-cells"><div class="row-chips">${main}${alts}${cutChips(x.lost)}</div>${notes ? `<span class="tgs">${notes}</span>` : ""}</div></div>`;
    }).join("");
    return `<section class="plan-box scen-box"><div class="now-h"><span class="what">큰 그림</span><span class="step">남은 챔프로 만들 수 있는 조합 · 픽마다 갱신</span><div class="seg" role="group" aria-label="시나리오">${tabs}</div></div>
      <div class="sc-sum"><b title="${esc(cur.win)}">${esc(cur.name)}</b>${cur.why.length ? `<span class="tgs">${cur.why.map((w) => /잡는 방향/.test(w) ? `<span class="tg good" title="${esc(w)}">${ico("target")}${esc(w.replace(/^상대 (\S+) 조합을 잡는 방향$/, "$1 상대 유리"))}</span>` : `<span class="tg bad" title="${esc(w)}">${ico("alert")}${esc(w.replace(/ — .*$/, "").replace(/ → .*$/, ""))}</span>`).join("")}</span>` : ""}</div>
      <div class="sc-rows">${rows}</div>
      <p class="help sc-foot">${ourTurn ? "칩을 누르면 바로 픽 · " : ""}고른 조합이 추천 순서에 반영</p></section>`;
  }

  const ROLE_1 = { T: "탑", J: "정", M: "미", A: "원", S: "서" };
  // 밴픽 20칸 타임라인: 옅은 칸 = 밴, 진한 칸 = 픽, 파랑 = 블루, 빨강 = 레드, 노란 테두리 = 지금, 점선 = 남은 차례(우리 예정 라인)
  function timeline(planned) {
    const cells = ORDER.map(([side, type], i) => {
      const s = S.draft.steps[i];
      const who = E.whoOfSide(S, side);
      const pr = !s.champ && planned[i];
      const cls = ["tl-c", side === "B" ? "b" : "r", type, i === S.draft.idx ? "now" : "", s.champ ? "filled" : s.skip ? "skip" : "open", i > 0 && ORDER[i - 1][1] !== type ? "gap" : ""].join(" ");
      const label = `${i + 1}. ${side === "B" ? "블루" : "레드"}(${who === "our" ? "우리" : "상대"}) ${type === "ban" ? "밴" : "픽"}${s.champ ? ` · ${CH[s.champ].ko}` : pr ? ` · ${ROLE_KO[pr]} 예정` : ""}`;
      const inner = s.champ ? `<img src="${IMG(s.champ)}" alt="" loading="lazy" onerror="this.remove()">` : pr ? `<span>${ROLE_1[pr]}</span>` : "";
      return `<li class="${cls}" title="${esc(label)}"><span class="sr-only">${esc(label)}</span>${inner}</li>`;
    }).join("");
    return `<ol class="tl" aria-label="밴픽 순서">${cells}</ol>
      <p class="tl-key"><span><i class="k ban"></i>밴</span><span><i class="k pick"></i>픽</span><span><i class="k b"></i>블루</span><span><i class="k r"></i>레드</span><span><i class="k now"></i>지금</span><span><i class="k open"></i>우리 예정</span></p>`;
  }

  function renderPlan() {
    const p = E.pickPlan(S, "our");
    if (!p.plan.some((s) => s.items.some((x) => !x.done && x.role))) return "";
    const st = curStep();
    const planned = {};
    p.plan.forEach((sl) => sl.items.forEach((x) => !x.done && x.role && (planned[x.i] = x.role)));
    const cards = p.plan.map((s) => {
      const items = s.items.map((x) => {
        if (x.done) return `<div class="pp-item done">${icon(x.champ, "sm")}<span><b>${esc(CH[x.champ].ko)}</b> <span class="dim">${x.role ? ROLE_KO[x.role] : ""} · 완료</span></span></div>`;
        if (!x.role) return "";
        const cands = x.cands.length ? x.cands.map((c) => `<button class="chip pp-c" data-act="${st && st[1] === "pick" && E.whoOfSide(S, st[0]) === "our" && s.now ? "pick" : ""}" data-id="${c.id}" data-role="${x.role}" title="${esc(E.statText(c.e))}">${icon(c.id, "sm")}${esc(CH[c.id].ko)}${c.e.g ? `<span class="st">${c.e.g}판</span>` : ""}</button>`).join("") : `<span class="dim">남은 챔프폭 없음</span>`;
        // 잘린 주력은 취소선 칩으로(글 대신)
        const cut = (x.mains || []).filter((m) => m.st !== "가능").map((m) => `<span class="chip cut" title="${esc(CH[m.id].ko)} ${esc(m.st)}">${icon(m.id, "sm")}<s>${esc(CH[m.id].ko)}</s><span class="st">${esc(m.st)}</span></span>`).join("");
        const tags = (x.tags || []).filter((t) => t.k !== "cut");
        return `<div class="pp-item"><div class="pp-role">${ROLE_KO[x.role]}</div><div class="row-chips">${cands}${cut}</div>${tags.length ? `<div class="bdgs">${tags.slice(0, 4).map(badge).join("")}</div>` : ""}</div>`;
      }).join("");
      return `<div class="pp-slot ${s.now ? "now" : ""} ${s.items.every((x) => x.done) ? "past" : ""}"><div class="pp-h"><b>${s.label}</b>${s.now ? `<span class="pill gold">지금</span>` : ""}</div>${items}</div>`;
    }).join("");
    const src = window.META ? `메타: op.gg 솔랭 ${window.META.patch} · gol.gg 2026 대회 · 라인 상대 전적 (${window.META.at})` : "밴·진영·상대 공개 라인에 따라 계속 바뀜";
    return `<section class="plan-box"><div class="now-h"><span class="what">픽 순서 전략</span><span class="step" title="${esc(src)}">${window.META ? `메타 ${esc(window.META.patch)}` : ""}</span></div>
      ${timeline(planned)}<div class="pp-grid">${cards}</div></section>`;
  }

  // 상대 연습 픽: 11/10 이후 팀 경기(내전 > 5인 > 3·4인 > 2인)·최근 3일 가중으로 본 상대 선수별 연습 챔프 (tools/recent.py practice)
  const READY_LV = { "완성": "lv3", "연습 중": "lv2", "표본 적음": "lv1" };
  const COMBO_KO = { bot: "바텀", jm: "정글-미드", tj: "탑-정글" };
  function renderPractice() {
    const t = E.teamOf(S, "enemy");
    if (!t || t.solo) return "";
    const R = window.RECENT;
    const P = E.practiceOf(t);
    const ps = S.ui.pState && S.ui.pState.team === t.id ? S.ui.pState : {};
    const canLive = !!window.RECENT_LIVE_URL && !!window.Practice && R && R.status === "ok";
    const btn = canLive ? `<div class="g-refresh"><button class="ib btn sm primary g-btn${prefreshing ? " busy" : ""}" data-act="prefresh" title="상대 연습 픽 갱신하기" aria-label="상대 연습 픽 갱신하기" ${prefreshing ? "disabled" : ""}>${REFRESH_ICO}<span class="sr-only">${prefreshing ? "갱신 중" : "갱신하기"}</span></button>
      <span class="help" role="status">${esc(ps.msg || (P && P.live ? `실시간 ${P.live.at}` : R && R.at ? `수집 ${R.at}` : ""))}</span></div>` : "";
    const head = (sub) => `<div class="now-h"><span class="what">상대 연습 픽</span><span class="step">${sub}</span></div>`;
    const bar = `<div class="pr-bar">${prepHtml(R)}${btn}</div>`;
    if (!P) return `<section class="plan-box prac-box">${head(esc(t.name))}${bar}<p class="help">미확보 — ${R && R.status === "ok" ? "다음 자동 수집(매일 0시) 때 분석됩니다." : esc(recWhy())}</p></section>`;
    const tg = P.teamGames || {};
    const since = md((P.live && P.live.since) || R.since) || "11/10";
    const sub = `${esc(t.name)} · 팀원끼리 한 판 ${tg.n || 0}${tg.five ? ` (5인 ${tg.five})` : ""}`;
    const days = (R.practiceRule && R.practiceRule.recentDays) || 3;
    const help = `<details class="prac-help"><summary>기준·한계</summary><ul class="plain">
      <li>함께 한 경기(같은 팀 2명 이상 같은 편)를 더 크게 봅니다: 사용자 설정(내전·스크림) &gt; 자유랭 5인 &gt; 3·4인 &gt; 2인 &gt; 혼자.</li>
      <li>${P.live ? "갱신한" : "수집"} 시각 기준 최근 ${days}일 경기는 1.5배. 「새로」 = 이전 랭크·숙련도에 거의 없던 챔프를 ${since} 이후 3판 이상.</li>
      <li>「완성」 = 3판 이상·승률 50% 이상·KDA 2.5 이상, 「연습 중」 = 그 밖, 「표본 적음」 = 3판 미만(참고만).</li>
      <li>대회 코드(토너먼트) 경기는 Riot 기록에 안 보일 수 있습니다. 닉네임(Riot ID)을 바꾼 선수는 다음 수집 때까지 빠집니다.</li></ul></details>`;
    // 라인 다섯 칸: 선수 이름 + 연습 픽 3개(한 줄씩: 얼굴·이름·판수, 새 픽·완성만 표시). 자세한 수치는 마우스를 올리면
    const cols = ROLES.map((r) => {
      const pl = P.players[r];
      const name = esc(nick(t.players[r].riot));
      if (!pl) return `<div class="pr-col" data-r="${r}"><div class="pr-h"><span class="pr-r">${ROLE_KO[r]}</span><b>${name}</b></div><p class="dim">${P.stale.includes(r) ? "계정 변경·조회 실패" : "자료 없음"}</p></div>`;
      const items = pl.picks.slice(0, 3).map((x) => `<li title="${esc(`${CH[x.id].ko}${x.r !== r ? ` (${ROLE_KO[x.r]})` : ""} · ${E.practiceText(x)}`)}">${icon(x.id, "sm").replace(/ title="[^"]*"/, "")}
          <span class="pr-t"><span class="pr-n">${esc(CH[x.id].ko)}${x.r !== r ? `<small>${ROLE_KO[x.r]}</small>` : ""}</span>
          <span class="pr-g">${x.g}판 ${x.w}승${x.new ? ` <span class="cp gold">새 픽</span>` : x.ready === "완성" ? ` <span class="cp good">완성</span>` : ""}</span></span></li>`).join("");
      return `<div class="pr-col" data-r="${r}"><div class="pr-h"><span class="pr-r">${ROLE_KO[r]}</span><b>${name}</b><span class="dim">${pl.n}판</span></div>
        ${items ? `<ul class="pr-list">${items}</ul>` : `<p class="dim">2판 이상 꺼낸 챔프 없음</p>`}</div>`;
    }).join("");
    const ko = (id) => (CH[id] ? CH[id].ko : id);
    const foot = [
      P.combos.length ? `<div><span class="pr-k">함께 연습</span>${P.combos.slice(0, 3).map((c) => `<span class="pr-f" title="${esc(`${COMBO_KO[c.kind]} · ${c.g}판 ${c.w}승`)}">${esc(c.ids.map(ko).join("+"))} ${c.g}판</span>`).join("")}</div>` : "",
      P.bans.length ? `<div><span class="pr-k">자주 밴</span>${P.bans.slice(0, 5).map((b) => `<span class="pr-f">${icon(b.id, "sm").replace(/ title="[^"]*"/, "")}${esc(ko(b.id))} ${b.n}</span>`).join("")}</div>` : "",
      P.swaps.length ? `<div><span class="pr-k">라인 바꿈</span>${P.swaps.map((x) => `<span class="pr-f" title="${esc(x.ids.map(ko).join("·"))}">${ROLE_KO[x.r]} → ${ROLE_KO[x.to]} ${x.g}/${x.of}판</span>`).join("")}</div>` : "",
    ].filter(Boolean).join("");
    return `<section class="plan-box prac-box">${head(sub)}${bar}<div class="pr-grid">${cols}</div>${foot ? `<div class="pr-foot">${foot}</div>` : ""}${help}</section>`;
  }

  function renderLive() {
    const seg = (act, cur, items) => `<div class="seg">${items.map(([v, n]) => `<button data-act="${act}" data-v="${v}" aria-pressed="${cur === v}">${n}</button>`).join("")}</div>`;
    const plan = E.pickPlan(S, "our");
    const planned = {};
    plan.plan.forEach((p) => p.items.forEach((x) => !x.done && x.role && (planned[x.i] = x.role)));
    return `<div class="draft-bar">
      <span class="pill gold">${S.series.game}세트</span>
      <span class="sel"><span class="sel-l">우리 진영</span> ${seg("side", S.draft.ourSide, [["B", "블루"], ["R", "레드"]])}</span>
      <span class="sel"><span class="sel-l">피어리스</span> ${seg("mode", S.series.mode, [["hard", "하드"], ["soft", "소프트"], ["off", "끔"]])}</span>
      <span class="spacer"></span>
      <button class="btn sm" data-act="resetGame">이번 세트 다시</button>
      ${S.ui.endAsk ? `<span class="end-ask" role="group" aria-label="${S.series.game}세트 결과"><span class="sel-l">${S.series.game}세트 결과</span>
        <button class="btn sm res-w" data-act="endGame" data-v="W">승</button><button class="btn sm res-l" data-act="endGame" data-v="L">패</button><button class="btn sm ghost" data-act="endCancel">취소</button></span>`
      : `<button class="btn sm primary" data-act="nextGame">세트 종료 → 다음 세트</button>`}
      <button class="btn sm" data-act="saveSeries">밴픽 저장</button>
      <button class="btn sm ghost" data-act="resetSeries">시리즈 초기화</button>
    </div>
    ${renderStatus("dstat-m")}
    <div class="board">
      <div class="dh">${renderSide("B", planned)}${renderStatus()}${renderSide("R", planned)}</div>
      <div class="col-main">${renderNow()}${renderDock()}</div>
      <aside class="col-grid ${S.ui.sheet ? "open" : ""}">${renderGrid()}</aside>
    </div>
    ${S.ui.sheet ? `<div class="sheet-bg m-only" data-act="sheet"></div>` : ""}
    `;
  }

  // ---------- 실시간 밴픽(PC 새 디자인 C) ----------
  // 계산·추천은 운영 함수(renderSide·renderStatus·renderNow·renderGrid·renderDock 몸통) 그대로, 배치와 모양만 바꾼다
  // 머리줄 왼쪽: 진영 · 피어리스(하드 피어리스 / 끔 — 소프트는 쓰지 않음, 11-19 사용자 결정)
  function liveLeftPC() {
    if (S.series.mode === "soft") S.series.mode = "hard";
    const seg = (act, cur, items, label) => `<div class="seg" role="group" aria-label="${label}">${items.map(([v, n]) => `<button data-act="${act}" data-v="${v}" aria-pressed="${cur === v}">${n}</button>`).join("")}</div>`;
    const ranked = isSolo(S.enemyTeam);
    return `${seg("side", S.draft.ourSide, [["B", "블루"], ["R", "레드"]], "우리 진영")}${ranked ? "" : seg("mode", S.series.mode, [["hard", "하드 피어리스"], ["off", "끔"]], "피어리스")}`;
  }
  function liveSetBarPC() {
    return `<button class="ib mh-ib" data-act="resetGame" aria-label="이번 세트 다시">${lbi("undo", 22)}</button>
      <button class="ib mh-ib" data-act="resetSeries" aria-label="시리즈 처음부터">${lbi("refresh", 22)}</button>
      ${S.ui.endAsk ? `<span class="end-ask" role="group" aria-label="${S.series.game}세트 결과"><button class="soft-b res-w" data-act="endGame" data-v="W">승</button><button class="soft-b res-l" data-act="endGame" data-v="L">패</button><button class="soft-b" data-act="endCancel">취소</button></span>`
        : `<button class="soft-b" data-act="nextGame">세트 종료 → 다음 세트</button>`}`;
  }
  // 목표 챔프 + 밴픽 설계 한 줄: 설계는 조합 이름 + 우리 남은 픽 초상화만(지금 차례 고리)
  function goalLinePC() {
    const g = ((S.ui.goal && S.ui.goal.ids) || []).filter((id) => CH[id]);
    const GP = goalPlanNow();
    const goal = `<span class="gl-pc"><b>목표 챔프</b>${g.map((id) => `<span class="gl-c">${icon(id, "xs")}${esc(CH[id].ko)}<button class="gl-x" data-act="goaldel" data-id="${id}" aria-label="${esc(CH[id].ko)} 목표에서 빼기">×</button></span>`).join("")}<input class="input gl-in" id="goalIn" list="champList" placeholder="${g.length ? "더 넣기" : "예: 블리츠"}" autocomplete="off" aria-label="목표 챔프 넣기"><button class="ib mh-ib gl-addb" data-act="goaladd" aria-label="목표 챔프 넣기">${lbi("plus", 18)}</button></span>`;
    let plan = "";
    if (GP) {
      const mine = GP.steps.filter((x) => x.who === "our" && x.kind === "pick" && x.id && x.i >= S.draft.idx);
      const done = !mine.length && E.picks(S, "our").length >= 5;
      plan = `<span class="gp-pc"><b>${esc(GP.sel.name.replace(/ 조합$/, ""))}</b><span class="dim">설계${done ? " 완성" : ""}</span>${mine.slice(0, 5).map((x) => `<span class="gp-c ${x.i === S.draft.idx ? "now" : ""}" title="${x.i + 1}. ${ROLE_KO[x.r] || ""} ${esc(CH[x.id].ko)}">${icon(x.id, "xs")}</span>`).join(`<span class="dim">→</span>`)}</span>`;
    }
    return { goal, plan };
  }
  // 한 줄: 왼쪽 차례 제목·라인 칸 · 가운데 되돌리기·밴 넘기기 · 오른쪽 목표 챔프 / 그 아래: 밴픽 설계 + 조합 방향 / 추천 카드
  function liveCtrlPC() {
    NOW_HEAD = null;
    const now = renderNow(true), H = NOW_HEAD || {}, G = goalLinePC(), st = curStep();
    const acts = `<span class="lc-c"><button class="lc-b" data-act="undo" ${S.draft.idx ? "" : "disabled"}>${ico("undo")}되돌리기</button>${st && st[1] === "ban" ? `<button class="lc-b" data-act="skip">${ico("skip")}밴 넘기기</button>` : ""}</span>`;
    const row = `<div class="lv-ctrl"><span class="lc-l">${H.step ? `<span class="step">${H.step}</span>` : ""}${H.tabs || ""}</span>${acts}<span class="lc-r">${G.goal}</span></div>`;
    const plan = G.plan || H.dir ? `<div class="gline">${G.plan || ""}${H.dir ? `<span class="dir">${H.dir}</span>` : ""}</div>` : "";
    return row + plan + now;
  }
  const DOCK_PC = [["grid", "챔프 고르기"], ["comps", "추천 조합"], ["strat", "운영 전략"], ["threat", "요주의 인물"], ["prac", "상대 연습 픽"], ["plan", "픽 순서"], ["series", "피어리스·저장"]];
  function renderDockPC() {
    const key = S.ui.dock && S.ui.dockAt === S.draft.idx && DOCK_PC.some((d) => d[0] === S.ui.dock) ? S.ui.dock : "grid";
    const body = { grid: renderGrid, comps: renderLiveCompsPC, threat: () => renderThreat(true), prac: renderPractice, plan: renderPlan, strat: renderStratPC, series: () => renderFearless() + renderSaved() }[key]();
    const tabs = DOCK_PC.map(([k, n]) => `<button role="tab" data-act="dock" data-k="${k}" aria-selected="${k === key}">${n}</button>`).join("");
    return `<section class="dock-pc"><div class="seg dock-tabs" role="tablist" aria-label="밴픽 도움 정보">${tabs}</div><div class="dock-body ${key === "grid" ? "is-grid" : ""}">${body || `<p class="help">${esc((DOCK_PC.find((d) => d[0] === key) || ["", ""])[1])} — 지금 보여 줄 내용이 없습니다.</p>`}</div></section>`;
  }
  // 추천 조합 탭(PC): 1~6위 한 줄 순위 · 상대 대비 · 방향 한 줄 · 다섯 칸(확정/목표/예정) · 근거·대체 픽 한 줄. 운영 글은 「운영 전략」 탭
  function renderLiveCompsPC() {
    const t = team(S.ourTeam);
    if (!t || !E.teamHasPools(t)) return `<p class="help">우리 팀 챔프폭을 넣으면 조합을 추천합니다.</p>`;
    const list = E.scenarios(S, "our", true) || [];
    if (!list.length) return `<p class="help">남은 라인이 없습니다.</p>`;
    const GP = goalPlanNow(), selId = GP ? GP.sel.id : "";
    const od = list[0].oppDir;
    const VS = { 유리: "good", 보통: "", 불리: "bad" };
    const cards = list.map((sc, i) => {
      const C = COMPS[sc.key], short = od ? COMPS[od].short : "";
      const dir = (sc.vs === "유리" ? `상대 ${short} 조합을 잡는 방향` : sc.vs === "불리" ? `상대 ${short} 조합에 약함` : od ? `상대 ${short} 조합과 대등` : C.name);
      const why = sc.why.filter((w) => !/잡는 방향|에 약함/.test(w)).map((w) => esc(w.replace(/ — .*$/, "")));
      const alts = ROLES.filter((r) => sc.slots[r] && !sc.slots[r].done && (sc.slots[r].alts || []).length).map((r) => `${ROLE_KO[r]} ${sc.slots[r].alts.map((a) => esc(CH[a.id].ko)).join("·")}`);
      const base = [sc.tag || "", ...why, alts.length ? "대체 픽 " + alts.join(" / ") : ""].filter(Boolean).join(" · ");
      return `<button class="cc ${sc.id === selId ? "on" : ""}" data-act="scen" data-k="${sc.id}" aria-pressed="${sc.id === selId}">
        <span class="cc-h"><b class="cc-n">${i + 1}</b><b class="cc-t">${esc(sc.name.replace(/ 조합$/, ""))}</b>${sc.vs ? `<span class="cc-vs ${VS[sc.vs]}">상대 대비 ${sc.vs}</span>` : ""}${sc.id === selId ? `<span class="cc-on">설계에 씀</span>` : ""}</span>
        <span class="cc-d ${VS[sc.vs] || ""}">${sc.vs === "불리" ? lbi("warn", 16) : lbi("comp", 16)}${dir}</span>
        <span class="cc-5">${ROLES.map((r) => { const x = sc.slots[r]; return `<span class="cc-s"><span class="cc-r">${ROLE_KO[r]}</span>${x && x.id ? icon(x.id, "md") : `<span class="ic md"></span>`}<span class="cc-cn">${x && x.id ? esc(CH[x.id].ko) : "—"}</span><span class="cc-st ${x && x.done ? "done" : x && x.goal ? "goal" : ""}">${x && x.done ? "확정" : x && x.goal ? "목표" : x && x.id ? "예정" : "챔프폭 없음"}</span></span>`; }).join("")}</span>
        ${base ? `<span class="cc-b">${base}</span>` : ""}</button>`;
    }).join("");
    return `<div class="cc-top">${od ? `<span>상대 방향 <b>${esc(COMPS[od].short)}</b></span>` : ""}<span class="dim">순위 = 숙련도 합 + 조합 적합도 + 상대 대비 상성 − 차단·빈 라인 · 누르면 그 조합으로 밴픽 설계 · 운영 방법은 「운영 전략」</span></div><div class="cc-g">${cards}</div>`;
  }
  // 차례가 바뀌면 강조(소리 대신, 사용자 요청 11-19): 우리 차례 보라 두 번 번쩍·점 물결·빈 칸 숨쉬기, 상대 차례 빨강 한 번. 탭 제목에도 표시
  let lastTurnKey = "", titleBlink = null;
  const BASE_TITLE = document.title;
  function turnTitle() {
    const st = S.tab === "live" ? curStep() : null;
    const who = st ? E.whoOfSide(S, st[0]) : "";
    const role = st && st[1] === "pick" && who === "our" ? (goalPlanNow() && (goalPlanNow().steps.find((x) => x.i === S.draft.idx) || {}).r) : null;
    const txt = !st ? BASE_TITLE : who === "our" ? `● 우리 ${role ? ROLE_KO[role] + " " : ""}${st[1] === "ban" ? "밴" : "픽"} · lolban` : `상대 ${st[1] === "ban" ? "밴" : "픽"} · lolban`;
    document.title = txt;
    { const fav = document.getElementById("fav"); if (fav) { const want = who === "our" ? "img/lolban-favicon-turn.svg" : "img/lolban-favicon.svg"; if (fav.getAttribute("href") !== want) fav.setAttribute("href", want); } }
    clearInterval(titleBlink); titleBlink = null;
    if (who === "our" && document.hidden) { let on = true; titleBlink = setInterval(() => { on = !on; document.title = on ? txt : "lolban"; if (!document.hidden) { clearInterval(titleBlink); document.title = txt; } }, 900); }
  }
  document.addEventListener("visibilitychange", turnTitle);
  // 운영 전략 탭(PC): 설계에 쓴 조합(없으면 1순위)의 승리 조건·초반·중반·후반·밴픽 순서·주의 — 운영 knowledge.js 문구 그대로
  function renderStratPC() {
    const GP = goalPlanNow();
    const list = E.scenarios(S, "our", true) || [];
    const cur = (GP && GP.sel) || list[0];
    if (!cur) return renderStrategy() || `<p class="help">우리 팀 챔프폭을 넣으면 운영 전략이 나옵니다.</p>`;
    const C = COMPS[cur.key];
    const tabs = list.length > 1 ? `<span class="seg">${list.slice(0, 4).map((x) => `<button data-act="scen" data-k="${x.id}" aria-pressed="${x.id === cur.id}">${esc(x.short || COMPS[x.key].short)}</button>`).join("")}</span>` : "";
    return `<div class="st-pc"><div class="st-h"><b>${esc(C.name)}</b><span class="dim">${GP && GP.sel ? "설계에 쓴 조합" : "추천 1위 조합"}</span>${tabs}</div>
      <p class="st-w"><b>승리 조건</b>${esc(C.win)}</p>
      <div class="st-3">${[["초반", C.early, "~14분"], ["중반", C.mid, "14~25분"], ["후반", C.late, "25분~"]].map(([t, d, m]) => `<div><span><b>${t}</b><small>${m}</small></span><p>${esc(d)}</p></div>`).join("")}</div>
      <p class="st-w bad"><b>${lbi("warn", 16)}주의</b>${esc(C.risk)}</p></div>`;
  }
  function showRecDetail(id) {
    const box = document.getElementById("recDetail");
    if (!box) return;
    const first = document.querySelector(":is(.live-pc, .enemy-pc) .recs .rec");
    const k = id && REC_DET[id] ? id : first && first.dataset.id;
    box.innerHTML = k && REC_DET[k] ? REC_DET[k] : "";
    document.querySelectorAll(":is(.live-pc, .enemy-pc) .recs .rec").forEach((el) => el.classList.toggle("det", el.dataset.id === k));
  }
  document.addEventListener("mouseover", (ev) => { const el = ev.target.closest && ev.target.closest(":is(.live-pc, .enemy-pc) .recs .rec"); if (el) showRecDetail(el.dataset.id); });
  document.addEventListener("focusin", (ev) => { const el = ev.target.closest && ev.target.closest(":is(.live-pc, .enemy-pc) .recs .rec"); if (el) showRecDetail(el.dataset.id); });
  function renderLivePC() {
    for (const k in REC_DET) delete REC_DET[k];
    const plan = E.pickPlan(S, "our");
    const planned = {};
    plan.plan.forEach((p) => p.items.forEach((x) => !x.done && x.role && (planned[x.i] = x.role)));
    const st = curStep(), who = st ? E.whoOfSide(S, st[0]) : "";
    const L = S.series.locked || [];
    const lock = L.length ? `<div class="lock-pc">${lbi("lock", 16)}<span>앞 세트 사용</span>${L.map((x) => `<span title="${esc(CH[x.id] ? CH[x.id].ko : x.id)} · ${x.game}세트">${icon(x.id, "xs")}</span>`).join("")}</div>` : "";
    const tk = st ? `${S.draft.idx}:${who}` : "done", go = tk !== lastTurnKey; lastTurnKey = tk;
    return `<div class="live-pc ${who ? "turn-" + who : ""} ${go ? "go" : ""}">${renderSide("B", planned)}
      <div class="lv-c">${renderStatus()}${liveCtrlPC()}<div class="rdet" id="recDetail" aria-live="polite"></div>${renderDockPC()}${lock}</div>
      ${renderSide("R", planned)}</div>`;
  }

  // ---------- our team ----------
  function compCard(c, title, sub, compact, enemy, extra) {
    const C = COMPS[c.key];
    const five = ROLES.map((r) => { const s = c.slots[r]; if (!s) return `<div class="s"><span class="ic"></span></div>`;
      return `<div class="s ${s.suggest ? "suggest" : ""} ${s.fixed ? "fixed" : ""}"><span class="r">${ROLE_KO[r]}</span>${icon(s.id)}<span class="n">${esc(CH[s.id].ko)}</span>${s.fixed ? `<span class="lv lvone">픽 완료</span>` : s.goal ? `<span class="lv lv3">목표</span>` : s.suggest ? `<span class="lv lv1">새로</span>` : lvTag(E.levelOf(s.lv))}</div>`; }).join("");
    const filled = ROLES.map((r) => c.slots[r]).filter(Boolean);
    const first = filled.filter((s) => !s.suggest).sort((a, b) => b.lv - a.lv || CH[b.id].pos.length - CH[a.id].pos.length)[0];
    const last = filled.filter((s) => (window.KB.COUNTERS[s.id] || []).length && s !== first).sort((a, b) => (window.KB.COUNTERS[b.id] || []).length - (window.KB.COUNTERS[a.id] || []).length)[0];
    return `<div class="card"><div class="comp-h"><h3>${esc(title || C.name)}</h3>${sub || ""}</div><div class="five">${five}</div>${extra || ""}
      <div class="plan"><dl>${compact ? "" : `<dt>승리 조건</dt><dd>${esc(C.win)}</dd><dt>초반</dt><dd>${esc(C.early)}</dd><dt>중반</dt><dd>${esc(C.mid)}</dd><dt>후반</dt><dd>${esc(C.late)}</dd>`}
      ${enemy ? `<dt>밴 포인트</dt><dd>${first ? `조합의 중심 <b>${esc(CH[first.id].ko)}</b> — 밴하거나 먼저 가져가면 이 조합이 흔들립니다` : ""}</dd>`
        : `<dt>밴픽 순서</dt><dd>${first ? `먼저 가져갈 챔프: <b>${esc(CH[first.id].ko)}</b>` : ""}${last ? ` · 카운터가 있는 <b>${esc(CH[last.id].ko)}</b>는 마지막 픽으로 숨기기` : ""}</dd>`}
      ${compact ? "" : `<dt>주의</dt><dd>${esc(C.risk)}</dd>`}</dl></div></div>`;
  }

  // ---------- 자료 출처·최근 기록·5인 경기 ----------
  const QUEUE = { 420: "솔로랭크", 440: "자유랭크", 400: "일반", 430: "일반", 490: "빠른 대전", 450: "칼바람", 0: "사용자 설정" };
  // 로스터 카드 글(11-19): 종류별로 「이름표 | 한 줄」. 긴 줄은 …로 자르고 전체는 마우스를 올리면
  function plFacts(t, r) {
    const p = t.players[r], R = window.RECENT;
    const row = (k, v, cls) => v ? `<div class="pf ${cls || ""}"><span class="pf-k">${k}</span><span class="pf-v" title="${esc(v)}">${esc(v)}</span></div>` : "";
    const alts = altsOf(t.id, r);
    const ql = { solo: "솔랭", flex: "자랭" }[CFG.queue] || "랭크";
    const sc = E.scoutOf(t, r);
    const season = sc && sc.total && sc.total.g ? [sc.tier ? `${CFG.queue === "flex" ? "자랭" : "솔랭"} ${TIER_KO[sc.tier.tier] || sc.tier.tier}${sc.tier.rank && !/MASTER|CHALLENGER/.test(sc.tier.tier) ? " " + ({ I: 1, II: 2, III: 3, IV: 4 }[sc.tier.rank] || sc.tier.rank) : ""}` : "",
      `${ql} ${sc.total.g}판 ${Math.round((sc.total.w / sc.total.g) * 100)}%`].filter(Boolean).join(" · ") : "";
    let recent = "", warn = "";
    const since = md((R && R.since) || "2026-11-10") + "~";
    if (R && R.status === "ok") {
      const raw = R.players && R.players[t.id] && R.players[t.id][r];
      const x = E.recentOf(t, r);
      if (!p.riot) recent = "계정을 넣으면 기록이 보입니다";
      else if (raw && raw.riot && raw.riot !== p.riot) recent = "계정이 바뀜 — 다음 수집 때 반영";
      else if (!x) recent = "기록 없음(계정 조회 실패)";
      else {
        const top = (x.champs || []).slice(0, 3).map((c) => `${CH[c.id] ? CH[c.id].ko : c.id} ${c.g}`).join(" · ");
        recent = `${ql} ${x.n}판${x.n ? ` ${Math.round((x.w / x.n) * 100)}%` : ""}${top ? ` · ${top}` : ""}`;
        const ar = E.actualRole(t, r);
        if (ar && ar.differs) warn = `등록 ${ROLE_KO[r]}인데 최근 ${ar.tot}판 중 ${ROLE_KO[ar.role]} ${ar.n}판`;
      }
    }
    return `<div class="pfs">${row("부계정", alts.length ? `${alts.map(nick).join(" · ")} (${ROLE_KO[r]} 판만)` : "")}${row("티어", p.tier ? `${p.tier} · ${p.pts}점` : `${p.pts}점`)}${row("시즌", season)}${row(since, recent)}${row("주의", warn, "bad")}</div>`;
  }
  function recentLine(t, r) {
    const R = window.RECENT;
    if (!R) return "";
    if (R.status !== "ok") return `<div class="help">11/10~ 최근 기록 미확보</div>`;
    const raw = R.players && R.players[t.id] && R.players[t.id][r];
    if (raw && raw.riot && raw.riot !== t.players[r].riot) return `<div class="help">11/10~ 최근 기록 미확보 (계정 변경 — 다음 수집 때 반영)</div>`;
    const x = E.recentOf(t, r);
    if (!x) return `<div class="help">11/10~ 최근 기록 미확보 (계정 조회 실패)</div>`;
    const ar = E.actualRole(t, r);
    const top = (x.champs || []).slice(0, 3).map((c) => `${CH[c.id] ? CH[c.id].ko : c.id} ${c.g}`).join(" · ");
    return `<div class="help">11/10~ 랭크 ${x.n}판${x.n ? ` ${Math.round((x.w / x.n) * 100)}%` : ""}${top ? ` · ${esc(top)}` : ""}</div>`
      + (ar && ar.differs ? `<div class="warn">등록 ${ROLE_KO[r]}인데 최근 ${ar.tot}판 중 ${ROLE_KO[ar.role]} ${ar.n}판</div>` : "");
  }
  // 갱신하기: Cloudflare Worker(js/config.js RECENT_LIVE_URL)가 Riot에서 바로 「함께 한 경기」를 가져온다(키는 Worker에만 있음).
  // Worker가 없거나 실패하면 매일 0시 자동 수집 자료(서버 /data/recent)를 다시 읽는다.
  let refreshing = false;
  // 기록 요약 자료(11-19): 공개 파일(js/recent.js) 대신 팀 공간 열쇠로 서버에서 받는다 — 팀 공간 밖에서는 기록이 안 보인다.
  // 서버는 그 공간이 볼 수 있는 팀 자료만 준다. 같은 날 자료면 이 브라우저의 실시간 갱신 결과(live)는 그대로 둔다.
  const REC = { status: "idle" };   // idle | loading | ok | empty | error | none(팀 공간 밖)
  async function loadRecent() {
    if (!SPACE || SPACE.bad || !WURL()) { REC.status = "none"; return null; }
    REC.status = "loading";
    try {
      const res = await wfetch("/data/recent");
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.status === "ok" && d.data && d.data.status === "ok") {
        const before = window.RECENT, R = d.data;
        if (before && before.live && R.at === before.at) R.live = before.live;
        if (!before || before.at !== R.at) PG = null;
        window.RECENT = R; REC.status = "ok"; render(); return R;
      }
      REC.status = res.ok ? "empty" : "error";
    } catch (e) { REC.status = "error"; }
    render(); return null;
  }
  // 기록이 없을 때 이유: 팀 공간 밖·불러오는 중·아직 수집 전
  const recWhy = () => !SPACE || SPACE.bad ? "기록은 팀 공간에 들어온 뒤 보입니다(초대 링크로 들어오기)" : REC.status === "loading" || REC.status === "idle" ? "기록 불러오는 중…" : REC.status === "error" ? "기록을 불러오지 못했습니다 — 새로고침해 보세요" : "Riot 최근 경기 수집 전입니다.";
  const REFRESH_ICO = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/></svg>`;
  const liveOf = (t) => { const R = window.RECENT; return R && R.live && t && R.live[t.id]; };
  const champId = (name) => { if (!name) return null; if (CH[name]) return name; const lo = String(name).toLowerCase(); return Object.keys(CH).find((k) => k.toLowerCase() === lo) || null; };
  // 0시 수집의 함께 한 경기(팀별)를 기억해 두고, 갱신은 수집 뒤 새 경기만 받아 합친다
  const NIGHT = { groups: {}, at: "" };
  const kstMs = (s) => Date.parse(String(s).replace(" ", "T") + ":00+09:00");
  let gTimer = null;
  let chainEnemy = false;   // 우리팀 「갱신하기」: 우리 팀 다음에 상대도
  function refreshRecent(auto) {
    if (refreshing && !auto) return;
    clearTimeout(gTimer);
    const before = window.RECENT, ourT = team(S.ourTeam);
    const count = () => { const g = window.RECENT && window.RECENT.status === "ok" ? E.groupsOf(ourT) : null; return g ? g.length : 0; };
    const n0 = count(), at0 = before && before.at;
    refreshing = true; S.ui.rState = {}; render();
    const done = (msg) => {
      // 우리 팀이 끝나면 지금 고른 상대(연습 픽·함께 한 경기)를 이어서 — Riot 한도를 두 팀이 동시에 쓰지 않게 차례로
      const en = E.teamOf(S, "enemy");
      if (chainEnemy && en && !en.solo && window.Practice && window.RECENT_LIVE_URL) {
        chainEnemy = false;
        S.ui.rState = { msg: `${msg} · 상대 ${en.name} 갱신 중…` }; render();
        refreshPractice(false, {
          progress: (m) => { S.ui.rState = { msg: `${msg} · 상대 ${en.name}: ${m}` }; render(); },
          done: (m) => { refreshing = false; S.ui.rState = { msg: `${msg} · 상대 ${en.name}: ${m}` }; render(); },
        });
        return;
      }
      chainEnemy = false; refreshing = false; S.ui.rState = { msg }; render();
    };
    const reload = (why) => {
      const end = (msg) => done((why ? why + " — " : "") + msg);
      if (!SPACE || SPACE.bad) { end("기록은 팀 공간에 들어온 뒤 보입니다"); return; }
      loadRecent().then((R) => {
        if (!R) { end(REC.status === "empty" ? "아직 수집된 기록이 없습니다" : "불러오기 실패 — 인터넷 연결을 확인해 주세요"); return; }
        const add = count() - n0;
        end(R.at === at0 ? `매일 0시 자동 수집 자료 그대로 · 수집 ${R.at}` : `자동 수집 자료로 갱신 · 수집 ${R.at}${add > 0 ? ` · 새 경기 ${add}판` : " · 새 경기 없음"}`);
      });
    };
    const url = window.RECENT_LIVE_URL;
    if (!url || !ourT || ourT.solo || !before || before.status !== "ok") { reload(""); return; }
    if (!SPACE) { chainEnemy = false; reload("실시간 갱신은 팀 공간에 들어온 뒤(「팀 공간」)"); return; }
    if (NIGHT.at !== before.at) { NIGHT.at = before.at; NIGHT.groups = {}; }
    if (!NIGHT.groups[ourT.id] && !(before.live && before.live[ourT.id])) NIGHT.groups[ourT.id] = (before.groups || {})[ourT.id] || [];
    const inc = NIGHT.groups[ourT.id] && before.since === (PREP.since || before.since) && kstMs(before.at) > 0;   // 기준일이 같을 때만 0시 자료에 더한다
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = setTimeout(() => ctl && ctl.abort(), 25000);
    wfetch(`/groups?team=${encodeURIComponent(ourT.id)}${inc ? `&after=${kstMs(before.at)}` : ""}`, { signal: ctl ? ctl.signal : undefined })
      .then((r) => r.json().catch(() => ({})).then((j) => ({ ok: r.ok, status: r.status, j })))
      .then(({ ok, status, j }) => {
        clearTimeout(timer);
        if (status === 404 && j && j.reason === "조회할 수 없는 팀") { reload("실시간 갱신은 등록된 우리 팀만"); return; }
        if (!ok || !j || j.status !== "ok" || !Array.isArray(j.groups)) { reload(`실시간 조회 실패(${(j && j.reason) || "응답 " + status})`); return; }
        const R = window.RECENT;
        if (j.pending) {   // 한도에 걸려 다 못 읽음: 기다렸다가 자동으로 이어 읽기
          const wait = Math.max(3, j.retryIn || 30);
          gTimer = setTimeout(() => refreshRecent(true), wait * 1000);
          refreshing = false; S.ui.rState = { wait: true, msg: `경기 ${j.groups.length}판까지 읽음 · 남은 ${j.pending}경기는 ${wait}초 뒤 자동으로 이어 읽음(Riot 한도: 2분 100회)` }; render(); return;
        }
        const fresh = j.groups.map((g) => {
          const picks = {}, playedRole = {};
          ROLES.forEach((r) => { if (g.picks && g.picks[r]) { picks[r] = champId(g.picks[r]); playedRole[r] = (g.playedRole && g.playedRole[r]) || ""; } });
          return { date: g.date, queue: g.queue, n: g.n, win: !!g.win, picks, playedRole };
        });
        const merged = {};
        if (inc) NIGHT.groups[ourT.id].forEach((g) => (merged[gameKeyRiot(g)] = g));
        fresh.forEach((g) => (merged[gameKeyRiot(g)] = g));
        const groups = Object.values(merged).sort((a, b) => String(b.date).localeCompare(String(a.date)));
        window.RECENT = { ...R, groups: { ...(R.groups || {}), [ourT.id]: groups }, live: { ...(R.live || {}), [ourT.id]: { at: j.at, pending: j.pending || 0 } } };
        const add = count() - n0;
        done(`실시간 ${j.at}${add > 0 ? ` · 새 경기 ${add}판` : " · 새 경기 없음"}`);
      })
      .catch(() => { clearTimeout(timer); reload("실시간 조회 실패(연결 안 됨)"); });
  }
  // 상대 연습 픽 갱신: Worker(/games)가 상대 5명 경기를 Riot에서 바로 읽고, 페이지가 js/practice.js로 다시 분석한다.
  // 기준선(이전 랭크·숙련도)은 매일 0시 수집 자료(RECENT.practiceBase). 경기를 다 못 읽었으면 바꾸지 않고 다시 누르라고 안내.
  let prefreshing = false;
  // 대회 준비 시작일(연습 기간 시작): 팀 전체 하나(Worker /config). 바꾸면 「갱신하기」는 바로, 매일 0시 수집은 다음 수집부터 그 날짜를 따른다
  const PREP = { since: "", def: "", edit: false, msg: "" };
  const md = (d) => (d ? d.slice(5).replace("-", "/").replace(/^0/, "") : "");
  async function loadPrep() {
    if (!window.RECENT_LIVE_URL) return;
    try { const d = await (await fetch(`${WURL()}/config${SPACE ? "?" + spaceQ() : ""}`, { cache: "no-store" })).json(); if (d.status === "ok") { PREP.since = d.since; PREP.def = d.default; if (SPACE && d.queue) CFG.queue = d.queue; if (S.tab === "live" || S.tab === "enemy") render(); } } catch (e) { /* 그대로 */ }
  }
  async function savePrep(v) {
    if (!SPACE) { PREP.msg = "팀 공간에 들어와야 바꿀 수 있습니다(「팀 공간」)."; render(); return; }
    PREP.msg = "저장 중…"; render();
    try {
      const res = await wfetch(`/config`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ since: v }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.status !== "ok") throw new Error(d.reason || "HTTP " + res.status);
      PREP.since = d.since; PREP.edit = false;
      PREP.msg = `연습 기간을 ${md(d.since)}~로 바꿨습니다(팀 전체). 「갱신하기」를 누르면 이 상대는 바로, 다른 기록은 매일 0시 수집 때 바뀝니다.`;
    } catch (e) { PREP.msg = "저장 실패: " + (e.message || e); }
    render();
  }
  function prepHtml(R) {
    const cur = PREP.since || (R && R.since) || "2026-11-10";
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const stale = PREP.since && R && R.since && PREP.since !== R.since;
    if (PREP.edit) return `<div class="prep"><label class="help" for="prepDate">대회 준비 시작일</label><input class="input" type="date" id="prepDate" min="2025-01-01" max="${today}" value="${esc(cur)}">
      <button class="btn sm primary" data-act="prepsave">저장</button>${PREP.def && PREP.def !== cur ? `<button class="btn sm ghost" data-act="prepdef">${md(PREP.def)}로</button>` : ""}<button class="btn sm ghost" data-act="prepcancel">취소</button>
      <span class="help">이 날짜부터 한 판을 「연습」으로 셉니다 · 팀 전체 적용</span></div>`;
    return `<div class="prep"><span class="help">연습 기간 <b>${md(cur)}~</b>${stale ? ` · 지금 보이는 자료는 ${md(R.since)}~ 기준(갱신하기·0시 수집 때 바뀜)` : ""}</span>
      ${PREP.since ? `<button class="ib btn sm ghost" data-act="prepedit" title="대회 준비 시작일 바꾸기(팀 전체)" aria-label="바꾸기" title="바꾸기">${ico("pencil")}</button>` : ""}${PREP.msg ? `<span class="help" role="status">${esc(PREP.msg)}</span>` : ""}</div>`;
  }
  // 갱신: 매일 0시 수집이 남긴 상대 경기(서버 /data/pgames, 팀 열쇠)에 수집 뒤 새 경기만 Riot에서 더한다 → 보통 한 번에 끝.
  // 기준일을 바꿔 처음부터 읽어야 하면 한도(2분 100회) 때문에 나눠 읽되, 남은 경기는 기다렸다가 자동으로 이어 읽는다.
  let PG = null;   // 0시 수집 경기 파일
  async function practiceGames() {
    if (PG) return PG;
    if (!SPACE || SPACE.bad) return null;
    try { const r = await wfetch("/data/pgames"); const d = r.ok ? await r.json() : null; if (d && d.status === "ok" && d.data && d.data.teams) PG = d.data; } catch (e) { /* 없으면 처음부터 */ }
    return PG;
  }
  let pTimer = null, pCb = null, NIGHTSTAT = null;   // NIGHTSTAT: 0시 수집 랭크 집계(새 경기를 더하기 전 원본)   // pCb: 우리팀 「갱신하기」가 이어서 부를 때 {progress(msg), done(msg)}
  async function refreshPractice(auto, cb) {
    if (cb) pCb = cb;
    const t = E.teamOf(S, "enemy"), R = window.RECENT;
    if ((prefreshing && !auto) || !t || t.solo || !R || R.status !== "ok" || !window.Practice) { if (cb && pCb === cb) { pCb = null; cb.done("상대 갱신 건너뜀"); } return; }
    clearTimeout(pTimer);
    if (!SPACE) { S.ui.pState = { team: t.id, msg: "실시간 갱신은 팀 공간에 들어온 뒤(「팀 공간」)" }; const c = pCb; pCb = null; if (c) c.done("팀 공간 필요"); render(); return; }
    prefreshing = true; S.ui.pState = { team: t.id, msg: auto ? "남은 경기 이어 읽는 중…" : "" }; render();
    const done = (msg) => { prefreshing = false; S.ui.pState = { team: t.id, msg }; const c = pCb; pCb = null; if (c) c.done(msg); render(); };
    const pg = await practiceGames();
    const since = PREP.since || R.since;
    const base = pg && pg.since === since && pg.teams && pg.teams[t.id] ? pg : null;   // 기준일이 같을 때만 0시 경기를 쓴다
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = setTimeout(() => ctl && ctl.abort(), 25000);
    wfetch(`/games?team=${encodeURIComponent(t.id)}${base ? `&after=${base.atMs}` : ""}`, { signal: ctl ? ctl.signal : undefined })
      .then((r) => r.json().catch(() => ({})).then((j) => ({ ok: r.ok, status: r.status, j })))
      .then(({ ok, status, j }) => {
        clearTimeout(timer);
        if (!ok || !j || j.status !== "ok" || !Array.isArray(j.games)) { done(`실시간 조회 실패(${(j && j.reason) || "응답 " + status}) — 매일 0시 자료 그대로`); return; }
        if (j.pending) {
          const wait = Math.max(3, j.retryIn || 30);
          const msg = `상대 경기 ${j.games.length}개 읽음 · 남은 ${j.pending}경기는 ${wait}초 뒤 자동으로 이어 읽음(Riot 한도: 2분 100회)`;
          if (E.teamOf(S, "enemy").id === t.id) { pTimer = setTimeout(() => refreshPractice(true), wait * 1000); if (pCb) pCb.progress(msg); }
          else { const c = pCb; pCb = null; if (c) c.done("상대가 바뀌어 멈춤"); }
          prefreshing = false; S.ui.pState = { team: t.id, msg }; render(); return;
        }
        const roles = ROLES.filter((r) => j.players && j.players[r] && !j.players[r].error && j.players[r].riot === t.players[r].riot);
        const all = {};
        if (base) base.teams[t.id].forEach((g) => (all[g.id] = g));
        j.games.forEach((g) => (all[g.id] = g));
        const games = Object.values(all);
        const RR = window.RECENT, sinceMs = Date.parse(`${j.since || since || "2026-11-10"}T00:00:00+09:00`);
        const P = window.Practice.compute(games, roles, RR.practiceBase && RR.practiceBase[t.id], sinceMs, Date.now());
        const before = RR.practice && RR.practice[t.id];
        P.live = { at: j.at, acct: j.players, since: j.since };
        // 상대 「함께 한 경기」도 같은 경기로(0시 수집기와 같은 규칙, tools/test-groups-from-games.cjs)
        const gr = window.Practice.groups(games, roles);
        // 시즌 전적·11/10 이후 랭크 전적(챔프폭 점수의 바탕): 0시 집계에 그 뒤 새 랭크 경기만 더함. 같은 날 다시 눌러도 0시 값에서 다시 더해 두 번 세지 않음
        let season = RR.season, players = RR.players, ranked = 0;
        if (base) {
          if (!NIGHTSTAT || NIGHTSTAT.at !== RR.at) NIGHTSTAT = { at: RR.at, season: {}, players: {} };
          if (!NIGHTSTAT.season[t.id]) { NIGHTSTAT.season[t.id] = (RR.season || {})[t.id] || null; NIGHTSTAT.players[t.id] = (RR.players || {})[t.id] || null; }
          const baseIds = new Set(base.teams[t.id].map((g) => g.id)), fresh = j.games.filter((g) => !baseIds.has(g.id));
          const ns = NIGHTSTAT.season[t.id], np = NIGHTSTAT.players[t.id];
          const addAll = (src, kind) => src && Object.fromEntries(Object.entries(src).map(([r, x]) => [r, roles.includes(r) ? window.Practice.addRanked(x, fresh, r, kind) : x]));
          if (ns) { season = { ...(RR.season || {}), [t.id]: addAll(ns, "season") }; ranked = ROLES.reduce((n, r) => n + ((season[t.id][r] && season[t.id][r].added) || 0), 0); }
          if (np) players = { ...(RR.players || {}), [t.id]: addAll(np, "recent") };
        }
        window.RECENT = { ...RR, season, players, practice: { ...(RR.practice || {}), [t.id]: P }, groups: { ...(RR.groups || {}), [t.id]: gr }, live: { ...(RR.live || {}), [t.id]: { at: j.at, pending: 0, ranked } } };
        const add = (P.teamGames.n || 0) - ((before && before.teamGames && before.teamGames.n) || 0);
        done(`실시간 ${j.at} · 상대 경기 ${games.length}개${base ? `(0시 이후 새 경기 ${j.games.length}${ranked ? ` · 랭크 ${ranked}판 전적에 더함` : ""})` : ""}${add > 0 ? ` · 팀원끼리 한 판 ${add}판 늘어남` : ""}`);
      })
      .catch(() => { clearTimeout(timer); done("실시간 조회 실패(연결 안 됨) — 매일 0시 자료 그대로"); });
  }
  function stacksHtml(t, mine) {
    const R = window.RECENT;
    const rs = S.ui.rState || {};
    const refresh = mine ? `<div class="g-refresh"><button class="ib btn sm primary g-btn${refreshing ? " busy" : ""}" data-act="grefresh" title="갱신하기 · 우리 팀과 지금 상대" aria-label="갱신하기 · 우리 팀과 지금 상대" ${refreshing ? "disabled" : ""}>${REFRESH_ICO}<span class="sr-only">${refreshing ? "갱신 중" : "갱신하기"}</span></button><span class="help" role="status">${esc(rs.msg || (liveOf(t) ? `Riot에서 바로 가져옴 · ${liveOf(t).at}` : R && R.at ? `매일 0시 자동 수집 ${R.at} · 누르면 Riot에서 바로 가져옵니다` : ""))}</span></div>` : "";
    const head = `<div class="section-title"><h2>${mine ? "우리 팀 함께 한 경기" : "상대 팀 함께 한 경기"}</h2><p>같은 팀 선수 2명 이상이 같은 편이었던 경기(자랭 등) · ${R && R.since ? esc(R.since) : "11/10"} 이후</p>${refresh}</div>`;
    if (!R || R.status !== "ok") return head + `<div class="note">${esc(recWhy())}</div>`;
    const st = E.groupsOf(t);
    const miss = ROLES.filter((r) => { const x = R.players[t.id] && R.players[t.id][r]; return !x || x.error; }).map((r) => `${ROLE_KO[r]} ${esc(t.players[r].riot)}`);
    const missNote = miss.length ? `<p class="help warn" style="margin:0 0 8px">계정을 찾지 못해 빠진 선수: ${miss.join(", ")}</p>` : "";
    if (st === null) return head + `<div class="note">미확보 — 이 팀 자료가 없습니다.</div>`;
    if (!st.length) return head + `<div class="card muted">${missNote}0판 — ${esc(R.since)} 이후 팀원 2명 이상이 같이 한 경기가 없습니다. (${liveOf(t) ? `실시간 ${esc(liveOf(t).at)}` : `수집 ${esc(R.at)}`})</div>`;
    const wins = st.filter((g) => g.win).length;
    const banCount = {};
    st.forEach((g) => (g.bans || []).forEach((b) => b && (banCount[b] = (banCount[b] || 0) + 1)));
    const bans = Object.entries(banCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    // 한 페이지에 5판, 번호로 넘김(우리·상대 따로)
    const PER = 5, key = mine ? "our" : "enemy";
    const pages = Math.ceil(st.length / PER);
    const page = Math.min(Math.max(1, ((S.ui.gPage || {})[key]) || 1), pages);
    const shown = st.slice((page - 1) * PER, page * PER);
    const nums = [];
    for (let p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - page) <= 2) nums.push(p); else if (nums[nums.length - 1] !== "…") nums.push("…");
    const pager = pages > 1 ? `<nav class="pager" aria-label="${mine ? "우리" : "상대"} 팀 함께 한 경기 페이지">
      <button class="btn sm ghost" data-act="gpage" data-k="${key}" data-p="${page - 1}" ${page > 1 ? "" : "disabled"} aria-label="이전 페이지" title="이전 페이지" class="ib">${ico("left")}</button>
      ${nums.map((p) => p === "…" ? `<span class="dim">…</span>` : `<button class="btn sm ${p === page ? "primary" : "ghost"}" data-act="gpage" data-k="${key}" data-p="${p}" ${p === page ? 'aria-current="page"' : ""}>${p}</button>`).join("")}
      <button class="btn sm ghost" data-act="gpage" data-k="${key}" data-p="${page + 1}" ${page < pages ? "" : "disabled"} aria-label="다음 페이지" title="다음 페이지" class="ib">${ico("right")}</button>
      <span class="dim pager-c">${(page - 1) * PER + 1}–${(page - 1) * PER + shown.length} / ${st.length}판</span></nav>` : "";
    const rows = shown.map((g) => `<tr data-gkey="${esc(gameKeyRiot(g))}" class="${mine && S.ui.gFocus === gameKeyRiot(g) ? "focus" : ""}"><td data-label="시각">${esc(g.date)}</td><td data-label="큐·인원">${QUEUE[g.queue] || g.queue} · ${g.n || 5}명</td><td data-label="결과"><span class="pill ${g.win ? "good" : "bad"}">${g.win ? "승" : "패"}</span></td>
      <td data-label="픽"><div class="row-chips">${ROLES.map((r) => g.picks[r] && CH[g.picks[r]] ? `<span class="chip" title="${ROLE_KO[r]}${g.playedRole && g.playedRole[r] && g.playedRole[r] !== r ? ` (실제 ${ROLE_KO[g.playedRole[r]] || "-"})` : ""}">${icon(g.picks[r], "sm")}${esc(CH[g.picks[r]].ko)}</span>` : "").join("")}</div></td>
      <td data-label="밴"><div class="row-chips">${(g.bans || []).filter((b) => CH[b]).map((b) => `<span class="chip">${icon(b, "sm")}</span>`).join("") || `<span class="dim">-</span>`}</div></td>
      ${mine ? `<td data-label="피드백">${noteBtns({ k: "riot", key: gameKeyRiot(g), date: g.date, queue: g.queue, n: g.n || 5, win: !!g.win, picks: Object.fromEntries(ROLES.filter((r) => g.picks[r] && CH[g.picks[r]]).map((r) => [r, g.picks[r]])) })}</td>` : ""}</tr>`).join("");
    const five = st.filter((g) => g.n === 5).length;
    return head + `<div class="card">${missNote}<p class="help" style="margin:0 0 8px">${st.length}판 ${wins}승 (5인 ${five}판) · 출처 ${esc(R.source)}${liveOf(t) ? ` · 실시간 ${esc(liveOf(t).at)}` : ` · 수집 ${esc(R.at)}`}${bans.length ? ` · 자주 밴: ${bans.map(([b, n]) => `${esc(CH[b].ko)} ${n}`).join(", ")}` : ""}</p>
      <div class="tbl-wrap"><table class="study cards-m"><thead><tr><th>시각</th><th>큐·인원</th><th>결과</th><th>함께 한 선수의 픽</th><th>밴</th>${mine ? "<th>피드백</th>" : ""}</tr></thead><tbody>${rows}</tbody></table></div>${pager}</div>`;
  }
  function dataStatus() {
    const R = window.RECENT, M = window.META, P = window.PRO, SC = window.SCOUT;
    const okCount = (obj, pred) => { let ok = 0, all = 0; Object.values(obj || {}).forEach((t) => Object.values(t).forEach((x) => { all++; if (pred(x)) ok++; })); return `${ok}/${all}명`; };
    const ours = team(S.ourTeam);
    const selfN = ROLES.filter((r) => (ours.players[r].pool || []).length).length;
    const stackTxt = R && R.status === "ok" ? S.teams.map((t) => { const st = E.groupsOf(t); return `${esc(t.name)} ${st === null ? "미확보" : st.length + "판" + (st.some((g) => g.n === 5) ? `(5인 ${st.filter((g) => g.n === 5).length})` : "")}`; }).join(" · ") : "미확보";
    const last = R && R.lastAttempt && !R.lastAttempt.ok ? ` · 마지막 시도 ${esc(R.lastAttempt.at)} 실패: ${esc(R.lastAttempt.reason)}` : "";
    const rows = [
      ["선수 전적 (티어·숙련도·최근 랭크)", "Riot API (league·champion-mastery·match)", R && R.status === "ok" && R.season ? R.at : "미확보", R && R.status === "ok" && R.season ? okCount(R.season, (x) => !x.error) + ` · 선수당 최근 랭크 ${R.seasonCap}판` : "새 키로 수집 전"],
      ["최근 랭크 (11/10~)", "Riot API match-v5", R && R.status === "ok" ? R.at : "미확보", (R && R.status === "ok" ? okCount(R.players, (x) => !x.error) + ` · 선수당 최대 ${R.cap}판` : (R ? esc(R.reason || "") : "-")) + last],
      ["함께 한 경기(2인 이상)", "Riot API match-v5", R && R.status === "ok" ? R.at : "미확보", stackTxt],
      ["메타·라인 상성", "op.gg 솔랭 · gol.gg 시즌 통계", M ? M.at : "미확보", M ? `패치 ${esc(M.patch)} · 상성 ${Object.keys(M.mu || {}).length}챔프` : "-"],
      ["프로 밴픽 순서·바텀 조합", "gol.gg 경기별 페이지", P ? P.at : "미확보", P ? `${P.games}경기 (${P.tournaments.filter((t) => t.games).map((t) => esc(t.name) + " " + t.games).join(", ")})` : "-"],
      ["자기평가·상대 챔프폭 메모", window.SELF_EVAL.status === "ok" ? "팀 공유 시트(CSV)" : SH.url ? "팀원 직접 입력 · 팀 공유 저장소" : "팀원 직접 입력", window.SELF_EVAL.status === "ok" ? window.SELF_EVAL.at : selfN ? "입력됨" : "미입력",
        window.SELF_EVAL.status === "ok" ? `${window.SELF_EVAL.rows}개 응답 · ${selfN}/5명` : window.SELF_EVAL.status === "error" ? `공유 시트 읽기 실패: ${esc(window.SELF_EVAL.reason)}`
          : SH.url ? `${selfN}/5명 · ${SH.status === "ok" ? "팀원 모두에게 공유됨" : SH.status === "error" ? `공유 저장소 연결 실패: ${esc(SH.err)}` : "공유 저장소 읽는 중"}` : `${selfN}/5명 · 이 브라우저에 저장(공유 저장소 미설정)`],
    ];
    return `<div class="section-title"><h2>자료 현황</h2><p>출처 · 수집 시각 · 표본</p></div>
      <div class="card tbl-wrap"><table class="study cards-m"><thead><tr><th>자료</th><th>출처</th><th>수집 시각</th><th>표본</th></tr></thead><tbody>
      ${rows.map((x) => `<tr><td data-label="자료"><b>${x[0]}</b></td><td data-label="출처">${x[1]}</td><td data-label="수집 시각">${x[2] === "미확보" || x[2] === "미입력" ? `<span class="pill bad">${x[2]}</span>` : esc(x[2])}</td><td data-label="표본">${x[3]}</td></tr>`).join("")}</tbody></table></div>`;
  }

  // 우리 팀이 아직 없을 때(새 사용자·솔랭·자랭): 빈 로스터 대신 시작 안내
  function noTeamHtml(mob) {
    const has = S.teams.some((t) => !t.solo);
    return `<section class="noteam ${mob ? "m" : ""}"><h2>${has ? "솔랭·자랭으로 보는 중" : "아직 우리 팀이 없습니다"}</h2>
      <p class="help">${has ? "위 「우리팀」에서 팀을 고르면 로스터·함께 한 경기가 보입니다." : "팀을 만들면 선수 5명의 계정·티어·챔프폭과 함께 한 경기, 피드백 노트를 팀원과 나눕니다."}</p>
      <div class="dnav">${SPACE ? "" : `<button class="btn primary" data-act="team">팀 만들기</button>`}<button class="btn" data-act="gotab" data-k="live">솔랭·자랭 밴픽 바로 하기</button></div>
      ${SPACE ? "" : `<p class="help">팀원에게 초대 링크를 받았다면 만들 필요 없이 그 링크를 여세요.</p>`}</section>`;
  }
  function renderOur() {
    const t = team(S.ourTeam);
    if (!t || t.solo) return flowCard() + noTeamHtml();
    const roster = ROLES.map((r) => { const p = t.players[r]; return `<div class="pl"><div class="role">${ROLE_KO[r]}</div><div class="id" title="${esc(p.riot)}">${esc(nick(p.riot))}</div>${plFacts(t, r)}<div class="chips">${poolChips(t, r)}</div></div>`; }).join("");
    const has = E.teamHasPools(t);
    const comps = has ? E.teamComps(t).slice(0, 4) : [];   // 챔프폭 보강 추천에 씀(조합 카드는 실시간 벤픽)
    const plan = has ? E.fearlessPlan(t, 3) : [];
    // 챔프폭 보강
    const topKeys = comps.slice(0, 2).map((c) => c.key);
    const thin = ROLES.map((r) => {
      const pm = E.poolMap(t, r);
      const solid = Object.values(pm).filter((e) => e.lv >= 2).length;
      const add = window.CHAMPIONS.filter((c) => c.pos[0] === r && !pm[c.id])
        .map((c) => ({ c, s: topKeys.reduce((s, k) => s + E.fit(c, k), 0) })).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.c.id);
      return { r, solid, add };
    });
    return `${flowCard()}<div class="section-title"><h2>${esc(t.name)} 로스터</h2><p>숙련도: 상·중·하, 원챔 = 주력 한 챔프</p>${teamSetMenu("our")}</div>
      <div class="roster">${roster}</div>
      ${stacksHtml(t, true)}
      ${has ? "" : `<div class="note" style="margin-top:12px">챔프폭이 비어 있습니다. 「챔프폭 편집」으로 선수별 챔피언을 넣으면 조합이 계산됩니다.</div>`}
      ${has ? `
      <div class="section-title"><h2>피어리스 세트별 조합 배분</h2><p>앞 세트에서 쓴 챔프를 빼고 다시 짠 조합 — 1세트에 주력을 다 쓰면 3세트가 비는지 확인</p></div>
      <div class="series">${plan.map((c, i) => compCard(c, `${i + 1}세트 · ${COMPS[c.key].name}`, `<span class="pill">숙련도 합 ${c.comfort.toFixed(0)}</span>`, true)).join("")}</div>
      <div class="section-title"><h2>챔프폭 보강</h2><p>숙련도 중 이상 챔프가 3개 미만인 라인은 피어리스 후반 세트에서 막힙니다</p></div>
      <div class="card tbl-wrap"><table class="study"><thead><tr><th>라인</th><th>중 이상</th><th>주력 조합에 맞는 연습 추천</th></tr></thead><tbody>
      ${thin.map((x) => `<tr><td><b>${ROLE_KO[x.r]}</b></td><td><span class="pill ${x.solid >= 3 ? "good" : "bad"}">${x.solid}개</span></td><td><div class="row-chips">${x.add.map((id) => `<span class="chip">${icon(id, "sm")}${esc(CH[id].ko)}</span>`).join("")}</div></td></tr>`).join("")}
      </tbody></table></div>` : ""}
`;
  }

  // ---------- 홈(PC 새 디자인 A) ----------
  // 기존 계산(poolMap·recentOf·actualRole·fearlessPlan·groupsOf·thin 보강)을 그대로 쓰고 모양만 바꾼다
  function homeRosterPC(t) {
    const ql = { solo: "솔랭", flex: "자랭" }[CFG.queue] || "랭크";
    return `<section class="h-sec"><h3 class="h-h">로스터 · 챔프폭<small>${md((window.RECENT && window.RECENT.since) || "2026-11-10")}~ ${ql}</small>${teamSetMenu("our")}</h3><div class="lane5">${ROLES.map((r) => {
      const p = t.players[r], x = E.recentOf(t, r), ar = x ? E.actualRole(t, r) : null;
      const pm = E.poolMap(t, r), list = Object.entries(pm).sort((a, b) => E.lvScore(b[1]) - E.lvScore(a[1])).slice(0, 5);
      const sub = [p.tier || "", x && x.n ? `${x.n}판 ${Math.round((x.w / x.n) * 100)}%` : ""].filter(Boolean).join(" · ");
      return `<div class="l5"><span class="l5-r">${ROLE_KO[r]}</span><b class="l5-n" title="${esc(p.riot)}">${esc(nick(p.riot) || "—")}</b><span class="l5-s">${esc(sub) || "&nbsp;"}</span>
        <span class="l5-w">${ar && ar.differs ? `${lbi("warn", 16)}최근 ${ROLE_KO[ar.role]} ${ar.n}판` : ""}</span>
        ${list.length ? list.map(([id, e], j) => `<span class="l5-c ${j ? "" : "first"}" title="${esc(CH[id] ? CH[id].ko : id)}${e.g ? ` · ${e.g}판` : ""}">${icon(id, j ? "md" : "lg")}<b>${esc(CH[id] ? CH[id].ko : id)}</b>${lvTag({ lv: e.lv, one: e.one })}</span>`).join("") : `<span class="help">챔프폭 없음 · 팀 설정에서</span>`}</div>`;
    }).join("")}</div></section>`;
  }
  function homeCompsPC(t) {
    if (!E.teamHasPools(t)) return "";
    const plan = E.fearlessPlan(t, 3);
    if (!plan.length) return "";
    return `<section class="h-sec"><h3 class="h-h">우리 팀 최적 조합<small>챔프폭으로 짠 조합 ${plan.length}개 · 세트마다 챔프가 겹치지 않게(피어리스)</small></h3><div class="hc3">${plan.map((c, i) => {
      const C = COMPS[c.key];
      const filled = ROLES.map((r) => c.slots[r]).filter(Boolean);
      const first = filled.filter((x) => !x.suggest).sort((a, b) => b.lv - a.lv)[0];
      return `<div class="hc"><span class="hc-h"><b>${i + 1}세트</b><span>${esc(C.name)}</span></span>
        <span class="hc-5">${ROLES.map((r) => { const x = c.slots[r]; return `<span class="hc-s"><span>${ROLE_KO[r]}</span>${x ? icon(x.id, "md") : `<span class="ic md"></span>`}<small>${x ? esc(CH[x.id].ko) : "—"}</small></span>`; }).join("")}</span>
        <span class="hc-w">${esc(C.win)}</span>
        <details class="hc-d"><summary>운영 보기</summary><dl><dt>초반</dt><dd>${esc(C.early)}</dd><dt>중반</dt><dd>${esc(C.mid)}</dd><dt>후반</dt><dd>${esc(C.late)}</dd>${first ? `<dt>밴픽 순서</dt><dd>먼저 가져갈 챔프: ${esc(CH[first.id].ko)}</dd>` : ""}<dt class="bad">주의</dt><dd>${esc(C.risk)}</dd></dl></details></div>`;
    }).join("")}</div></section>`;
  }
  function homeGamesPC(t, theirs) {
    const R = window.RECENT, rs = S.ui.rState || {}, pk = theirs ? "enemy" : "our";
    const refresh = theirs ? "" : `<button class="hg-ref ${refreshing ? "busy" : ""}" data-act="grefresh" ${refreshing ? "disabled" : ""} aria-label="갱신하기 · 우리 팀과 지금 상대" title="갱신하기 · 우리 팀과 지금 상대">${lbi("refresh", 22)}</button><span class="help" role="status">${esc(rs.msg || (liveOf(t) ? `Riot에서 바로 가져옴 · ${liveOf(t).at}` : ""))}</span>`;
    const st = R && R.status === "ok" ? E.groupsOf(t) : null;
    const head = (sub) => `<h3 class="h-h">${theirs ? esc(t.name) + " " : ""}함께 한 경기<small>${sub}</small>${refresh}</h3>`;
    if (!st) return `<section class="h-sec">${head("")}<p class="help">${R && R.status === "ok" ? "이 팀 자료가 없습니다." : esc(recWhy())}</p></section>`;
    if (!st.length) return `<section class="h-sec">${head("")}<p class="help">아직 팀원 2명 이상이 같이 한 경기가 없습니다.</p></section>`;
    const PER = 5, pages = Math.ceil(st.length / PER), page = Math.min(Math.max(1, ((S.ui.gPage || {})[pk]) || 1), pages);
    const rows = st.slice((page - 1) * PER, page * PER).map((g) => {
      const k = gameKeyRiot(g), ref = { k: "riot", key: k, date: g.date, queue: g.queue, n: g.n || 5, win: !!g.win, picks: Object.fromEntries(ROLES.filter((r) => g.picks[r] && CH[g.picks[r]]).map((r) => [r, g.picks[r]])) };
      GAMEREF[k] = ref; const nn = noteUrl() ? notesOfGame(ref).length : 0;
      return `<div class="hg ${S.ui.gFocus === k ? "focus" : ""}" data-gkey="${esc(k)}"><b class="${g.win ? "w" : "l"}">${g.win ? "승" : "패"}</b><span class="hg-d">${esc(String(g.date))} · ${QS[g.queue] || g.queue} ${g.n || 5}인</span>
        <span class="hg-p">${ROLES.filter((r) => g.picks[r] && CH[g.picks[r]]).map((r) => `<span class="hg-c">${icon(g.picks[r], "md")}<small>${ROLE_KO[r]}</small></span>`).join("")}</span>
        ${noteUrl() && !theirs ? (nn ? `<button class="soft-b" data-act="ngame" data-gk="${esc(k)}">${lbi("note", 18)}피드백 ${nn}</button>` : `<button class="soft-b" data-act="nnew" data-gk="${esc(k)}">${lbi("note", 18)}피드백 쓰기</button>`) : ""}</div>`;
    }).join("");
    const pager = pages > 1 ? `<nav class="pager h-pg" aria-label="함께 한 경기 페이지"><button class="btn sm ghost" data-act="gpage" data-k="${pk}" data-p="${page - 1}" ${page > 1 ? "" : "disabled"} aria-label="이전 페이지">${ico("left")}</button><span class="dim">${page} / ${pages}</span><button class="btn sm ghost" data-act="gpage" data-k="${pk}" data-p="${page + 1}" ${page < pages ? "" : "disabled"} aria-label="다음 페이지">${ico("right")}</button></nav>` : "";
    return `<section class="h-sec">${head(`${st.length}판 ${st.filter((g) => g.win).length}승`)}<div class="hgl">${rows}</div>${pager}</section>`;
  }
  function homeBoostPC(t) {
    if (!E.teamHasPools(t)) return "";
    const topKeys = E.teamComps(t).slice(0, 2).map((c) => c.key);
    return `<section class="h-sec"><h3 class="h-h">챔프폭 보강<small>숙련도 중 이상이 3개 미만인 라인은 피어리스 후반 세트에서 막힙니다</small></h3><div class="lane5">${ROLES.map((r) => {
      const pm = E.poolMap(t, r), solid = Object.values(pm).filter((e) => e.lv >= 2).length;
      const add = window.CHAMPIONS.filter((c) => c.pos[0] === r && !pm[c.id]).map((c) => ({ c, s: topKeys.reduce((a, k) => a + E.fit(c, k), 0) })).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.c.id);
      return `<div class="l5"><span class="l5-b"><span class="l5-r">${ROLE_KO[r]}</span><span class="pill ${solid >= 3 ? "good" : "bad"}">중 이상 ${solid}개</span></span><span class="hb">${add.map((id) => `<span class="hg-c">${icon(id, "md")}<small>${esc(CH[id].ko)}</small></span>`).join("")}</span></div>`;
    }).join("")}</div></section>`;
  }
  // 시작 단계: 팀 공간 subin(처음 쓴 팀)은 모두 끝난 것으로 본다(사용자 지시 11-19)
  function nuSteps() {
    const sp = spaceTeamId(), legacy = sp === "subin", t = sp ? team(sp) : null;
    const five = !!t && ROLES.every((r) => t.players[r] && /#/.test(t.players[r].riot || ""));
    // 상대 팀 등록 = 이 팀이 직접 넣은 팀(기본으로 들어 있는 처음 팀 명단은 세지 않음)
    const opp = S.teams.some((x) => !x.solo && x.id !== (sp || S.ourTeam) && !(window.SEED_TEAMS || []).some((y) => y.id === x.id));
    return [
      { k: "team", n: "로그인 · 팀", d: "로그인하고 팀 만들기·들어가기", done: !!sp },
      { k: "five", n: "우리 선수 5명", d: "라인별 라이엇 ID", done: legacy || five },
      { k: "invite", n: "팀원 초대", d: "링크 공유", done: legacy || (!!sp && !!S.ui.invited) },
      { k: "opp", n: "상대 팀 등록", d: "엑셀 또는 직접", done: legacy || (!!sp && opp) },
    ];
  }
  const needOnboard = () => guest() || (!S.ui.flowHide && !nuSteps().every((x) => x.done));
  function newUserPC() {
    const st = nuSteps(), curI = st.findIndex((x) => !x.done);
    // 직접 고른 단계는 그때의 진행 상태에서만 보여 줌 — 단계를 끝내면(진행이 바뀌면) 다음 할 단계로 넘어감
    const pick = S.ui.nuStep && typeof S.ui.nuStep === "object" && S.ui.nuStep.at === curI ? S.ui.nuStep.k : null;
    const view = pick && st.some((x, i) => x.k === pick && (x.done || i === curI)) ? st.findIndex((x) => x.k === pick) : curI;
    const bar = `<ol class="nu-bar">${st.map((x, i) => `<li class="${x.done ? "done" : ""} ${i === view ? "on" : ""}">${x.done || i === curI ? `<button data-act="nustep" data-k="${x.k}">` : "<span>"}<span class="nu-n">${x.done ? lbi("check", 16) : i + 1}</span><span class="nu-t"><b>${x.n}</b><small>${x.d}</small></span>${x.done || i === curI ? "</button>" : "</span>"}</li>`).join(`<li class="nu-line" aria-hidden="true"></li>`)}</ol>`;
    const msg = TM.msg ? `<p class="help nu-msg" role="status">${esc(TM.msg)}</p>` : `<p class="help nu-msg" role="status"></p>`;
    const k = st[view].k;
    let body = "";
    if (k === "team" && !(SPACE && !SPACE.bad && !SPACE.viaLogin && TM.step !== "verify")) {
      body = loginBody() + `<p class="help nu-foot">${SESS ? "" : "로그인하면 팀을 만들거나 팀장에게 받은 초대 코드로 들어갑니다 · "}<button class="nc-a del" data-act="gotab" data-k="live">팀 없이 실시간 밴픽만 쓰기</button></p>`;
    } else if (k === "team") {
      if (SPACE && !SPACE.bad) body = `<div class="nu-done">${lbi("check", 22)}<b>${esc(SPACE.name || "팀 공간")}</b> 팀을 만들었습니다</div>`;
      else if (TM.step === "verify") {
        const left = Math.max(0, Math.round(((TM.at || Date.now()) + 15 * 60e3 - Date.now()) / 1000));
        body = `<div class="nu-in"><span class="nu-f">${esc(TM.name)}</span><span class="nu-f">${esc(TM.riot)}<small class="ok">${lbi("check", 14)}계정 있음</small></span></div>
          <div class="nu-ver"><span class="nu-ic"><img src="${ICON_IMG(TM.icon)}" alt="기본 아이콘 ${TM.icon}번" width="96" height="96"><b>${TM.icon}번 아이콘</b></span>
            <ol class="nu-how"><li>롤 클라이언트에서 <b>${esc(TM.riot)}</b>로 로그인</li><li>프로필 아이콘을 <b>${TM.icon}번</b>으로 바꾸기</li><li>아래 「확인」 · 끝나면 원래 아이콘으로 돌려도 됨</li></ol></div>
          ${msg}<div class="nu-act"><button class="n-new" data-act="tcheck" ${TM.busy ? "disabled" : ""}>${lbi("check", 18)}${TM.busy ? "확인 중…" : "확인"}</button><span class="dim">남은 시간 <b id="nuLeft" data-end="${(TM.at || Date.now()) + 15 * 60e3}">${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}</b></span><span class="n-sp"></span><button class="nc-a" data-act="tback">처음으로</button></div>`;
      } else {
        body = `${SPACE && SPACE.bad ? `<p class="warn">이 브라우저의 팀 공간 열쇠가 바뀌었습니다. 팀원에게 새 초대 링크를 받아 여세요.</p>` : ""}
          <div class="nu-in"><input class="input nu-f" id="tmName" maxlength="30" value="${esc(TM.name)}" placeholder="팀 이름" aria-label="팀 이름"><input class="input nu-f" id="tmRiot" maxlength="42" value="${esc(TM.riot)}" placeholder="본인 라이엇 ID (이름#태그)" aria-label="본인 라이엇 ID"></div>
          ${msg}<div class="nu-act"><button class="n-new" data-act="tstart" ${TM.busy ? "disabled" : ""}>${TM.busy ? "계정 확인 중…" : "팀 만들기"}</button><span class="n-sp"></span><button class="nc-a del" data-act="gotab" data-k="live">팀 없이 실시간 밴픽만 쓰기</button></div>`;
      }
      body += `<p class="help nu-foot">초대 링크를 받았다면 만들 필요 없이 그 링크를 여세요 · 본인 확인은 남이 우리 명단으로 팀을 만들지 못하게 하려는 것</p>`;
    } else if (k === "five") {
      const t = team(spaceTeamId());
      body = `<div class="nu-five">${ROLES.map((r) => { const pl = t && t.players[r]; return `<span class="nu-p ${pl && /#/.test(pl.riot || "") ? "ok" : ""}"><small>${ROLE_KO[r]}</small><b>${esc((pl && nick(pl.riot)) || "비어 있음")}</b></span>`; }).join("")}</div>
        <div class="nu-act"><button class="tab n-new" data-tab="team">선수 넣기</button><button class="soft-b" data-act="import">엑셀로 한 번에</button></div>
        <p class="help nu-foot">라인마다 본계정 라이엇 ID · 티어와 챔프폭은 기록에서 자동</p>`;
    } else if (k === "invite" && SPACE && SPACE.viaLogin) {
      body = loginBody();
    } else if (k === "invite") {
      body = `<span class="sd-link nu-link">${esc(location.origin + location.pathname)}#join=${esc(SPACE ? SPACE.id : "")}.●●●●●●●●</span>
        <div class="nu-act"><button class="n-new" data-act="invite">${lbi("invite", 18)}초대 링크 복사</button><span class="dim">팀 단톡방에 붙여 넣기 · 팀원은 링크만 열면 끝</span></div>`;
    } else {
      body = `<div class="nu-act"><button class="n-new" data-act="import">엑셀로 상대 팀 등록</button><span class="dim">상대 명단·챔프폭을 한 번에 · 등록하면 사이드바에 상대 팀이 생김</span></div>`;
    }
    return `<div class="home nu-pc">${collectBanner()}${bar}<section class="nu-body">${body}</section></div>`;
  }
  function renderOurPC() {
    if (needOnboard()) return newUserPC();
    const t = team(S.ourTeam);
    if (!t || t.solo) return flowCard() + noTeamHtml();
    return `<div class="home">${collectBanner()}${flowCard()}${homeRosterPC(t)}${homeCompsPC(t)}${homeGamesPC(t)}${homeBoostPC(t)}</div>`;
  }

  // ---------- 상대 예상 조합 ----------
  // 거르기: 피어리스(하드·소프트·끔) · 세트(1~3) · 우리 밴(먼저 밴할 3개 반영). 기본값은 지금 시리즈 설정
  function ecOpt(detail) {
    const f = (detail && S.ui.ecf) || {};
    const mode = f.mode || S.series.mode || "off";
    const game = mode === "off" ? 1 : Math.max(1, Math.min(3, f.game || S.series.game || 1));
    return { mode, game, ban: !!f.ban };
  }
  function ecomps(ours, en, o) {
    let bans = [];
    if (o.ban) {
      const virtual = Object.assign({}, S, { enemyTeam: en.id, draft: { ourSide: "B", steps: emptySteps(), idx: 0 }, series: { game: 1, mode: "off", locked: [] } });
      bans = E.recommendBan(virtual, "our", 3).map((x) => x.id);
    }
    const r = E.enemyCompSet(ours, en, { mode: o.mode, game: o.game, bans });
    r.bans = bans;
    return r;
  }
  const EC_TAG = { main: "tr", alt: "tr2", ban: "nu", comfort: "nu", prac: "hi", next: "nu", other: "nu" };
  const ec5 = (c, sz) => `<span class="hc-5">${ROLES.map((r) => { const y = c.slots[r]; return `<span class="hc-s"><span>${ROLE_KO[r]}</span>${y ? icon(y.id, sz || "md") : `<span class="ic ${sz || "md"}"></span>`}<small>${y ? esc(CH[y.id].ko) : "—"}</small></span>`; }).join("")}</span>`;
  const ecLike = (x) => `<span class="ec-lk ${x.level === "높음" ? "hi" : x.level === "보통" ? "mid" : "lo"}" title="주력 대비 ${x.pct}%"><small>가능성</small><b>${x.level}</b><i style="--w:${x.pct}%"></i></span>`;
  const ecAnsBody = (a) => a ? `<span class="ec-ah"><b>우리 대응</b><span class="vsb ${a.vs === "유리" ? "good" : a.vs === "불리" ? "bad" : ""}">${a.vs}</span><span>${esc(COMPS[a.comp.key].name)}</span></span>${ec5(a.comp, "sm")}<span class="hc-w">${esc(COMPS[a.comp.key].win)}</span>` : `<span class="help">우리 대응 조합을 만들 챔프폭이 부족합니다.</span>`;
  function ecCard(x) {
    const nm = COMPS[x.comp.identity] ? COMPS[x.comp.identity].name : COMPS[x.comp.key].name;
    return `<article class="ec" tabindex="0" data-act="ecopen" aria-label="${esc(x.tag)} ${esc(nm)} — 눌러서 상황별 전체 보기">
      <span class="ec-h"><span class="ec-tag ${EC_TAG[x.kind]}">${esc(x.tag)}</span>${x.also ? `<span class="ec-tag nu">${esc(x.also)}</span>` : ""}<b>${esc(nm)}</b>${ecLike(x)}</span>
      ${ec5(x.comp)}${x.why ? `<span class="ec-why">${esc(x.why)}</span>` : ""}
      <span class="ec-ans" role="tooltip">${ecAnsBody(x.answer)}</span></article>`;
  }
  function renderEnemyCompsPC(ours, en) {
    const o = ecOpt(true), r = ecomps(ours, en, o);
    const seg = (k, cur, items, label, dis) => `<div class="seg" role="group" aria-label="${label}">${items.map(([v, n]) => `<button data-act="ecf" data-k="${k}" data-v="${v}" aria-pressed="${String(cur) === String(v)}" ${dis ? "disabled" : ""}>${n}</button>`).join("")}</div>`;
    const bar = `<div class="n-bar ec-bar"><button class="ec-back" data-act="ecback">${ico("left")}상대 분석</button>
      <span class="ec-fl"><small>피어리스</small>${seg("mode", o.mode === "soft" ? "hard" : o.mode, [["hard", "하드 피어리스"], ["off", "끔"]], "피어리스")}</span>
      <span class="ec-fl"><small>세트</small>${seg("game", o.game, [[1, "1세트"], [2, "2세트"], [3, "3세트"]], "세트", o.mode === "off")}</span>
      <span class="ec-fl"><small>우리 밴</small>${seg("ban", o.ban ? 1 : 0, [[0, "반영 안 함"], [1, "먼저 밴 3개 반영"]], "우리 밴")}${r.bans.length ? `<span class="ec-bans">${r.bans.map((id) => `<span title="${esc(CH[id].ko)} 밴">${icon(id, "xs")}</span>`).join("")}</span>` : ""}</span></div>`;
    const flow = o.mode !== "off" && r.flow.length ? `<section class="ec-flow" aria-label="세트 흐름"><small>세트 흐름 · 상대가 세트마다 가장 유력한 조합을 쓴다고 볼 때</small><span class="ec-fs">${r.flow.map((f) => `<span class="ec-f ${f.game === o.game ? "now" : f.game < o.game ? "past" : ""}"><b>${f.game}세트</b><span>${esc(COMPS[f.comp.identity].name)}</span><span class="ec-fi">${ROLES.map((x) => f.comp.slots[x] ? icon(f.comp.slots[x].id, "xs") : "").join("")}</span></span>`).join(`<span class="dim">→</span>`)}</span></section>` : "";
    const now = r.list.filter((x) => x.kind !== "ban" && x.kind !== "next").sort((a, b) => b.like - a.like);
    const ifs = r.list.filter((x) => x.kind === "ban" || x.kind === "next");
    const ev = (x) => [`숙련도 합 ${x.comp.comfort.toFixed(1)}`, x.ev.prac >= 1 ? `연습 픽 근거 ${x.ev.prac.toFixed(1)}` : "", x.ev.games ? `팀 경기 라인·챔프 ${x.ev.games}회` : "", x.ev.same ? `거의 그대로 ${x.ev.same}판` : ""].filter(Boolean).join(" · ");
    const row = (x, i) => { const nm = COMPS[x.comp.identity].name;
      return `<article class="ecr"><span class="ecr-n">${i + 1}</span>
        <span class="ecr-l"><span class="ec-h"><span class="ec-tag ${EC_TAG[x.kind]}">${esc(x.tag)}</span>${x.also ? `<span class="ec-tag nu">${esc(x.also)}</span>` : ""}<b>${esc(nm)}</b></span>${ecLike(x)}<span class="ec-why">${esc([x.why, ev(x)].filter(Boolean).join(" · "))}</span></span>
        ${ec5(x.comp)}<span class="ecr-a">${ecAnsBody(x.answer)}</span></article>`; };
    return `<div class="home enemy-pc ec-page">${bar}${flow}
      <section class="h-sec"><h3 class="h-h">${o.mode === "off" ? "" : `${o.game}세트 `}가능성 순<small>숙련도를 가장 무겁게, 연습 픽·팀 경기에서 해 본 조합을 더해 매김 · 주력 = 100</small></h3><div class="ecl">${now.map(row).join("") || `<p class="help">조합을 만들 챔프폭이 부족합니다.</p>`}</div></section>
      ${ifs.length ? `<section class="h-sec"><h3 class="h-h">상황이 바뀌면<small>밴 싸움에서 핵심이 막히거나, 피어리스로 다음 세트에 갈 때</small></h3><div class="ecl">${ifs.map(row).join("")}</div></section>` : ""}</div>`;
  }

  // ---------- 상대 팀 분석(PC 새 디자인 A) ----------
  function renderEnemyPC() {
    for (const k in REC_DET) delete REC_DET[k];
    const ours = team(S.ourTeam), en = team(S.enemyTeam);
    if (!en || en.solo) return `<p class="help">사이드바에서 상대 팀을 고르세요. 상대 팀이 없으면 + 로 엑셀 등록.</p>`;
    const has = E.teamHasPools(en);
    if (S.ui.enView === "comps" && has) return renderEnemyCompsPC(ours, en);
    const sum = (t) => ROLES.reduce((a, r) => a + ((t.players[r] || {}).pts || 0), 0);
    const gaps = ROLES.map((r) => ({ r, g: ((ours.players[r] || {}).pts || 0) - ((en.players[r] || {}).pts || 0) }));
    const weak = gaps.filter((x) => x.g <= -15).map((x) => ROLE_KO[x.r]), strong = gaps.filter((x) => x.g >= 15).map((x) => ROLE_KO[x.r]);
    // 요주의(운영 keyThreats와 같은 계산, 빈 밴픽 기준)
    const keep = { enemyTeam: S.enemyTeam, draft: S.draft, series: S.series };
    S.draft = { ourSide: keep.draft.ourSide, steps: emptySteps(), idx: 0 }; S.series = { game: 1, mode: "off", locked: [] };
    let kt = null; try { kt = E.keyThreats(S, "our"); } catch (e) { kt = null; } finally { Object.assign(S, keep); }
    const thr = kt ? [kt.top, kt.second].filter((x) => x && x.champ) : [];
    const summary = `<section class="e-sum">
      <span class="e-k"><small>티어 점수 합</small><b><span class="tb">${sum(ours)}</span> : <span class="tr">${sum(en)}</span></b></span>
      <span class="e-k"><small>라인 우세 · 열세</small><span class="e-lanes">${gaps.map((x) => `<span class="pill ${x.g >= 15 ? "good" : x.g <= -15 ? "bad" : ""}">${ROLE_KO[x.r]} ${x.g > 0 ? "+" : ""}${x.g}</span>`).join("")}</span></span>
      <span class="e-k e-dir"><small>운영 방향</small><b>${esc(weak.length ? `${weak.join("·")}은 버티는 픽, 정글이 커버` : "라인전 무난")}${strong.length ? ` · ${esc(strong.join("·"))} 주도권으로 동선 시작` : ""}</b></span>
      ${thr.length ? `<span class="e-thr">${thr.map((t, i) => `<span class="e-t">${icon(t.champ, "md")}<span><small class="${i ? "" : "bad"}">요주의 · ${ROLE_KO[t.r]}</small><b>${esc(nick(t.p.riot))}</b><small>${esc(CH[t.champ].ko)}${t.why && t.why[0] ? " · " + esc(t.why[0]) : ""}</small></span></span>`).join("")}</span>` : ""}
    </section>`;
    // 사전 밴 후보(운영과 같은 virtual 밴픽)
    const virtual = Object.assign({}, S, { enemyTeam: en.id, draft: { ourSide: "B", steps: emptySteps(), idx: 0 }, series: { game: 1, mode: "off", locked: [] } });
    const preBans = has ? E.recommendBan(virtual, "our", 8) : [];
    const bans = `<section class="h-sec"><h3 class="h-h">사전 밴 후보<small>첫 밴 페이즈 기준 · 우선순위 순</small></h3>${preBans.length ? `<div class="recs e-bans">${preBans.map((r, i) => recCardPC(r, "ban", true, i + 1, E.cardPills(en, r.tgt, r.id, r.reasons, true))).join("")}</div><div class="rdet" id="recDetail"></div>` : `<p class="help">상대 챔프폭을 넣으면 나옵니다.</p>`}</section>`;
    // 라인 다섯 칸
    const lanes = `<section class="h-sec"><h3 class="h-h">라인별 상대와 연습 포인트<small>점수 차 = 우리 − 상대</small>${teamSetMenu("enemy")}</h3><div class="lane5">${ROLES.map((r) => {
      const p = en.players[r] || {}, o = ours.players[r] || {}, x = E.recentOf(en, r);
      const st = E.laneStudy(ours, en, r);
      const have = [...new Set(st.flatMap((y) => y.have))].slice(0, 4), learn = [...new Set(st.flatMap((y) => y.learn))].slice(0, 3), risky = [...new Set(st.flatMap((y) => y.risky))].slice(0, 4);
      const pm = E.poolMap(en, r), list = Object.entries(pm).sort((a, b) => E.lvScore(b[1]) - E.lvScore(a[1])).slice(0, 4);
      const gap = (o.pts || 0) - (p.pts || 0);
      const row = (t, ids, cls) => `<span class="e-mini"><small class="${cls}">${t}</small><span>${ids.length ? ids.map((id) => `<span class="e-mi ${cls}" title="${esc(CH[id].ko)}">${icon(id, "xs")}</span>`).join("") : `<span class="dim">—</span>`}</span></span>`;
      return `<div class="l5"><span class="l5-r">${ROLE_KO[r]}</span><b class="l5-n tr"><a href="${opgg(p.riot)}" target="_blank" rel="noopener" title="${esc(p.riot)}">${esc(nick(p.riot) || "—")}</a></b>
        <span class="l5-s">${esc([p.tier, x && x.n ? `${x.n}판 ${Math.round((x.w / x.n) * 100)}%` : ""].filter(Boolean).join(" · ")) || "&nbsp;"}</span>
        <span class="l5-s">vs ${esc(nick(o.riot) || "—")} <b class="${gap >= 15 ? "pos" : gap <= -15 ? "neg" : ""}">${gap > 0 ? "+" : ""}${gap}</b></span>
        ${list.map(([id, e], j) => `<span class="l5-c ${j ? "" : "first"}">${icon(id, j ? "md" : "lg")}<b>${esc(CH[id].ko)}</b>${lvTag({ lv: e.lv, one: e.one })}</span>`).join("") || `<span class="help">챔프폭 없음</span>`}
        ${row("우리 대응 가능", have, "good")}${row("새로 연습 추천", learn, "hi")}${row("우리 챔프 중 주의", risky, "bad")}</div>`;
    }).join("")}</div></section>`;
    // 예상 조합: 지금 시리즈 설정(피어리스·세트) 기준, 우리 밴은 반영 안 함
    const comps = has ? `<section class="h-sec"><h3 class="h-h">예상 조합<small>상대가 나올 만한 조합 · 가능성 순 · 카드에 마우스를 올리면 우리 대응</small><button class="ec-more" data-act="ecopen">상황별 전체 보기 ${lbi("chev", 16)}</button></h3>
      <div class="ec-grid">${ecomps(ours, en, ecOpt(false), false).list.filter((x) => x.kind !== "other").slice(0, 6).map((x) => ecCard(x)).join("")}</div></section>` : "";
    return `<div class="home enemy-pc">${collectBanner()}${summary}${bans}${lanes}${comps}${homeGamesPC(en, true)}</div>`;
  }

  // ---------- opponent ----------
  function renderEnemy() {
    const ours = team(S.ourTeam), en = team(S.enemyTeam);
    const has = E.teamHasPools(en);
    const opts = S.teams.filter((t) => t.id !== S.ourTeam).map((t) => `<option value="${t.id}" ${t.id === en.id ? "selected" : ""}>${esc(t.name)}</option>`).join("");
    const sum = (t) => ROLES.reduce((s, r) => s + (t.players[r].pts || 0), 0);
    const rows = ROLES.map((r) => {
      const p = en.players[r], o = ours.players[r];
      const gap = (o.pts || 0) - (p.pts || 0);
      const study = E.laneStudy(ours, en, r);
      const have = [...new Set(study.flatMap((x) => x.have))];
      const learn = [...new Set(study.flatMap((x) => x.learn))].slice(0, 4);
      const risky = [...new Set(study.flatMap((x) => x.risky))];
      return `<tr><td data-label="라인"><b>${ROLE_KO[r]}</b></td>
        <td data-label="상대 선수"><a href="${opgg(p.riot)}" target="_blank" rel="noopener">${esc(nick(p.riot))}</a><div class="help">${esc(p.tier)} · ${p.pts}점${totalTxt(en, r)}</div>${recentLine(en, r)}</td>
        <td data-label="우리 선수">${esc(nick(o.riot))}<div class="help">${esc(o.tier)} · ${o.pts}점${totalTxt(ours, r)}</div></td>
        <td data-label="점수 차"><span class="pill ${gap >= 15 ? "good" : gap <= -15 ? "bad" : ""}">${gap > 0 ? "+" : ""}${gap}</span></td>
        <td data-label="상대 챔프폭"><div class="row-chips">${poolChips(en, r)}</div></td>
        <td data-label="우리 대응 가능"><div class="row-chips">${have.map((id) => `<span class="chip">${icon(id, "sm")}${esc(CH[id].ko)}</span>`).join("") || `<span class="dim">-</span>`}</div></td>
        <td data-label="새로 연습 추천"><div class="row-chips">${learn.map((id) => `<span class="chip">${icon(id, "sm")}${esc(CH[id].ko)}</span>`).join("") || `<span class="dim">-</span>`}</div></td>
        <td data-label="우리 챔프 중 주의"><div class="row-chips">${risky.map((id) => `<span class="chip">${icon(id, "sm")}${esc(CH[id].ko)}</span>`).join("") || `<span class="dim">-</span>`}</div></td></tr>`;
    }).join("");
    let compsHtml = "";
    if (has) {
      const theirs = E.teamComps(en).slice(0, 2);
      const tk = theirs[0].key;
      const ansKey = Object.keys(COMPS).filter((k) => COMPS[k].beats.includes(tk))
        .map((k) => E.buildComp(ours, k)).sort((a, b) => b.comfort * 3 + b.fitScore - (a.comfort * 3 + a.fitScore))[0];
      compsHtml = `<div class="section-title"><h2>상대 예상 조합 → 연습할 대응 조합</h2><p>상대 챔프폭으로 만든 조합과, 그걸 잡는 우리 조합</p></div>
        <div class="comps">${theirs.map((c, i) => compCard(c, `상대 ${i === 0 ? "주력" : "대안"} · ${COMPS[c.key].name}`, `<span class="pill bad">상대</span>`, false, true)).join("")}
        ${ansKey ? compCard(ansKey, `우리 대응 · ${COMPS[ansKey.key].name}`, `<span class="pill good">연습 추천</span>`) : ""}</div>`;
    }
    // 사전 밴 후보
    const virtual = Object.assign({}, S, { enemyTeam: en.id, draft: { ourSide: "B", steps: emptySteps(), idx: 0 }, series: { game: 1, mode: "off", locked: [] } });
    const preBans = E.recommendBan(virtual, "our").slice(0, 5);
    const gaps = ROLES.map((r) => ({ r, g: (ours.players[r].pts || 0) - (en.players[r].pts || 0) }));
    const weak = gaps.filter((x) => x.g <= -15).map((x) => ROLE_KO[x.r]);
    const strong = gaps.filter((x) => x.g >= 15).map((x) => ROLE_KO[x.r]);
    return `<div class="section-title"><h2>상대팀 사전 분석</h2><select id="enemyPick" aria-label="상대팀">${opts}</select>${teamSetMenu("enemy")}${window.SCOUT ? `<p>op.gg 전적 기준 ${esc(window.SCOUT.at)}</p>` : ""}</div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
        <div class="card"><div class="muted">티어 점수 합</div><div style="font-size:22px;font-weight:800">${sum(ours)} <span class="muted" style="font-size:14px">우리</span> : ${sum(en)} <span class="muted" style="font-size:14px">상대</span></div></div>
        <div class="card"><div class="muted">우세 라인</div><div style="font-weight:700">${strong.join(", ") || "없음"}</div><div class="muted" style="margin-top:6px">열세 라인</div><div style="font-weight:700">${weak.join(", ") || "없음"}</div></div>
        <div class="card"><div class="muted">운영 방향</div><div>${weak.length ? `${esc(weak.join("·"))}은 버티는 픽, 정글이 커버` : "라인전 무난"}${strong.length ? ` · ${esc(strong.join("·"))} 주도권으로 동선 시작` : ""}</div></div>
      </div>
      ${has ? "" : `<div class="note" style="margin-top:12px">이 팀은 op.gg 전적을 읽지 못했고 직접 입력한 챔프폭도 없습니다. 「상대 챔프폭 편집」에 넣으면 카운터·연습 추천·예상 조합이 채워집니다.</div>`}
      ${enemySections([
        ["ban", "사전 밴 후보", () => `<div class="section-title"><h2>사전 밴 후보</h2><p>첫 밴 페이즈 기준</p></div>
          <div class="card">${preBans.length ? `<div class="recs">${preBans.map((r) => recCard(r, "ban", false, 0, E.cardPills(en, r.tgt, r.id, r.reasons, true))).join("")}</div>` : `<span class="muted">상대 챔프폭을 넣으면 나옵니다.</span>`}</div>`],
        ["threat", "요주의 인물", () => renderThreatFor(en.id)],
        ["lanes", "라인별 상대·연습 포인트", () => `<div class="section-title"><h2>라인별 상대와 연습 포인트</h2><p>점수 차 = 우리 − 상대</p></div>
          <div class="card tbl-wrap"><table class="study cards-m"><thead><tr><th>라인</th><th>상대 선수</th><th>우리 선수</th><th>점수 차</th><th>상대 챔프폭</th><th>우리 대응 가능</th><th>새로 연습 추천</th><th>우리 챔프 중 주의</th></tr></thead><tbody>${rows}</tbody></table></div>`],
        ["comps", "예상 조합 → 대응 조합", () => compsHtml],
        ["stacks", "함께 한 경기", () => stacksHtml(en, false)],
      ])}`;
  }

  // ---------- pool editor ----------
  let editing = null;
  // 티어는 고르기: 티어 + (아이언~다이아) 단계 1~4 / (마스터 이상) LP. 저장 글자는 「골드 4」·「마스터 700LP」 그대로
  const TIERS = ["아이언", "브론즈", "실버", "골드", "플래티넘", "에메랄드", "다이아", "마스터", "그랜드마스터", "챌린저"];
  const HIGH = (t) => /마스터|챌린저/.test(t);
  function parseTier(v) { const m = String(v || "").trim().match(/^(그랜드마스터|챌린저|마스터|다이아|에메랄드|플래티넘|골드|실버|브론즈|아이언)\s*(\d+)?\s*(LP)?/i); if (!m) return { t: "", d: "", lp: "" }; return HIGH(m[1]) ? { t: m[1], d: "", lp: m[2] || "" } : { t: m[1], d: m[2] || "", lp: "" }; }
  function tierPicker(r, v) {
    const x = parseTier(v);
    const opt = (val, lab, on) => `<option value="${val}" ${on ? "selected" : ""}>${lab}</option>`;
    return `<select class="input" style="flex:1" data-tf="t" data-role="${r}" aria-label="${ROLE_KO[r]} 티어">${opt("", "티어 고르기", !x.t)}${TIERS.map((t) => opt(t, t, x.t === t)).join("")}</select>`
      + (x.t && !HIGH(x.t) ? `<select class="input" style="width:76px" data-tf="d" data-role="${r}" aria-label="${ROLE_KO[r]} 단계">${opt("", "단계", !x.d)}${[4, 3, 2, 1].map((n) => opt(n, n, String(n) === x.d)).join("")}</select>` : "")
      + (x.t && HIGH(x.t) ? `<input class="input" style="width:84px" type="number" min="0" step="1" inputmode="numeric" data-tf="lp" data-role="${r}" value="${esc(x.lp)}" placeholder="LP" aria-label="${ROLE_KO[r]} LP">` : "");
  }
  // 점수(티어 점수 합 비교용): 마스터 70(500LP 이상 90) · 그랜드마스터·챌린저 90 · 다이아 60 · 에메랄드 45 · 플래티넘 35 · 골드 25 · 실버 15 · 브론즈 5 (js/teams.js 머리말과 같음)
  const TIER_PTS = { 아이언: 0, 브론즈: 5, 실버: 15, 골드: 25, 플래티넘: 35, 에메랄드: 45, 다이아: 60 };
  function ptsOf(tier) { const x = parseTier(tier); if (!x.t) return null; if (HIGH(x.t)) return x.t === "마스터" && !(Number(x.lp) >= 500) ? 70 : 90; return TIER_PTS[x.t] != null ? TIER_PTS[x.t] : null; }
  function setRkFrom(el) {
    const r = el.dataset.role, q = el.dataset.q, acc = el.dataset.acc, p = team(editing).players[r];
    const row = el.closest(".sd-qrow"), tt = row.querySelector('[data-rkf="t"]').value, d = row.querySelector('[data-rkf="d"]'), lp = row.querySelector('[data-rkf="lp"]');
    const v = !tt ? "" : HIGH(tt) ? (lp && lp.value !== "" && el.dataset.rkf !== "t" ? `${tt} ${Math.max(0, parseInt(lp.value, 10) || 0)}LP` : tt) : `${tt} ${d && el.dataset.rkf !== "t" ? d.value : 4}`;
    const k = rkKey(acc), e = { ...((p.rk || {})[k] || {}) };
    if (v) e[q] = v; else delete e[q];
    p.rk = { ...(p.rk || {}), [k]: e };
    applyTiers(); save(); shareChanged(editing, r); renderEditor(); render();
    const n = document.querySelector(`#setEd [data-role="${r}"][data-acc="${CSS.escape(acc)}"][data-q="${q}"][data-rkf="${el.dataset.rkf === "t" && HIGH(tt) ? "lp" : el.dataset.rkf}"]`) || document.querySelector(`#setEd [data-role="${r}"][data-acc="${CSS.escape(acc)}"][data-q="${q}"][data-rkf="t"]`); if (n) n.focus();
  }
  function setTierFrom(el) {
    const r = el.dataset.role, row = el.closest(".ed-row"), p = team(editing).players[r];
    const t = row.querySelector('[data-tf="t"]').value, d = row.querySelector('[data-tf="d"]'), lp = row.querySelector('[data-tf="lp"]');
    p.tier = !t ? "" : HIGH(t) ? (lp && lp.value !== "" && el.dataset.tf !== "t" ? `${t} ${Math.max(0, parseInt(lp.value, 10) || 0)}LP` : t) : (d && d.value && el.dataset.tf !== "t" ? `${t} ${d.value}` : t);
    const pv = ptsOf(p.tier); if (pv != null) p.pts = pv;   // 티어를 바꾸면 점수도 규칙대로(마스터 이상은 점수 칸 없이 자동)
    if (/#/.test(p.riot || "")) { const k = rkKey(p.riot), q = CFG.queue === "flex" ? "f" : "s", e = { ...((p.rk || {})[k] || {}) }; if (p.tier) e[q] = p.tier; else delete e[q]; p.rk = { ...(p.rk || {}), [k]: e }; applyTiers(); }
    save(); shareChanged(editing, r);
  }
  // ---------- 계정 입력 도움(사용자 요청 11-19: op.gg처럼 닉네임 연관 검색) ----------
  // Riot API에는 비슷한 이름 검색이 없어서: ① 이 사이트가 아는 계정(모든 팀 명단·부계정·전에 쓴 계정)에서 이름·태그·초성으로 추천,
  // ② 이름#태그를 다 쓰면 서버(/riot/check)가 Riot에 있는지와 솔랭·자랭 티어를 알려 주고 「티어 채우기」(설정의 티어 기준대로).
  const KEY_SEEN = "sentrix-draft.riotseen.v1";
  const CHK = {};   // 「팀|라인|칸」 → 확인 결과 HTML(편집 창을 다시 그려도 유지)
  const chkTimers = {};
  const normId = (v) => String(v || "").replace(/\s+/g, " ").trim().replace(/\s*#\s*/, "#");
  function seenIds() { try { const v = JSON.parse(localStorage.getItem(KEY_SEEN) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function rememberId(id) { try { const v = seenIds().filter((x) => x.toLowerCase() !== id.toLowerCase()); v.unshift(id); localStorage.setItem(KEY_SEEN, JSON.stringify(v.slice(0, 200))); } catch (e) { /* 무시 */ } }
  function knownIds() {
    const m = new Map();
    const add = (id, where) => { if (id && id.includes("#") && !m.has(id.toLowerCase())) m.set(id.toLowerCase(), { id, where }); };
    const each = (teams) => teams.forEach((t) => !t.solo && ROLES.forEach((r) => { const p = t.players[r] || {}; add(p.riot, `${t.name} ${ROLE_KO[r]}`); (p.alts || []).forEach((a) => add(a, `${t.name} ${ROLE_KO[r]} 부계정`)); }));
    each(S.teams); each(window.SEED_TEAMS || []);
    seenIds().forEach((id) => add(id, "전에 입력"));
    return [...m.values()];
  }
  // 이름 부분은 빈칸 무시·대소문자 무시·초성(ㄹㄱ)도, 태그는 앞부분
  function suggestIds(q, self) {
    q = normId(q); if (!q) return [];
    const [qn, qt] = q.split("#"), qq = qn.toLowerCase().replace(/\s+/g, "");
    const hasCho = /[ㄱ-ㅎ]/.test(qq);
    const out = [];
    knownIds().forEach((x) => {
      if (x.id.toLowerCase() === q.toLowerCase() || (self && x.id.toLowerCase() === self.toLowerCase())) return;
      const [n, t] = x.id.split("#"), nn = n.toLowerCase().replace(/\s+/g, "");
      if (qt !== undefined && !t.toLowerCase().startsWith(qt.toLowerCase())) return;
      let rank = nn.startsWith(qq) ? 0 : nn.includes(qq) ? 1 : -1;
      if (rank < 0 && hasCho) { const c = cho(nn); rank = c.startsWith(qq) ? 2 : c.includes(qq) ? 3 : -1; }
      if (rank >= 0) out.push({ ...x, rank });
    });
    return out.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id, "ko")).slice(0, 6);
  }
  const TIER_KO_EN = { IRON: "아이언", BRONZE: "브론즈", SILVER: "실버", GOLD: "골드", PLATINUM: "플래티넘", EMERALD: "에메랄드", DIAMOND: "다이아", MASTER: "마스터", GRANDMASTER: "그랜드마스터", CHALLENGER: "챌린저" };
  const TIER_ORD = Object.keys(TIER_KO_EN);
  const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };
  const tierLine = (x) => !x ? "" : /MASTER|CHALLENGER/.test(x.tier) ? `${TIER_KO_EN[x.tier]} ${x.lp}LP` : `${TIER_KO_EN[x.tier]} ${ROMAN[x.rank] || ""} ${x.lp}LP`.replace(/\s+/g, " ");
  const tierVal = (x) => (!x ? -1 : TIER_ORD.indexOf(x.tier) * 10000 + (5 - (ROMAN[x.rank] || 5)) * 1000 + (x.lp || 0));
  // 설정의 티어 기준대로 채울 글자: 솔랭+자랭 = 높은 쪽(자랭이면 「(자유랭)」), 솔랭만, 자랭만
  function tierFor(d) {
    const q = CFG.queue;
    if (q === "solo") return d.solo ? tierLine(d.solo) : "";
    if (q === "flex") return d.flex ? `${tierLine(d.flex)} (자유랭)` : "";
    if (!d.solo && !d.flex) return "";
    return tierVal(d.flex) > tierVal(d.solo) ? `${tierLine(d.flex)} (자유랭)` : tierLine(d.solo);
  }
  function fieldKey(el) { return `${editing}|${el.dataset.role}|${el.dataset.f === "riot" ? "riot" : "alt" + el.dataset.alt}`; }
  function edSuggest(el) {
    const r = el.dataset.role, box = document.getElementById(`edsug-${r}`);
    if (!box) return;
    const list = suggestIds(el.value, null);
    const fk = el.dataset.f === "riot" ? "riot" : "alt" + el.dataset.alt;
    box.innerHTML = list.map((x) => `<button type="button" class="ed-s" data-act="edsug" data-role="${r}" data-k="${fk}" data-v="${esc(x.id)}"><b>${esc(x.id.split("#")[0])}</b><span>#${esc(x.id.split("#")[1])}</span><small>${esc(x.where)}</small></button>`).join("");
    box.hidden = !list.length; box.dataset.for = fk;
  }
  function edCheckSoon(el) {
    const k = fieldKey(el); clearTimeout(chkTimers[k]);
    chkTimers[k] = setTimeout(() => edCheck(el, k), 700);
  }
  async function edCheck(el, k) {
    const r = el.dataset.role, out = document.getElementById(`edchk-${r}`), v = normId(el.value);
    const show = (html) => { CHK[k] = html; if (out) { out.dataset.k = k; out.innerHTML = html; } };   // 그 라인에서 마지막으로 고친 칸의 결과
    if (v.length < 2) { show(""); return; }
    if (!SPACE) { show(`<span class="help">팀 공간에 들어오면 Riot에서 계정이 있는지 확인합니다.</span>`); return; }
    show(`<span class="help">Riot에서 확인 중…</span>`);
    try {
      const res = await wfetch(`/riot/check?id=${encodeURIComponent(v)}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.status !== "ok") throw new Error(d.reason || "HTTP " + res.status);
      if (normId(el.value) !== v) return;   // 그사이 또 고쳤으면 버림
      if (!d.exists) { show(`<span class="ed-no">✕ ${esc(d.riot)} — Riot에 없는 계정입니다(이름·태그 확인)</span>`); return; }
      const tiers = [d.solo ? `솔랭 ${tierLine(d.solo)}` : "솔랭 기록 없음", d.flex ? `자랭 ${tierLine(d.flex)}` : "자랭 기록 없음"].join(" · ");
      const fill = tierFor(d), field = el.dataset.f === "riot" ? "riot" : "alt" + el.dataset.alt;
      const inl = !!el.closest("#setEd"), fs = d.solo ? tierLine(d.solo).replace(/^(\S+ \d) \d+LP$/, "$1") : "", ff = d.flex ? tierLine(d.flex).replace(/^(\S+ \d) \d+LP$/, "$1") : "";
      const same = d.riot.toLowerCase() === v.toLowerCase();   // 대소문자만 다르면 같은 계정(Riot ID는 대소문자 구분 없음)
      if (inl && editing && team(editing)) {   // 우리 팀 편집 칸: 받은 솔랭·자랭을 바로 넣음(고르는 칸 없음)
        const tt = team(editing), p = tt.players[r], val = { ...(d.solo ? { s: lowLp(d.solo) } : {}), ...(d.flex ? { f: lowLp(d.flex) } : {}) };
        p.rk = { ...(p.rk || {}), [rkKey(v)]: val, [rkKey(d.riot)]: val }; applyTiers(); save();
        const slot = el.dataset.f === "riot" ? "m" : el.dataset.alt, box = document.getElementById(`edrk-${r}-${slot}`); if (box) box.outerHTML = rkView(tt, r, v, slot);
        const eff = document.getElementById(`edeff-${r}`); if (eff) eff.innerHTML = effLine(tt, r);
        show(`<span class="ed-ok">✓ ${esc(d.riot)}</span>` + (!same ? `<button type="button" class="btn sm" data-act="eduse" data-role="${r}" data-k="${field}" data-v="${esc(d.riot)}">이걸로</button>` : ""));
        rememberId(d.riot); return;
      }
      show(`<span class="ed-ok">✓ ${esc(d.riot)}</span><span class="help">${esc(tiers)}</span>`
        + (!same ? `<button type="button" class="btn sm" data-act="eduse" data-role="${r}" data-k="${field}" data-v="${esc(d.riot)}">이걸로</button>` : "")
        + (inl ? ((fs || ff) ? `<button type="button" class="btn sm" data-act="rkfill" data-role="${r}" data-acc="${esc(d.riot)}" data-s="${esc(fs)}" data-f="${esc(ff)}">솔랭·자랭 채우기</button>` : `<span class="help">솔랭·자랭 모두 언랭</span>`)
          : fill ? `<button type="button" class="btn sm" data-act="edfill" data-role="${r}" data-v="${esc(fill)}">티어 채우기 · ${esc(fill)}</button>` : ""));
      rememberId(d.riot);
    } catch (e) { show(`<span class="help">확인하지 못했습니다(${esc(e.message || e)}) — 입력은 저장됐습니다.</span>`); }
  }
  // 칸에 값 넣기(추천 고르기·「이걸로」): 입력 이벤트로 저장 경로를 그대로 탄다
  function edSet(r, k, v) {
    const el = document.querySelector(k === "riot" ? `#modal [data-f="riot"][data-role="${r}"]` : `#modal [data-alt="${k.slice(3)}"][data-role="${r}"]`);
    if (!el) return;
    el.value = v; el.dispatchEvent(new Event("input", { bubbles: true }));
    const box = document.getElementById(`edsug-${r}`); if (box) box.hidden = true;
    edCheck(el, fieldKey(el));
  }

  let edLane = "T";   // 휴대폰: 자기평가 창은 라인 하나씩
  function renderEditor() {
    const inl = document.getElementById("setEd");
    if (inl && S.tab === "team" && !MOB.matches) {
      // 설정 칸 안: 닫기(Esc)로 비우지 않고 고른 팀을 다시 그림
      editing = setTeamPC(); inl.dataset.team = editing;
      const ok = team(editing); if (!ok) { inl.innerHTML = ""; return; }
      inl.innerHTML = edInlineHtml(ok); return;
    }
    const root = document.getElementById("modal");
    if (!editing) { root.innerHTML = ""; return; }
    const t = team(editing);
    const roles = MOB.matches ? edRolesFull(t) : ROLES.map((r) => { const p = t.players[r]; return `<div class="ed-role ed-pool-only" data-r="${r}"><div class="ed-row"><b style="width:40px">${ROLE_KO[r]}</b><span class="ed-who">${esc(nick(p.riot) || "계정 없음")}</span></div>
      <div class="row-chips">${poolChips(t, r, { edit: true })}</div>
      <div class="ed-row"><input class="input" style="flex:1" list="champList" data-add="${r}" placeholder="챔피언 추가 (이름 입력 후 Enter)">
      <select data-addlv="${r}" aria-label="숙련도"><option value="3">상</option><option value="2" selected>중</option><option value="1">하</option><option value="one">원챔</option></select>
      <button class="ib btn sm" data-act="add" data-role="${r}" aria-label="추가" title="추가">${ico("plus")}</button></div></div>`; }).join("");
    function edRolesFull(t) { return ROLES.map((r) => { const p = t.players[r]; return `<div class="ed-role" data-r="${r}"><div class="ed-row"><b style="width:40px">${ROLE_KO[r]}</b>
      <input class="input ed-acc" style="flex:2" data-f="riot" data-role="${r}" value="${esc(p.riot)}" placeholder="본계정 이름#태그" aria-label="${ROLE_KO[r]} 라이엇 ID">
      ${[0, 1].map((k) => `<input class="input ed-acc ed-alt" style="flex:1.4" data-alt="${k}" data-role="${r}" value="${esc(((p.alts || altsOf(t.id, r)) || [])[k] || "")}" placeholder="부계정${k + 1}(선택)" aria-label="${ROLE_KO[r]} 부계정 ${k + 1}">`).join("")}
      ${tierPicker(r, p.tier)}
      ${HIGH(parseTier(p.tier).t) ? `<span class="ed-pts help" title="마스터 500LP 이상·그랜드마스터·챌린저 90, 마스터 70">점수 ${p.pts}</span>` : `<input class="input" style="width:70px" type="number" data-f="pts" data-role="${r}" value="${p.pts}" aria-label="점수">`}</div>
      <div class="ed-sug" id="edsug-${r}" role="listbox" aria-label="${ROLE_KO[r]} 계정 추천" hidden></div>
      <p class="ed-chk" id="edchk-${r}" aria-live="polite" data-k="${t.id}|${r}|riot">${CHK[`${t.id}|${r}|riot`] || ""}</p>
      <div class="row-chips">${poolChips(t, r, { edit: true })}</div>
      <div class="ed-row"><input class="input" style="flex:1" list="champList" data-add="${r}" placeholder="챔피언 추가 (이름 입력 후 Enter)">
      <select data-addlv="${r}" aria-label="숙련도"><option value="3">상</option><option value="2" selected>중</option><option value="1">하</option><option value="one">원챔</option></select>
      <button class="ib btn sm" data-act="add" data-role="${r}" aria-label="추가" title="추가">${ico("plus")}</button></div></div>`; }).join(""); }
    root.innerHTML = `<div class="modal-bg" data-act="close"><div class="modal" role="dialog" aria-modal="true" aria-label="챔프폭 편집" ${MOB.matches ? `data-edr="${edLane}"` : ""}>
      <div class="modal-h"><h2>${esc(t.name)} · ${t.id === S.ourTeam ? "자기평가 입력" : "챔프폭 편집"}</h2><button class="ib btn sm" data-act="close" aria-label="닫기" title="닫기">${ico("x")}</button></div>
      ${MOB.matches ? `<p class="help ed-intro">${t.id === S.ourTeam ? "<b>대회에서 실제로 꺼낼 수 있는 챔프</b>만 넣고 자신감을 고르세요. 본인 평가가 있는 선수는 이 목록만 추천에 쓰고, 전적은 참고로만 붙습니다. " : ""}${t.id === S.ourTeam ? "" : "여기 넣은 챔프는 전적 추천에 <b>더해집니다</b>(전적 챔프는 그대로 남음). "}칩을 누르면 상 → 중 → 하 → 원챔 순서로 바뀝니다. ×는 삭제.</p>` : `<p class="help ed-intro">알약을 누르면 숙련도가 바뀝니다 · ×는 삭제 · 바로 저장됩니다</p>`}
      ${MOB.matches ? `<p class="help" id="shareNote" aria-live="polite">${t.solo ? "개인(솔랭) 상대는 이 브라우저에만 저장됩니다." : shareNote()}</p>${t.solo || !SH.url ? "" : shareRoles(t)}` : ""}
      ${MOB.matches ? laneChips("edlane", edLane, "라인", { noAll: true }) : ""}${roles}</div></div>`;
  }
  // 설정 PC: 라인 한 줄 = 라인 · 계정(본계정 확인·부계정·티어) · 챔프폭 알약(+ 챔프)
  function setTeamPC() {
    const ours = team(S.ourTeam);
    const want = S.ui.setTeam === "enemy" ? (S.ui.setEnemy && team(S.ui.setEnemy) && !team(S.ui.setEnemy).solo && S.ui.setEnemy !== S.ourTeam ? S.ui.setEnemy : (S.teams.find((t) => !t.solo && t.id !== S.ourTeam) || {}).id) : ours && !ours.solo ? ours.id : null;
    return want || null;
  }
  // ---- 티어: 계정마다 솔랭(s)·자랭(f) → 설정 기준으로 반영 티어 ----
  const rkKey = (id) => String(id || "").replace(/\s*#\s*/, "#").trim().toLowerCase();
  const accountsOf = (t, r) => { const p = t.players[r]; return [[p.riot, "본계정"]].concat(((p.alts || altsOf(t.id, r)) || []).filter(Boolean).map((a, i) => [a, `부계정 ${i + 1}`])).filter(([a]) => /#/.test(a || "")); };
  function tierNum(v) { const x = parseTier(v); if (!x.t) return -1; const i = TIERS.indexOf(x.t); return i * 10000 + (HIGH(x.t) ? Math.min(9999, Number(x.lp) || 0) : (5 - (Number(x.d) || 4)) * 1000); }
  const Q_KO = { s: "솔랭", f: "자랭" };
  // 반영 티어: { tier, q, acc, fb(다른 큐로 대신), none(언랭) }
  function effTier(t, r) {
    const p = t.players[r], rk = p.rk || {}, accs = accountsOf(t, r);
    const pick = (qs) => { let best = null; accs.forEach(([a, lab]) => qs.forEach((q) => { const v = (rk[rkKey(a)] || {})[q]; const n = tierNum(v); if (n >= 0 && (!best || n > best.n)) best = { tier: v, q, acc: lab, n }; })); return best; };
    const basis = CFG.queue === "solo" ? ["s"] : CFG.queue === "flex" ? ["f"] : ["s", "f"];
    const b = pick(basis); if (b) return b;
    if (basis.length === 1) { const o = pick(basis[0] === "s" ? ["f"] : ["s"]); if (o) return { ...o, fb: true }; }
    return { none: true };
  }
  // 예전 자료(티어 한 칸)는 본계정의 솔랭(「(자유랭)」이 붙었으면 자랭)으로 옮김
  function migrateTier(t, r) {
    const p = t.players[r];
    if (p.rk || !/#/.test(p.riot || "")) return;
    const m = /\((자유랭|자랭)\)/.test(p.tier || ""), v = String(p.tier || "").replace(/\s*\((자유랭|자랭)\)/, "").trim();
    p.rk = { [rkKey(p.riot)]: v && tierNum(v) >= 0 ? { [m ? "f" : "s"]: v } : {} };
    if (!v) p.ptsU = p.pts;   // 티어 없이 넣어 둔 점수는 언랭 점수로 유지
  }
  // ---- 기록 수집 상태(수집기가 서버에 알림) ----
  const CS = { state: "", at: "", startAt: "", timer: null };
  async function loadCollectStatus() {
    if (!SPACE || SPACE.bad || !WURL()) return;
    try {
      const res = await wfetch(`/data/status`); const d = await res.json().catch(() => ({}));
      const was = CS.state;
      if (res.ok && d.status === "ok" && d.data) Object.assign(CS, d.data);
      if (was === "running" && CS.state !== "running") loadRecent();   // 수집이 끝나면 기록 다시 읽기
      clearTimeout(CS.timer);
      if (CS.state === "running") CS.timer = setTimeout(loadCollectStatus, 60000);
      if (["our", "enemy", "team", "live"].includes(S.tab)) render();
    } catch (e) { /* 다음에 */ }
  }
  // 수집 범위(사용자 요청 11-19: 어디까지 모으는지 알려 주기). 실제 수집기(tools/recent.py)와 같게:
  // 챔프폭 = 계정마다 최근 랭크 N판(Riot이 보관하는 최대 2년 안), 숙련도 = 전체 기간, 함께 한 경기 = 연습 기간부터
  function rangeNote() {
    const R = window.RECENT || {}, cap = R.seasonCap || 100, since = md(PREP.since || R.since || "2026-11-10");
    const can = R.status === "ok" && !!window.RECENT_LIVE_URL && !guest(), msg = (S.ui.rState || {}).msg || "";
    // 기록 갱신: 아이콘 버튼 하나(사용자 요청 11-19) — 도는 중 → 끝나면 체크(실패면 느낌표), 자세한 내용은 마우스를 올리면
    const bad = /실패|오류/.test(msg), st = refreshing || (S.ui.rState || {}).wait ? "busy" : msg ? (bad ? "bad" : "done") : "";
    const tip = refreshing ? "갱신 중" : msg ? msg : "기록 갱신 · Riot에서 최근 경기를 바로 가져옴";
    const btn = can ? `<button class="cs-rb ${st}" data-act="grefresh" ${refreshing ? "disabled" : ""} title="${esc(tip)}" aria-label="${esc(tip)}">${st === "done" ? lbi("check", 18) : st === "bad" ? lbi("warn", 18) : lbi("refresh", 18)}</button>` : "";
    return `<div class="cs-row"><p class="cs-range">랭크 <b>${cap}판</b> 기준(최대 2년) · 함께 한 경기 <b>${since}~</b>${R.at ? ` · ${esc(String(R.at).slice(5, 16).replace("-", "/"))} 수집` : ""}</p>${btn}</div>`;
  }
  // 우리·상대 팀 기록이 아직 없으면 위쪽 띠
  function collectBanner() {
    if (guest()) return "";
    const R = window.RECENT, has = (t) => t && !t.solo && R && R.status === "ok" && R.players && R.players[t.id] && Object.keys(R.players[t.id]).length;
    const ids = [team(S.ourTeam), S.tab === "our" || S.tab === "team" ? null : team(S.enemyTeam)].filter((t) => t && !t.solo && ROLES.some((r) => /#/.test((t.players[r] || {}).riot || "")));
    const miss = ids.filter((t) => !has(t));
    if (!miss.length) return ids.length ? rangeNote() : "";
    const hm = (v) => String(v || "").slice(11, 16);
    if (CS.state === "running") return `<div class="cs-band run" role="status"><span class="cs-dot"></span><b>Riot 기록을 모으는 중입니다</b><span>${CS.startAt ? `${hm(CS.startAt)} 시작 · ` : ""}${miss.map((t) => esc(t.name)).join(" · ")} 시즌 기록·챔프폭·함께 한 경기 — 끝나면 자동으로 채워집니다(보통 10~20분)</span></div>${rangeNote()}`;
    return `<div class="cs-band" role="status"><b>아직 기록이 없습니다</b><span>${miss.map((t) => esc(t.name)).join(" · ")} — 등록은 끝났고, Riot 기록은 다음 수집(매일 0시) 때 채워집니다${CS.state === "failed" ? " · 지난 수집이 실패해 다시 시도합니다" : ""}</span></div>${rangeNote()}`;
  }
  // Riot에서 계정별 솔랭·자랭 받기: pairs = [[팀ID, 라인]…]. 팀 공간 열쇠가 있어야 조회됨
  const TQ = { busy: false, done: 0, all: 0, miss: 0, msg: "", fails: [] };
  const lowLp = (x) => (x ? tierLine(x).replace(/^(\S+ \d) \d+LP$/, "$1") : "");
  async function fetchTiers(pairs, quiet) {
    if (!SPACE || SPACE.bad) { TQ.msg = "팀 공간에 들어오면 Riot에서 티어를 받습니다"; render(); return; }
    if (TQ.busy) return;
    const jobs = [];
    const seen = new Set();
    pairs.forEach(([tid, r]) => { const t = team(tid); if (t && !t.solo && t.players[r]) accountsOf(t, r).forEach(([a]) => { const k = `${tid}|${r}|${rkKey(a)}`; if (!seen.has(k)) { seen.add(k); jobs.push([tid, r, a]); } }); });
    Object.assign(TQ, { busy: true, done: 0, all: jobs.length, miss: 0, msg: "", fails: [] }); render();
    for (const [tid, r, a] of jobs) {
      let d = null, why = "확인 못 함";
      for (let tries = 0; tries < 8; tries++) {
        try {
          const res = await wfetch(`/riot/check?id=${encodeURIComponent(a)}`);
          const j = await res.json().catch(() => ({}));
          if (res.status === 429) { TQ.msg = "Riot 조회 한도 — 1분 뒤 이어서 받습니다"; render(); await new Promise((ok) => setTimeout(ok, 61000)); continue; }
          if (res.ok && j.status === "ok") d = j; else why = j.reason || `응답 ${res.status}`;
        } catch (e) { why = "연결 실패"; }
        break;
      }
      const t = team(tid);
      if (t && d && d.exists) {
        const p = t.players[r], k = rkKey(a);
        p.rk = { ...(p.rk || {}), [k]: { ...(d.solo ? { s: lowLp(d.solo) } : {}), ...(d.flex ? { f: lowLp(d.flex) } : {}) } };
        applyTiers(); shareChanged(tid, r);
      } else { TQ.miss++; const tm = team(tid); TQ.fails.push({ team: tm ? tm.name : "", r, a, why: d && !d.exists ? "Riot에 없는 계정(이름·태그 확인)" : why }); }
      TQ.done++; TQ.msg = `Riot에서 티어 받는 중 ${TQ.done} / ${TQ.all}`;
      if (TQ.done % 5 === 0 || TQ.done === TQ.all) { save(); render(); }
    }
    TQ.busy = false; TQ.msg = `티어 받기 끝 — 계정 ${TQ.all}개${TQ.miss ? ` 중 ${TQ.miss}개는 못 받음(아래 목록)` : ""}`;
    save(); render(); if (!quiet || TQ.miss) toast(TQ.msg);
  }
  function applyTiers() {
    S.teams.forEach((t) => { if (t.solo) return; ROLES.forEach((r) => { const p = t.players[r]; if (!p) return; migrateTier(t, r); if (!p.rk) return;
      const e = effTier(t, r);
      if (e.none) { p.tier = ""; p.pts = p.ptsU != null && p.ptsU !== "" ? Number(p.ptsU) || 0 : 0; return; }
      p.tier = e.q === "f" ? `${e.tier} (자유랭)` : e.tier; const pv = ptsOf(e.tier); if (pv != null) p.pts = pv; }); });
  }
  const TIER_FILE = { 아이언: "iron", 브론즈: "bronze", 실버: "silver", 골드: "gold", 플래티넘: "platinum", 에메랄드: "emerald", 다이아: "diamond", 마스터: "master", 그랜드마스터: "grandmaster", 챌린저: "challenger" };
  const tierImg = (t, sz) => `<img class="tier-ic" src="img/tier/${TIER_FILE[t] || "unranked"}.svg" alt="" width="${sz || 22}" height="${Math.round((sz || 22) * 13 / 17)}" aria-hidden="true">`;
  // 칸 제목을 붙인 티어 고르기(설정 PC). data-tf·data-role은 편집 창 tierPicker와 같아 저장 계산(setTierFrom) 그대로
  function tierPickerPC(r, v, pts) {
    const x = parseTier(v);
    const opt = (val, lab, on) => `<option value="${val}" ${on ? "selected" : ""}>${lab}</option>`;
    const f = (lab, inner, cls) => `<label class="sd-fl ${cls || ""}"><small>${lab}</small>${inner}</label>`;
    return f("티어", `<span class="sd-tsel">${tierImg(x.t)}<select class="input" data-tf="t" data-role="${r}" aria-label="${ROLE_KO[r]} 티어">${opt("", "티어 없음", !x.t)}${TIERS.map((t) => opt(t, t, x.t === t)).join("")}</select></span>`, "sd-ft")
      + (x.t && !HIGH(x.t) ? f("단계", `<select class="input" data-tf="d" data-role="${r}" aria-label="${ROLE_KO[r]} 단계">${opt("", "-", !x.d)}${[4, 3, 2, 1].map((n) => opt(n, n, String(n) === x.d)).join("")}</select>`, "sd-fd") : "")
      + (x.t && HIGH(x.t) ? f("LP", `<input class="input" type="number" min="0" step="1" inputmode="numeric" data-tf="lp" data-role="${r}" value="${esc(x.lp)}" placeholder="LP" aria-label="${ROLE_KO[r]} LP">`, "sd-fd") : "")
      // 마스터 이상은 점수가 티어·LP로 정해져(마스터 70, 500LP↑·그마·챌 90) 칸을 아예 두지 않음(사용자 지시 11-19)
      + (HIGH(x.t) ? "" : f("점수", `<input class="input" type="number" data-f="pts" data-role="${r}" value="${pts}" aria-label="${ROLE_KO[r]} 점수" title="티어 점수 합 비교용 · 티어를 고르면 자동">`, "sd-fp"));
  }
  // 계정 한 줄의 큐 하나(솔랭/자랭): 티어 + 단계(또는 LP)
  function rkPicker(r, acc, q, v, dis) {
    const x = parseTier(v), opt = (val, lab, on) => `<option value="${val}" ${on ? "selected" : ""}>${lab}</option>`, at = `data-role="${r}" data-acc="${esc(acc)}" data-q="${q}"`;
    return `<span class="sd-q"><small>${Q_KO[q]}</small><span class="sd-qrow"><span class="sd-tsel">${tierImg(x.t)}<select class="input" data-rkf="t" ${at} aria-label="${ROLE_KO[r]} ${Q_KO[q]} 티어" ${dis ? "disabled" : ""}>${opt("", "언랭", !x.t)}${TIERS.map((tt) => opt(tt, tt, x.t === tt)).join("")}</select></span>`
      + (x.t && !HIGH(x.t) ? `<select class="input sd-qd" data-rkf="d" ${at} aria-label="${ROLE_KO[r]} ${Q_KO[q]} 단계">${[4, 3, 2, 1].map((n) => opt(n, n, String(n) === String(x.d || 4))).join("")}</select>` : "")
      + (x.t && HIGH(x.t) ? `<input class="input sd-qd" type="number" min="0" step="1" inputmode="numeric" data-rkf="lp" ${at} value="${esc(x.lp)}" placeholder="LP" aria-label="${ROLE_KO[r]} ${Q_KO[q]} LP">` : "") + `</span></span>`;
  }
  // 우리 팀 편집 칸(11-19 사용자 지적: 계정만 넣으면 티어는 알아서): Riot에서 받은 솔랭·자랭을 보여 주기만
  function rkView(t, r, acc, slot) {
    const id = `edrk-${r}-${slot}`;
    if (!/#/.test(acc || "")) return `<p class="sd-rkv dim" id="${id}">계정을 넣으면 Riot에서 솔랭·자랭 티어를 불러옵니다</p>`;
    const v = (t.players[r].rk || {})[rkKey(acc)];
    if (!v) return `<p class="sd-rkv dim" id="${id}">${TQ.busy ? "티어 불러오는 중…" : "아직 티어를 못 받음 — 저장하면 Riot에서 다시 받습니다"}</p>`;
    const q = (k) => { const x = parseTier(v[k]); return `<span class="sd-rkq"><small>${Q_KO[k]}</small>${tierImg(x.t, 18)}${x.t ? esc(v[k]) : "언랭"}</span>`; };
    return `<p class="sd-rkv" id="${id}">${q("s")}${q("f")}</p>`;
  }
  function rkRow(t, r, acc) {
    const v = (t.players[r].rk || {})[rkKey(acc)] || {}, dis = !/#/.test(acc || "");
    return `<div class="sd-rk">${rkPicker(r, acc, "s", v.s, dis)}${rkPicker(r, acc, "f", v.f, dis)}</div>`;
  }
  function effLine(t, r) {
    const p = t.players[r];
    if (!accountsOf(t, r).length) return `<p class="help sd-eff-none">계정(이름#태그)을 넣으면 Riot에서 티어를 받습니다</p>`;
    const e = effTier(t, r);
    const basis = QUEUE_TXT[CFG.queue][0];
    if (e.none) return `<div class="sd-eff none"><span class="sd-eff-h"><small>반영 티어 · ${esc(basis)}</small><b>${tierImg("")}언랭</b></span>
      <label class="sd-fl sd-fp"><small>점수</small><input class="input" type="number" min="0" max="100" data-ptsu data-role="${r}" value="${esc(p.ptsU != null ? p.ptsU : "")}" placeholder="0" aria-label="${ROLE_KO[r]} 언랭 점수"></label>
      <span class="sd-warn">솔랭·자랭 티어가 없어 점수를 직접 넣어 주세요(비우면 0점)</span></div>`;
    return `<div class="sd-eff ${e.fb ? "fb" : ""}"><span class="sd-eff-h"><small>반영 티어 · ${esc(basis)}</small><b>${tierImg(parseTier(e.tier).t)}${esc(e.tier)}</b></span><span class="sd-eff-m">${esc(e.acc)} · ${Q_KO[e.q]} · 점수 <b>${p.pts}</b></span>
      ${e.fb ? `<span class="sd-warn">${CFG.queue === "solo" ? "솔랭" : "자랭"} 티어가 없어 ${Q_KO[e.q]}으로 대신 반영</span>` : ""}</div>`;
  }
  function edInlineHtml(t) {
    return ROLES.map((r) => { const p = t.players[r], alts = (p.alts || altsOf(t.id, r)) || [];
      return `<div class="sd-role ed-role" data-r="${r}"><b class="sd-r">${ROLE_KO[r]}</b>
        <div class="sd-acc"><label class="sd-fl sd-main"><small>본계정</small><input class="input ed-acc" data-f="riot" data-role="${r}" value="${esc(p.riot)}" placeholder="이름#태그" aria-label="${ROLE_KO[r]} 라이엇 ID"></label>${rkView(t, r, p.riot, "m")}
          <div class="ed-sug" id="edsug-${r}" role="listbox" aria-label="${ROLE_KO[r]} 계정 추천" hidden></div>
          <p class="ed-chk" id="edchk-${r}" aria-live="polite" data-k="${t.id}|${r}|riot">${CHK[`${t.id}|${r}|riot`] || ""}</p>
          ${[0, 1].filter((k) => alts[k] || ((S.ui.altOpen || {})[t.id + "|" + r] || 0) > k).map((k) => `<div class="sd-altw"><label class="sd-fl"><small>부계정 ${k + 1}</small><input class="input ed-acc ed-alt" data-alt="${k}" data-role="${r}" value="${esc(alts[k] || "")}" placeholder="이름#태그" aria-label="${ROLE_KO[r]} 부계정 ${k + 1}"></label><button type="button" class="sd-altdel" data-act="altdel" data-team="${t.id}" data-role="${r}" data-k="${k}" aria-label="부계정 ${k + 1} 지우기" title="부계정 지우기"><svg class="ico-x" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>${rkView(t, r, alts[k] || "", k)}`).join("")}
          ${alts.filter(Boolean).length < 2 && ((S.ui.altOpen || {})[t.id + "|" + r] || 0) < 2 ? `<button class="sd-altadd" data-act="altadd" data-role="${r}" data-team="${t.id}" data-n="${Math.max(alts.filter(Boolean).length, (S.ui.altOpen || {})[t.id + "|" + r] || 0) + 1}">${lbi("plus", 14)}부계정 <small>(라인당 3개까지)</small></button>` : ""}
          <div id="edeff-${r}">${effLine(t, r)}</div></div>
        <div class="sd-pool"><div class="row-chips">${poolChips(t, r, { edit: true })}</div>
          <div class="ed-row sd-add"><label class="sd-fl"><small>챔프 추가</small><input class="input" list="champList" data-add="${r}" placeholder="이름 입력 후 Enter" aria-label="${ROLE_KO[r]} 챔프 추가"></label>
          <label class="sd-fl"><small>숙련도</small><select class="input" data-addlv="${r}" aria-label="숙련도"><option value="3">상</option><option value="2" selected>중</option><option value="1">하</option><option value="one">원챔</option></select></label>
          <span class="sd-fl"><small aria-hidden="true">&nbsp;</small><button class="ib btn sm sd-addb" data-act="add" data-role="${r}" aria-label="추가" title="추가">${ico("plus")}</button></span></div></div></div>`; }).join("");
  }
  // 우리 팀 화면(사용자 지적 11-19): 들어가면 보기 화면, 「수정」을 눌러야 편집 칸, 「저장」·「취소」로 끝냄. 우리·상대 알약·공유 버튼·티어 받기 버튼 없음
  const TE = { on: false, snap: null };
  function teamViewPC(t) {
    return `<div class="tv">${ROLES.map((r) => { const p = t.players[r] || {}, accs = accountsOf(t, r), e = accs.length ? effTier(t, r) : null;
      return `<div class="tv-r"><b class="tv-l">${ROLE_KO[r]}</b>
        <span class="tv-who">${p.riot ? `<a class="tv-n" href="${opgg(p.riot)}" target="_blank" rel="noopener">${esc(nick(p.riot))}<small>#${esc(String(p.riot).split("#")[1] || "")}</small></a>` : `<span class="dim">계정 없음</span>`}
          ${accs.length > 1 ? `<small class="tv-alt">부계정 ${accs.length - 1}</small>` : ""}
          ${e ? `<span class="tv-t">${e.none ? `${tierImg("")}언랭` : `${tierImg(parseTier(e.tier).t)}${esc(e.tier)}`}</span>` : ""}</span>
        <span class="row-chips tv-pool">${poolChips(t, r, { max: 8 })}</span></div>`; }).join("")}</div>`;
  }
  function renderTeamPC() {
    const ours = team(S.ourTeam), t = ours && !ours.solo ? ours : null;
    S.ui.setTeam = "our";   // 상대 챔프폭은 상대 화면 「상대 챔프폭 편집」에서
    const edit = TE.on && !!t;
    if (!edit) editing = editing && document.getElementById("modal") && document.getElementById("modal").innerHTML ? editing : null;
    const fails = TQ.fails.length && !TQ.busy ? `<details class="tq-fails"><summary>티어를 못 받은 계정 ${TQ.fails.length}개</summary><ul>${TQ.fails.map((f) => `<li><b>${esc(f.team)}</b> ${ROLE_KO[f.r]} · ${esc(f.a)} <span class="dim">${esc(f.why)}</span></li>`).join("")}</ul></details>` : "";
    const bar = edit
      ? `<span class="dim sd-help">챔프 알약을 누르면 숙련도가 바뀝니다</span><span class="n-sp"></span><button class="soft-b" data-act="tcancel">취소</button><button class="n-new" data-act="tsave">저장</button>`
      : `<span class="n-sp"></span><button class="soft-b" data-act="export">엑셀 내보내기</button><button class="soft-b" data-act="import">명단 등록</button>${t ? `<button class="n-new" data-act="tedit">${lbi("settings", 16)}수정</button>` : ""}`;
    const left = `<section class="sd-main-c"><div class="n-bar sd-bar"><h3 class="h-h">선수·챔프폭</h3>${bar}</div>
      ${TQ.busy ? `<p class="help" role="status">Riot에서 티어 받는 중 ${TQ.done} / ${TQ.all}</p>` : ""}${fails}
      ${!t ? `<p class="help">우리 팀이 없습니다 — 오른쪽에서 팀을 만들거나 초대 코드로 들어오세요.</p>` : edit ? `<div id="setEd" class="sd-ed" data-team=""></div>` : teamViewPC(t)}</section>`;
    const inv = (SESS || !SPACE) ? loginBody() : SPACE && !SPACE.bad ? `<span class="sd-team">${crestOf(ours && !ours.solo ? ours : { name: SPACE.name || "팀" }, "b")}<b>${esc(SPACE.name || "팀 공간")}</b>${SPACE.owner ? `<small>팀장 인증 ${esc(SPACE.owner)}</small>` : ""}</span>
        <span class="sd-link" title="초대 링크(열쇠는 가림)">${esc(location.origin + location.pathname)}#join=${esc(SPACE.id)}.●●●●●●●●</span>
        <button class="n-new" data-act="tcopy">${lbi("invite", 18)}초대 링크 복사</button>
        ${TM.msg ? `<p class="help" role="status">${esc(TM.msg)}</p>` : ""}
        <p class="help">링크를 연 브라우저가 우리 팀에 들어옵니다 · 상대가 명단을 알아도 링크 없이는 못 봄</p>
        <span class="sd-btns"><button class="soft-b" data-act="trotate">${lbi("refresh", 16)}링크 새로 만들기</button><button class="soft-b bad" data-act="tleave">이 브라우저 열쇠 지우기</button></span>`
      : `<div class="sd-tb">${teamBody()}</div>`;
    const right = `<aside class="sd-side"><section class="sd-card"><h3>우리 팀·초대</h3>${inv}</section></aside>`;
    return `<div class="home settings-pc">${collectBanner() ? `<div class="cs-wrap">${collectBanner()}</div>` : ""}${left}${right}</div>`;
  }
  // 설정(PC): 분석 기준 · 이 브라우저 · 계정
  function renderSettingsPC() {
    const acct = SESS ? `<p class="lg-who">${esc((AUTH.user && AUTH.user.nick) || "로그인됨")} · ${PROVIDER_KO[AUTH.user && AUTH.user.provider] || ""}</p>
        <span class="sd-btns"><button class="soft-b" data-act="lgout">로그아웃</button><button class="nc-a del" data-act="lgdel">탈퇴</button></span>
        <p class="help">탈퇴하면 로그인 정보와 소속이 지워지고, 혼자 있는 팀은 팀 자료까지 지워집니다</p>`
      : `<p class="help">로그인하지 않았습니다</p><span class="sd-btns"><button class="tab n-new" data-tab="our">로그인</button></span>`;
    const right = `<div class="set-cards">
      <section class="sd-card"><h3>분석 기준</h3><b class="sd-sub">티어 기준</b>
        <div class="seg" role="group" aria-label="티어 기준">${Object.entries(QUEUE_TXT).map(([k, [n]]) => `<button data-act="setq" data-v="${k}" aria-pressed="${CFG.queue === k}">${n}</button>`).join("")}</div>
        ${CFG.qMsg ? `<p class="help" role="status">${esc(CFG.qMsg)}</p>` : ""}
        <b class="sd-sub">대회 준비 시작일</b>${prepHtml(window.RECENT)}<p class="help">이 날짜부터 한 판을 연습으로 셈</p></section>
      <section class="sd-card"><h3>이 브라우저</h3><p class="help">밴픽 진행·저장한 밴픽·팀 공간 열쇠·화면 상태는 이 브라우저에만 있습니다. 다른 기기는 초대 링크로 들어오면 팀 자료를 같이 봅니다.</p>
        <span class="sd-btns"><button class="soft-b" data-act="wipe">처음 상태로</button><small class="dim">팀 공간 열쇠와 팀 공유 자료는 그대로</small></span></section>
      <section class="sd-card"><h3>계정</h3>${acct}</section></div>`;
    return `<div class="home settings-only">${right}</div>`;
  }
  function addChamp(r) {
    const inp = document.querySelector(`[data-add="${r}"]`);
    const c = findChamp(inp.value);
    if (!c) { inp.setCustomValidity("챔피언을 찾을 수 없습니다"); inp.reportValidity(); return; }
    inp.setCustomValidity("");
    const lvv = document.querySelector(`[data-addlv="${r}"]`).value;
    const p = team(editing).players[r];
    p.pool = (p.pool || []).filter((x) => x[0] !== c.id);
    p.pool.push(lvv === "one" ? [c.id, 3, true] : [c.id, Number(lvv)]);
    save(); shareChanged(editing, r); renderEditor(); render();
    const again = document.querySelector(`[data-add="${r}"]`); if (again) again.focus();
  }

  // 부계정(js/teams.js players[라인].alts): 기록 수집이 그 라인으로 한 판만 본계정 기록에 합친다
  const altsOf = (tid, r) => {
    const tt = S.teams.find((x) => x.id === tid), mine = tt && tt.players[r] && tt.players[r].alts;   // 엑셀·편집 창에서 넣은 값(본계정 포함 라인당 3개)
    if (Array.isArray(mine)) return mine.filter(Boolean).slice(0, 2);
    const t = window.SEED_TEAMS.find((x) => x.id === tid); return (t && t.players[r] && t.players[r].alts) || [];
  };

  // ---------- data menu ----------
  // ---------- 설정 페이지(11-19 정식 배포: 흩어진 설정을 한 곳에) ----------
  // 왼쪽 목차 + 오른쪽 한 칸(상대팀 분석과 같은 틀). 휴대폰은 목차가 위 칩 줄.
  const CFG = { queue: "both", qMsg: "" };   // 티어 분석 기준(팀 공간마다 서버 /config, 공간이 없으면 이 브라우저)
  const QUEUE_TXT = { both: ["솔랭+자랭", "솔로랭크·자유랭크 중 높은 티어, 두 큐 랭크 전적을 모두"], solo: ["솔랭만", "솔로랭크 티어와 솔로랭크 전적만"], flex: ["자랭만", "자유랭크 티어와 자유랭크 전적만"] };
  const SET_SECS = [["space", "우리 팀·초대"], ["basis", "분석 기준"], ["teams", "선수·챔프폭"], ["browser", "이 브라우저"]];
  // ---------- 핵심 흐름(11-19): 팀 만들기 → 팀원 초대 링크 → 상대 팀 등록 이 한눈에 ----------
  // 라이엇 로그인(RSO)은 Riot 승인 뒤 1단계에 들어간다. 지금 1단계는 「팀 만들기(라이엇 계정 본인 확인)」.
  const spaceTeamId = () => (SPACE && !SPACE.bad ? SPACE.id : null);
  function flowSteps() {
    const ourId = spaceTeamId();
    const hasOpp = S.teams.some((t) => !t.solo && t.id !== (ourId || S.ourTeam));
    // 처음 쓴 팀(팀 공간 subin)은 시작 절차를 모두 끝낸 것으로 본다(사용자 지시 11-19) — 팀원마다 안내 없이 바로
    const legacy = ourId === "subin";
    return [
      { k: "team", n: "팀 만들기", d: "팀 이름 + 본인 라이엇 계정 확인", done: !!ourId, act: `data-act="team"`, cta: "팀 만들기" },
      { k: "invite", n: "팀원 초대", d: "초대 링크를 팀 단톡방에 공유", done: legacy || (!!ourId && !!S.ui.invited), act: `data-act="invite"`, cta: "초대 링크 복사" },
      { k: "opp", n: "상대 팀 등록", d: "엑셀로 상대 팀 명단·챔프폭 넣기", done: legacy || hasOpp, act: `data-act="import"`, cta: "상대 팀 등록" },
    ];
  }
  // 우리팀 전략 맨 위 시작 카드: 다 끝났거나 닫으면 안 보임
  function flowCard(mob) {
    const st = flowSteps();
    if (S.ui.flowHide || st.every((x) => x.done)) return "";
    const cur = st.find((x) => !x.done);
    const steps = st.map((x, i) => `<li class="fl-s ${x.done ? "done" : x === cur ? "cur" : ""}"><span class="fl-n">${x.done ? "✓" : i + 1}</span><span class="fl-t"><b>${x.n}</b>${mob ? "" : `<small>${x.d}</small>`}</span></li>`).join("");
    return `<section class="flow ${mob ? "m" : ""}" aria-label="시작하기"><ol class="fl-steps">${steps}</ol>
      <div class="fl-act"><button class="btn sm primary" ${cur.act}>${cur.cta}</button>${mob ? "" : `<button class="btn sm ghost ib" data-act="flowhide" aria-label="시작하기 닫기" title="닫기">${ico("x")}</button>`}</div></section>`;
  }
  // 위 막대: 팀이 없으면 「팀 만들기」, 있으면 「팀원 초대」(누르면 링크 복사)
  function topCta() {
    if (!SPACE) return `<button class="btn sm primary" data-act="team">팀 만들기</button>`;
    if (SPACE.bad) return `<button class="btn sm warnb" data-act="team">초대 링크 다시 받기</button>`;
    return `<button class="btn sm" data-act="invite" title="초대 링크를 복사해 팀원에게 보내기">${ico("users")}<span>팀원 초대</span></button>`;
  }
  let toastT = null;
  function toast(msg) {
    let el = document.getElementById("toast");
    if (!el) { el = document.body.appendChild(Object.assign(document.createElement("div"), { id: "toast", className: "toast" })); el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); }
    el.textContent = msg; el.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("on"), 2600);
  }
  // ---- 로그인 ----
  const PROVIDER_KO = { google: "구글", naver: "네이버", kakao: "카카오" };
  async function loadProviders() {
    if (!WURL() || AUTH.providers) return;
    try { const d = await (await fetch(`${WURL()}/auth/providers`, { cache: "no-store", credentials: "omit" })).json(); AUTH.providers = d.status === "ok" ? d.providers : []; } catch (e) { AUTH.providers = []; }
    if (guest() || S.tab === "settings" || S.tab === "team" || S.tab === "our") render();
  }
  function startLogin(p) { location.href = `${WURL()}/auth/${p}/start?ret=${encodeURIComponent(location.origin + location.pathname)}`; }
  async function loadMe() {
    if (!SESS || !WURL()) return;
    try {
      const res = await fetch(`${WURL()}/auth/me`, { cache: "no-store", credentials: "omit", headers: { "X-Session": SESS } });
      const d = await res.json().catch(() => ({}));
      if (res.status === 401) { logoutLocal("로그인이 끝났습니다 — 다시 로그인해 주세요"); return; }
      if (!res.ok || d.status !== "ok") return;
      AUTH.user = d.user; AUTH.spaces = d.spaces || [];
      try { localStorage.setItem(KEY_AUTH, JSON.stringify({ user: AUTH.user, spaces: AUTH.spaces })); } catch (e) { /* 이번만 */ }
      const before = SPACE && SPACE.id, ls = loginSpace();
      if (ls) { SPACE = ls; if (before !== ls.id) { spaceJoined(); return; } }
      else if (SPACE && SPACE.viaLogin) SPACE = null;
      render();
    } catch (e) { /* 다음에 */ }
  }
  function logoutLocal(msg) {
    SESS = ""; AUTH.user = null; AUTH.spaces = []; AUTH.msg = msg || "";
    try { localStorage.removeItem(KEY_SESS); localStorage.removeItem(KEY_AUTH); } catch (e) { /* 무시 */ }
    if (SPACE && SPACE.viaLogin) { SPACE = null; SH.url = ""; NT.list = null; }
    render();
  }
  async function authPost(op, body) {
    const res = await fetch(`${WURL()}/auth/${op}`, { method: "POST", cache: "no-store", credentials: "omit", headers: { "Content-Type": "application/json", "X-Session": SESS }, body: JSON.stringify(body || {}) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d.status !== "ok") throw new Error(d.reason || "HTTP " + res.status);
    return d;
  }
  async function authAction(a, el) {
    // 다시 그리기 전에 입력값부터 읽음(그리면 칸이 새로 만들어져 비어 버림)
    const vals = { lgTeam: ((document.getElementById("lgTeam") || {}).value || "").trim(), lgCode: ((document.getElementById("lgCode") || {}).value || "").trim() };
    const v = (id) => vals[id] || "";
    AUTH.busy = true; AUTH.msg = ""; render();
    try {
      if (a === "lgnew") { const d = await authPost("team/create", { name: v("lgTeam") }); try { localStorage.setItem("lolban.space.v1", d.space.id); } catch (e) { /* 이번만 */ } AUTH.msg = `「${d.space.name}」 팀을 만들었습니다 — 초대 코드를 만들어 팀원에게 보내세요`; }
      else if (a === "lgjoin") { const d = await authPost("team/join", { code: v("lgCode") }); try { localStorage.setItem("lolban.space.v1", d.space.id); } catch (e) { /* 이번만 */ } AUTH.msg = `「${d.space.name}」 팀에 들어왔습니다`; }
      else if (a === "lgcode") { const d = await authPost("team/code", { space: SPACE.id }); AUTH.msg = `새 초대 코드 ${d.code} — ${d.exp}까지`; }
      else if (a === "lgleave") { if (!confirm(`「${SPACE.name}」 팀에서 나갈까요?`)) { AUTH.busy = false; render(); return; } await authPost("team/leave", { space: SPACE.id }); try { localStorage.removeItem("lolban.space.v1"); } catch (e) { /* 무시 */ } SPACE = null; AUTH.msg = "팀에서 나왔습니다"; }
      else if (a === "lgdel") { if (!confirm("탈퇴할까요? 로그인 정보와 소속이 지워지고, 혼자 있는 팀은 팀 자료까지 지워집니다. 되돌릴 수 없습니다.")) { AUTH.busy = false; render(); return; } await authPost("delete", {}); AUTH.busy = false; logoutLocal("탈퇴했습니다 — 로그인 정보를 지웠습니다"); return; }
      else if (a === "lgout") { try { await authPost("logout", {}); } catch (e) { /* 서버에서 이미 끝남 */ } AUTH.busy = false; logoutLocal("로그아웃했습니다"); return; }
      else if (a === "lgcopy") { const c = SPACE && SPACE.code; if (c) { try { await navigator.clipboard.writeText(`lolban.com 팀 초대 코드: ${c}`); AUTH.msg = "초대 코드를 복사했습니다 — 팀 단톡방에 붙여 넣으세요"; S.ui.invited = true; save(); } catch (e) { AUTH.msg = `초대 코드: ${c}`; } } }
      AUTH.busy = false; await loadMe();
    } catch (e) { AUTH.busy = false; AUTH.msg = e.message || String(e); render(); }
  }
  // 로그인 · 팀 만들기/들어가기 · 초대 코드 칸(새 사용자 홈·설정이 같이 씀)
  function loginBody() {
    const msg = AUTH.msg || (LOGIN_ERR ? { cancel: "로그인을 취소했습니다", state: "로그인 시간이 지났습니다 — 다시 눌러 주세요", provider: "로그인 공급자 응답에 문제가 있었습니다 — 잠시 뒤 다시", not_ready: "그 로그인은 아직 준비 중입니다" }[LOGIN_ERR] || "로그인하지 못했습니다" : "");
    const note = msg ? `<p class="help lg-msg" role="status">${esc(msg)}</p>` : "";
    if (!SESS) {
      const pv = AUTH.providers;
      const btns = pv == null ? `<p class="help">불러오는 중…</p>` : pv.length ? pv.map((x) => `<button class="lg-b ${x}" data-act="lglogin" data-k="${x}">${PROVIDER_KO[x] || x}로 로그인</button>`).join("") : `<p class="help">로그인 준비 중입니다 — 곧 열립니다</p>`;
      return `<div class="lg">${btns}${note}<p class="help lg-foot">받는 정보: 로그인한 서비스의 회원 번호(바꿔서 저장)와 닉네임 · 이메일·전화번호는 받지 않음</p></div>`;
    }
    const who = AUTH.user ? `${esc(AUTH.user.nick || "로그인됨")} · ${PROVIDER_KO[AUTH.user.provider] || ""}` : "로그인됨";
    if (!SPACE || !SPACE.viaLogin) {
      return `<div class="lg"><p class="lg-who">${who}<button class="nc-a del" data-act="lgout">로그아웃</button></p>
        <div class="lg-two"><section><b>팀 만들기</b><span class="help">내가 팀장 · 초대 코드로 팀원을 부름</span><input class="input" id="lgTeam" maxlength="30" placeholder="팀 이름"><button class="n-new" data-act="lgnew" ${AUTH.busy ? "disabled" : ""}>팀 만들기</button></section>
        <section><b>초대 코드로 들어가기</b><span class="help">팀장에게 받은 6자리</span><input class="input lg-code" id="lgCode" maxlength="8" placeholder="예: K7P2QX" autocomplete="off"><button class="soft-b" data-act="lgjoin" ${AUTH.busy ? "disabled" : ""}>들어가기</button></section></div>${note}</div>`;
    }
    const others = AUTH.spaces.filter((x) => x.id !== SPACE.id);
    return `<div class="lg"><p class="lg-who">${who}<button class="nc-a del" data-act="lgout">로그아웃</button></p>
      <p class="lg-team"><b>${esc(SPACE.name)}</b><span class="help">${SPACE.isOwner ? "팀장" : "팀원"} · ${SPACE.members || 1}명</span></p>
      ${SPACE.isOwner ? (SPACE.code ? `<div class="lg-code-box"><span class="help">팀원 초대 코드 · ${esc(SPACE.codeExp)}까지</span><b>${esc(SPACE.code)}</b><span class="sd-btns"><button class="n-new" data-act="lgcopy">코드 복사</button><button class="soft-b" data-act="lgcode">새로 만들기</button></span><span class="help">새로 만들면 옛 코드는 바로 막힙니다</span></div>`
        : `<button class="n-new" data-act="lgcode">초대 코드 만들기</button>`) : `<p class="help">팀원 초대 코드는 팀장이 만듭니다</p>`}
      ${others.length ? `<p class="help">다른 팀: ${others.map((x) => `<button class="nc-a" data-act="lgswitch" data-id="${x.id}">${esc(x.name)}</button>`).join(" · ")}</p>` : ""}
      <span class="sd-btns"><button class="soft-b bad" data-act="lgleave">팀 나가기</button><button class="nc-a del" data-act="lgdel">탈퇴</button></span>${note}</div>`;
  }
  async function copyInvite() {
    if (SPACE && SPACE.viaLogin) { if (SPACE.code) return authAction("lgcopy"); openSettings("space"); return; }
    if (!SPACE || SPACE.bad) { openSettings("space"); return; }
    try { await navigator.clipboard.writeText(inviteLink()); S.ui.invited = true; save(); render(); toast("초대 링크를 복사했습니다 — 팀 단톡방에 붙여 넣으세요"); }
    catch (e) { openSettings("space"); toast("링크를 길게 눌러 복사하세요"); }
  }
  // 팀 공간에 들어오면 그 팀을 우리팀으로(처음 쓴 팀 subin은 예전 명단 그대로)
  function ensureSpaceTeam(pick) {
    if (!SPACE || SPACE.bad) return;
    if (!S.teams.some((t) => t.id === SPACE.id)) S.teams.unshift(blankTeam(SPACE.id, SPACE.name || "우리 팀"));
    const t = S.teams.find((x) => x.id === SPACE.id);
    if (SPACE.name && t.name !== SPACE.name && SPACE.id !== "subin") t.name = SPACE.name;
    if (S.ourTeam !== SPACE.id && S.ourTeam !== SOLO.our) pick = true;   // 우리팀 목록은 팀 공간 팀(+솔랭·자랭)만
    if (pick) { S.ourTeam = SPACE.id; E.setOurTeam(S.ourTeam); if (S.enemyTeam === S.ourTeam) S.enemyTeam = (S.teams.find((x) => !x.solo && x.id !== S.ourTeam) || { id: SOLO.enemy }).id; }
    save();
  }

  // 「팀 설정」 메뉴(11-19): 설정이 필요한 버튼(자기평가·상대 챔프폭·준비일·엑셀)을 한 곳에. 화면마다 같은 메뉴
  const TSM = { open: "" };
  function teamSetMenu(where, mob) {
    const ourT = team(S.ourTeam), en = team(S.enemyTeam), id = where + (mob ? "m" : "");
    if (where === "enemy") return en && !en.solo && !guest() ? `<button class="btn sm primary tsm-b ${mob ? "mv-hb" : ""}" data-act="edit" data-team="${en.id}">${ico("gear")}<span>상대 챔프폭 편집</span></button>` : "";
    const it = (attrs, label, sub) => `<button class="tsm-i" role="menuitem" ${attrs}><b>${label}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
    const items = [
      ourT && !ourT.solo ? it(`data-act="edit" data-team="${ourT.id}"`, "우리팀 자기평가 입력", ourT.name) : "",
      en && !en.solo ? it(`data-act="edit" data-team="${en.id}"`, "상대 챔프폭 편집", en.name) : "",
      it(`data-act="settings" data-k="basis"`, "분석 기준·대회 준비일", `티어 기준 ${QUEUE_TXT[CFG.queue][0]}`),
      it(`data-act="export"`, "엑셀 내보내기", "팀·챔프폭 한 시트"),
      it(`data-act="import"`, "엑셀 불러오기", "작성법·미리보기 뒤 적용"),
      it(`data-act="settings" data-k="teams"`, "설정 전체", ""),
    ].join("");
    const open = TSM.open === id;
    return `<span class="tsm ${mob ? "mv-hb" : ""}"><button class="btn sm primary tsm-b" data-act="tsm" data-k="${id}" aria-haspopup="menu" aria-expanded="${open}">${ico("gear")}<span>팀 설정</span></button>
      ${open ? `<div class="tsm-pop" role="menu" aria-label="팀 설정">${items}</div>` : ""}</span>`;
  }
  function openSettings(sec) {
    if (S.tab !== "settings") S.ui.setFrom = S.tab;
    S.tab = "settings"; if (sec) S.ui.setSec = sec; MV.more = false; save(); render(); window.scrollTo(0, 0);
  }
  async function saveQueue(q) {
    if (!QUEUE_TXT[q]) return;
    if (!SPACE) { S.ui.queue = q; CFG.queue = q; CFG.qMsg = "이 브라우저에 저장했습니다(팀 공간에 들어오면 팀 전체 기준을 씁니다)."; save(); render(); return; }
    CFG.qMsg = "저장 중…"; render();
    try {
      const res = await wfetch(`/config`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ queue: q }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.status !== "ok") throw new Error(d.reason || "HTTP " + res.status);
      CFG.queue = d.queue; CFG.qMsg = `팀 전체 기준을 「${QUEUE_TXT[d.queue][0]}」으로 바꿨습니다.`;
    } catch (e) { CFG.qMsg = "저장 실패: " + (e.message || e); }
    render();
  }
  function renderSettings() {
    const key = SET_SECS.some(([k]) => k === S.ui.setSec) ? S.ui.setSec : "space";
    const ourT = team(S.ourTeam);
    const enemies = S.teams.filter((t) => !t.solo && t.id !== S.ourTeam);
    const sec = {
      space: () => `<h3>${SPACE && !SPACE.bad ? "우리 팀·팀원 초대" : "로그인 · 팀"}</h3>${SESS || !SPACE ? loginBody() : teamBody()}`,
      basis: () => `<h3>분석 기준</h3>
        <div class="set-row"><div class="set-l"><b>티어 기준</b><span class="help">선수 티어·점수 채우기와 랭크 전적(시즌·연습 기간 판수·승률)에 쓰는 큐</span></div>
          <div class="seg set-seg" role="group" aria-label="티어 기준">${Object.entries(QUEUE_TXT).map(([k, [n]]) => `<button data-act="setq" data-v="${k}" aria-pressed="${CFG.queue === k}">${n}</button>`).join("")}</div></div>
        <p class="help">${esc(QUEUE_TXT[CFG.queue][1])}을(를) 봅니다.${SPACE && !SPACE.bad ? " 팀 공간 전체에 적용됩니다." : " 지금은 이 브라우저에만 적용됩니다."}</p>
        ${CFG.qMsg ? `<p class="help" role="status">${esc(CFG.qMsg)}</p>` : ""}
        <div class="set-row"><div class="set-l"><b>대회 준비 시작일</b><span class="help">이 날짜부터 한 판을 「연습」으로 셉니다(상대 연습 픽·함께 한 경기)</span></div></div>
        ${prepHtml(window.RECENT)}`,
      teams: () => `<h3>선수·챔프폭</h3>
        <div class="set-row"><div class="set-l"><b>우리팀 · ${esc(ourT ? ourT.name : "-")}</b><span class="help">선수 계정(라인당 3개)·티어·자기평가 챔프폭</span></div>${ourT && !ourT.solo ? `<button class="btn sm primary" data-act="edit" data-team="${ourT.id}">자기평가 입력</button>` : ""}</div>
        <div class="set-row"><div class="set-l"><b>상대 팀</b><span class="help">상대 선수 계정·챔프폭 메모(우리 팀 공간 안에서만 공유)</span></div>
          <span class="set-inline"><select id="setEnemy" aria-label="편집할 상대 팀">${enemies.map((t) => `<option value="${t.id}" ${t.id === S.enemyTeam ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select><button class="btn sm" data-act="setedit">챔프폭 편집</button></span></div>
        <div class="set-row"><div class="set-l"><b>엑셀로 한 번에</b><span class="help">팀 ${S.teams.filter((t) => !t.solo).length}개 · 팀마다 섹션 한 시트</span></div>
          <span class="set-inline"><button class="btn sm" data-act="export">엑셀 내보내기</button><button class="btn sm" data-act="import">엑셀 불러오기</button></span></div>`,
      browser: () => `<h3>이 브라우저</h3>
        <div class="set-row"><div class="set-l"><b>저장한 것</b><span class="help">밴픽 진행·저장한 밴픽·팀 공간 열쇠·화면 상태는 이 브라우저에만 있습니다. 다른 기기는 초대 링크로 팀 공간에 들어오면 팀 자료를 같이 봅니다.</span></div></div>
        <div class="set-row"><div class="set-l"><b>처음 상태로</b><span class="help">팀·챔프폭 입력·밴픽·피어리스를 처음 상태로 되돌립니다(팀 공간 열쇠와 팀 공유 자료는 그대로).</span></div><button class="btn sm ghost" data-act="wipe">처음 상태로</button></div>`,
    }[key]();
    return `<div class="section-title"><h2>설정</h2><p>${SPACE && !SPACE.bad ? `팀 공간 · ${esc(SPACE.name || "")}` : "팀 공간 없음 — 이 브라우저에만 저장"}</p><button class="ib btn sm" data-act="setback" aria-label="돌아가기" title="돌아가기">${ico("back")}</button></div>
      <div class="ensec set"><nav class="ensec-nav" role="tablist" aria-label="설정 목차">${SET_SECS.map(([k, n]) => `<button role="tab" data-act="setsec" data-k="${k}" aria-selected="${k === key}">${n}</button>`).join("")}</nav>
      <div class="ensec-body"><section class="card set-card">${sec}</section></div></div>`;
  }

  // ---------- 팀·챔프폭 엑셀 내보내기 · 불러오기 페이지(사용자 요청 11-19) ----------
  // 엑셀 라이브러리(SheetJS 0.20.3, js/vendor)는 내보내기·불러오기 때만 읽는다(평소 화면 속도 그대로).
  // 읽기는 반드시 0.20.3(옛 판의 파일 읽기 보안 문제 피함): 이름(window.XLSX)이 아니라 판 번호로 확인하고 따로 보관
  let XL = null;
  const isReader = (X) => !!X && X.version === "0.20.3" && !X.style_version;
  function loadXLSX() {
    if (XL) return XL;
    XL = new Promise((ok, no) => {
      const s = document.createElement("script");
      s.src = "js/vendor/xlsx-0.20.3.mini.min.js"; s.onload = () => { const X = window.XLSX; isReader(X) ? ok(X) : (XL = null, no(new Error("엑셀 도구를 읽지 못했습니다"))); };
      s.onerror = () => { XL = null; no(new Error("엑셀 도구를 읽지 못했습니다 — 인터넷 연결을 확인해 주세요")); };
      document.head.appendChild(s);
    });
    return XL;
  }
  // 내보내기 전용: 칸 색·선을 저장하는 xlsx-js-style 1.2.0(Apache-2.0). 옛 SheetJS 0.18.5 바탕이라 파일 읽기에는 쓰지 않는다(불러오기는 위 0.20.3).
  // 같은 이름(window.XLSX)을 쓰므로 읽은 뒤 따로 보관하고 원래 값으로 돌려 둔다.
  let XW = null;
  function loadXLSXStyle() {
    if (XW) return XW;
    XW = new Promise((ok, no) => {
      const prev = window.XLSX;
      const s = document.createElement("script");
      s.src = "js/vendor/xlsx-js-style-1.2.0.min.js";
      s.onload = () => { const X = window.XLSX; window.XLSX = prev;   // 스크립트의 var XLSX는 지울 수 없어 이전 값(없으면 undefined)으로 덮는다
        X && X.style_version ? ok(X) : (XW = null, no(new Error("엑셀 도구를 읽지 못했습니다"))); };
      s.onerror = () => { XW = null; no(new Error("엑셀 도구를 읽지 못했습니다 — 인터넷 연결을 확인해 주세요")); };
      document.head.appendChild(s);
    });
    return XW;
  }
  const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  function styledSheet(X, rows) {
    const L = window.TeamSheet.sheetLayout(rows), ws = X.utils.aoa_to_sheet(rows);
    Object.entries(L.cells).forEach(([rc, st]) => {
      const [r, c] = rc.split(",").map(Number), a = X.utils.encode_cell({ r, c });
      if (!ws[a]) ws[a] = { t: "s", v: "" };
      ws[a].s = st;
    });
    const rng = X.utils.decode_range(ws["!ref"]); rng.e.c = Math.max(rng.e.c, window.TeamSheet.HEAD.length - 1); ws["!ref"] = X.utils.encode_range(rng);
    ws["!cols"] = L.cols; ws["!rows"] = L.heights; ws["!merges"] = L.merges;
    return ws;
  }
  async function exportData() {
    try {
      const X = await loadXLSXStyle();
      let list = S.teams.filter((t) => !t.solo), ourId = S.ourTeam;
      if (!list.length) { list = [blankTeam("tpl-our", "우리 팀 이름"), blankTeam("tpl-opp", "상대 팀 이름")]; ourId = "tpl-our"; }
      else if (list.length === 1) list = list.concat([blankTeam("tpl-opp", "상대 팀 이름")]);   // 상대 팀 칸 하나는 예시로
      const rows = window.TeamSheet.toRows(list, ourId, (id) => (CH[id] ? CH[id].ko : id), todayKST());
      const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, styledSheet(X, rows), "팀 챔프폭");
      X.writeFile(wb, `팀챔프폭-${todayKST()}.xlsx`);
    } catch (e) { alert("내보내기 실패: " + (e.message || e)); }
  }
  // 불러오기 페이지 상태: 고른 파일을 읽은 결과와 바뀌는 것
  const IMP = { file: "", parsed: null, diff: null, msg: "", busy: false, from: "our", json: null, text: "", team: "", our: false, src: "", ocr: null, chk: {}, canon: {}, seq: 0, mode: "", done: null };
  // 단계: 등록 끝 → done, 읽은 결과가 있으면 → check, 방법을 골랐으면 → input, 아니면 → how
  const impStep = () => (IMP.done ? "done" : IMP.parsed || IMP.json ? "check" : IMP.mode ? "input" : "how");
  function impReset(mode) { Object.assign(IMP, { file: "", parsed: null, diff: null, json: null, msg: "", busy: false, ocr: null, mode: mode || "", done: null, alts: null, fix: {}, add: {} }); }
  const newTeamId = () => { let id; do { id = "u" + Math.random().toString(36).slice(2, 10); } while (S.teams.some((t) => t.id === id)); return id; };
  // ---- 사진 글자 인식: 브라우저 안 Tesseract.js(한글+영어). 사진은 서버로 보내지 않는다 ----
  let TESS = null;
  function loadTess() {
    if (TESS) return TESS;
    TESS = new Promise((ok, no) => {
      const sc = document.createElement("script");
      sc.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
      sc.integrity = "sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F"; sc.crossOrigin = "anonymous";
      sc.onload = () => (window.Tesseract ? ok(window.Tesseract) : (TESS = null, no(new Error("글자 인식 도구를 읽지 못했습니다"))));
      sc.onerror = () => { TESS = null; no(new Error("글자 인식 도구를 읽지 못했습니다 — 인터넷 연결을 확인해 주세요")); };
      document.head.appendChild(sc);
    });
    return TESS;
  }
  // 캡처 다듬기: 작은 글은 2배로 키우고 흑백, 어두운 화면(게임·디스코드)은 뒤집어 흰 바탕 검은 글로
  async function prepImage(file, pl) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(pl.k, Math.max(1, 3600 / Math.max(bmp.width, 1)));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(bmp, 0, 0, c.width, c.height);
    const im = g.getImageData(0, 0, c.width, c.height), d = im.data;
    let sum = 0; for (let q = 0; q < d.length; q += 4) { const y = 0.299 * d[q] + 0.587 * d[q + 1] + 0.114 * d[q + 2]; d[q] = d[q + 1] = d[q + 2] = y; sum += y; }
    if (sum / (d.length / 4) < 128) for (let q = 0; q < d.length; q += 4) d[q] = d[q + 1] = d[q + 2] = 255 - d[q];
    if (pl.bin) {   // 오츠 문턱으로 흑백 두 색
      const h = new Array(256).fill(0); for (let q = 0; q < d.length; q += 4) h[d[q] | 0]++;
      const n = d.length / 4; let all = 0; for (let t = 0; t < 256; t++) all += t * h[t];
      let sB = 0, wB = 0, best = 0, th = 128;
      for (let t = 0; t < 256; t++) { wB += h[t]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += t * h[t]; const v = wB * wF * (sB / wB - (all - sB) / wF) ** 2; if (v > best) { best = v; th = t; } }
      for (let q = 0; q < d.length; q += 4) d[q] = d[q + 1] = d[q + 2] = d[q] > th ? 255 : 0;
    }
    g.putImageData(im, 0, 0);
    return c;
  }
  function ocrProgress(v) { IMP.ocr = v; const b = document.getElementById("ipBar"); if (b) { b.style.setProperty("--w", Math.round(v * 100) + "%"); const t = document.getElementById("ipBarT"); if (t) t.textContent = `사진 글자 읽는 중 ${Math.round(v * 100)}%`; } }
  async function readImage(file) {
    IMP.fix = {}; IMP.file = file.name || "붙여 넣은 사진"; IMP.src = "image"; IMP.mode = "image"; IMP.done = null; IMP.parsed = null; IMP.diff = null; IMP.json = null; IMP.msg = ""; IMP.busy = true; IMP.ocr = 0; render();
    try {
      if (file.size > 12 * 1024 * 1024) throw new Error("사진이 너무 큽니다(12MB까지)");
      const T = await loadTess();
      // 세 가지로 읽기(11-19 시험: 줄마다 맞게 읽는 방식이 달랐음) — 계정이 가장 많이 잡힌 글을 쓰고, 나머지는 고칠 후보로
      const plans = [{ k: 3, bin: false, psm: "6", lang: ["kor", "eng"] }, { k: 3, bin: true, psm: "6", lang: ["kor"] }, { k: 2.4, bin: false, psm: "3", lang: ["kor", "eng"] }];
      const texts = [];
      for (let i = 0; i < plans.length; i++) {
        const pl = plans[i], canvas = await prepImage(file, pl);
        const w = await T.createWorker(pl.lang, 1, { logger: (m) => { if (m.status === "recognizing text") ocrProgress((i + m.progress) / plans.length); } });
        await w.setParameters({ tessedit_pageseg_mode: pl.psm, preserve_interword_spaces: "1" });
        const { data } = await w.recognize(canvas); await w.terminate();
        texts.push((data.text || "").split("\n").map((x) => x.replace(/\s+$/, "")).filter((x) => x.trim()).join("\n"));
      }
      const cnt = (t) => window.TeamSheet.fromText(t, { ocr: true, team: "x" }).rows.filter((r) => r.length === 7 && r[1] && r[0] !== "라인").length;
      texts.sort((a, b) => cnt(b) - cnt(a));
      const found = cnt(texts[0]);
      // 다른 읽기의 계정 후보(줄 순서 그대로) — Riot에 없는 계정을 고칠 때 씀
      IMP.alts = texts.slice(1).map((t) => Object.fromEntries(window.TeamSheet.fromText(t, { ocr: true, team: "x" }).rows.filter((r) => r.length === 7 && r[1] && r[0] !== "라인").map((r) => [r[0], r[1]])));   // 라인 → 계정
      IMP.add = {};
      IMP.text = texts[0];
      IMP.busy = false; IMP.ocr = null;
      if (!found) { IMP.msg = "사진에서 「이름#태그」 계정을 찾지 못했습니다 — 읽은 글을 텍스트 칸에 넣어 두었으니 고쳐서 「명단으로 바꾸기」를 누르세요"; render(); return; }
      IMP.msg = `사진에서 계정 ${found}개를 읽었습니다 — 틀린 글자는 텍스트 칸에서 고친 뒤 다시 「명단으로 바꾸기」`;
      parseText();
    } catch (e) { IMP.busy = false; IMP.ocr = null; IMP.msg = "사진을 읽지 못했습니다: " + (e.message || e); render(); }
  }
  // 텍스트 → 명단 미리보기
  function parseText() {
    const resolve = (n) => { const c = findChamp(n); return c ? c.id : null; };
    const r = window.TeamSheet.fromText(IMP.text, { resolve, ocr: IMP.src === "image", team: (IMP.team || "").trim(), our: IMP.our });
    if (IMP.src === "image" && IMP.fix) r.rows = r.rows.map((row) => row.length === 7 && row[0] !== "라인" ? row.map((c, k) => (k >= 1 && k <= 3 && IMP.fix[c] ? IMP.fix[c] : c)) : row);
    // 첫 읽기에서 빠진 라인을 다른 읽기에서 찾아 Riot으로 확인한 계정(첫 팀에 넣음)
    if (IMP.src === "image" && IMP.add && Object.keys(IMP.add).length && r.rows.length) {
      const end = r.rows.findIndex((row, k) => k > 1 && row.length === 0), at = end < 0 ? r.rows.length : end;
      const have = new Set(r.rows.slice(0, at).map((row) => row[0]));
      const ORD = ["탑", "정글", "미드", "원딜", "서폿"], add = Object.entries(IMP.add).filter(([ko]) => !have.has(ko)).map(([ko, id]) => [ko, id, "", "", "", "", ""]);
      const body = r.rows.slice(2, at).concat(add).sort((a, b) => ORD.indexOf(a[0]) - ORD.indexOf(b[0]));
      r.rows = r.rows.slice(0, 2).concat(body, r.rows.slice(at));
    }
    if (!r.rows.length) { IMP.parsed = null; IMP.diff = null; IMP.msg = "「이름#태그」 계정을 찾지 못했습니다 — 예시처럼 한 줄에 라인과 계정을 적어 주세요"; render(); return; }
    IMP.parsed = window.TeamSheet.parse(r.rows, resolve);
    markOurImport();
    r.notes.forEach((n) => IMP.parsed.warnings.push({ row: 0, msg: n }));
    if (!IMP.file || IMP.src === "text") IMP.file = "텍스트";
    IMP.diff = window.TeamSheet.diff(S.teams, IMP.parsed, S.ourTeam);
    render(); checkIds();
  }
  // 미리보기 계정이 Riot에 있는지(팀 공간 열쇠 필요, 6시간 캐시, 한도면 1분 쉼)
  async function checkIds() {
    const P = IMP.parsed; if (!P || !SPACE || SPACE.bad) return;
    const seq = ++IMP.seq;
    const ids = [...new Set(P.teams.flatMap((t) => Object.values(t.players).flatMap((x) => [x.riot, ...(x.alts || [])])).filter(Boolean))];
    for (const id of ids) {
      if (IMP.chk[id] === "ok" || IMP.chk[id] === "no") continue;
      IMP.chk[id] = "wait";
      for (let tries = 0; tries < 6; tries++) {
        if (seq !== IMP.seq) return;
        try {
          const res = await wfetch(`/riot/check?id=${encodeURIComponent(id)}`); const d = await res.json().catch(() => ({}));
          if (res.status === 429) { await new Promise((ok) => setTimeout(ok, 61000)); continue; }
          IMP.chk[id] = res.ok && d.status === "ok" ? (d.exists ? "ok" : "no") : "err";
          if (IMP.chk[id] === "ok" && d.riot) IMP.canon[id] = d.riot;
        } catch (e) { IMP.chk[id] = "err"; }
        break;
      }
      if (seq !== IMP.seq) return;
      if (S.tab === "import" && !MOB.matches) { const el = document.getElementById("iwCheck"); if (el) el.outerHTML = impCheckPC(); }
      else { const el = document.getElementById("ipChk"); if (el && S.tab === "import") el.outerHTML = impCheckHtml(IMP.parsed); }
    }
    if (IMP.src === "image" && IMP.alts && seq === IMP.seq) fixFromAlts(seq);
  }
  // 사진 계정 고치기: 본계정 n번째가 Riot에 없으면 다른 읽기의 n번째(앞뒤 한 줄) 후보 중 Riot에 있는 것으로 글을 바꾸고 다시 읽음
  async function fixFromAlts(seq) {
    const P = IMP.parsed; if (!P || !P.teams[0]) return;
    const LK = { T: "탑", J: "정글", M: "미드", A: "원딜", S: "서폿" };
    const nk = (x) => String(x || "").replace(/\s+/g, "").toLowerCase();   // 같은 계정(빈칸·대소문자만 다름)은 한 번만
    const used = new Set(Object.values(P.teams[0].players).map((x) => nk(x.riot)).filter(Boolean));
    let fixed = 0;
    // 읽은 라인을 먼저 고치고, 빠진 라인은 그다음에 채움
    const order = Object.keys(LK).sort((a, b) => !!(P.teams[0].players[b] && P.teams[0].players[b].riot) - !!(P.teams[0].players[a] && P.teams[0].players[a].riot));
    for (const r of order) {
      const pl = P.teams[0].players[r], bad = pl && pl.riot;
      if (bad && IMP.chk[bad] !== "no") continue;   // 맞는 계정은 그대로, 없는 라인·Riot에 없는 계정만
      const cands = [...new Set(IMP.alts.map((a) => a[LK[r]]).filter((x) => x && nk(x) !== nk(bad) && !used.has(nk(x))))];
      for (const c of cands) {
        if (seq !== IMP.seq) return;
        if (IMP.chk[c] == null) { try { const res = await wfetch(`/riot/check?id=${encodeURIComponent(c)}`); const d = await res.json().catch(() => ({})); IMP.chk[c] = res.ok && d.status === "ok" ? (d.exists ? "ok" : "no") : "err"; } catch (e) { IMP.chk[c] = "err"; } }
        if (IMP.chk[c] === "ok") { if (bad) IMP.fix[bad] = c; else IMP.add[LK[r]] = c; used.add(nk(c)); fixed++; break; }
      }
    }
    if (fixed && seq === IMP.seq) { IMP.msg = `사진 계정 ${fixed}개를 다른 읽기 결과로 고쳤습니다(Riot에 있는 계정으로 확인) — 남은 ✕는 텍스트 칸에서 직접 고쳐 주세요`; parseText(); }
  }
  // 「우리 팀은?」: 파일에 우리팀 표시가 없으면 내 팀 이름과 같은 팀을 우리 팀으로(없으면 고르게)
  function markOurImport(name) {
    const P = IMP.parsed; if (!P) return;
    const ourT = team(S.ourTeam), mine = ourT && !ourT.solo ? ourT.name : "";
    if (name != null) P.teams.forEach((t) => (t.our = t.name === name));
    else if (!P.teams.some((t) => t.our) && mine) P.teams.forEach((t) => (t.our = t.name === mine));
  }
  function impOurPick(P) {
    const ourT = team(S.ourTeam); if (!P || !P.teams.length || !ourT || ourT.solo) return "";
    const cur = (P.teams.find((t) => t.our) || {}).name || "";
    return `<label class="ip-our"><b>우리 팀은?</b><select data-act="impour" aria-label="파일에서 우리 팀 고르기"><option value="" ${cur ? "" : "selected"}>없음 — 모두 상대 팀으로</option>${P.teams.map((t) => `<option value="${esc(t.name)}" ${t.name === cur ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select><span class="help">고른 팀의 선수는 「${esc(ourT.name)}」에 들어갑니다</span></label>`;
  }
  function impCheckHtml(P) {
    if (!P) return "";
    const ids = [...new Set(P.teams.flatMap((t) => Object.values(t.players).flatMap((x) => [x.riot, ...(x.alts || [])])).filter(Boolean))];
    if (!ids.length) return "";
    if (!SPACE || SPACE.bad) return `<p class="help" id="ipChk">팀 공간에 들어오면 계정마다 Riot에 있는지 확인합니다</p>`;
    const no = ids.filter((id) => IMP.chk[id] === "no").length, ok = ids.filter((id) => IMP.chk[id] === "ok").length;
    return `<div class="ip-chk" id="ipChk"><b>계정 확인 <small>${ok + no} / ${ids.length}</small></b>${no ? `<span class="sd-warn">Riot에 없는 계정 ${no}개 — 텍스트에서 고치고 다시 바꾸거나, 엑셀이면 고쳐서 다시 올려 주세요</span>` : ""}
      <span class="ip-ids">${ids.map((id) => { const st = IMP.chk[id] || "wait"; return `<span class="ip-id ${st}" title="${st === "ok" ? "Riot에 있음" : st === "no" ? "Riot에 없는 계정" : st === "err" ? "확인 못 함" : "확인 중"}">${st === "ok" ? "✓" : st === "no" ? "✕" : st === "err" ? "?" : "…"} ${esc(id)}</span>`; }).join("")}</span></div>`;
  }
  async function readImport(file) {
    if (/^image\//.test(file.type || "") || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name || "")) return readImage(file);
    IMP.done = null;
    if (/\.txt$/i.test(file.name || "") || file.type === "text/plain") { IMP.src = "text"; IMP.mode = "text"; IMP.file = file.name; IMP.text = (await file.text()).slice(0, 20000); IMP.msg = ""; parseText(); return; }
    IMP.src = "file"; IMP.mode = "excel"; IMP.chk = IMP.chk || {};
    IMP.file = file.name; IMP.parsed = null; IMP.diff = null; IMP.json = null; IMP.msg = ""; IMP.busy = true; render();
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("파일이 너무 큽니다(2MB까지)");
      if (/\.json$/i.test(file.name)) {   // 예전 「내보내기」 파일(.json)도 받는다
        const d = JSON.parse(await file.text());
        if (!Array.isArray(d.teams)) throw new Error("teams 없음");
        IMP.json = d;
      } else {
        const X = await loadXLSX();
        const wb = X.read(await file.arrayBuffer(), { type: "array", cellFormula: false, cellHTML: false, cellStyles: false });
        const name = wb.SheetNames.includes("팀 챔프폭") ? "팀 챔프폭" : wb.SheetNames[0];
        let rows = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: false, blankrows: true });
        // 설문처럼 「팀 이름 | 탑 | 정글 …」 한 줄에 팀 하나인 파일도 우리 양식으로(11-19)
        if (window.TeamSheet.isWide(rows)) { rows = window.TeamSheet.fromWide(rows); IMP.wide = true; } else IMP.wide = false;
        IMP.parsed = window.TeamSheet.parse(rows, (n) => { const c = findChamp(n); return c ? c.id : null; });
        markOurImport();
        IMP.diff = window.TeamSheet.diff(S.teams, IMP.parsed, S.ourTeam);
      }
    } catch (e) { IMP.msg = "읽지 못했습니다: " + (e.message || e); }
    IMP.busy = false; render(); checkIds();
  }
  function applyImport() {
    if (IMP.json) {
      const d = IMP.json;
      S.teams = d.teams; if (d.ourTeam) S.ourTeam = d.ourTeam; E.setOurTeam(S.ourTeam);
      if (!S.teams.find((t) => t.id === S.enemyTeam) || S.enemyTeam === S.ourTeam) S.enemyTeam = (S.teams.find((t) => t.id !== S.ourTeam && !t.solo) || S.teams[0]).id;
      save(); IMP.json = null; IMP.msg = "예전 파일(.json)을 그대로 불러왔습니다."; render(); return;
    }
    const P = IMP.parsed;
    if (!P || P.errors.length) return;
    const ids = impIds(P), no = ids.filter((id) => IMP.chk[id] === "no");
    if (no.length && !confirm(`Riot에 없는 계정 ${no.length}개가 있습니다:\n${no.join("\n")}\n\n이 계정은 기록이 비게 됩니다. 그대로 등록할까요?`)) return;
    P.teams.forEach((t) => Object.values(t.players).forEach((x) => { if (IMP.canon[x.riot]) x.riot = IMP.canon[x.riot]; x.alts = (x.alts || []).map((a) => IMP.canon[a] || a); }));
    const res = window.TeamSheet.apply(S.teams, P, S.ourTeam, newTeamId);
    S.teams = res.teams;
    if (res.ourId !== S.ourTeam) { S.ourTeam = res.ourId; E.setOurTeam(S.ourTeam); }
    if (S.enemyTeam === S.ourTeam || !S.teams.find((t) => t.id === S.enemyTeam)) S.enemyTeam = (S.teams.find((t) => t.id !== S.ourTeam && !t.solo) || S.teams[0]).id;
    save();
    res.touched.forEach(([tid, r]) => shareChanged(tid, r));   // 챔프폭·티어는 팀 공간에 공유
    if (SPACE && !SPACE.bad && res.touched.length) setTimeout(() => fetchTiers(res.touched), 0);   // 본계정·부계정 솔랭·자랭을 Riot에서 자동으로
    const n = P.teams.length, nNew = IMP.diff.filter((x) => x.isNew).length;
    IMP.msg = `적용했습니다 — 팀 ${n}개${nNew ? `(새 팀 ${nNew})` : ""}.${SH.url ? " 챔프폭·티어는 팀 공간에 공유됩니다." : ""}${SPACE && !SPACE.bad ? " 본계정·부계정의 솔랭·자랭 티어를 Riot에서 받는 중입니다." : " 팀 공간에 들어오면 Riot에서 솔랭·자랭 티어를 받을 수 있습니다."}`;
    IMP.done = { n, nNew, names: P.teams.map((t) => (t.our ? `${(team(S.ourTeam) || {}).name || t.name}(우리 팀)` : t.name)), no, ids: ids.length };
    IMP.parsed = null; IMP.diff = null; IMP.file = "";
    render(); window.scrollTo(0, 0);
  }
  const accTxt = (a) => (a.length ? a.map(esc).join(" · ") : "없음");
  const champList = (pool, cls) => pool.map(([id, lv, one]) => `<span class="cp ${cls}">${esc(CH[id] ? CH[id].ko : id)} ${one ? "원챔" : LEVEL_KO[lv]}</span>`).join("");
  function impPreview() {
    let pv = "";
    if (IMP.busy) pv = `<p class="help">읽는 중…</p>`;
    else if (IMP.json) pv = `<div class="card imp-pv"><h3>예전 내보내기 파일(.json)</h3><p class="help">팀 ${IMP.json.teams.length}개 · 지금 팀·챔프폭이 이 파일 내용으로 통째로 바뀝니다.</p>
      <div class="dnav"><button class="btn primary" data-act="impapply">적용</button><button class="btn ghost" data-act="impclear">취소</button></div></div>`;
    else if (IMP.parsed) {
      const P = IMP.parsed, D = IMP.diff;
      const changed = D.filter((x) => x.lanes.length), same = D.length - changed.length;
      const errs = P.errors.length ? `<div class="imp-errs" role="alert"><b>고칠 곳 ${P.errors.length}개</b> — 고친 뒤 다시 올려 주세요<ul>${P.errors.slice(0, 30).map((e) => `<li>${e.row ? `<span class="pill">${e.row}행</span>` : ""}${esc(e.msg)}</li>`).join("")}</ul></div>` : "";
      const warns = P.warnings.length ? `<details class="imp-warn"><summary>확인할 것 ${P.warnings.length}개</summary><ul>${P.warnings.map((w) => `<li><span class="pill">${w.row}행</span>${esc(w.msg)}</li>`).join("")}</ul></details>` : "";
      const lane = (l) => `<li><b>${l.ko}</b>${l.ch.length ? l.ch.map((c) => c.k === "acc" ? `<span class="imp-c">계정 ${accTxt(c.from)} → <b>${accTxt(c.to)}</b></span>`
        : c.k === "tier" ? `<span class="imp-c">티어 ${esc(c.from || "없음")} → <b>${esc(c.to || "없음")}</b></span>` : c.k === "pts" ? `<span class="imp-c">점수 ${c.from == null ? "-" : c.from} → <b>${c.to}</b></span>`
        : `<span class="imp-c">챔프폭 ${c.add.length ? `<span class="cpills">${champList(c.add, "good")}</span>` : ""}${c.del.length ? `<span class="cpills">${champList(c.del, "bad")}</span>` : ""}</span>`).join("") : `<span class="help">새로 넣음</span>`}</li>`;
      const cards = changed.map((x) => `<div class="card imp-team"><h3>${esc(x.name)} ${x.isNew ? `<span class="pill gold">새 팀</span>` : `<span class="pill">바뀜</span>`}${x.becomesOur ? `<span class="pill blue">우리팀으로</span>` : x.our ? `<span class="pill blue">우리팀</span>` : ""}</h3><ul class="imp-lanes">${x.lanes.map(lane).join("")}</ul></div>`).join("");
      pv = `<section class="imp-pv"><div class="imp-sum"><b>${esc(IMP.file)}</b><span class="help">팀 ${D.length}개 · 바뀌는 팀 ${changed.length}${same ? ` · 그대로 ${same}` : ""}${D.some((x) => x.isNew) ? ` · 새 팀 ${D.filter((x) => x.isNew).length}` : ""}</span></div>
        ${impOurPick(P)}${impCheckHtml(P)}${errs}${warns}${cards || (P.errors.length ? "" : `<p class="help">바뀌는 것이 없습니다.</p>`)}
        <div class="dnav"><button class="btn primary" data-act="impapply" ${P.errors.length || !changed.length ? "disabled" : ""}>적용</button><button class="btn ghost" data-act="impclear">다시 고르기</button></div></section>`;
    }
    return pv;
  }
  // ---------- 명단 등록(PC): 단계 ----------
  const impIds = (P) => [...new Set(P.teams.flatMap((t) => Object.values(t.players).flatMap((x) => [x.riot, ...(x.alts || [])])).filter(Boolean))];
  const IW_ICO = {
    excel: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M3.5 9h17M3.5 14.5h17M9.5 9v11.5"/></svg>`,
    text: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 10.5h14M5 15h9M5 19.5h6"/></svg>`,
    image: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/></svg>`,
  };
  const IW_MODES = [["excel", "엑셀", "양식이나 설문 엑셀 파일 · 팀 여러 개를 한 번에"], ["text", "텍스트", "「이름#태그」를 붙여 넣기 · 한 팀씩 빠르게"], ["image", "사진", "로비·디스코드·단톡 캡처 · 글자를 읽어 명단으로"]];
  function impStepper(step) {
    const ST = [["how", "방법"], ["input", "입력"], ["check", "확인"], ["done", "등록"]], cur = ST.findIndex((x) => x[0] === step);
    return `<ol class="iw-steps" aria-label="명단 등록 단계">${ST.map(([k, n], i) => `<li class="${i < cur ? "past" : i === cur ? "now" : ""}" ${i === cur ? `aria-current="step"` : ""}><span>${i < cur ? lbi("check", 14) : i + 1}</span>${n}</li>`).join("")}</ol>`;
  }
  function impHowPC() {
    return `<section class="iw-body"><h2 class="iw-h">어떻게 넣을까요?</h2>
      <div class="iw-modes">${IW_MODES.map(([k, n, d]) => `<button class="iw-mode" data-act="ipmode" data-v="${k}"><span class="iw-ic">${IW_ICO[k]}</span><b>${n}</b><small>${d}</small></button>`).join("")}</div>
      <p class="help">어느 방법이든 다음 화면에서 계정마다 Riot에 있는지 확인한 뒤 등록합니다</p></section>`;
  }
  function impInputPC() {
    const m = IMP.mode, busy = IMP.busy && IMP.ocr != null;
    const msg = IMP.msg ? `<p class="iw-msg" role="status">${esc(IMP.msg)}</p>` : "";
    const nav = (next) => `<div class="iw-nav"><button class="soft-b" data-act="ipmode" data-v="">이전</button>${next || ""}</div>`;
    if (m === "excel") return `<section class="iw-body"><h2 class="iw-h">엑셀 파일 올리기</h2>
      <div class="ip-tpl"><span><b>엑셀 양식</b><small>팀마다 「팀 줄 + 라인 5줄」. 지금 명단이 채워진 파일로 받아 고쳐 쓰면 됩니다 · 설문처럼 한 줄에 팀 하나(팀 이름 | 탑 | 정글 | 미드 | 원딜 | 서폿)인 엑셀도 됩니다</small></span><button class="n-new" data-act="export">${lbi("note", 18)}엑셀 양식 내려받기</button></div>
      <label class="ip-drop" id="impDrop"><input type="file" id="impFile" accept=".xlsx,.xls,.json" hidden><span class="ip-ic iw-ic">${IW_ICO.excel}</span><b>엑셀 파일을 여기로 끌어다 놓기</b><span>또는 눌러서 고르기 · .xlsx</span></label>
      ${IMP.busy ? `<p class="help">읽는 중…</p>` : ""}${msg}${nav()}</section>`;
    if (m === "image") return `<section class="iw-body"><h2 class="iw-h">사진 올리기</h2>
      <label class="ip-drop" id="impDrop"><input type="file" id="impFile" accept="image/*" hidden><span class="ip-ic iw-ic">${IW_ICO.image}</span><b>캡처한 사진을 여기로 끌어다 놓기</b><span>눌러서 고르기 · <kbd>Ctrl</kbd>+<kbd>V</kbd>로 바로 붙여 넣기</span></label>
      ${busy ? `<div class="ip-bar"><i id="ipBar" style="--w:${Math.round((IMP.ocr || 0) * 100)}%"></i><span id="ipBarT">사진 글자 읽는 중 ${Math.round((IMP.ocr || 0) * 100)}%</span><small>처음 한 번은 글자 인식 자료(약 2MB)를 받습니다 · 사진은 이 브라우저 밖으로 나가지 않음</small></div>` : IMP.busy ? `<p class="help">읽는 중…</p>` : ""}
      <p class="help">사진 글자 인식은 틀릴 수 있습니다 — 다음 화면에서 계정마다 Riot 확인 결과를 보고 고칠 수 있어요</p>${msg}${nav()}</section>`;
    const ex = "탑 바람개비#KR1\n정글 숲지기#0001\n부계정 숲지기부캐#KR2\n미드 별빛#1234\n원딜 화살#KR1\n서폿 방패#KR3";
    return `<section class="iw-body"><h2 class="iw-h">텍스트 붙여 넣기</h2>
      <div class="ip-team"><label class="sd-fl"><small>팀 이름</small><input class="input" id="ipTeam" maxlength="30" value="${esc(IMP.team)}" placeholder="예: 새벽반"></label>
        <div class="seg" role="group" aria-label="우리 팀인지"><button data-act="ipour" data-v="0" aria-pressed="${!IMP.our}">상대 팀</button><button data-act="ipour" data-v="1" aria-pressed="${!!IMP.our}">우리 팀</button></div></div>
      <label class="sd-fl ip-txt"><small>한 줄에 라인과 「이름#태그」 · 라인이 없으면 순서대로 탑·정글·미드·원딜·서폿 · 「부계정」 줄은 바로 위 라인에</small><textarea class="input" id="ipText" rows="8" spellcheck="false" placeholder="${esc(ex)}">${esc(IMP.text)}</textarea></label>
      <p class="help">여러 팀은 「팀: 이름」 줄로 나눕니다</p>${msg}
      ${nav(`<button class="n-new" data-act="ipparse">다음 · 확인하기</button>`)}</section>`;
  }
  // 확인: 팀마다 라인 · 계정(고칠 수 있음) · Riot 확인 · 파일 챔프폭
  function impCheckPC() {
    const P = IMP.parsed, D = IMP.diff || [];
    const ids = impIds(P), no = ids.filter((id) => IMP.chk[id] === "no"), ok = ids.filter((id) => IMP.chk[id] === "ok").length;
    const waiting = SPACE && !SPACE.bad ? ids.length - ok - no.length - ids.filter((id) => IMP.chk[id] === "err").length : 0;
    const stIcon = (id) => { if (!id) return ""; const st = IMP.chk[id] || "wait"; return `<span class="iw-st ${st}" title="${st === "ok" ? "Riot에 있음" : st === "no" ? "Riot에 없는 계정" : st === "err" ? "확인 못 함" : "확인 중"}">${st === "ok" ? "✓" : st === "no" ? "✕" : st === "err" ? "?" : "…"}</span>`; };
    const inp = (ti, r, k, v) => `<span class="iw-acc ${IMP.chk[v] === "no" ? "bad" : ""}"><input class="input" data-ipacc="${ti}:${r}:${k}" value="${esc(v || "")}" placeholder="${k ? "부계정 이름#태그" : "이름#태그"}" spellcheck="false" aria-label="${ROLE_KO[r]} ${k ? "부계정" : "본계정"}">${stIcon(v)}${IMP.canon[v] && IMP.canon[v].toLowerCase() !== v.toLowerCase() ? `<small class="iw-canon">Riot 표기 ${esc(IMP.canon[v])}</small>` : ""}</span>`;
    const hasPool = P.teams.some((t) => Object.values(t.players).some((x) => x.pool && x.pool.length));
    const tIds = (t) => Object.values(t.players).flatMap((x) => [x.riot, ...(x.alts || [])]).filter(Boolean);
    const order = P.teams.map((t, ti) => ti).sort((a, b) => (tIds(P.teams[b]).some((id) => IMP.chk[id] === "no") ? 1 : 0) - (tIds(P.teams[a]).some((id) => IMP.chk[id] === "no") ? 1 : 0));
    const cards = order.map((ti) => { const t = P.teams[ti];
      const d = D.find((x) => x.name === t.name) || {};
      const tag = d.becomesOur || t.our ? `<span class="pill blue">우리 팀</span>` : d.isNew ? `<span class="pill gold">새 상대 팀</span>` : `<span class="pill">있는 팀 고침</span>`;
      const rows = ROLES.map((r) => { const x = t.players[r] || { riot: "", alts: [], pool: [] };
        return `<tr><th>${ROLE_KO[r]}</th><td class="iw-accs">${inp(ti, r, 0, x.riot)}${(x.alts || []).map((a, j) => inp(ti, r, j + 1, a)).join("")}</td>${hasPool ? `<td class="iw-pool">${x.pool && x.pool.length ? champList(x.pool, "") : `<span class="dim">기록으로 채움</span>`}</td>` : ""}</tr>`; }).join("");
      const ids2 = tIds(t), nNo = ids2.filter((id) => IMP.chk[id] === "no").length, allOk = ids2.length && ids2.every((id) => IMP.chk[id] === "ok");
      const name = esc(t.our ? (team(S.ourTeam) || {}).name || t.name : t.name);
      const state = nNo ? `<span class="iw-tst bad">✕ 없는 계정 ${nNo}</span>` : allOk ? `<span class="iw-tst ok">✓ 계정 ${ids2.length}개 확인</span>` : `<span class="iw-tst">확인 중</span>`;
      const tbl = `<table class="iw-tbl"><thead><tr><th>라인</th><th>계정</th>${hasPool ? "<th>챔프폭(파일)</th>" : ""}</tr></thead><tbody>${rows}</tbody></table>`;
      return `<details class="iw-team" ${nNo || !allOk ? "open" : ""}><summary><b>${name}</b> ${tag}${state}<span class="iw-who">${ROLES.map((r) => esc(nick((t.players[r] || {}).riot) || "-")).join(" · ")}</span></summary>${tbl}</details>`;
    }).join("");
    const errs = P.errors.length ? `<div class="imp-errs" role="alert"><b>고칠 곳 ${P.errors.length}개</b> — 이전으로 가서 고쳐 주세요<ul>${P.errors.slice(0, 30).map((e) => `<li>${e.row ? `<span class="pill">${e.row}행</span>` : ""}${esc(e.msg)}</li>`).join("")}</ul></div>` : "";
    const warns = P.warnings.length ? `<details class="imp-warn"><summary>확인할 것 ${P.warnings.length}개</summary><ul>${P.warnings.map((w) => `<li>${w.row ? `<span class="pill">${w.row}행</span>` : ""}${esc(w.msg)}</li>`).join("")}</ul></details>` : "";
    const sum = !SPACE || SPACE.bad ? `<p class="help">팀 공간에 들어오면 계정마다 Riot에 있는지 확인합니다</p>`
      : `<div class="iw-sum ${no.length ? "bad" : waiting ? "" : "good"}" role="status"><b>${waiting ? `계정 확인 중 ${ok + no.length} / ${ids.length}` : no.length ? `Riot에 없는 계정 ${no.length}개` : `계정 ${ids.length}개 모두 Riot에서 확인됨`}</b><span>${no.length ? "빨간 칸의 이름·태그를 고치면 바로 다시 확인합니다(띄어쓰기도 그대로)" : waiting ? "확인이 끝나기 전에도 등록할 수 있습니다" : "등록하면 솔랭·자랭 티어를 받고, 챔프폭·전적은 기록 수집 때 채워집니다"}</span></div>`;
    const canGo = !P.errors.length && P.teams.length;
    return `<section class="iw-body" id="iwCheck"><h2 class="iw-h">이대로 등록할까요?<small>${esc(IMP.file || "")} · 팀 ${P.teams.length}개</small></h2>
      ${impOurPick(P)}${sum}${errs}${warns}<div class="iw-teams">${cards}</div>
      <div class="iw-nav"><button class="soft-b" data-act="ipback">이전</button><button class="n-new" data-act="impapply" ${canGo ? "" : "disabled"}>${no.length ? `등록하기 (없는 계정 ${no.length}개 포함)` : `등록하기 · 팀 ${P.teams.length}개`}</button></div></section>`;
  }
  function impDonePC() {
    const d = IMP.done;
    const tq = TQ.busy ? `<p class="iw-msg" role="status">Riot에서 솔랭·자랭 티어 받는 중 ${TQ.done} / ${TQ.all}</p>` : TQ.msg ? `<p class="iw-msg" role="status">${esc(TQ.msg)}</p>` : "";
    const fails = TQ.fails.length && !TQ.busy ? `<details class="tq-fails" open><summary>티어를 못 받은 계정 ${TQ.fails.length}개 — 우리 팀·상대 챔프폭 편집에서 고칠 수 있습니다</summary><ul>${TQ.fails.map((f) => `<li><b>${esc(f.team)}</b> ${ROLE_KO[f.r]} · ${esc(f.a)} <span class="dim">${esc(f.why)}</span></li>`).join("")}</ul></details>` : "";
    return `<section class="iw-body iw-done"><span class="iw-ok">${lbi("check", 28)}</span><h2 class="iw-h">등록했습니다</h2>
      <p class="help">${d.names.map(esc).join(" · ")}</p>
      ${d.no.length ? `<p class="iw-msg bad">Riot에 없는 계정 ${d.no.length}개는 기록이 비어 있습니다: ${d.no.map(esc).join(", ")}</p>` : ""}${tq}${fails}
      <p class="help">챔프폭·전적·함께 한 경기는 Riot 기록 수집(매일 0시) 때 채워지고, 수집 중이면 화면 위에 알려 드립니다</p>
      <div class="iw-nav"><button class="soft-b" data-act="ipmode" data-v="">더 등록하기</button><button class="soft-b tab" data-tab="team">우리 팀 보기</button><button class="n-new tab" data-tab="enemy">상대 분석 보기</button></div></section>`;
  }
  function renderImportPC() {
    const step = impStep();
    const body = step === "done" ? impDonePC() : step === "check" ? (IMP.json ? `<section class="iw-body"><h2 class="iw-h">예전 내보내기 파일(.json)</h2><p class="help">팀 ${IMP.json.teams.length}개 · 지금 팀·챔프폭이 이 파일 내용으로 통째로 바뀝니다.</p><div class="iw-nav"><button class="soft-b" data-act="ipback">이전</button><button class="n-new" data-act="impapply">등록하기</button></div></section>` : impCheckPC()) : step === "input" ? impInputPC() : impHowPC();
    return `<div class="home imp-pc iw">${impStepper(step)}${body}</div>`;
  }
  function renderImport() {
    const ex = [["팀", "새벽반", "우리팀"], ["라인", "본계정", "부계정1", "부계정2", "티어", "점수", "챔프폭"],
      ["탑", "바람개비#KR1", "", "", "에메랄드 4 24LP", "45", "다리우스:상, 말파이트:상, 케넨:중"], ["정글", "숲지기#0001", "숲지기부캐#KR2", "", "챌린저 630LP", "90", "키아나:원챔, 누누:중"], ["…", "", "", "", "", "", ""]];
    const exHtml = `<div class="tbl-wrap"><table class="imp-ex"><tbody>${ex.map((r, i) => `<tr class="${i === 0 ? "t" : i === 1 ? "h" : ""}">${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    const pv = impPreview();
    return `<div class="section-title"><h2>팀·챔프폭 불러오기</h2><p>엑셀로 팀 명단·계정·챔프폭을 한 번에 넣습니다</p><button class="ib btn sm" data-act="impback" aria-label="돌아가기" title="돌아가기">${ico("back")}</button></div>
      <div class="imp">
        <section class="card imp-how"><h3>엑셀 쓰는 법</h3><ol class="steps">
          <li>「지금 자료로 양식 내려받기」를 누르면 지금 팀·챔프폭이 채워진 엑셀이 받아집니다. 그 파일을 고쳐 쓰면 됩니다.</li>
          <li>팀마다 <b>「팀 | 팀 이름 | 우리팀 또는 상대」</b> 줄 하나, 그 아래 <b>라인 5줄</b>(탑·정글·미드·원딜·서폿).</li>
          <li><b>계정</b>: 본계정·부계정1·부계정2 칸에 <code>이름#태그</code>. 라인당 3개까지, 부계정은 그 라인으로 한 판만 기록에 합칩니다.</li>
          <li><b>챔프폭</b>: <code>챔프이름:상</code>을 쉼표로 이어서. 숙련도는 상·중·하·원챔, 안 쓰면 중. 한글 이름·줄임말·영어 이름 모두 됩니다.</li>
          <li>저장한 엑셀을 아래에 올리면 <b>바뀌는 것을 먼저 보여 주고</b>, 「적용」을 눌러야 바뀝니다.</li></ol>
          ${exHtml}
          <ul class="plain help"><li>팀은 <b>이름</b>으로 맞춥니다 — 같은 이름이면 그 팀을 고치고, 처음 보는 이름이면 새 팀을 만듭니다. 파일에 없는 팀·라인은 지우지 않고 그대로 둡니다.</li>
          <li>챔프폭·티어는 팀 공간 팀원에게 공유됩니다. 계정은 이 브라우저에 저장되고, 새 계정의 전적은 서버 수집이 그 팀을 알게 된 뒤(다음 단계)부터 채워집니다.</li></ul>
          <div class="dnav"><button class="btn" data-act="export">지금 자료로 양식 내려받기</button></div></section>
        <section class="card imp-up"><h3>엑셀 올리기</h3>
          <label class="imp-drop" id="impDrop"><input type="file" id="impFile" accept=".xlsx,.xls,.json" hidden><b>엑셀 파일 고르기</b><span class="help">또는 여기로 끌어다 놓기 · .xlsx (예전 .json도 됨)</span></label>
          ${IMP.msg ? `<p class="help imp-msg" role="status">${esc(IMP.msg)}</p>` : ""}${pv}</section>
      </div>`;
  }

  // ---------- actions ----------
  function choose(id, wantRole) {
    const st = curStep();
    if (!st || !CH[id]) return;
    const who = E.whoOfSide(S, st[0]);
    if (E.taken(S).has(id) || E.lockedFor(S, who).has(id)) return;
    const step = S.draft.steps[S.draft.idx];
    step.champ = id; step.skip = false;
    step.cands = undefined;
    if (st[1] !== "pick") step.role = null;
    else if (who === "enemy" && S.ui.predRole && E.openRoles(S, "enemy").includes(S.ui.predRole)) step.role = S.ui.predRole;
    else if (who === "our" && (wantRole || S.ui.ourRole) && E.openRoles(S, "our").includes(wantRole || S.ui.ourRole)) step.role = wantRole || S.ui.ourRole;
    else { const pr = E.pickRole(S, who, id); step.role = pr.role; step.cands = pr.cands; }
    S.draft.idx++;
    if (S.ui.predRole && !E.openRoles(S, "enemy").includes(S.ui.predRole)) S.ui.predRole = "";
    S.ui.ourRole = "";   // 우리 라인 칸은 한 번 고르면 전체로 돌아감(다음 차례는 다른 라인일 수 있음)
    S.ui.sheet = false; S.ui.q = "";
    save(); render();
  }
  function setRole(i, r) {
    const side = ORDER[i][0];
    const s = S.draft.steps[i];
    if (r === "?") { s.role = "?"; if (!s.cands || !s.cands.length) s.cands = E.flexRoles(s.champ); save(); render(); return; }
    const other = S.draft.steps.find((x, j) => j !== i && ORDER[j][0] === side && ORDER[j][1] === "pick" && x.role === r);
    if (other) other.role = s.role === "?" ? "?" : s.role;
    if (other && other.role === "?" && (!other.cands || !other.cands.length)) other.cands = E.flexRoles(other.champ);
    s.role = r; save(); render();
  }

  // ---------- 시야 공부: 배우기(애니메이션 장면) · 한눈에 보기(자리 요약) · 문제 모음 ----------
  // 맵 그림: 공식 미니맵 + 부쉬(img/map-sr.webp, 만드는 법 tools/map-bushes/)
  const MAP_IMG = () => (window.VISION && window.VISION.map ? window.VISION.map + "?v=60" : `https://ddragon.leagueoflegends.com/cdn/${window.DDRAGON_VERSION}/img/map/map11.png`);
  const vseg = (act, cur, items, label) => `<div class="seg" role="group" aria-label="${label}">${items.map(([v, n]) => `<button data-act="${act}" data-v="${v}" aria-pressed="${cur === v}">${n}</button>`).join("")}</div>`;
  // 레드 진영 좌표: 강을 기준으로 뒤집되, 뒤집으면 강·벽에 걸리는 자리는 따로 잰 rx·ry
  function redXY(x, y) {
    const sp = window.VISION.spots.find((p) => p.x === x && p.y === y);
    return sp && sp.rx != null ? { x: sp.rx, y: sp.ry } : { x: y, y: x };
  }
  // 문제 목록 + 레드 진영 변형(-r): 강의가 "레드(퍼플)일 때도 같다/반대편"이라고 한 와드 문제
  function allDrills() {
    const V = window.VISION;
    if (V._all) return V._all;
    const out = [];
    V.drills.forEach((d) => {
      out.push(d);
      const flip = (arr) => (arr || []).map(([id, x, y]) => [id, y, x]);
      if (d.mirror) out.push({ ...d, id: d.id + "-r", side: "R", title: d.title + " (레드)", pos: d.pos ? { us: flip(d.pos.us), them: flip(d.pos.them) } : undefined, opts: d.opts.map((o) => ({ ...o, ...(o.rx != null ? { x: o.rx, y: o.ry } : redXY(o.x, o.y)) })) });
    });
    V._all = out;
    return out;
  }
  const drillById = (id) => allDrills().find((d) => d.id === id);
  function renderVisionPC() {
    const V = window.VISION;
    if (!V) return `<div class="home"><p class="help">시야 자료를 불러오지 못했습니다.</p></div>`;
    const mode = S.ui.vMode || "learn", u = S.ui;
    const D = allDrills(), score = u.dScore || {};
    const pill = (act, cur, items, label) => `<div class="seg" role="group" aria-label="${label}">${items.map(([v, n]) => `<button data-act="${act}" data-v="${v}" aria-pressed="${cur === v}">${n}</button>`).join("")}</div>`;
    let sub = "", body = "";
    if (mode === "drill") {
      const cat = DCATS.some(([k]) => k === u.dCat) ? u.dCat : DCATS.find(([k]) => D.some((d) => dcatOf(d) === k))[0];
      sub = pill("dcat", cat, DCATS.filter(([k]) => D.some((d) => dcatOf(d) === k)).map(([k, n]) => { const ds = D.filter((d) => dcatOf(d) === k); return [k, `${n}<small>${ds.filter((d) => score[d.id]).length}/${ds.length}</small>`]; }), "문제 종류")
        + (Object.keys(score).length ? `<button class="nc-a del" data-act="dreset">점수 지우기</button>` : "");
      const pool = D.filter((d) => dcatOf(d) === cat), k = Math.min(u.dIdx || 0, pool.length - 1), d = pool[k];
      const name = DCATS.find(([x]) => x === cat)[1];
      const answered = u.ans && u.ans[d.id] != null;
      const nav = `<button class="soft-b" data-act="dprev" ${k ? "" : "disabled"}>이전</button>${answered ? `<button class="soft-b" data-act="dretry" data-id="${d.id}">다시 풀기</button>` : ""}<span class="n-sp"></span>${k < pool.length - 1 ? `<button class="n-new sm" data-act="dnext">다음 문제 ${lbi("chev", 16)}</button>` : `<span class="dim">이 종류 마지막 문제</span>`}`;
      body = drillPC(V, d, `<span class="ec-tag nu">${esc(name)}</span><b>${k + 1} / ${pool.length}</b>`, nav);
    } else if (mode === "spots") {
      const side = (u.vSide && u.vSideBase === S.draft.ourSide ? u.vSide : S.draft.ourSide) || "B";
      sub = pill("vside", side, [["B", "블루"], ["R", "레드"]], "진영") + `<span class="dim">번호를 누르면 지도에서 표시 · 「장면 보기」는 애니메이션으로</span>`;
      body = renderSummary(V);
    } else {
      const T = u.tut || {};
      if (!T.u) {
        const POS = [["T", "탑"], ["J", "정글"], ["M", "미드"], ["A", "원딜"], ["S", "서폿"]];
        sub = pill("lpos", POS.some(([k]) => k === u.lPos) ? u.lPos : "T", POS, "포지션") + `<span class="dim">단원을 누르면 장면 → 문제 → 정리</span>`;
      } else {
        const un = V.units.find((x) => x.id === T.u);
        sub = `<button class="ec-back" data-act="tback">${ico("left")}단원 목록</button><b class="vz-ut">${esc(un.title)}</b><span class="dim">${esc(un.goal)}</span>`;
      }
      if (T.u && T.step === "quiz") {
        const un = V.units.find((x) => x.id === T.u), q = T.queue || un.drills, k = Math.min(T.k || 0, q.length - 1), d = drillById(q[k]);
        const answered = (u.ans || {})[d.id] != null;
        body = drillPC(V, d, `<span class="ec-tag hi">② 문제</span><b>${T.retry ? "틀린 문제 다시 · " : ""}${k + 1} / ${q.length}</b>`,
          `<span class="n-sp"></span>${answered ? `<button class="n-new sm" data-act="tnext">${k < q.length - 1 ? "다음 문제" : "정리 보기"} ${lbi("chev", 16)}</button>` : `<span class="dim">보기를 하나 고르세요</span>`}`);
      } else body = renderLearn(V);
    }
    const bar = `<div class="n-bar vz-bar">${pill("vmode", mode, [["learn", "배우기"], ["drill", "문제"], ["spots", "한눈에 보기"]], "공부 보기")}<span class="vz-sep"></span>${sub}</div>`;
    return `<div class="home vision-pc v-${mode}">${bar}${body}</div>`;
  }
  function renderVision() {
    const V = window.VISION;
    if (!V) return `<div class="card">시야 자료를 불러오지 못했습니다.</div>`;
    const mode = S.ui.vMode || "learn";
    const head = `<div class="vmode">${vseg("vmode", mode, [["learn", "배우기"], ["drill", "문제 모음"], ["spots", "시야 한눈에 보기"]], "공부 보기")}</div>`;
    return head + (mode === "drill" ? renderDrill(V) : mode === "spots" ? renderSummary(V) : renderLearn(V));
  }
  const mmss = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  // 운영 문제 출처(2026 자료): 영상은 챕터 시각으로, 글은 그대로
  const refLinks = (V, refs) => `<span class="drefs">${refs.map(([k, at]) => { const r = (V.macroRefs || {})[k]; if (!r) return ""; const vid = !/^https?:/.test(r[1]);
    const sec = at ? at.split(":").reduce((a, b) => a * 60 + Number(b), 0) : 0;
    const href = vid ? `https://www.youtube.com/watch?v=${r[1]}${sec ? `&t=${sec}s` : ""}` : r[1];
    return `<a class="vlink" href="${href}" target="_blank" rel="noopener" title="${esc(r[0])}${at ? " " + at : ""}">${ico("eye")}${esc(r[0])}${at ? " " + at : ""}</a>`; }).join("")}</span>`;
  const vlink = (V, t) => `<a class="vlink" href="${V.source.url}&t=${t}s" target="_blank" rel="noopener" title="${esc(V.source.title)} ${mmss(t)} 장면 열기">${ico("eye")}영상 ${mmss(t)}</a>`;

  // ----- 장면 무대: 실제 미니맵 위에 챔프·와드·시야·화살표를 그리고, 이전 장면에서 움직임을 애니메이션으로 이어 준다 -----
  // 좌표는 맵 %(world 기준). world는 맵 전체 정사각형이고 카메라(cam)만큼 확대·이동한다.
  const camBox = (cam) => { const [cx, cy, s] = cam; const x0 = Math.max(0, Math.min(100 - s, cx - s / 2)), y0 = Math.max(0, Math.min(100 - s, cy - s / 2)); return { w: 10000 / s, tx: -x0, ty: -y0 }; };
  const camCss = (b) => `width:${b.w}%;transform:translate(${b.tx}%,${b.ty}%)`;
  const dataA = (o) => ` data-a='${JSON.stringify(o)}'`;
  const pct = ([x, y]) => `left:${x}%;top:${y}%`;
  // 카메라 맞추기: 장면 안의 챔프·와드·화살표·글씨가 모두 보이도록(정해 둔 카메라보다 좁히지는 않음)
  function fitCam(sc) {
    const pts = [];
    Object.values(sc.a || {}).forEach((t) => { if (t.at) pts.push(t.at); (t.via || []).forEach((q) => pts.push(q)); });
    Object.values(sc.w || {}).forEach((w) => pts.push(w.at));
    (sc.p || []).forEach((p) => p.pts.forEach((q) => pts.push(q)));
    (sc.hit || []).forEach((h) => pts.push(h.at)); (sc.l || []).forEach((l) => pts.push(l.at)); (sc.fitPts || []).forEach((q) => pts.push(q));
    const [cx, cy, s] = sc.cam;
    if (!pts.length) return sc.cam;
    const m = 3;   // 가장자리 여유(맵 %)
    const x0 = Math.min(cx - s / 2, ...pts.map((q) => q[0] - m)), x1 = Math.max(cx + s / 2, ...pts.map((q) => q[0] + m));
    const y0 = Math.min(cy - s / 2, ...pts.map((q) => q[1] - m)), y1 = Math.max(cy + s / 2, ...pts.map((q) => q[1] + m));
    const ns = Math.min(100, Math.max(x1 - x0, y1 - y0));
    return ns <= s + 0.01 ? sc.cam : [(x0 + x1) / 2, (y0 + y1) / 2, ns];
  }
  function stageHtml(sc0, prev0, extra) {
    const sc = sc0 && sc0.cam ? { ...sc0, cam: fitCam(sc0) } : sc0, prev = prev0 && prev0.cam ? { ...prev0, cam: fitCam(prev0) } : prev0;
    const red = !!sc.red;
    const side = (s) => (s === "us") !== red ? "b" : "r";   // 테두리 색 = 그 팀 진영 색
    // 미니맵은 기본 전체. 「장면 확대」를 누르면 장면이 보여 주려는 곳으로(다음 장면에도 유지), ＋/−·끌기로 직접 조절
    const focusMode = S.ui.mapMode === "focus";
    const viewCam = focusMode ? sc.cam : [50, 50, 100];
    const cam = camBox(viewCam), pcam = focusMode && prev && prev.cam ? camBox(prev.cam) : null;
    const camAnim = pcam && (pcam.w !== cam.w || pcam.tx !== cam.tx || pcam.ty !== cam.ty) ? dataA({ k: "cam", from: pcam, to: cam }) : "";
    const zones = (sc.z || []).map((z) => {
      const lab = z.t ? `<em>${esc(z.t)}</em>` : "";
      const anim = z.d != null ? dataA({ k: "in", d: z.d }) : "";
      if (z.k === "ring" || z.k === "range") return `<span class="sc-z z-${z.k}" style="${pct(z.at)};width:${z.r * 2}%"${anim}>${lab}</span>`;
      return `<span class="sc-z z-${z.k}" style="${pct(z.at)};width:${z.rx * 2}%;height:${z.ry * 2}%;--rot:${z.rot || 0}deg"${anim}>${lab}</span>`;
    }).join("");
    const arrows = (sc.p || []).length ? `<svg class="sc-arrows" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${sc.p.map((p) => `<polyline class="ar-${p.k}" pathLength="1" points="${p.pts.map((q) => q.join(",")).join(" ")}"${dataA({ k: "draw", d: p.d || 0 })}/>`).join("")}</svg>` : "";
    const heads = (sc.p || []).map((p) => { const n = p.pts.length, [x1, y1] = p.pts[n - 2], [x2, y2] = p.pts[n - 1];
      return `<span class="sc-head ar-${p.k}" style="${pct(p.pts[n - 1])};--ang:${Math.atan2(y2 - y1, x2 - x1)}rad"${dataA({ k: "show", d: (p.d || 0) + 0.6 })}></span>`; }).join("");
    const pw = (prev && prev.w) || {};
    const wards = Object.entries(sc.w || {}).map(([id, w]) => {
      const isNew = !pw[id] || (!!pw[id].ghost !== !!w.ghost);
      const cls = `${w.k === "ctrl" ? "k-ctrl" : "k-ward"} s-${side(w.s)} ${w.ghost ? "ghost" : ""} ${w.x ? "dead" : ""}`;
      const inA = isNew ? dataA({ k: "in", d: w.d || 0 }) : "";
      const vanim = isNew ? dataA({ k: "show", d: (w.d || 0) + 0.25 }) : w.x ? dataA({ k: "fade", d: w.d || 0 }) : "";
      const vis = vgrid() ? visCanvas(`sc-vcan ${cls}`, "", { x: w.at[0], y: w.at[1], r: 900, s: side(w.s) }, vanim)
        : `<span class="sc-vis ${cls}" style="${pct(w.at)};width:${(w.r || 6) * 2}%"${isNew ? dataA({ k: "grow", d: (w.d || 0) + 0.25 }) : ""}${w.x ? dataA({ k: "fade", d: w.d || 0 }) : ""}></span>`;
      return vis + `<span class="sc-ward ${cls}" style="${pct(w.at)}"${inA}><i></i>${w.x ? `<b class="sc-x"${dataA({ k: "in", d: w.d || 0 })}>✕</b>` : ""}</span>`;
    }).join("");
    // 전체 맥락(js/world.js): 장면에 없는 우리 팀원을 시점 자리에 채우고, 우리 포탑·라인 미니언 시야를 더한다
    const W = window.WORLD, ctxW = W && sc.ph && !sc.noCtx ? W.fill(sc, sc.ph) : { add: {}, vis: [] };
    // 라인 웨이브(js/world.js): 우리 미니언 묶음은 늘 보이고 시야 1100을 준다. 상대 묶음은 우리 시야 안일 때만
    const wv = W ? W.waves(sc) : [];
    const waves = wv.filter((q) => q.us > 0).map((q) => [q.usAt[0], q.usAt[1], 1100, `우리 ${q.ko} 미니언`]);
    const ourSide = red ? "r" : "b";
    const towers = W ? W.towers.filter((t, i) => !(sc.down || []).includes(i)) : [];
    const ctxUs = Object.fromEntries(Object.entries(ctxW.add).filter(([, t]) => t.s === "us"));
    // 안개: 우리 챔프(1350)·포탑(1350)·와드(900)·라인 미니언(1100)이 못 보는 곳을 어둡게 — 상대는 여기서만 숨을 수 있다
    const fogSrc = sc.fog === false ? null : [...Object.values({ ...(sc.a || {}), ...ctxUs }).filter((t) => t.s === "us" && t.at).map((t) => [t.at[0], t.at[1], 1350]),
      ...towers.filter((t) => t.side === ourSide).map((t) => [t.at[0], t.at[1], 1350]),
      ...Object.values(sc.w || {}).filter((w) => w.s === "us" && !w.ghost && !w.x).map((w) => [w.at[0], w.at[1], 900]), ...(sc.vis || []).map((v) => [v[0], v[1], v[2]]), ...waves.map((v) => [v[0], v[1], v[2]])];
    const seen = fogSrc && fogSrc.length ? teamVision(fogSrc) : null, gv = vgrid();
    const inSight = (p) => !seen || !gv || !!seen[Math.min(gv.h - 1, Math.floor((p[1] / 100) * gv.h)) * gv.w + Math.min(gv.w - 1, Math.floor((p[0] / 100) * gv.w))];
    // 맞라인 상대는 우리 시야 안일 때만 그린다(밖이면 모름)
    const ctxThem = Object.fromEntries(Object.entries(ctxW.add).filter(([, t]) => t.s === "them" && inSight(t.at)));
    // 한 라인에 묶음 하나: 부딪히는 자리에 「우리 수 : 상대 수」(상대는 우리 시야 안일 때만 수, 밖이면 ?)
    const waveHtml = wv.map((q) => { const seeThem = q.them > 0 && inSight(q.themAt), at0 = q.us > 0 ? q.usAt : q.themAt;
      const tip = `${q.ko} 웨이브 — 우리 ${q.us}마리 · 상대 ${q.them > 0 ? (seeThem ? q.them + "마리" : "시야 밖") : "없음"}${q.note ? " · " + q.note : ""}`;
      return `<span class="sc-wv" style="${pct(at0)}" title="${esc(tip)}" aria-label="${esc(tip)}"><b class="s-${side("us")}">${q.us}</b><b class="${q.them > 0 && !seeThem ? "unk" : "s-" + side("them")}">${q.them > 0 ? (seeThem ? q.them : "?") : 0}</b></span>`
        + (q.note ? `<span class="sc-lab wvl" style="left:${at0[0]}%;top:${at0[1] + (at0[1] > 82 ? -2.8 : 2.4)}%;transform:translate(${at0[0] > 82 ? -92 : at0[0] < 18 ? -8 : -50}%,-50%)">${esc(q.note)}</span>` : ""); }).join("");
    const towerHtml = towers.map((t) => `<span class="sc-tower s-${t.side} ${t.side === ourSide ? "us" : "them"}" style="${pct(t.at)}" title="${t.side === ourSide ? "우리" : "상대"} 포탑 · ${esc(t.kind)}"></span>`).join("");
    // 다른 시야 출처(우리 라인 미니언 등): 작은 표시 + 이름
    const vsrc = (sc.vis || []).map((v) => `<span class="sc-vsrc" style="${pct(v)}" title="${esc(v[3] || "우리 시야")}"></span><span class="sc-lab vsrc" style="left:${v[0]}%;top:${v[1] + 2.2}%">${esc(v[3] || "우리 시야")}</span>`).join("")
      ;
    const fog = fogSrc && fogSrc.length && vgrid() ? `<canvas class="sc-fog" width="${vgrid().w}" height="${vgrid().h}" data-fog='${JSON.stringify(fogSrc)}' aria-hidden="true"></canvas>` : "";
    const pa = (prev && prev.a) || {};
    const toks = Object.entries({ ...ctxUs, ...ctxThem, ...(sc.a || {}) }).map(([id, t0]) => {
      // 문제 그림(autoFog): 우리 시야 밖에 그린 상대는 「예상 위치」로 흐리게
      const t = sc.autoFog && t0.s === "them" && !t0.fog && !inSight(t0.at) ? { ...t0, fog: 1 } : t0;
      if (t.ctx) return `<span class="sc-tok ${t.s} s-${side(t.s)} ctx" style="${pct(t.at)}" title="${t.s === "us" ? "우리" : "상대"} ${esc(CH[t.c] ? CH[t.c].ko : t.c)}${t.s === "them" ? " — 우리 시야 안" : ""}">${icon(t.c, "sm")}</span>`;
      const from = pa[id] ? pa[id].at : null;
      const pts = from ? [from, ...(t.via || []), t.at] : [...(t.via || []), t.at];
      const moves = pts.length > 1 && pts.some((q) => q[0] !== t.at[0] || q[1] !== t.at[1]);
      const anim = moves ? dataA({ k: "move", pts, d: t.d || 0 }) : !pa[id] ? dataA({ k: "in", d: t.d || 0 }) : "";
      return `<span class="sc-tok ${t.s} s-${side(t.s)} ${t.me ? "me" : ""} ${t.fog ? "fogged" : ""}" style="${pct(t.at)}"${anim} title="${t.s === "us" ? "우리" : "상대"} ${esc(CH[t.c] ? CH[t.c].ko : t.c)}${t.fog ? " — 안 보임(예상 위치)" : ""}">${icon(t.c, "sm")}${t.fog ? `<b class="fog-q">?</b>` : ""}</span>`;
    }).join("");
    const hits = (sc.hit || []).map((h) => `<span class="sc-hit" style="${pct(h.at)};width:${(h.r || 1.6) * 2}%"${dataA({ k: "pop", d: h.d || 0 })}></span>`).join("");
    const labs = (sc.l || []).map((l) => `<span class="sc-lab ${l.k || ""}" style="${pct(l.at)}"${dataA({ k: "in", d: l.d || 0 })}>${esc(l.t)}</span>`).join("");
    const base = red ? `<span class="sc-base r" style="right:8px;bottom:8px">우리 = 레드</span>` : "";
    // 보기 핀(버튼)이 들어 있으면 그림(role=img)이 아니라 묶음(group)이어야 버튼을 누를 수 있다
    const role = extra && extra.pins ? `role="group" aria-label="${esc(sc.cap || "맵에서 보기 고르기")}"` : `role="img" aria-label="${esc(sc.cap || "맵 그림")}"`;
    const zoomBar = `<div class="sc-zoom" role="group" aria-label="미니맵 확대·축소"><button type="button" data-act="mzoom" data-v="in" aria-label="확대">＋</button><button type="button" data-act="mzoom" data-v="out" aria-label="축소">−</button><button type="button" data-act="mapmode" data-v="full" aria-pressed="${!focusMode}">전체</button><button type="button" data-act="mapmode" data-v="focus" aria-pressed="${focusMode}" aria-label="장면 확대"><span class="zl">장면 확대</span><span class="zs" aria-hidden="true">확대</span></button></div>`;
    return `<div class="sc-stage ${extra && extra.cls ? extra.cls : ""} ${viewCam[2] < 99.9 ? "zoomed" : ""}" ${role} data-cam='${JSON.stringify(viewCam)}' data-focus='${JSON.stringify(sc.cam)}'>${zoomBar}
      <div class="sc-world" style="${camCss(cam)}"${camAnim}><img class="sc-map" src="${MAP_IMG()}" alt="" draggable="false">${fog}${towerHtml}${waveHtml}${vsrc}${zones}${arrows}${heads}${wards}${hits}${toks}${labs}${extra && extra.pins ? extra.pins : ""}</div>
      ${base}${sc.approx ? `<span class="sc-approx">대략 자리 · 정확한 자리는 영상</span>` : ""}</div>`;
  }
  // ----- 실제 시야: 게임 이동·시야 격자(js/visiongrid.js)로 와드가 밝히는 칸을 계산 -----
  // 벽은 시야를 막고, 부쉬 칸은 와드가 같은 부쉬 안에 있을 때만 보인다. 와드·제어 와드 시야 900 = 18칸.
  let _vg = null;
  function vgrid() {
    if (_vg) return _vg;
    const G = window.VGRID; if (!G) return null;
    const a = new Uint8Array(G.w * G.h); let k = 0;
    for (const t of G.rle.split(",")) { const [v, n] = t.split("*"); const cnt = n ? parseInt(n, 16) : 1; a.fill(parseInt(v, 16), k, k + cnt); k += cnt; }
    return (_vg = { w: G.w, h: G.h, a });
  }
  function visionCells(x, y, range) {
    const g = vgrid(); if (!g) return null;
    const cx = (x / 100) * g.w, cy = (y / 100) * g.h, R = (range || 900) / 50;
    const at = (i, j) => g.a[Math.min(g.h - 1, Math.max(0, j)) * g.w + Math.min(g.w - 1, Math.max(0, i))];
    const mine = at(Math.floor(cx), Math.floor(cy)), myBush = mine >= 2 ? mine : 0, out = [];
    for (let j = Math.floor(cy - R); j <= Math.ceil(cy + R); j++) for (let i = Math.floor(cx - R); i <= Math.ceil(cx + R); i++) {
      if (i < 0 || j < 0 || i >= g.w || j >= g.h) continue;
      const dx = i + 0.5 - cx, dy = j + 0.5 - cy; if (dx * dx + dy * dy > R * R) continue;
      const v = at(i, j); if (v === 1 || (v >= 2 && v !== myBush)) continue;
      const steps = Math.ceil(Math.hypot(dx, dy) * 3); let ok = true;
      for (let st = 1; st < steps; st++) { const q = at(Math.floor(cx + (dx * st) / steps), Math.floor(cy + (dy * st) / steps)); if (q === 1 || (q >= 2 && q !== myBush)) { ok = false; break; } }   // 벽과 다른 부쉬는 그 뒤를 가린다
      if (ok) out.push(i, j);
    }
    return out;
  }
  // 시야 캔버스: data-vis에 와드 자리·색, 그린 뒤 drawVision이 칸을 칠한다
  const visCanvas = (cls, style, v, anim) => { const g = vgrid(); return g ? `<canvas class="${cls}" width="${g.w}" height="${g.h}" style="${style}" data-vis='${JSON.stringify(v)}'${anim || ""} aria-hidden="true"></canvas>` : ""; };
  // 우리 팀 시야(챔프 1350 · 와드 900)를 합친 칸 — 이 밖은 안개(상대가 안 보이는 곳)
  function teamVision(sources) {
    const g = vgrid(); if (!g) return null;
    const seen = new Uint8Array(g.w * g.h);
    sources.forEach(([x, y, r]) => { const c = visionCells(x, y, r); for (let k = 0; k < c.length; k += 2) seen[c[k + 1] * g.w + c[k]] = 1; });
    return seen;
  }
  function drawVision(root) {
    if (!root) return;
    root.querySelectorAll("canvas[data-fog]").forEach((cv) => {
      let src; try { src = JSON.parse(cv.dataset.fog); } catch (e) { return; }
      const g = vgrid(), seen = teamVision(src); if (!seen) return;
      const x = cv.getContext("2d"), img = x.createImageData(g.w, g.h);
      for (let k = 0; k < seen.length; k++) if (!seen[k] && g.a[k] !== 1) { img.data[k * 4 + 3] = 150; }
      x.putImageData(img, 0, 0);
    });
    root.querySelectorAll("canvas[data-vis]").forEach((cv) => {
      let o; try { o = JSON.parse(cv.dataset.vis); } catch (e) { return; }
      const cells = visionCells(o.x, o.y, o.r); if (!cells) return;
      const x = cv.getContext("2d"); x.clearRect(0, 0, cv.width, cv.height);
      x.fillStyle = o.s === "r" ? "rgba(255, 96, 104, 0.42)" : "rgba(255, 228, 120, 0.42)";
      for (let k = 0; k < cells.length; k += 2) x.fillRect(cells[k], cells[k + 1], 1, 1);
    });
  }
  function setStageCam(stage, c) {
    const s = Math.max(8, Math.min(100, c[2])), h = s / 2;
    const cam = [Math.max(h, Math.min(100 - h, c[0])), Math.max(h, Math.min(100 - h, c[1])), s];
    stage.dataset.cam = JSON.stringify(cam);
    const w = stage.querySelector(".sc-world"); if (w) { w.getAnimations().forEach((a) => a.cancel()); w.setAttribute("style", camCss(camBox(cam))); }
    stage.classList.toggle("zoomed", s < 99.9);
  }
  function zoomStage(stage, dir) {
    let c; try { c = JSON.parse(stage.dataset.cam); } catch (e) { c = [50, 50, 100]; }
    setStageCam(stage, [c[0], c[1], dir === "in" ? c[2] / 1.6 : c[2] * 1.6]);
  }
  // 마우스 휠(트랙패드 두 손가락)로 확대·축소 — 커서 아래 지점을 고정한 채로
  let zoomUsed = false;
  function zoomHintDone() { if (zoomUsed) return; zoomUsed = true; document.querySelectorAll(".sc-hint").forEach((h) => { h.classList.add("out"); setTimeout(() => h.remove(), 400); }); }
  let hintShown = false;   // 처음 보이는 그림 한 번만
  function addZoomHint(root) {
    if (zoomUsed || hintShown || !root) return;
    const st = root.querySelector(".sc-stage"); if (!st) return;
    hintShown = true;
    st.insertAdjacentHTML("beforeend", `<div class="sc-hint" aria-hidden="true"><span class="sc-hint-b"><b class="hint-wheel">마우스 스크롤로 확대·축소할 수 있습니다</b><b class="hint-touch">＋ − 버튼으로 확대·축소할 수 있습니다</b><small>확대한 뒤에는 끌어서 옮기기 · 「전체」로 돌아오기</small></span></div>`);
  }
  document.addEventListener("wheel", (ev) => {
    const stage = ev.target.closest && ev.target.closest(".sc-stage"); if (!stage || !ev.deltaY) return;
    let c; try { c = JSON.parse(stage.dataset.cam); } catch (e) { c = [50, 50, 100]; }
    const k = Math.exp(Math.max(-60, Math.min(60, ev.deltaY * (ev.deltaMode === 1 ? 16 : 1))) * 0.004);
    const s2 = Math.max(8, Math.min(100, c[2] * k));
    if (Math.abs(s2 - c[2]) < 0.01) return;   // 전체에서 더 줄이면 그냥 페이지가 내려간다
    ev.preventDefault();
    const r = stage.getBoundingClientRect(), fx = (ev.clientX - r.left) / r.width, fy = (ev.clientY - r.top) / r.height;
    const px = c[0] - c[2] / 2 + fx * c[2], py = c[1] - c[2] / 2 + fy * c[2];
    setStageCam(stage, [px - (fx - 0.5) * s2, py - (fy - 0.5) * s2, s2]);
    zoomHintDone();
  }, { passive: false });
  // 확대한 그림은 끌어서 옮긴다(손가락·마우스)
  document.addEventListener("pointerdown", (ev) => {
    const stage = ev.target.closest && ev.target.closest(".sc-stage.zoomed"); if (!stage || ev.target.closest("button")) return;
    let c; try { c = JSON.parse(stage.dataset.cam); } catch (e) { return; }
    const r = stage.getBoundingClientRect(), x0 = ev.clientX, y0 = ev.clientY, c0 = c.slice();
    stage.setPointerCapture && stage.setPointerCapture(ev.pointerId);
    const move = (e) => setStageCam(stage, [c0[0] - ((e.clientX - x0) / r.width) * c0[2], c0[1] - ((e.clientY - y0) / r.height) * c0[2], c0[2]]);
    const up = () => { stage.removeEventListener("pointermove", move); stage.removeEventListener("pointerup", up); stage.removeEventListener("pointercancel", up); };
    stage.addEventListener("pointermove", move); stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
  });
  // 그린 뒤 애니메이션 실행(움직임 줄이기 설정이면 바로 마지막 모습)
  const reduceMotion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  function runAnims(root) {
    if (!root || reduceMotion.matches) return;
    root.querySelectorAll("[data-a]").forEach((el) => {
      let o; try { o = JSON.parse(el.dataset.a); } catch (e) { return; }
      const delay = (o.d || 0) * 1000, base = "translate(-50%, -50%)";
      const opt = (dur, extra) => ({ duration: dur, delay, easing: "cubic-bezier(.3,.7,.3,1)", fill: "backwards", ...(extra || {}) });
      if (o.k === "move") {
        let len = 0; for (let i = 1; i < o.pts.length; i++) len += Math.hypot(o.pts[i][0] - o.pts[i - 1][0], o.pts[i][1] - o.pts[i - 1][1]);
        const dur = Math.max(500, Math.min(2400, len * 70));
        let acc = 0; const frames = o.pts.map((q, i) => { if (i) acc += Math.hypot(q[0] - o.pts[i - 1][0], q[1] - o.pts[i - 1][1]); return { left: q[0] + "%", top: q[1] + "%", offset: len ? acc / len : i / (o.pts.length - 1) }; });
        el.animate(frames, opt(dur, { easing: "ease-in-out" }));
      } else if (o.k === "in") el.animate([{ opacity: 0, transform: base + " scale(.4)" }, { opacity: 1, transform: base + " scale(1)" }], opt(380));
      else if (o.k === "show") el.animate([{ opacity: 0 }, { opacity: 1 }], opt(200));
      else if (o.k === "grow") el.animate([{ opacity: 0, transform: base + " scale(.2)" }, { opacity: 1, transform: base + " scale(1)" }], opt(650));
      else if (o.k === "fade") el.animate([{ opacity: 1 }, { opacity: getComputedStyle(el).opacity }], opt(350));
      else if (o.k === "pop") el.animate([{ opacity: 0, transform: base + " scale(.2)" }, { opacity: 1, transform: base + " scale(1.25)", offset: 0.6 }, { opacity: 1, transform: base + " scale(1)" }], opt(520));
      else if (o.k === "draw") el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], opt(700, { easing: "ease-out" }));
      else if (o.k === "cam") el.animate([{ width: o.from.w + "%", transform: `translate(${o.from.tx}%,${o.from.ty}%)` }, { width: o.to.w + "%", transform: `translate(${o.to.tx}%,${o.to.ty}%)` }], { duration: 850, easing: "ease-in-out", fill: "backwards" });
    });
  }

  // ----- 배우기: 단원 → ① 애니메이션 장면 → ② 확인 문제 → ③ 정리 -----
  function renderLearn(V) {
    const T = S.ui.tut || {};
    const units = V.units;
    const unitScore = (un) => { const sc = (S.ui.dScore || {}); const ok = un.drills.filter((id) => sc[id]).length; return { ok, n: un.drills.length }; };
    if (!T.u) {
      // 포지션별 배우기: 라인마다 해야 할 행동을 단원으로. 단원의 pos = 해당 포지션들
      const POS = [["T", "탑"], ["J", "정글"], ["M", "미드"], ["A", "원딜"], ["S", "서폿"]];
      const pos = POS.some(([k]) => k === S.ui.lPos) ? S.ui.lPos : "T";
      const list = units.filter((un) => (un.pos || []).includes(pos));
      const cards = list.map((un, i) => { const sc = unitScore(un); const fin = (S.ui.tutDone || {})[un.id];
        return `<button class="lu ${fin ? "fin" : ""}" data-act="tunit" data-v="${un.id}"><span class="lu-n">${fin ? ico("shield") : i + 1}</span><span class="lu-b"><b>${esc(un.title)}</b><span>${esc(un.goal)}</span><span class="lu-p"><i style="width:${sc.n ? (sc.ok / sc.n) * 100 : 0}%"></i></span><small>${fin ? "완료" : `장면 ${un.scenes.length}개 · 문제 ${sc.n}개 · 맞힘 ${sc.ok}`}${un.src ? ` · ${esc(un.src)}` : ""}</small></span></button>`; }).join("");
      return `<section class="card vbox"><div class="now-h"><span class="what">배우기</span><span class="step">포지션을 고르고 단원을 누르면 맵 위 애니메이션으로 한 장면씩 → 확인 문제 → 정리</span></div>
        <div class="vctl">${vseg("lpos", pos, POS, "포지션")}</div>
        <div class="lus">${cards || `<p class="dim">이 포지션 단원이 아직 없습니다.</p>`}</div></section>`;
    }
    const un = units.find((x) => x.id === T.u);
    const steps = [["learn", "① 장면 보기"], ["quiz", "② 문제"], ["review", "③ 정리"]];
    const stepBar = `<ol class="lsteps">${steps.map(([k, n]) => `<li class="${T.step === k ? "on" : ""}">${n}</li>`).join("")}</ol>`;
    const top = `<div class="lhead"><button class="btn sm ghost" data-act="tback">← 단원 목록</button><b>${esc(un.title)}</b><span class="dim">${esc(un.goal)}</span></div>${stepBar}`;
    let body = "";
    if (T.step === "learn") {
      const n = un.scenes.length, k = Math.min(Math.max(0, T.k || 0), n - 1);
      const sc = un.scenes[k], prev = T.pk != null && T.pk >= 0 && T.pk < n ? un.scenes[T.pk] : null;
      const dots = un.scenes.map((_, i) => `<button class="sc-dot ${i === k ? "on" : i < k ? "seen" : ""}" data-act="tscene" data-k="${i}" aria-label="장면 ${i + 1}" ${i === k ? 'aria-current="step"' : ""}></button>`).join("");
      body = `<div class="sc-wrap">${stageHtml({ ...sc, ph: sc.ph != null ? sc.ph : un.ph, waves: sc.waves || un.waves }, prev ? { ...prev, ph: prev.ph != null ? prev.ph : un.ph, waves: prev.waves || un.waves } : prev)}
        <div class="sc-cap"><div class="sc-cap-h"><span class="sc-n">${k + 1} / ${n}</span><b>${esc(sc.cap)}</b></div><p>${esc(sc.say)}</p>
          <div class="sc-meta">${sc.t != null ? vlink(V, sc.t) : sc.refs ? refLinks(V, sc.refs) : `<span class="dim">영상 밖 기본 원칙</span>`}${sc.approx ? `<span class="dim">그림 자리는 대략 — 정확한 자리는 영상에서</span>` : ""}</div>
          <div class="sc-dots" role="group" aria-label="장면">${dots}</div>
          <div class="dnav"><button class="btn sm ghost" data-act="tscene" data-k="${k - 1}" ${k ? "" : "disabled"}>이전</button><button class="ib btn sm ghost" data-act="treplay" aria-label="다시 보기" title="다시 보기">${ico("replay")}</button>${k < n - 1 ? `<button class="btn sm primary" data-act="tscene" data-k="${k + 1}">다음 장면</button>` : `<button class="btn sm primary" data-act="tstart">문제 풀기 (${un.drills.length}문제)</button>`}</div></div></div>`;
    } else if (T.step === "quiz") {
      const q = T.queue || un.drills, k = Math.min(T.k || 0, q.length - 1);
      const d = drillById(q[k]);
      const answered = (S.ui.ans || {})[d.id] != null;
      body = `<p class="lprog">${T.retry ? "틀린 문제 다시 · " : ""}${k + 1} / ${q.length}</p>${drillCard(V, d, "")}
        <div class="dnav">${answered ? `<button class="btn sm primary" data-act="tnext">${k < q.length - 1 ? "다음 문제" : "정리 보기"}</button>` : `<span class="dim">보기를 하나 고르세요</span>`}</div>`;
    } else {
      const res = un.drills.map((id) => ({ d: drillById(id), ok: !!(S.ui.dScore || {})[id] }));
      const wrong = res.filter((r) => !r.ok);
      body = `<p class="lsum ${wrong.length ? "no" : "ok"}">${wrong.length ? `${res.length}문제 중 ${res.length - wrong.length}개 맞힘 — 틀린 ${wrong.length}문제를 다시 풀면 단원 완료` : `${res.length}문제 모두 맞힘 — 단원 완료`}</p>
        <ol class="lres">${res.map((r) => `<li class="${r.ok ? "ok" : "no"}">${ico(r.ok ? "shield" : "alert")}<span>${esc(r.d.title)}</span></li>`).join("")}</ol>
        <div class="dnav">${wrong.length ? `<button class="btn sm primary" data-act="tretry">틀린 문제 다시 (${wrong.length})</button><button class="btn sm ghost" data-act="tlearn">장면 다시 보기</button>`
          : `${units.indexOf(un) < units.length - 1 ? `<button class="btn sm primary" data-act="tunit" data-v="${units[units.indexOf(un) + 1].id}">다음 단원</button>` : ""}<button class="btn sm ghost" data-act="tback">단원 목록</button>`}</div>`;
    }
    return `<section class="card vbox drill">${top}${body}</section>`;
  }

  // ----- 한눈에 보기: 게임 흐름 순서대로 "언제 · 어디 · 왜" — 번호를 누르면 지도에서 강조, 「장면 보기」는 그 애니메이션으로 -----
  function renderSummary(V) {
    const u = S.ui;
    const side = (u.vSide && u.vSideBase === S.draft.ourSide ? u.vSide : S.draft.ourSide) || "B";
    const pos = (sp) => (side === "B" ? { x: sp.x, y: sp.y } : redXY(sp.x, sp.y));
    const order = ["lv1", "lane", "back", "mid", "obj"];
    const ls = V.lessons.slice().sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase) || a.t - b.t);
    const used = [...new Set(ls.map((l) => l.spot))].map((id) => V.spots.find((s) => s.id === id));
    const marks = used.map((sp) => { const p = pos(sp), ctrl = ls.some((l) => l.spot === sp.id && l.type === "ctrl");
      return `<button class="vm ${ctrl ? "t-ctrl" : ""} ${u.vSpot === sp.id ? "sel" : ""} ${sp.approx ? "approx" : ""}" style="left:${p.x}%;top:${p.y}%" data-act="vspot" data-id="${sp.id}" aria-label="${sp.id}번 ${esc(sp.name)}">${sp.id}</button>`; }).join("");
    const base = side === "B" ? `<span class="vbase ours" style="left:9%;top:91%">우리</span><span class="vbase theirs" style="left:91%;top:9%">상대</span>` : `<span class="vbase ours" style="left:91%;top:9%">우리</span><span class="vbase theirs" style="left:9%;top:91%">상대</span>`;
    const rows = order.map((ph) => {
      const items = ls.filter((l) => l.phase === ph);
      if (!items.length) return "";
      const P = V.phases.find((p) => p.id === ph);
      return `<li class="sm-grp"><div class="sm-h"><b>${esc(P.name)}</b><span>${esc(P.time)}</span></div><ol class="sm-list">${items.map((l) => { const sp = V.spots.find((s) => s.id === l.spot);
        return `<li class="sm-row ${u.vSpot === l.spot ? "sel" : ""}"><button class="vm ${l.type === "ctrl" ? "t-ctrl" : ""}" data-act="vspot" data-id="${l.spot}" aria-label="${l.spot}번 지도에서 보기">${l.spot}</button>
          <div class="sm-b"><b>${esc(l.title)}</b><span class="sm-k"><em>언제</em>${esc(l.when)}</span><span class="sm-k"><em>어디</em>${esc(sp.name)} · ${l.type === "ctrl" ? "제어 와드" : "와드"}${sp.approx ? " · 대략 자리" : ""}</span><span class="sm-k"><em>왜</em>${esc(l.text)}</span>
          <span class="sm-act">${l.go ? `<button class="btn sm" data-act="tgo" data-u="${l.go[0]}" data-k="${l.go[1]}">장면 보기</button>` : ""}${vlink(V, l.t)}</span></div></li>`; }).join("")}</ol></li>`;
    }).join("");
    return `<section class="card vbox">
      <div class="now-h"><span class="what">한눈에 보기</span><span class="step">게임 흐름 순서 · 번호를 누르면 지도에서 표시 · 「장면 보기」는 애니메이션으로</span></div>
      <div class="vctl">${vseg("vside", side, [["B", "블루"], ["R", "레드"]], "진영")}<span class="dim">출처 <a href="${V.source.url}" target="_blank" rel="noopener">${esc(V.source.author)} · ${esc(V.source.title)}</a></span></div>
      <div class="vgrid"><div class="vmap"><img src="${MAP_IMG()}" alt="소환사의 협곡 미니맵" loading="lazy">${(() => { const sp = used.find((q) => q.id === u.vSpot); if (!sp) return ""; const p = pos(sp); return visCanvas("sm-vcan", "", { x: p.x, y: p.y, r: 900, s: "b" }); })()}${base}${marks}</div><ol class="sm-groups">${rows}</ol></div>
      <p class="vkey"><span><i class="vm"></i>와드</span><span><i class="vm t-ctrl"></i>분홍 테두리 = 제어 와드</span><span><i class="vm approx"></i>점선 = 대략 자리(정확한 자리는 영상)</span></p>
    </section>`;
  }

  const phaseOf = (d) => d.ph != null ? d.ph : window.WORLD ? window.WORLD.phaseOf(d.time) : "";
  // 문제 한 장: 상황(시점·양 팀 레벨·아이템) → 질문 → 고르기 → 왜 맞고 틀린지
  function drillParts(V, d, numLabel) {
    const ans = (S.ui.ans || {})[d.id];
    const P = { stage: "", opts: "", notes: "" };
    const done = ans != null;
    const teamRow = (arr, cls) => `<div class="dteam ${cls}">${arr.map(([id, lv, it]) => `<span class="dch">${icon(id, "sm")}<b>${esc(CH[id].ko)}</b><span class="dlv">${lv}레벨</span><span class="dit">${esc(it)}</span></span>`).join("")}</div>`;
    const optCls = (o, i) => !done ? "" : o.ok ? "ok" : i === ans ? "no" : "";
    const optList = (wide) => `<ol class="dopts ${wide ? "wide" : ""}">${d.opts.map((o, i) => `<li><button class="dopt ${optCls(o, i)}" data-act="dans" data-id="${d.id}" data-i="${i}" ${done ? "disabled" : ""}><b>${"ABCD"[i]}</b><span>${esc(o.t)}${done ? `<small>${esc(o.why)}</small>` : ""}</span></button></li>`).join("")}</ol>`;
    let body;
    if (d.scene) {
      // 상황 그림(실제 맵·실제 거리): 고르기 전 = 상황, 고른 뒤 = 그 선택으로 벌어지는 일을 애니메이션으로
      const base = { ...d.scene, ph: d.scene.ph != null ? d.scene.ph : phaseOf(d), a: { ...(d.scene.a || {}) }, w: { ...(d.scene.w || {}) }, fitPts: d.opts.filter((o) => o.x != null).map((o) => [o.x, o.y]) };
      const pinned = d.opts.every((o) => o.x != null);
      if (done && d.kind === "pos" && d.scene.me) base.a.me = { c: d.scene.me, s: "us", at: [d.opts[ans].x, d.opts[ans].y], me: 1 };
      let sc = base, prev = null;
      if (done && d.opts[ans].after) {
        const af = d.opts[ans].after; const a = { ...base.a };
        Object.entries(af.a || {}).forEach(([id, t]) => { a[id] = { ...(a[id] || {}), ...t }; });
        const w = { ...base.w }; Object.entries(af.w || {}).forEach(([id, t]) => { w[id] = t; });
        sc = { ...base, a, w, p: af.p, hit: af.hit, l: af.l || base.l, z: [...(base.z || []), ...(af.z || [])], waves: af.waves ? { ...(base.waves || {}), ...af.waves } : base.waves };
        prev = base;
      }
      const pins = pinned ? d.opts.map((o, i) => `<button class="dpin sc-pin ${optCls(o, i)}" style="left:${o.x}%;top:${o.y}%" data-act="dans" data-id="${d.id}" data-i="${i}" ${done ? "disabled" : ""} aria-label="${"ABCD"[i]} ${esc(o.t)}">${"ABCD"[i]}</button>`).join("") : "";
      const note = d.scene.note || (d.kind === "pos" ? "그림의 거리는 게임 거리 비율 그대로 · 빨간 원 = 말파이트 궁이 닿는 범위(사거리 1,000 + 충격 325)" : "");
      P.stage = stageHtml(sc, prev, { pins, cls: "dmap-pos" }); P.opts = optList(false);
      P.notes = `${note ? `<p class="help sc-note">${esc(note)}</p>` : ""}${done ? "" : `<p class="help sc-note">고르면 그 선택으로 벌어지는 일이 그림에서 움직입니다</p>`}`;
      body = `<div class="dgrid">${P.stage}${P.opts}</div>${P.notes}`;
    } else if (d.kind === "map") {
      // 와드 위치 문제도 같은 그림(전체 미니맵 + 확대·축소): 양 팀 위치, 이미 박힌 와드, 보기 핀. 맞힌 뒤 정답 와드의 실제 시야
      const xs = d.opts.map((o) => o.x), ys = d.opts.map((o) => o.y);
      const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 12;
      const focus = d.view || [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2, Math.min(100, Math.max(14, span))];
      const a = {};
      (d.pos ? [...d.pos.us.map((c) => [c, "us"]), ...d.pos.them.map((c) => [c, "them"])] : []).forEach(([[id, x, y, f], side], i) => { a[`${side}${i}`] = { c: id, s: side, at: [x, y], ...(f === "?" ? { fog: 1 } : {}) }; });   // 넷째 칸 "?" = 시야 밖(예상 위치)
      const w = {};
      (d.wards || []).forEach((q, i) => { w[`pw${i}`] = { at: q.at, k: q.k, s: q.s }; });
      const okO = d.opts.find((o) => o.ok);
      if (done) w.ans = { at: [okO.x, okO.y], k: "ward", s: "us", d: 0.2 };
      const labs = (d.wards || []).map((q) => ({ at: [q.at[0], q.at[1] - 1.6], t: q.t, k: q.s === "them" ? "bad" : "" }));
      const sc = { cam: focus, a, w, l: labs, fitPts: d.opts.map((o) => [o.x, o.y]), cap: d.q, ph: phaseOf(d), autoFog: 1, waves: d.waves, gone: d.gone };
      const pins = d.opts.map((o, i) => `<button class="dpin sc-pin ${optCls(o, i)}" style="left:${o.x}%;top:${o.y}%" data-act="dans" data-id="${d.id}" data-i="${i}" ${done ? "disabled" : ""} aria-label="${"ABCD"[i]} ${esc(o.t)}">${"ABCD"[i]}</button><span class="dpin-l" style="left:${o.x}%;top:${o.y}%" aria-hidden="true">${esc(o.t)}</span>`).join("");
      P.stage = stageHtml(sc, done ? { ...sc, w: Object.fromEntries(Object.entries(w).filter(([k]) => k !== "ans")) } : null, { pins, cls: "dmap-pos" }); P.opts = optList(false);
      P.notes = `<p class="help sc-note">기본은 전체 미니맵 · 「장면 확대」나 ＋로 가까이 · 어두운 곳 = 우리 시야 밖${d.wards && d.wards.length ? " · 빨간 영역 = 이미 박힌 상대 와드가 보는 곳" : ""}</p>`;
      body = `<div class="dgrid">${P.stage}${P.opts}</div>
        ${P.notes}`;
    } else {
      P.opts = optList(true);
      body = P.opts;
    }
    const verdict = done ? (d.opts[ans].ok ? `<p class="dres ok">맞음 — ${esc(d.opts[ans].why)}</p>` : `<p class="dres no">아쉬움 — 정답은 ${"ABCD"[d.opts.findIndex((o) => o.ok)]}. ${esc(d.opts.find((o) => o.ok).why)}</p>`) : "";
    const red = d.side === "R";
    const sides = d.kind === "map" ? `<span class="dside ${red ? "r" : "b"}">우리 = ${red ? "레드(오른쪽 위)" : "블루(왼쪽 아래)"}</span><span class="dside ${red ? "b" : "r"}">상대 = ${red ? "블루(왼쪽 아래)" : "레드(오른쪽 위)"}</span>` : "";
    P.src = d.src != null ? vlink(V, d.src) : d.refs ? refLinks(V, d.refs) : `<span class="dim">기본 원칙</span>`;
    P.head = `<div class="dhead"><span class="pill">${esc(d.cat)}</span><b>${numLabel ? esc(numLabel) + " " : ""}${esc(d.title)}</b><span class="dmeta">${ico("eye")}${esc(d.time)}${d.obj ? " · " + esc(d.obj) : ""}</span>${P.src}</div>`;
    P.sides = `<div class="dsides">${sides}${d.when ? `<span class="dwhen"><b>언제</b> ${esc(d.when)}</span>` : ""}</div>`;
    P.teams = `<div class="dteams"><div><span class="dt-l ${red ? "r" : "b"}">우리${d.kind === "map" ? " · " + (red ? "레드" : "블루") : ""}</span>${teamRow(d.us, "us")}</div><div><span class="dt-l ${red ? "b" : "r"}">상대${d.kind === "map" ? " · " + (red ? "블루" : "레드") : ""}</span>${teamRow(d.them, "them")}</div></div>`;
    P.note = d.note ? `<div class="dnote" role="note"><b class="dnote-h">상황</b>${Array.isArray(d.note) ? `<ul>${d.note.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : `<p>${esc(d.note)}</p>`}</div>` : "";
    P.q = `<p class="dq">${esc(d.q)}</p>`;
    P.verdict = verdict; P.body = body; P.done = done;
    return P;
  }
  function drillCard(V, d, numLabel) {
    const P = drillParts(V, d, numLabel);
    return `${P.head}
      ${P.sides}
      ${P.teams}
      ${P.note}
      ${P.q}${P.body}${P.verdict}`;
  }
  // PC A: 왼쪽 큰 지도 · 오른쪽 위에서 아래로 질문 → 상황 → 선택지 → 풀이 → 넘기기. 지도가 없는 문제는 상황을 왼쪽에
  function drillPC(V, d, meta, nav) {
    const P = drillParts(V, d, "");
    const right = `<div class="vz-r"><span class="vz-meta">${meta}<span class="dmeta">${ico("eye")}${esc(d.time)}${d.obj ? " · " + esc(d.obj) : ""}</span></span>
      <h2 class="vz-q">${esc(d.q)}</h2><span class="vz-t">${esc(d.title)}</span>
      ${P.sides}${P.stage ? P.teams + P.note : ""}${P.opts}${P.verdict ? `<div class="vz-v">${P.verdict}<span class="vz-src">${P.src}</span></div>` : ""}<div class="dnav vz-nav">${nav}</div></div>`;
    const left = P.stage ? `<div class="vz-l">${P.stage}${P.notes}</div>` : `<div class="vz-l vz-txt">${P.teams}${P.note}</div>`;
    return `<section class="vz drill">${left}${right}</section>`;
  }
  // 문제 모음: 종류별로 차례대로
  // 문제 종류: 와드·한타·포지셔닝·운영(조합별·불리·유리·오브젝트)
  const DCATS = [["와드", "와드·시야", "어디에 박고, 왜 거기인가"], ["한타", "한타", "싸울지·피할지, 숫자와 체력"], ["포지셔닝", "포지셔닝", "실제 거리로 서는 자리"],
    ["운영:조합", "운영 · 조합별", "사이드 조합·한타 조합의 운영"], ["운영:불리", "운영 · 불리할 때", "버티고 바꿔 먹는 선택"], ["운영:유리", "운영 · 유리할 때", "이득을 굴려 끝내는 선택"], ["운영:오브젝트", "운영 · 오브젝트", "유충·전령·용·바론 판단"],
    ["운영:라인", "운영 · 쌓여도 밀면 안 될 때", "정보·점멸·오브젝트·인원을 보고 참기"], ["운영:모름", "운영 · 적 위치를 모를 때", "안 보이는 적은 우리 쪽으로 온다고 가정"]];
  const dcatOf = (d) => (d.cat === "운영" ? `운영:${d.sub}` : d.cat);
  function renderDrill(V) {
    const D = allDrills(), u = S.ui, score = u.dScore || {};
    const cat = DCATS.some(([k]) => k === u.dCat) ? u.dCat : "";
    if (!cat) {
      const cards = DCATS.map(([k, n, g], i) => { const ds = D.filter((d) => dcatOf(d) === k); if (!ds.length) return ""; const ok = ds.filter((d) => score[d.id]).length;
        return `<button class="lu" data-act="dcat" data-v="${k}"><span class="lu-n">${i + 1}</span><span class="lu-b"><b>${esc(n)}</b><span>${esc(g)}</span><span class="lu-p"><i style="width:${(ok / ds.length) * 100}%"></i></span><small>문제 ${ds.length}개 · 맞힘 ${ok}</small></span></button>`; }).join("");
      const right = Object.values(score).filter(Boolean).length;
      return `<section class="card vbox"><div class="now-h"><span class="what">문제 모음</span><span class="step">종류를 고르면 미니맵과 상황을 보고 선택 · 고른 뒤 그 선택으로 벌어지는 일이 움직입니다 · 맞힘 ${right} / ${D.length}</span></div>
        <div class="lus">${cards}</div>${Object.keys(score).length ? `<div class="dnav" style="margin-top:12px"><button class="btn sm ghost" data-act="dreset">점수 지우기</button></div>` : ""}</section>`;
    }
    const pool = D.filter((d) => dcatOf(d) === cat);
    const k = Math.min(u.dIdx || 0, pool.length - 1), d = pool[k];
    const name = DCATS.find(([x]) => x === cat)[1];
    return `<section class="card vbox drill">
      <div class="lhead"><button class="btn sm ghost" data-act="dcat" data-v="">← 문제 종류</button><b>${esc(name)}</b><span class="dim">${k + 1} / ${pool.length}</span></div>
      ${drillCard(V, d, `${k + 1}.`)}
      <div class="dnav"><button class="btn sm" data-act="dprev" ${k ? "" : "disabled"}>이전</button>${k < pool.length - 1 ? `<button class="btn sm primary" data-act="dnext">다음 문제</button>` : `<button class="btn sm primary" data-act="dcat" data-v="">종류 목록으로</button>`}${(u.ans && u.ans[d.id] != null) ? `<button class="btn sm ghost" data-act="dretry" data-id="${d.id}">다시 풀기</button>` : ""}</div>
    </section>`;
  }

  // ---------- 휴대폰 화면(모바일 시안 A, 2026-11-19) ----------
  // 한 화면 = 한 가지 일. 화면 자체는 아래로 스크롤하지 않고, 긴 목록은 가로로 넘기거나 쪽을 넘기거나 아래 시트 안에서만.
  // 하단 탭: 전략 · 벤픽 · 상대 · 노트 + 「⋯」(팀 고르기·세트 조작·시야 공부·데이터)
  const MV = { more: false };
  const DOTS = `<svg class="ico-dots" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`;
  const QS = { 420: "솔랭", 440: "자랭", 400: "일반", 430: "일반", 490: "빠른 대전", 450: "칼바람", 0: "사설방" };
  const lvKo = (e) => (e.one ? "원챔" : LEVEL_KO[e.lv] || "");
  const topPool = (t, r, n) => (t && !t.solo ? Object.entries(E.poolMap(t, r)).sort((a, b) => E.lvScore(b[1]) - E.lvScore(a[1])).slice(0, n) : []);
  const uniq = (a) => [...new Set(a)];
  // 라인 칩 한 줄(전체·탑·정글·미드·원딜·서폿)
  function laneChips(act, cur, label, opts) {
    const o = opts || {};
    const items = (o.noAll ? [] : [["", "전체"]]).concat(ROLES.map((r) => [r, ROLE_KO[r]]));
    return `<div class="mv-chips" role="group" aria-label="${label}">${items.map(([r, n]) => `<button class="mv-chip" data-act="${act}" data-r="${r}" aria-pressed="${cur === r}" ${o.dis && r && o.dis(r) ? "disabled" : ""}>${n}</button>`).join("")}</div>`;
  }
  const mvPager = (act, key, page, pages, extra) => `<div class="mv-pager">${pages > 1 ? `<button class="btn sm ghost" data-act="${act}" data-k="${key}" data-p="${page - 1}" ${page > 1 ? "" : "disabled"} aria-label="이전 쪽">◀</button>
    <span class="mv-pg">${page} / ${pages}</span><button class="btn sm ghost" data-act="${act}" data-k="${key}" data-p="${page + 1}" ${page < pages ? "" : "disabled"} aria-label="다음 쪽">▶</button>` : ""}${extra || ""}</div>`;
  const pageOf = (key, n, per) => { const pages = Math.max(1, Math.ceil(n / per)); return [Math.min(Math.max(1, ((S.ui.gPage || {})[key]) || 1), pages), pages]; };

  // ---- 실시간 벤픽 ----
  function mvSlot(i, who, planned) {
    const s = S.draft.steps[i];
    const now = i === S.draft.idx;
    if (!s.champ) {
      const pr = who === "our" && planned ? planned[i] : null;
      return `<div class="mv-s empty ${now ? "now" : ""}"><span>${now ? (pr ? ROLE_KO[pr] + "?" : "선택 중") : pr ? ROLE_KO[pr] : "대기"}</span></div>`;
    }
    const ep = s.role === "?" ? E.picks(S, who).find((x) => x.i === i) : null;
    const unk = who === "enemy" || s.role === "?" ? `<option value="?" ${s.role === "?" ? "selected" : ""}>${ep && ep.role ? ROLE_KO[ep.role] + "?" : "모름"}</option>` : "";
    return `<div class="mv-s f">${icon(s.champ, "mv")}<select data-act="role" data-i="${i}" aria-label="${esc(CH[s.champ].ko)} 라인">${unk}${ROLES.map((r) => `<option value="${r}" ${r === s.role ? "selected" : ""}>${ROLE_KO[r]}</option>`).join("")}</select></div>`;
  }
  const DOCK_M = [["comps", "조합"], ["threat", "요주의"], ["prac", "연습 픽"], ["strat", "전략"], ["series", "저장"]];
  function renderPracticeM() {
    const html = renderPractice();
    if (!html) return "";
    const r = S.ui.mPr || (S.ui.predRole && ROLES.includes(S.ui.predRole) ? S.ui.predRole : "T");
    return `${laneChips("mpr", r, "상대 라인", { noAll: true })}<div class="mv-prac" data-show="${r}">${html}</div>`;
  }
  function renderDockM() {
    const key = S.ui.dock && S.ui.dockAt === S.draft.idx && DOCK_M.some((d) => d[0] === S.ui.dock) ? S.ui.dock : dockAuto();
    const body = { comps: renderLiveComps, threat: () => renderThreat(true), prac: renderPracticeM, strat: renderStrategy, series: () => renderFearless() + renderSaved() }[key]();
    const auto = dockAuto();
    const tabs = DOCK_M.map(([k, n]) => `<button role="tab" data-act="dock" data-k="${k}" aria-selected="${k === key}">${n}${k === auto && k !== key ? `<span class="dk-dot" aria-label="지금 차례 추천"></span>` : ""}</button>`).join("");
    return `<section class="mv-dock" aria-label="밴픽 도움 정보"><div class="mv-dtabs" role="tablist">${tabs}</div>
      <div class="mv-dbody">${body || `<p class="help">${esc((DOCK_M.find((d) => d[0] === key) || ["", ""])[1])} — 지금 보여 줄 내용이 없습니다.</p>`}</div></section>`;
  }
  function renderLiveM() {
    const plan = E.pickPlan(S, "our");
    const planned = {};
    plan.plan.forEach((p) => p.items.forEach((x) => !x.done && x.role && (planned[x.i] = x.role)));
    const st = curStep();
    const who = st ? E.whoOfSide(S, st[0]) : null;
    const ourSide = S.draft.ourSide, enSide = ourSide === "B" ? "R" : "B";
    const turn = st ? `${who === "our" ? "우리" : "상대"} ${st[1] === "ban" ? "밴" : "픽"}` : "밴픽 완료";
    const row = (w, side) => `<div class="mv-row ${side}"><span class="mv-who">${w === "our" ? "우리" : "상대"}</span><div class="mv-picks">${sideIdx(side, "pick").map((i) => mvSlot(i, w, planned)).join("")}</div></div>`;
    const bans = (side) => `<span class="mv-bset ${side}" aria-label="${side === ourSide ? "우리" : "상대"} 밴">${sideIdx(side, "ban").map((i) => { const s = S.draft.steps[i];
      return `<span class="mv-b ${i === S.draft.idx ? "now" : ""}">${s.champ ? icon(s.champ, "sm") : s.skip ? "–" : ""}</span>`; }).join("")}</span>`;
    let act;
    if (S.ui.endAsk) act = `<span class="mv-ask">${S.series.game}세트 결과</span><button class="btn res-w" data-act="endGame" data-v="W">승</button><button class="btn res-l" data-act="endGame" data-v="L">패</button><button class="btn ghost" data-act="endCancel">취소</button>`;
    else if (!st) act = `<button class="btn primary mv-main" data-act="nextGame">세트 종료 → 다음 세트</button><button class="ib btn" data-act="undo" aria-label="되돌리기" title="되돌리기">${ico("undo")}</button>`;
    else act = `<button class="btn primary mv-main" data-act="sheet">${st[1] === "ban" ? (who === "our" ? "밴할 챔프 고르기" : "상대 밴 기록") : who === "our" ? "챔프 고르기" : "상대 픽 기록"}</button>
      ${st[1] === "ban" ? `<button class="ib btn" data-act="skip" aria-label="넘기기" title="넘기기">${ico("skip")}</button>` : ""}<button class="ib btn" data-act="undo" ${S.draft.idx ? "" : "disabled"} aria-label="되돌리기" title="되돌리기">${ico("undo")}</button>`;
    return `<div class="mv mv-live">
      <header class="mv-h"><span class="pill gold">${S.series.game}세트</span><b class="mv-turn">${st ? S.draft.idx + 1 : 20}/20 · <span class="${st ? st[0] : ""}">${turn}</span></b>
        <span class="mv-sub">${ourSide === "B" ? "블루" : "레드"} · vs ${esc(E.teamOf(S, "enemy").name)}</span><button class="mv-more" data-act="mmore" aria-label="세트·데이터 메뉴" aria-expanded="${MV.more}">${DOTS}</button></header>
      <section class="mv-board" aria-label="밴픽 판">${row("our", ourSide)}${row("enemy", enSide)}<div class="mv-bans"><span>밴</span>${bans(ourSide)}${bans(enSide)}</div></section>
      <section class="mv-now" aria-label="지금 차례 추천">${renderNow()}</section>
      ${renderDockM()}
      <div class="mv-act">${act}</div></div>`;
  }
  // 챔프 고르기 시트: 추천 6 + 그 라인 챔프폭 + 라인 기준 전체(좌우로 넘김), 검색은 이름·초성
  function renderPickM() {
    const st = curStep();
    if (!st) return "";
    const who = E.whoOfSide(S, st[0]), type = st[1];
    const lane = S.ui.role || "";
    const taken = E.taken(S), locked = E.lockedFor(S, who);
    const ok = (id) => CH[id] && !taken.has(id) && !locked.has(id);
    const roleAttr = type === "pick" && who === "our" && lane ? ` data-role="${lane}"` : "";
    const cell = (id, sub) => `<button class="mv-cell" data-act="pick" data-id="${id}"${roleAttr} ${ok(id) ? "" : "disabled"}>${icon(id).replace(/ title="[^"]*"/, "")}<span class="n">${esc(CH[id].ko)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</button>`;
    let rec = type === "ban" ? E.recommendBan(S, who) : who === "our" ? E.recommendPick(S, "our", lane || undefined) : lane ? E.predictRole(S, "enemy", lane) : E.recommendPick(S, "enemy");
    rec = (rec || []).filter((x) => ok(x.id)).slice(0, 6);
    // 우리 픽·상대 밴 → 우리 챔프폭, 상대 픽·우리 밴 → 상대 챔프폭
    const poolT = (type === "pick") === (who === "our") ? E.teamOf(S, "our") : E.teamOf(S, "enemy");
    const pool = lane ? topPool(poolT, lane, 6) : [];
    const done = (r) => type === "pick" && E.picks(S, who).some((p) => p.role === r);
    const title = type === "ban" ? (who === "our" ? "밴할 챔프" : "상대 밴 기록") : who === "our" ? `${lane ? ROLE_KO[lane] + " " : ""}픽 고르기` : `상대 ${lane ? ROLE_KO[lane] + " " : ""}픽 기록`;
    const searching = !!String(S.ui.q || "").trim();
    return `<div class="mv-sheet-bg" data-act="sheet"></div>
      <section class="mv-sheet mv-pick ${searching ? "searching" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <span class="mv-grab" aria-hidden="true"></span>
      <div class="mv-sh-h"><b>${esc(title)}</b><button class="ib btn sm" data-act="sheet" aria-label="닫기" title="닫기">${ico("x")}</button></div>
      <label class="mv-search"><span>검색</span><input id="q" class="input" placeholder="이름·초성 (예: ㅁㅍ)" value="${esc(S.ui.q || "")}" autocomplete="off" enterkeyhint="done"></label>
      ${laneChips("mlane", lane, "라인", { dis: done })}
      ${rec.length ? `<div class="mv-sec mv-rec"><b>추천 · 이 차례</b><div class="mv-cells">${rec.map((x) => cell(x.id)).join("")}</div></div>` : ""}
      ${lane && !poolT.solo ? `<div class="mv-sec mv-pool"><b>${poolT === E.teamOf(S, "our") ? "우리" : "상대"} ${ROLE_KO[lane]} 챔프폭 · 숙련도순</b>${pool.length ? `<div class="mv-cells">${pool.map(([id, e]) => cell(id, lvKo(e))).join("")}</div>` : `<span class="help">챔프폭 없음</span>`}</div>` : ""}
      <div class="mv-sec mv-all"><b class="mv-all-h">${lane ? ROLE_KO[lane] : "전체"} 챔피언 · 좌우로 넘김</b><b class="mv-res-h">검색 결과</b><div class="champs" id="champs">${champButtons()}</div></div>
      </section>`;
  }
  // 「⋯」 메뉴: 팀 고르기 · 세트 조작(벤픽 화면) · 시야 공부 · 데이터
  function renderMoreM() {
    const opts = (sel, excl, soloId) => S.teams.filter((t) => t.id !== excl && !t.solo).map((t) => `<option value="${t.id}" ${t.id === sel ? "selected" : ""}>${esc(t.name)}</option>`).join("")
      + `<optgroup label="팀 자료 없이"><option value="${soloId}" ${sel === soloId ? "selected" : ""}>솔랭·자랭</option></optgroup>`;
    const seg = (act, cur, items) => `<div class="seg">${items.map(([v, n]) => `<button data-act="${act}" data-v="${v}" aria-pressed="${cur === v}">${n}</button>`).join("")}</div>`;
    const live = S.tab === "live";
    return `<div class="mv-sheet-bg" data-act="mmore"></div>
      <section class="mv-sheet mv-menu" role="dialog" aria-modal="true" aria-label="메뉴">
      <span class="mv-grab" aria-hidden="true"></span>
      <div class="mv-sh-h"><b>메뉴</b><button class="ib btn sm" data-act="mmore" aria-label="닫기" title="닫기">${ico("x")}</button></div>
      <div class="mv-teams"><label>우리팀<select id="ourSelM">${opts(S.ourTeam, null, SOLO.our)}</select></label><label>상대<select id="enemySelM">${opts(S.enemyTeam, S.ourTeam, SOLO.enemy)}</select></label></div>
      ${live ? `<div class="mv-mg"><b>${S.series.game}세트</b>
        <div class="mv-ml"><span>우리 진영</span>${seg("side", S.draft.ourSide, [["B", "블루"], ["R", "레드"]])}</div>
        <div class="mv-ml"><span>피어리스</span>${seg("mode", S.series.mode, [["hard", "하드"], ["soft", "소프트"], ["off", "끔"]])}</div>
        <div class="mv-mb"><button class="btn primary" data-act="nextGame">세트 종료</button><button class="btn" data-act="saveSeries">밴픽 저장</button>
          <button class="btn" data-act="resetGame">이번 세트 다시</button><button class="btn ghost" data-act="resetSeries">시리즈 초기화</button></div></div>` : ""}
      <div class="mv-mg">${topCta().replace("btn sm", "btn mv-wide")}</div>
      <div class="mv-mg mv-mb"><button class="btn" data-act="settings">${SPACE && !SPACE.bad ? `설정 · ${esc(SPACE.name || "팀 공간")}` : "설정"}</button><button class="btn ${S.tab === "vision" ? "primary" : ""}" data-act="mvision">시야 공부</button></div>
      <p class="help mv-legal"><a href="/privacy/">개인정보 처리방침</a> · <a href="/terms/">이용약관</a> · <a href="mailto:wonseo151@naver.com">문의</a></p>
      </section>`;
  }

  // ---- 함께 한 경기(쪽마다 3판) ----
  function mvGames(t, mine) {
    const R = window.RECENT;
    const rs = S.ui.rState || {};
    const refresh = mine ? `<button class="ib btn sm g-btn${refreshing ? " busy" : ""}" data-act="grefresh" title="갱신하기 · 우리 팀과 지금 상대" aria-label="갱신하기 · 우리 팀과 지금 상대" ${refreshing ? "disabled" : ""}>${REFRESH_ICO}<span class="sr-only">${refreshing ? "갱신 중" : "갱신하기"}</span></button>` : "";
    const head = (sub) => `<div class="mv-gh"><b>함께 한 경기</b><span class="help" role="status">${sub}</span>${refresh}</div>`;
    const st = R && R.status === "ok" ? E.groupsOf(t) : null;
    if (!st) return head(rs.msg ? esc(rs.msg) : "미확보") + `<p class="help">${R && R.status === "ok" ? "Riot 경기 수집 전이거나 이 팀 자료가 없습니다." : esc(recWhy())}</p>`;
    if (!st.length) return head(rs.msg ? esc(rs.msg) : `0판 · ${esc(md(R.since))} 이후`) + `<p class="help">팀원 2명 이상이 같이 한 경기가 없습니다.</p>`;
    const PER = 3, key = mine ? "ourM" : "enemyM";
    const [page, pages] = pageOf(key, st.length, PER);
    const wins = st.filter((g) => g.win).length, five = st.filter((g) => g.n === 5).length;
    const rows = st.slice((page - 1) * PER, page * PER).map((g) => {
      const picks = ROLES.filter((r) => g.picks[r] && CH[g.picks[r]]);
      const fb = mine ? noteBtns({ k: "riot", key: gameKeyRiot(g), date: g.date, queue: g.queue, n: g.n || 5, win: !!g.win, picks: Object.fromEntries(picks.map((r) => [r, g.picks[r]])) }) : "";
      return `<div class="mv-g ${g.win ? "w" : "l"} ${mine && S.ui.gFocus === gameKeyRiot(g) ? "focus" : ""}" data-gkey="${esc(gameKeyRiot(g))}"><b class="mv-gr">${g.win ? "승" : "패"}</b>
        <span class="mv-gq">${QS[g.queue] || g.queue} ${g.n || 5}인<small>${esc(String(g.date).slice(0, 5).replace("-", "/").replace(/^0/, ""))}</small></span><span class="mv-gi">${picks.map((r) => icon(g.picks[r], "sm")).join("")}</span>${fb}</div>`;
    }).join("");
    return head(rs.msg ? esc(rs.msg) : `${st.length}판 ${wins}승 · 5인 ${five}판`) + `<div class="mv-gl">${rows}</div>` + mvPager("gpage", key, page, pages);
  }

  // ---- 우리팀 전략: 다섯 줄 로스터 + 함께 한 경기 ----
  function renderOurM() {
    const t = team(S.ourTeam);
    const rows = ROLES.map((r) => {
      const p = t.players[r];
      const alt = altsOf(t.id, r).length;
      const top = topPool(t, r, 3);
      return `<div class="mv-pl"><span class="mv-r">${ROLE_KO[r]}</span><div class="mv-pn"><b title="${esc(p.riot)}">${esc(nick(p.riot) || "-")}</b><span>${esc(p.tier || "")}${alt ? ` · 부계정 ${alt}` : ""}</span></div>
        <div class="mv-pc">${top.map(([id, e]) => `<span class="mv-pi">${icon(id, "sm")}<small>${lvKo(e)}</small></span>`).join("") || `<span class="dim">챔프폭 없음</span>`}</div></div>`;
    }).join("");
    return `<div class="mv mv-our">
      <header class="mv-h"><b class="mv-title">${esc(t.name)}</b>${teamSetMenu("our", true)}</header>
      ${flowCard(true)}
      <section class="mv-roster" aria-label="로스터">${t.solo ? noTeamHtml(true) : rows}</section>
      ${t.solo ? "" : `<section class="mv-games" aria-label="함께 한 경기">${mvGames(t, true)}</section>`}</div>`;
  }

  // ---- 상대팀 분석: 선수 카드 넘기기 + 아래 칸 하나 ----
  const EN_M = [["ban", "밴 후보"], ["threat", "요주의"], ["comps", "예상 조합"], ["games", "함께 한 경기"]];
  function renderEnemyM() {
    const ours = team(S.ourTeam), en = team(S.enemyTeam);
    const opts = S.teams.filter((t) => t.id !== S.ourTeam).map((t) => `<option value="${t.id}" ${t.id === en.id ? "selected" : ""}>${esc(t.name)}</option>`).join("");
    const sum = (t) => ROLES.reduce((s, r) => s + (t.players[r].pts || 0), 0);
    const gaps = ROLES.map((r) => ({ r, g: (ours.players[r].pts || 0) - (en.players[r].pts || 0) }));
    const weak = gaps.filter((x) => x.g <= -15).map((x) => ROLE_KO[x.r]), strong = gaps.filter((x) => x.g >= 15).map((x) => ROLE_KO[x.r]);
    const P = E.practiceOf(en);
    const ko = (id) => esc(CH[id].ko);
    const cards = ROLES.map((r, i) => {
      const p = en.players[r];
      const top = topPool(en, r, 3);
      const study = E.laneStudy(ours, en, r);
      const have = uniq(study.flatMap((x) => x.have)).filter((id) => CH[id]).slice(0, 2);
      const risky = uniq(study.flatMap((x) => x.risky)).filter((id) => CH[id]).slice(0, 2);
      const pr = P && P.players[r] ? P.players[r].picks.filter((x) => CH[x.id]).slice(0, 3) : [];
      return `<article class="mv-ec"><div class="mv-ec-h"><span class="mv-r">${ROLE_KO[r]}</span><b>${esc(nick(p.riot) || "-")}</b><span class="help">${esc(p.tier || "")}${p.pts ? ` · ${p.pts}점` : ""}</span><span class="mv-ec-n">${i + 1} / 5</span></div>
        <div class="mv-ec-s"><span class="mv-k">주력</span>${top.length ? `<div class="mv-ec-c">${top.map(([id, e]) => `<span class="mv-cell">${icon(id).replace(/ title="[^"]*"/, "")}<span class="n">${ko(id)}</span><span class="sub">${lvKo(e)}</span></span>`).join("")}</div>` : `<span class="dim">챔프폭·전적 없음</span>`}</div>
        <div class="mv-ec-s"><span class="mv-k">연습 중</span><div class="cpills">${pr.map((x) => `<span class="cp ${x.new ? "gold" : ""}">${ko(x.id)} ${x.g}판${x.new ? " · 새 픽" : ""}</span>`).join("") || `<span class="dim">자료 없음</span>`}</div></div>
        <div class="mv-ec-s"><span class="mv-k">우리 대응</span><div class="cpills">${have.map((id) => `<span class="cp good">${ko(id)}</span>`).join("")}${risky.map((id) => `<span class="cp bad">${ko(id)} 주의</span>`).join("") || (have.length ? "" : `<span class="dim">-</span>`)}</div></div></article>`;
    }).join("");
    const key = EN_M.some(([k]) => k === S.ui.enSecM) ? S.ui.enSecM : "ban";
    let low = "";
    if (key === "ban") {
      const virtual = Object.assign({}, S, { enemyTeam: en.id, draft: { ourSide: "B", steps: emptySteps(), idx: 0 }, series: { game: 1, mode: "off", locked: [] } });
      const pre = E.recommendBan(virtual, "our").slice(0, 3);
      low = pre.length ? `<div class="mv-bcs">${pre.map((x) => { const ps = E.cardPills(en, x.tgt, x.id, x.reasons, true).slice(0, 1);
        return `<div class="mv-bc">${icon(x.id).replace(/ title="[^"]*"/, "")}<b>${ko(x.id)}</b>${x.tgt ? `<span class="help">${ROLE_KO[x.tgt]}</span>` : ""}${pillsHtml(ps)}</div>`; }).join("")}</div>` : `<p class="help">상대 챔프폭을 넣으면 나옵니다.</p>`;
    } else if (key === "threat") low = renderThreatFor(en.id);
    else if (key === "comps" && E.teamHasPools(en)) {
      const theirs = E.teamComps(en).slice(0, 2);
      const ans = Object.keys(COMPS).filter((k) => COMPS[k].beats.includes(theirs[0].key)).map((k) => E.buildComp(ours, k)).sort((a, b) => b.comfort * 3 + b.fitScore - (a.comfort * 3 + a.fitScore))[0];
      low = `<div class="comps">${theirs.map((c, i) => compCard(c, `상대 ${i === 0 ? "주력" : "대안"} · ${COMPS[c.key].name}`, `<span class="pill bad">상대</span>`, true, true)).join("")}${ans ? compCard(ans, `우리 대응 · ${COMPS[ans.key].name}`, `<span class="pill good">연습 추천</span>`, true) : ""}</div>`;
    } else if (key === "games") low = mvGames(en, false);
    return `<div class="mv mv-enemy">
      <header class="mv-h"><label class="mv-esel">상대<select id="enemyPick" aria-label="상대팀">${opts}</select></label>${teamSetMenu("enemy", true)}</header>
      <div class="mv-sum">점수 <b>${sum(ours)} : ${sum(en)}</b> · 우세 <b class="good">${esc(strong.join("·") || "없음")}</b> · 열세 <b class="bad">${esc(weak.join("·") || "없음")}</b></div>
      ${en.solo ? `<p class="help mv-pad">솔랭·자랭 상대는 선수 자료가 없습니다.</p>` : `<section class="mv-ecs" aria-label="상대 선수 카드 · 좌우로 넘김">${cards}</section>`}
      <div class="mv-chips mv-pad" role="tablist" aria-label="상대 분석">${EN_M.map(([k, n]) => `<button class="mv-chip" role="tab" data-act="enm" data-k="${k}" aria-selected="${k === key}" aria-pressed="${k === key}">${n}</button>`).join("")}</div>
      <section class="mv-low">${low || `<p class="help">보여 줄 내용이 없습니다.</p>`}</section></div>`;
  }

  // ---- 피드백 노트: 분류 칩 + 쪽마다 3개 ----
  function renderNotesM() {
    const t = team(S.ourTeam);
    const head = (n) => `<header class="mv-h"><b class="mv-title">피드백 노트</b><span class="mv-sub">팀 공유${n != null ? ` · ${n}개` : ""}</span>${noteUrl() ? `<button class="ib btn sm ghost mv-hb" data-act="nrefresh" aria-label="새로고침" title="새로고침">${ico("refresh")}</button>` : ""}</header>`;
    const wrap = (h) => `<div class="mv mv-notes">${h}</div>`;
    if (!noteUrl()) return wrap(head() + `<p class="help mv-pad">${t && t.solo ? "솔랭·자랭 우리팀에는 노트를 쓸 수 없습니다. 「⋯」에서 우리 팀을 고르세요." : "팀 공간에 들어오면 팀원과 노트를 나눕니다 — 「팀 공간」에서 팀을 만들거나 초대 링크로 들어오세요."}</p>`);
    if (NT.status === "error" && !NT.list) return wrap(head() + `<p class="help mv-pad">노트를 불러오지 못했습니다: ${esc(NT.err)} <button class="btn sm" data-act="nrefresh">다시 시도</button></p>`);
    if (!NT.list) return wrap(head() + `<p class="help mv-pad">노트 불러오는 중…</p>`);
    const f = S.ui.nf || {};
    const gsel = f.game ? GAMEREF[f.game] : null;
    const cat = NOTE_CAT.some(([c]) => c === S.ui.nCat) ? S.ui.nCat : "champ";
    const champs = uniq(NT.list.map((n) => n.champ).filter((c) => c && CH[c])).sort((a, b) => CH[a].ko.localeCompare(CH[b].ko, "ko"));
    const base = NT.list.filter((n) => (!f.st || n.kind === (f.st === "good" ? "good" : "fix")) && (!f.champ || n.champ === f.champ) && (!f.game || (gsel ? notesOfGame(gsel).includes(n) : true)))
      .sort((a, b) => String(b.upd || b.at).localeCompare(String(a.upd || a.at)));
    // 경기로 거를 때는 분류 칸을 가리지 않고 그 경기 노트 전부
    const list = f.game ? base : base.filter((n) => n.cat === cat);
    const PER = 3;
    const [page, pages] = pageOf("notesM", list.length, PER);
    const card = (n) => `<article class="ncard mv-nc ${n.kind}"><div class="ncard-h">${n.champ && CH[n.champ] ? icon(n.champ, "sm") : ""}<b>${esc(n.title)}</b>${n.kind === "fix" ? `<span class="pill bad nst">고칠 점</span>` : `<span class="pill good nst">잘한 점</span>`}</div>
      ${n.body ? `<p class="nbody" data-act="nmore">${esc(n.body)}</p>` : ""}
      <div class="ncard-f"><span>${esc((NOTE_WHO.find((w) => w[0] === n.who) || ["", ""])[1])}</span>${n.game ? `<button class="ng" data-act="ngo" data-id="${n.id}" title="이 경기 기록으로 이동">${esc(gameText(n.game))}</button>` : ""}
        <span class="nby">${esc(String(n.at || "").slice(5, 10).replace("-", "/"))}</span><button class="ib btn sm ghost" data-act="nedit" data-id="${n.id}" aria-label="고치기" title="고치기">${ico("pencil")}</button><button class="ib btn sm ghost" data-act="ndel" data-id="${n.id}" aria-label="지우기" title="지우기">${ico("trash")}</button></div></article>`;
    const cats = `<div class="mv-chips mv-pad" role="tablist" aria-label="분류">${NOTE_CAT.map(([c, n]) => `<button class="mv-chip" role="tab" data-act="ncat" data-k="${c}" aria-selected="${!f.game && c === cat}" aria-pressed="${!f.game && c === cat}">${n} <small>${base.filter((x) => x.cat === c).length}</small></button>`).join("")}</div>`;
    const filt = `<div class="mv-nfil mv-pad"><div class="seg" role="group" aria-label="종류">${[["", "전체"], ["fix", "고칠 점"], ["good", "잘한 점"]].map(([v, n]) => `<button data-act="nf" data-k="st" data-v="${v}" aria-pressed="${(f.st || "") === v}">${n}</button>`).join("")}</div>
      ${f.game ? `<button class="btn sm mv-ngame" data-act="nf" data-k="game" data-v="">${esc(gsel ? gameText(gsel) : "선택한 경기")} ×</button>`
      : `<select class="input" data-act="nfc" aria-label="챔프로 거르기"><option value="">챔프 전체</option>${champs.map((c) => `<option value="${c}" ${f.champ === c ? "selected" : ""}>${esc(CH[c].ko)}</option>`).join("")}</select>`}</div>`;
    const items = list.slice((page - 1) * PER, page * PER).map(card).join("") || `<p class="help">노트 없음</p>`;
    return wrap(head(NT.list.length) + cats + filt + (NT.status === "error" ? `<p class="help warn mv-pad">저장 실패: ${esc(NT.err)}</p>` : "")
      + `<section class="mv-nl" aria-label="노트 목록">${items}</section>`
      + mvPager("gpage", "notesM", page, pages, `<button class="btn primary mv-nnew" data-act="nnew" data-cat="${f.game ? "champ" : cat}"${f.game ? ` data-gk="${esc(f.game)}"` : ""}>+ 노트 쓰기</button>`));
  }
  const MOB_VIEW = { live: renderLiveM, our: renderOurM, enemy: renderEnemyM, notes: renderNotesM };

  let lastIdx = -1;
  // 그리는 도중(입력 칸이 사라지며 change·blur가 또 render를 부름) 다시 들어오면 끝난 뒤 한 번 더
  let RENDERING = false, RENDER_AGAIN = false;
  function render() {
    if (RENDERING) { RENDER_AGAIN = true; return; }
    RENDERING = true;
    try { renderInner(); } finally { RENDERING = false; }
    if (RENDER_AGAIN) { RENDER_AGAIN = false; render(); }
  }
  function renderInner() {
    if (typeof hideHover === "function") hideHover();
    if (guest()) {
      if (!GUEST_TABS.includes(S.tab)) S.tab = "live";
      if (S.ourTeam !== SOLO.our) { S.ourTeam = SOLO.our; E.setOurTeam(S.ourTeam); }
      if (S.enemyTeam !== SOLO.enemy) { S.enemyTeam = SOLO.enemy; syncQueue(true); }
    }
    document.documentElement.classList.toggle("guest", guest());
    window.QUEUE_MODE = CFG.queue;   // 티어 기준(설정) → 엔진이 솔랭·자랭 전적 중 무엇을 볼지
    applyTiers();   // 반영 티어·점수 = 계정별 솔랭·자랭 중 기준에 맞는 가장 높은 것
    GPC = undefined;
    // 다시 그려도 옆으로 넘긴 위치는 그대로(차례가 바뀌면 밴픽 설계 띠는 지금 칸으로)
    const keepX = ["ctrack", "gpStrip"].map((id) => [id, (document.getElementById(id) || {}).scrollLeft || 0]);
    renderTop();
    const v = document.getElementById("view");
    const keepFocus = document.activeElement && document.activeElement.id === "q";
    const pos = keepFocus ? document.activeElement.selectionStart : 0;
    const mob = MOB.matches, mobV = mob && MOB_VIEW[S.tab];
    document.body.classList.toggle("mob", mob); document.body.classList.toggle("mv-on", !!mobV);
    document.documentElement.classList.toggle("pc", !mob);
    turnTitle();
    if (!mob) { renderSideNav(); renderHead(); }
    if (!mob) setTimeout(tipIcons, 0);
    const keepEd = !mob && S.tab === "team" ? document.getElementById("setEd") : null;
    const keepEdF = keepEd && keepEd.contains(document.activeElement) ? keepEd : null;
    const edAE = keepEdF ? document.activeElement : null;
    v.innerHTML = mobV ? mobV() : S.tab === "live" ? (mob ? renderLive() : renderLivePC()) : S.tab === "our" ? (mob ? renderOur() : renderOurPC()) : S.tab === "vision" ? (mob ? renderVision() : renderVisionPC()) : S.tab === "notes" ? (mob ? renderNotes() : renderNotesPC()) : S.tab === "import" ? (mob ? renderImport() : renderImportPC()) : S.tab === "settings" ? (mob ? renderSettings() : renderSettingsPC()) : S.tab === "team" ? (mob ? renderSettings() : renderTeamPC()) : (mob ? renderEnemy() : renderEnemyPC());
    if (!mob && S.tab === "team") { const ph = document.getElementById("setEd"); if (ph) { if (keepEdF && keepEdF.dataset.team === setTeamPC()) { ph.replaceWith(keepEdF); if (edAE && keepEdF.contains(edAE)) { const c = edAE.selectionStart; edAE.focus(); try { edAE.setSelectionRange(c, c); } catch (e) { /* select */ } } } else renderEditor(); } }
    // 휴대폰: 챔프 고르기·「⋯」 메뉴는 화면 아래 시트로
    const ms = document.getElementById("msheet") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "msheet" }));
    ms.innerHTML = mob ? (S.tab === "live" && S.ui.sheet ? renderPickM() : "") + (MV.more ? renderMoreM() : "") : "";
    const mb = document.querySelector(".tab-more"); if (mb) { mb.setAttribute("aria-expanded", String(MV.more)); mb.classList.toggle("cur", S.tab === "vision"); }
    keepX.forEach(([id, x]) => { const el = document.getElementById(id); if (el) el.scrollLeft = x; });
    if (lastIdx !== S.draft.idx) { const sp = document.getElementById("gpStrip"), nw = sp && sp.querySelector(".now"); if (sp && nw) sp.scrollLeft = Math.max(0, nw.offsetLeft - 8); lastIdx = S.draft.idx; }
    if (S.tab === "vision") { drawVision(v); runAnims(v); addZoomHint(v); }
    if ((S.tab === "live" || S.tab === "enemy") && !mob) showRecDetail(null);
    if (S.tab === "notes") v.querySelectorAll(".nbody").forEach((p) => { if (p.scrollHeight > p.clientHeight + 2) p.classList.add("clamped"); });
    if (keepFocus) { const q = document.getElementById("q"); if (q) { q.focus(); q.setSelectionRange(pos, pos); } }
  }

  document.addEventListener("click", (ev) => {
    if (TSM.open && !(ev.target.closest && ev.target.closest(".tsm-b"))) { const inside = ev.target.closest && ev.target.closest(".tsm-pop"); TSM.open = ""; if (!inside) { render(); return; } }
    const el = ev.target.closest("[data-act], .tab");
    if (!el) return;
    if (el.classList.contains("tab")) { if (el.tagName === "A") ev.preventDefault(); S.tab = el.dataset.tab; MV.more = false; save(); render(); window.scrollTo(0, 0); if (S.tab === "notes") loadNotes(); return; }
    const a = el.dataset.act;
    if ((a === "close" || a === "nclose") && ev.target !== el && el.classList.contains("modal-bg")) return; // 모달 안쪽 클릭
    switch (a) {
      case "pick": choose(el.dataset.id, el.dataset.role); break;
      case "skip": { const st = curStep(); if (st && st[1] === "ban") { S.draft.steps[S.draft.idx].skip = true; S.draft.idx++; save(); render(); } break; }
      case "undo": if (S.draft.idx > 0) { S.draft.idx--; S.draft.steps[S.draft.idx] = { champ: null, role: null, skip: false }; save(); render(); } break;
      case "resetGame": if (confirm("이번 세트 밴픽을 지울까요?")) { S.draft.steps = emptySteps(); S.draft.idx = 0; save(); render(); } break;
      case "nextGame":   // 결과(승·패)를 고르면 넘어감
        if (!["our", "enemy"].some((w) => E.picks(S, w).length)) { alert("이번 세트에 픽이 없습니다."); break; }
        S.ui.endAsk = true; MV.more = false; render(); break;
      case "endCancel": S.ui.endAsk = false; render(); break;
      case "endGame": {
        const ps = ["our", "enemy"].flatMap((w) => E.picks(S, w).map((p) => ({ id: p.champ, who: w, game: S.series.game })));
        S.ui.endAsk = false;
        if (!ps.length) { render(); break; }
        S.series.games = (S.series.games || []).filter((g) => g.game !== S.series.game).concat([Object.assign(gameRecord(S.series.game), { result: el.dataset.v })]);
        S.series.locked = S.series.locked.concat(ps); S.series.game++;
        S.draft.steps = emptySteps(); S.draft.idx = 0; save(); render(); window.scrollTo(0, 0); break;
      }
      case "savedRes": { const list = loadSaved(), r = list.find((x) => x.sid === el.dataset.sid), g = r && r.games.find((x) => String(x.game) === el.dataset.g);
        if (g) { g.result = g.result === el.dataset.v ? null : el.dataset.v; writeSaved(list); S.ui.savedOpen = r.sid; render(); } break; }
      case "saveSeries": saveSeries(); break;
      case "savedDel": { const list = loadSaved(), r = list.find((x) => x.sid === el.dataset.sid);
        if (r && confirm(`${r.at} · ${r.enemyName} 상대 ${r.games.length}세트 기록을 지울까요?`)) { writeSaved(list.filter((x) => x.sid !== r.sid)); render(); } break; }
      case "resetSeries": if (confirm("시리즈를 초기화할까요? 피어리스 잠금·세트 번호·이번 세트 밴픽이 지워지고, 「밴픽 저장」을 누르지 않은 내용은 남지 않습니다.")) { S.series = { game: 1, mode: S.series.mode, locked: [] }; S.draft.steps = emptySteps(); S.draft.idx = 0; save(); render(); } break;
      case "side": if (S.draft.ourSide !== el.dataset.v) {
        if (S.draft.idx > 0 && !confirm("진영을 바꾸면 이번 세트 밴픽이 지워집니다. 바꿀까요?")) break;
        S.draft.ourSide = el.dataset.v; if (ORDER.kind === "ranked") window.KB.useOrder("ranked", S.draft.ourSide);   // 솔랭·자랭: 우리 밴이 먼저
        S.draft.steps = emptySteps(); S.draft.idx = 0; save(); render(); } break;
      case "mode": S.series.mode = el.dataset.v; save(); render(); break;
      case "frole": S.ui.role = el.dataset.r; save(); render(); break;
      case "onlypool": S.ui.onlyPool = !S.ui.onlyPool; save(); render(); break;
      case "pred": S.ui.predRole = el.dataset.r; render(); break;
      case "ourrole": S.ui.ourRole = el.dataset.r; render(); break;
      case "scen": S.ui.scen = S.ui.scen === el.dataset.k ? "" : el.dataset.k; save(); render(); break;
      case "ensec": S.ui.enSec = el.dataset.k; save(); render(); break;
      case "ecopen": S.ui.enView = "comps"; S.ui.ecf = { mode: S.series.mode || "off", game: Math.min(3, S.series.game || 1), ban: false }; save(); render(); window.scrollTo(0, 0); break;
      case "ecback": S.ui.enView = ""; save(); render(); window.scrollTo(0, 0); break;
      case "ecf": { const f = { ...(S.ui.ecf || {}) }, k = el.dataset.k, v = el.dataset.v; f[k] = k === "mode" ? v : k === "ban" ? v === "1" : Number(v); S.ui.ecf = f; save(); render(); break; }
      case "nnew": { const g = el.dataset.gk ? GAMEREF[el.dataset.gk] : null; openNoteForm({ game: g, cat: el.dataset.cat, who: el.dataset.who }); break; }
      case "nedit": { const n = (NT.list || []).find((x) => x.id === el.dataset.id); if (n) openNoteForm({ note: n }); break; }
      case "ndel": { const n = (NT.list || []).find((x) => x.id === el.dataset.id);
        if (n && confirm(`「${n.title}」 노트를 지울까요? 팀원 모두에게서 지워집니다.`)) sendNote({ op: "delete", id: n.id }).then(render, (e) => { NT.status = "error"; NT.err = String(e.message || e); render(); }); break; }
      case "nstat": { const n = (NT.list || []).find((x) => x.id === el.dataset.id); if (!n) break;
        const next = { todo: "practice", practice: "done", done: "todo" }[n.status] || "todo";
        const { id, at, upd, ...rest } = n;
        sendNote({ op: "update", id, note: { ...rest, status: next } }).then(render, (e) => { NT.status = "error"; NT.err = String(e.message || e); render(); }); break; }
      case "nsave": saveNoteForm(); break;
      case "ngo": { const n = (NT.list || []).find((x) => x.id === el.dataset.id); if (n) goGame(n.game); break; }
      case "nmore": if (el.classList.contains("clamped") || el.classList.contains("open")) el.classList.toggle("open"); break;
      case "nclose": closeNoteForm(); break;
      case "nrefresh": loadNotes(); break;
      case "nf": S.ui.nf = { ...(S.ui.nf || {}), [el.dataset.k]: el.dataset.v }; S.ui.gPage = { ...(S.ui.gPage || {}), notesM: 1 }; render(); break;
      // 휴대폰 화면
      case "ncat": S.ui.nCat = el.dataset.k; S.ui.nf = { ...(S.ui.nf || {}), game: "" }; S.ui.gPage = { ...(S.ui.gPage || {}), notesM: 1 }; save(); render(); break;
      case "enm": S.ui.enSecM = el.dataset.k; save(); render(); break;
      case "mpr": S.ui.mPr = el.dataset.r; render(); break;
      case "mmore": MV.more = !MV.more; render(); break;
      case "mvision": MV.more = false; S.tab = "vision"; save(); render(); window.scrollTo(0, 0); break;
      case "mlane": { const st = curStep(); S.ui.role = el.dataset.r;
        if (st && E.whoOfSide(S, st[0]) === "enemy") S.ui.predRole = el.dataset.r; else S.ui.ourRole = el.dataset.r;
        render(); { const q = document.getElementById("q"); if (q && q.value) q.focus(); } break; }
      case "ngame": S.ui.nf = { game: el.dataset.gk }; S.tab = "notes"; save(); render(); window.scrollTo(0, 0); break;
      case "nfpick": { const w = document.getElementById("nfWho"), c = document.getElementById("nfChamp");
        if (w) w.value = el.dataset.r; if (c && CH[el.dataset.c]) c.value = CH[el.dataset.c].ko; break; }
      case "team": case "tclose": case "tback": case "tcopy": case "tleave": case "trotate": case "tstart": case "tcheck":
        if ((a === "tclose") && ev.target !== el && el.classList.contains("modal-bg")) break;
        teamAction(a); break;
      case "invite": copyInvite(); break;
      case "pickenemy": if (el.dataset.id && team(el.dataset.id)) { S.enemyTeam = el.dataset.id; syncQueue(true); S.tab = "enemy"; MV.more = false; save(); render(); window.scrollTo(0, 0); } break;
      case "gotab": S.tab = el.dataset.k; MV.more = false; save(); render(); window.scrollTo(0, 0); break;
      case "flowhide": S.ui.flowHide = true; save(); render(); break;
      case "nustep": { const st = nuSteps(); S.ui.nuStep = { k: el.dataset.k, at: st.findIndex((x) => !x.done) }; save(); render(); break; }
      case "settings": TSM.open = ""; openSettings(el.dataset.k); checkSpace(); break;
      case "tsm": TSM.open = TSM.open === el.dataset.k ? "" : el.dataset.k; render(); { const f = document.querySelector(".tsm-pop .tsm-i"); if (f && TSM.open) f.focus(); } break;
      case "edsug": case "eduse": edSet(el.dataset.role, el.dataset.k, el.dataset.v); break;
      case "rkfill": { const t = editing && team(editing), p = t && t.players[el.dataset.role]; if (!p) break;
        p.rk = { ...(p.rk || {}), [rkKey(el.dataset.acc)]: { ...(el.dataset.s ? { s: el.dataset.s } : {}), ...(el.dataset.f ? { f: el.dataset.f } : {}) } };
        applyTiers(); save(); shareChanged(editing, el.dataset.role); renderEditor(); render(); break; }
      case "edfill": { const p = editing && team(editing).players[el.dataset.role]; if (p) { p.tier = el.dataset.v; const pv = ptsOf(p.tier); if (pv != null) p.pts = pv; save(); shareChanged(editing, el.dataset.role); renderEditor(); render(); } break; }
      case "setsec": S.ui.setSec = el.dataset.k; save(); render(); break;
      case "setteam": S.ui.setTeam = el.dataset.v; save(); render(); break;
      case "tedit": { const t = team(S.ourTeam); if (!t) break; TE.on = true; TE.snap = JSON.stringify(t); render(); break; }
      case "tcancel": case "tsave": { const t = team(S.ourTeam); if (!t) break;
        const before = TE.snap ? JSON.parse(TE.snap) : null;
        if (el.dataset.act === "tcancel" && before) { const i = S.teams.findIndex((x) => x.id === t.id); if (i >= 0) S.teams[i] = before; }
        const now = team(S.ourTeam);
        TE.on = false; TE.snap = null; editing = null;
        if (S.ui.altOpen) ROLES.forEach((r) => delete S.ui.altOpen[t.id + "|" + r]);   // 비워 둔 부계정 칸은 닫음
        applyTiers(); save(); rosterChanged(); ROLES.forEach((r) => shareChanged(now.id, r));
        // 저장: 계정이 바뀐 라인만 Riot에서 솔랭·자랭 다시 받기
        const accSig = (x, r) => JSON.stringify([((x.players[r] || {}).riot || ""), ((x.players[r] || {}).alts || [])]);
        if (el.dataset.act === "tsave" && before) { const ch = ROLES.filter((r) => accSig(before, r) !== accSig(now, r) || accountsOf(now, r).some(([a]) => !(now.players[r].rk || {})[rkKey(a)])); if (ch.length && SPACE && !SPACE.bad) fetchTiers(ch.map((r) => [now.id, r])); }
        toast(el.dataset.act === "tsave" ? "저장했습니다" : "수정을 취소했습니다"); render(); break; }
      case "delteam": { const t = team(el.dataset.id); if (!t || t.solo || t.id === S.ourTeam) break;
        if (!confirm(`「${t.name}」 팀을 지울까요? 명단·챔프폭 메모가 ${SPACE && !SPACE.bad ? "팀원 모두에게서 " : ""}지워집니다.`)) break;
        S.teams = S.teams.filter((x) => x.id !== t.id);
        if (S.enemyTeam === t.id) { S.enemyTeam = (S.teams.find((x) => !x.solo && x.id !== S.ourTeam) || { id: SOLO.enemy }).id; syncQueue(true); }
        if (S.ui.setEnemy === t.id) S.ui.setEnemy = "";
        if (S.tab === "enemy" && S.enemyTeam === SOLO.enemy) S.tab = "our";
        save(); render(); toast(`「${t.name}」 팀을 지웠습니다`); break; }
      case "lglogin": startLogin(el.dataset.k); break;
      case "lgnew": case "lgjoin": case "lgcode": case "lgleave": case "lgout": case "lgcopy": case "lgdel": authAction(a, el); break;
      case "lgswitch": try { localStorage.setItem("lolban.space.v1", el.dataset.id); } catch (e) { /* 이번만 */ } SPACE = loginSpace(); spaceJoined(); break;
      case "vsopen": S.ui.vsOpen = S.ui.vsOpen === el.dataset.k ? "" : el.dataset.k; renderHead(); { const f = document.querySelector(".vs-pop [aria-selected=true]") || document.querySelector(".vs-pop button"); if (f && S.ui.vsOpen) f.focus(); } break;
      case "vspick": { const id = el.dataset.id; S.ui.vsOpen = "";
        if (el.dataset.k === "our") { S.ourTeam = id; E.setOurTeam(S.ourTeam); if (S.enemyTeam === S.ourTeam) S.enemyTeam = (S.teams.find((x) => x.id !== S.ourTeam && !x.solo) || { id: SOLO.enemy }).id; }
        else S.enemyTeam = id;
        syncQueue(true); save(); render(); break; }
      case "theme": { const t = isDark() ? "light" : "dark"; document.documentElement.dataset.theme = t; try { localStorage.setItem("lolban.theme", t); } catch (e) { /* 이번만 */ } render(); break; }
      case "tqall": { const tid = setTeamPC(); if (tid) fetchTiers(ROLES.map((r) => [tid, r])); break; }
      case "altdel": { const tt = team(el.dataset.team), r = el.dataset.role, k = Number(el.dataset.k); if (!tt) break; const p = tt.players[r];
        const a = (p.alts || altsOf(tt.id, r) || []).slice(); a.splice(k, 1); p.alts = a.filter(Boolean);
        const key = tt.id + "|" + r; S.ui.altOpen = { ...(S.ui.altOpen || {}), [key]: Math.max(0, ((S.ui.altOpen || {})[key] || 0) - 1, p.alts.length) };
        applyTiers(); save(); shareChanged(tt.id, r); renderEditor(); break; }
      case "altadd": { S.ui.altOpen = { ...(S.ui.altOpen || {}), [el.dataset.team + "|" + el.dataset.role]: Number(el.dataset.n) }; renderEditor(); const i = document.querySelector(`#setEd [data-role="${el.dataset.role}"][data-alt="${Number(el.dataset.n) - 1}"]`); if (i) i.focus(); break; }
      case "sharenow": { const tid = setTeamPC(); if (tid) { ROLES.forEach((r) => shareChanged(tid, r)); shareNoteUpdate(); toast("팀원에게 올리는 중…"); } break; }
      case "setback": S.tab = S.ui.setFrom && !["settings", "import"].includes(S.ui.setFrom) ? S.ui.setFrom : "our"; save(); render(); window.scrollTo(0, 0); break;
      case "setq": saveQueue(el.dataset.v); break;
      case "setedit": { const v = (document.getElementById("setEnemy") || {}).value; if (v) { editing = v; renderEditor(); pullShared(); } break; }
      case "goaladd": addGoal(); break;
      case "goaldel": S.ui.goal = { ids: ((S.ui.goal && S.ui.goal.ids) || []).filter((x) => x !== el.dataset.id) }; save(); render(); break;
      case "goalclr": S.ui.goal = { ids: [] }; save(); render(); break;
      case "ctnav": { const tr = document.getElementById("ctrack"); if (tr) { const w = (tr.firstElementChild || {}).offsetWidth || 300; tr.scrollBy({ left: Number(el.dataset.d) * (w + 12), behavior: "smooth" }); } break; }
      case "dock": S.ui.dock = el.dataset.k; S.ui.dockAt = S.draft.idx; render(); break;
      case "grefresh": if (!refreshing) { chainEnemy = true; refreshRecent(false);
        if (SPACE && !SPACE.bad && !TQ.busy) { const en = E.teamOf(S, "enemy"); const list = [team(S.ourTeam), en].filter((x) => x && !x.solo).flatMap((x) => ROLES.map((r) => [x.id, r])); if (list.length) fetchTiers(list, true); } } break;
      case "prefresh": refreshPractice(false); break;
      case "prepedit": PREP.edit = true; PREP.msg = ""; render(); { const d = document.getElementById("prepDate"); if (d) d.focus(); } break;
      case "prepcancel": PREP.edit = false; render(); break;
      case "prepdef": savePrep(PREP.def); break;
      case "prepsave": { const d = document.getElementById("prepDate"); if (d && d.value) savePrep(d.value); break; }
      case "gpage": { S.ui.gPage = { ...(S.ui.gPage || {}), [el.dataset.k]: Number(el.dataset.p) }; save(); render();
        // 새 페이지 첫 줄부터 보이게 표 머리로 올림(상단바·휴대폰 하단 탭에 가리지 않게)
        const pg = [...document.querySelectorAll(".pager")].find((n) => n.querySelector(`[data-k="${el.dataset.k}"]`));
        const card = pg && pg.closest(".card"); if (card && card.getBoundingClientRect().top < 70) card.scrollIntoView({ block: "start" }); break; }
      case "vphase": S.ui.vPhase = el.dataset.v; S.ui.vSpot = null; save(); render(); break;
      case "vside": S.ui.vSide = el.dataset.v; S.ui.vSideBase = S.draft.ourSide; save(); render(); break;
      case "vrole": S.ui.vRole = el.dataset.v; save(); render(); break;
      case "vmode": S.ui.vMode = el.dataset.v; save(); render(); break;
      case "vpurp": S.ui.vPurp = S.ui.vPurp === el.dataset.v ? "" : el.dataset.v; S.ui.vSpot = null; save(); render(); break;
      case "dcat": S.ui.dCat = el.dataset.v; S.ui.dIdx = 0; S.ui.dAns = null; save(); render(); window.scrollTo(0, 0); break;
      case "lpos": S.ui.lPos = el.dataset.v; save(); render(); break;
      case "mapmode": S.ui.mapMode = el.dataset.v; save(); { const st = el.closest(".sc-stage"); if (st) { let f; try { f = JSON.parse(st.dataset.focus); } catch (e) { f = [50, 50, 100]; } setStageCam(st, el.dataset.v === "focus" ? f : [50, 50, 100]); st.querySelectorAll('[data-act="mapmode"]').forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === el.dataset.v))); } } break;
      case "mzoom": { const st = el.closest(".sc-stage"); if (st) zoomStage(st, el.dataset.v); zoomHintDone(); break; }
      case "dans": { const d = drillById(el.dataset.id); if (!d) break; const i = Number(el.dataset.i);
        S.ui.ans = { ...(S.ui.ans || {}), [d.id]: i }; S.ui.dScore = { ...(S.ui.dScore || {}), [d.id]: !!d.opts[i].ok }; save(); render(); break; }
      case "dretry": { const a = { ...(S.ui.ans || {}) }; delete a[el.dataset.id]; S.ui.ans = a; save(); render(); break; }
      case "dnext": S.ui.dIdx = (S.ui.dIdx || 0) + 1; save(); render(); window.scrollTo(0, 0); break;
      case "dprev": S.ui.dIdx = Math.max(0, (S.ui.dIdx || 0) - 1); save(); render(); window.scrollTo(0, 0); break;
      case "dreset": S.ui.dScore = {}; S.ui.ans = {}; save(); render(); break;
      // 단계별 배우기
      case "tunit": S.ui.tut = { u: el.dataset.v, step: "learn", k: 0, pk: -1 }; save(); render(); window.scrollTo(0, 0); break;
      case "tgo": S.ui.vMode = "learn"; S.ui.tut = { u: el.dataset.u, step: "learn", k: Number(el.dataset.k), pk: Number(el.dataset.k) - 1 }; save(); render(); window.scrollTo(0, 0); break;
      case "tscene": { const T = S.ui.tut || {}; const un = window.VISION.units.find((x) => x.id === T.u); if (!un) break;
        const k = Math.max(0, Math.min(un.scenes.length - 1, Number(el.dataset.k))); S.ui.tut = { ...T, step: "learn", pk: T.k || 0, k }; save(); render(); break; }
      case "treplay": { const T = S.ui.tut || {}; S.ui.tut = { ...T, pk: (T.k || 0) - 1 }; render(); break; }
      case "tback": S.ui.tut = {}; save(); render(); window.scrollTo(0, 0); break;
      case "tlearn": S.ui.tut = { ...S.ui.tut, step: "learn", k: 0, pk: -1 }; save(); render(); break;
      case "tstart": { const un = window.VISION.units.find((x) => x.id === S.ui.tut.u); const a = { ...(S.ui.ans || {}) }; un.drills.forEach((id) => delete a[id]); S.ui.ans = a;
        S.ui.tut = { ...S.ui.tut, step: "quiz", queue: un.drills.slice(), k: 0, retry: false }; save(); render(); window.scrollTo(0, 0); break; }
      case "tnext": { const T = S.ui.tut; if ((T.k || 0) < T.queue.length - 1) S.ui.tut = { ...T, k: (T.k || 0) + 1 };
        else { const un = window.VISION.units.find((x) => x.id === T.u); const allOk = un.drills.every((id) => (S.ui.dScore || {})[id]); if (allOk) S.ui.tutDone = { ...(S.ui.tutDone || {}), [un.id]: true }; S.ui.tut = { ...T, step: "review" }; }
        save(); render(); window.scrollTo(0, 0); break; }
      case "tretry": { const un = window.VISION.units.find((x) => x.id === S.ui.tut.u); const wrong = un.drills.filter((id) => !(S.ui.dScore || {})[id]); const a = { ...(S.ui.ans || {}) }; wrong.forEach((id) => delete a[id]); S.ui.ans = a;
        S.ui.tut = { ...S.ui.tut, step: "quiz", queue: wrong, k: 0, retry: true }; save(); render(); window.scrollTo(0, 0); break; }
      case "vspot": S.ui.vSpot = S.ui.vSpot === Number(el.dataset.id) ? null : Number(el.dataset.id); render(); break;
      case "sheet": S.ui.sheet = !S.ui.sheet;
        // 휴대폰: 시트의 라인 칩은 지금 차례 화면에서 고른 라인으로 시작
        if (S.ui.sheet && MOB.matches) { const st = curStep(); S.ui.q = ""; S.ui.role = (st && E.whoOfSide(S, st[0]) === "enemy" ? S.ui.predRole : S.ui.ourRole) || ""; }
        render(); if (S.ui.sheet) { const q = document.getElementById("q"); if (q && matchMedia("(min-width: 761px)").matches) q.focus(); } break;
      case "edit": editing = el.dataset.team; renderEditor(); pullShared(); break;
      case "close": editing = null; renderEditor(); break;
      case "edlane": edLane = el.dataset.r; renderEditor(); break;
      case "add": addChamp(el.dataset.role); break;
      case "del": { ev.stopPropagation(); const p = team(el.dataset.team).players[el.dataset.role]; p.pool = p.pool.filter((x) => x[0] !== el.dataset.id); save(); shareChanged(el.dataset.team, el.dataset.role); renderEditor(); render(); break; }
      case "pinrec": case "pinrecall": { const t = team(el.dataset.team), r = el.dataset.role, p = t.players[r]; p.pool = p.pool || [];
        const have = new Set(p.pool.map((x) => x[0]));
        const add = el.dataset.act === "pinrec" ? [[el.dataset.id, +el.dataset.lv || 2, !!el.dataset.one]] : Object.entries(E.poolMap({ ...t, players: { ...t.players, [r]: { ...p, pool: [] } } }, r)).filter(([id, e]) => !have.has(id) && CH[id] && (e.g || e.rg || e.scout)).sort((a, b) => E.lvScore(b[1]) - E.lvScore(a[1])).slice(0, 8).map(([id, e]) => [id, e.lv, !!e.one]);
        add.forEach(([id, lv, one]) => { if (!have.has(id)) { p.pool.push(one ? [id, 3, true] : [id, lv]); have.add(id); } });
        save(); shareChanged(t.id, r); renderEditor(); render(); break; }
      case "cycle": { const p = team(el.dataset.team).players[el.dataset.role]; const e = p.pool.find((x) => x[0] === el.dataset.id);
        if (e[2]) { e[1] = 3; e.length = 2; } else if (e[1] === 1) { e[1] = 3; e[2] = true; } else e[1] = e[1] - 1;
        save(); shareChanged(el.dataset.team, el.dataset.role); renderEditor(); render(); break; }
      case "export": MV.more = false; { const dm = document.getElementById("dataMenu"); if (dm) dm.hidden = true; } exportData(); render(); break;
      case "import": MV.more = false; IMP.from = S.tab === "import" ? IMP.from : S.tab; if (S.tab !== "import" && !IMP.busy) impReset(""); S.tab = "import"; { const dm = document.getElementById("dataMenu"); if (dm) dm.hidden = true; } render(); window.scrollTo(0, 0); break;
      case "impback": S.tab = IMP.from && IMP.from !== "import" ? IMP.from : "our"; render(); window.scrollTo(0, 0); break;
      case "impapply": applyImport(); break;
      case "ipmode": impReset(el.dataset.v); render(); window.scrollTo(0, 0); break;
      case "ipback": IMP.parsed = null; IMP.diff = null; IMP.json = null; IMP.msg = ""; if (!IMP.mode) IMP.mode = IMP.src === "file" ? "excel" : IMP.src || "text"; render(); window.scrollTo(0, 0); break;
      case "ipparse": { if (IMP.src !== "image") IMP.alts = null; const ta = document.getElementById("ipText"); if (ta) IMP.text = ta.value; const tm = document.getElementById("ipTeam"); if (tm) IMP.team = tm.value; if (IMP.src !== "image") IMP.src = "text"; IMP.file = IMP.src === "image" ? IMP.file : "텍스트"; IMP.msg = ""; parseText(); break; }
      case "ipour": { const tm = document.getElementById("ipTeam"); if (tm) IMP.team = tm.value; const ta = document.getElementById("ipText"); if (ta) IMP.text = ta.value; IMP.our = el.dataset.v === "1"; if (IMP.parsed && IMP.src !== "file") parseText(); else render(); break; }
      case "impclear": IMP.parsed = null; IMP.diff = null; IMP.json = null; IMP.file = ""; IMP.msg = ""; render(); break;
      case "wipe": if (confirm("모든 입력(챔프폭·밴픽·피어리스)을 처음 상태로 되돌릴까요?")) { S = fresh(); E.setOurTeam(S.ourTeam); save(); render(); } break;
    }
  });
  function addGoal() {
    const inp = document.getElementById("goalIn"), msg = document.getElementById("goalMsg");
    const c = inp && findChamp(inp.value);
    if (!c) { const t = inp && inp.value.trim() ? "챔프 이름을 찾지 못했습니다." : "챔프 이름을 넣어 주세요."; if (msg) msg.textContent = t; else toast(t); return; }
    const ids = ((S.ui.goal && S.ui.goal.ids) || []).filter((x) => x !== c.id).concat([c.id]).slice(-3);
    S.ui.goal = { ids }; save(); render();
    const n = document.getElementById("goalIn"); if (n && !MOB.matches) n.focus();
  }
  // PC: 추천 조합·밴픽 설계 띠는 마우스로 끌어서 넘김(휴대폰은 손가락으로 밀기)
  let drag = null, dragEat = false;
  document.addEventListener("pointerdown", (ev) => {
    if (ev.pointerType !== "mouse" || ev.button !== 0) return;
    const tr = ev.target.closest && ev.target.closest(".drag-x");
    if (!tr || ev.target.closest("input, select, textarea")) return;
    drag = { tr, x: ev.clientX, left: tr.scrollLeft, moved: false };
  });
  document.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; drag.tr.classList.add("dragging"); }
    if (drag.moved) { drag.tr.scrollLeft = drag.left - dx; ev.preventDefault(); }
  });
  document.addEventListener("pointerup", () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) return;
    d.tr.classList.remove("dragging");
    dragEat = true; setTimeout(() => (dragEat = false), 0);   // 끌기 끝의 클릭은 버튼으로 안 받음
    // 가장 가까운 카드 시작점에 맞춤
    const kids = [...d.tr.children], base = kids.length ? kids[0].offsetLeft : 0;
    const near = kids.reduce((b, k) => (Math.abs(k.offsetLeft - base - d.tr.scrollLeft) < Math.abs(b.offsetLeft - base - d.tr.scrollLeft) ? k : b), kids[0]);
    if (near) d.tr.scrollTo({ left: near.offsetLeft - base, behavior: "smooth" });
  });
  document.addEventListener("click", (ev) => { if (dragEat) { ev.stopPropagation(); ev.preventDefault(); dragEat = false; } }, true);
  // 명단 등록 화면: 캡처 사진 붙여 넣기(Ctrl+V). 글 칸이 아닌 곳에 붙인 글도 텍스트로
  document.addEventListener("paste", (ev) => {
    if (S.tab !== "import" || MOB.matches) return;
    const items = [...((ev.clipboardData && ev.clipboardData.items) || [])];
    const img = items.find((x) => x.kind === "file" && /^image\//.test(x.type));
    if (img) { ev.preventDefault(); const f = img.getAsFile(); if (f) readImage(f); return; }
    const a = document.activeElement;
    if (a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT")) return;
    const txt = ev.clipboardData && ev.clipboardData.getData("text/plain");
    if (txt && txt.trim()) { ev.preventDefault(); IMP.text = txt.slice(0, 20000); IMP.src = "text"; IMP.file = "붙여 넣은 글"; IMP.msg = ""; parseText(); }
  });
  document.addEventListener("click", (ev) => { if (S.ui.vsOpen && !(ev.target.closest && ev.target.closest(".vs-side"))) { S.ui.vsOpen = ""; renderHead(); } }, true);
  document.addEventListener("dragover", (ev) => { const d = ev.target.closest && ev.target.closest("#impDrop"); if (d) { ev.preventDefault(); d.classList.add("over"); } });
  document.addEventListener("dragleave", (ev) => { const d = ev.target.closest && ev.target.closest("#impDrop"); if (d) d.classList.remove("over"); });
  document.addEventListener("drop", (ev) => { const d = ev.target.closest && ev.target.closest("#impDrop"); if (!d) return; ev.preventDefault(); d.classList.remove("over"); const f = ev.dataTransfer && ev.dataTransfer.files[0]; if (f) readImport(f); });
  document.addEventListener("input", (ev) => {
    const t = ev.target;
    if (t.id === "ipText") { IMP.text = t.value; return; }
    // 목표 챔프: 목록에서 고르면(정확한 이름) 바로 넣음 — 예전엔 Enter를 눌러야만 들어가서 「골라도 안 들어감」(사용자 지적 11-19)
    if (t.id === "goalIn" && (ev.inputType === "insertReplacementText" || ev.inputType == null) && window.CHAMPIONS.some((c) => c.ko === t.value.trim() || c.id === t.value.trim())) { addGoal(); return; }
    if (t.id === "ipTeam") { IMP.team = t.value; return; }
    if (t.id === "q") { S.ui.q = t.value; const box = document.getElementById("champs"); if (box) box.innerHTML = champButtons(); else render();
      const sh = document.querySelector(".mv-pick"); if (sh) sh.classList.toggle("searching", !!t.value.trim()); return; }
    if (t.dataset && t.dataset.tf === "lp" && editing) { setTierFrom(t); return; }
    if (editing && t.classList && t.classList.contains("ed-acc")) { edSuggest(t); edCheckSoon(t); }
    if (t.dataset && t.dataset.alt != null && editing) {
      const p = team(editing).players[t.dataset.role];
      const a = (p.alts || altsOf(editing, t.dataset.role)).slice(0, 2); while (a.length < 2) a.push("");
      a[Number(t.dataset.alt)] = t.value.replace(/\s*#\s*/, "#").trim(); p.alts = a.filter(Boolean); save(); return;
    }
    if (t.dataset && t.dataset.f && editing) {
      const p = team(editing).players[t.dataset.role];
      p[t.dataset.f] = t.dataset.f === "pts" ? Number(t.value) || 0 : t.value; save();
    }
  });
  document.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.id === "ourSel" || t.id === "ourSelM") { S.ourTeam = t.value; E.setOurTeam(S.ourTeam); if (S.enemyTeam === S.ourTeam) S.enemyTeam = S.teams.find((x) => x.id !== S.ourTeam && !x.solo).id; syncQueue(true); save(); render(); }
    else if (t.dataset && t.dataset.rkf && editing) { setRkFrom(t); return; }
    else if (t.dataset && t.dataset.ptsu != null && editing) { const p = team(editing).players[t.dataset.role]; p.ptsU = t.value === "" ? null : Math.max(0, Math.min(100, Number(t.value) || 0)); applyTiers(); save(); renderEditor(); render(); }
    else if (t.dataset && t.dataset.act === "impour" && IMP.parsed) { markOurImport(t.value); IMP.diff = window.TeamSheet.diff(S.teams, IMP.parsed, S.ourTeam); render(); }
    else if (t.dataset && t.dataset.act === "setenemy") { S.ui.setEnemy = t.value; save(); render(); }
    else if (t.dataset && t.dataset.act === "nfc") { S.ui.nf = { ...(S.ui.nf || {}), champ: t.value }; render(); }
    else if (t.id === "enemySel" || t.id === "enemySelM" || t.id === "enemyPick") { S.enemyTeam = t.value; syncQueue(true); save(); render(); }
    else if (t.dataset && t.dataset.act === "role") setRole(Number(t.dataset.i), t.value);
    else if (t.id === "impFile" && t.files[0]) { readImport(t.files[0]); t.value = ""; }
    else if (t.dataset && t.dataset.ipacc && IMP.parsed) {
      const [ti, r, k] = t.dataset.ipacc.split(":"), pt = IMP.parsed.teams[+ti]; if (!pt) return;
      const x = pt.players[r] || (pt.players[r] = { row: 0, riot: "", alts: [], tier: "", pts: null, pool: [] });
      const v = t.value.trim() ? window.TeamSheet.riotOf(t.value.replace(/\s+/g, " ")) : "";
      if (v == null) { t.setCustomValidity("이름#태그 형식"); t.reportValidity(); return; }
      t.setCustomValidity("");
      if (+k === 0) x.riot = v; else { x.alts = (x.alts || []).slice(); x.alts[+k - 1] = v; x.alts = x.alts.filter(Boolean); }
      if (v) delete IMP.chk[v];
      IMP.diff = window.TeamSheet.diff(S.teams, IMP.parsed, S.ourTeam); render(); checkIds();
    }
    else if (t.dataset && t.dataset.tf && editing) { const r = t.dataset.role, k = t.dataset.tf; setTierFrom(t); renderEditor(); render();
      const next = document.querySelector(`#modal [data-role="${r}"][data-tf="${k === "t" ? "d" : k}"]`) || document.querySelector(`#modal [data-role="${r}"][data-tf="${k === "t" ? "lp" : k}"]`) || document.querySelector(`#modal [data-role="${r}"][data-tf="t"]`); if (next) next.focus(); }
    else if (t.dataset && t.dataset.f && editing && !(S.tab === "team" && t.closest && t.closest("#setEd"))) render();   // 우리 팀 편집 칸: 칸을 벗어날 때 다시 그리면 누른 저장·취소가 사라짐(11-19)
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && ev.target.dataset && ev.target.dataset.add) { ev.preventDefault(); addChamp(ev.target.dataset.add); }
    else if (ev.key === "Enter" && ev.target.id === "goalIn") { ev.preventDefault(); addGoal(); }
    else if (ev.key === "Enter" && ev.target.id === "q") { const first = document.querySelector("#champs .cbtn:not([disabled])"); if (first) choose(first.dataset.id); }
    else if (ev.key === "Escape" && editing) { editing = null; renderEditor(); }
    else if (ev.key === "Escape" && S.ui.vsOpen) { S.ui.vsOpen = ""; renderHead(); }
    else if (ev.key === "Escape" && TSM.open) { TSM.open = ""; render(); }
    else if (ev.key === "Escape" && MV.more) { MV.more = false; render(); }
    else if (ev.key === "Escape" && S.ui.sheet) { S.ui.sheet = false; render(); }
    else if (ev.key === "Escape" && ev.target.id === "q") { S.ui.q = ""; render(); }
    else if (S.tab === "live" && !editing && !MOB.matches && ev.key.length === 1 && !ev.metaKey && !ev.ctrlKey && !ev.altKey
      && !/^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName) && matchMedia("(min-width: 761px)").matches) {
      const q = document.getElementById("q"); if (q) q.focus(); // PC: 아무 글자나 치면 바로 챔피언 검색
    }
  });

  // ---------- 팀 공유 자기평가 (게시된 CSV) ----------
  window.SELF_EVAL = { status: window.SELF_EVAL_CSV_URL ? "loading" : "unset" };
  function parseCsv(text) {
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += ch;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim()));
  }
  async function loadSelfEval() {
    const url = window.SELF_EVAL_CSV_URL;
    if (!url) return;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const rows = parseCsv(await res.text());
      const head = rows.shift().map((h) => h.trim());
      const col = (kw) => head.findIndex((h) => h.includes(kw));
      const ci = { role: col("라인"), champ: col("챔피언"), conf: col("자신감"), use: col("대회") };
      if (ci.role < 0 || ci.champ < 0) throw new Error("열 이름(라인·챔피언)을 찾지 못함");
      const roleOf = { 탑: "T", 정글: "J", 미드: "M", 원딜: "A", 바텀: "A", 서폿: "S", 서포터: "S" };
      const latest = {};
      rows.forEach((r) => {
        const role = roleOf[(r[ci.role] || "").trim()];
        const c = findChamp(r[ci.champ]);
        if (!role || !c) return;
        const use = ci.use < 0 || !/아니|no|x/i.test(r[ci.use] || "");
        const conf = (r[ci.conf] || "").trim();
        latest[role + "|" + c.id] = use ? [c.id, conf.includes("원챔") ? 3 : conf.includes("상") ? 3 : conf.includes("하") ? 1 : 2, conf.includes("원챔") || undefined] : null;
      });
      const t = team(S.ourTeam);
      const byRole = {};
      Object.entries(latest).forEach(([k, v]) => { const r = k.split("|")[0]; byRole[r] = byRole[r] || []; if (v) byRole[r].push(v.filter((x) => x !== undefined)); });
      Object.entries(byRole).forEach(([r, list]) => { if (list.length) t.players[r].pool = list; });
      window.SELF_EVAL = { status: "ok", rows: rows.length, at: new Date().toLocaleString("ko-KR") };
    } catch (err) {
      window.SELF_EVAL = { status: "error", reason: String(err.message || err) };
    }
    render();
  }

  // ---------- 팀 공유 챔프폭 (js/config.js SELF_EVAL_SHARE_URL = Worker /selfeval) ----------
  // 우리 자기평가와 상대 챔프폭 메모를 링크를 받은 팀원끼리 같이 본다. 팀·라인별 칸 하나, 마지막 저장이 남는다.
  const SH = { url: window.SELF_EVAL_SHARE_URL && SPACE ? window.SELF_EVAL_SHARE_URL : "", status: window.SELF_EVAL_SHARE_URL && SPACE ? "loading" : "unset", at: "", err: "", pending: {}, timers: {} };
  const seedP = (tid, r) => { const t = window.SEED_TEAMS.find((x) => x.id === tid); return (t && t.players[r]) || {}; };
  const normPool = (pool) => (pool || []).map((e) => (e[2] ? [e[0], 3, true] : [e[0], e[1]]));
  const sameJ = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const shareable = (tid) => { const t = team(tid); return !!t && !t.solo; };
  function sharedBody(tid, r) { const t = team(tid), p = t.players[r];
    const rk = p.rk ? Object.fromEntries(accountsOf(t, r).map(([a]) => rkKey(a)).filter((k, i, a) => a.indexOf(k) === i && p.rk[k]).slice(0, 3).map((k) => [k, { ...(p.rk[k].s ? { s: p.rk[k].s } : {}), ...(p.rk[k].f ? { f: p.rk[k].f } : {}) }])) : null;
    return { pool: normPool(p.pool), tier: p.tier && p.tier !== seedP(tid, r).tier ? p.tier : "", ...(rk && Object.keys(rk).length ? { rk } : {}) }; }
  function editedLocally(tid, r) { const p = team(tid).players[r], sp = seedP(tid, r); return !sameJ(normPool(p.pool), normPool(sp.pool)) || (p.tier || "") !== (sp.tier || ""); }
  function shareChanged(tid, r) {
    if (!SH.url || !shareable(tid)) return;
    const k = tid + "|" + r; SH.pending[k] = (SH.pending[k] || 0) + 1;   // 바꿀 때마다 번호가 올라감
    clearTimeout(SH.timers[k]);
    SH.timers[k] = setTimeout(() => pushShared(tid, r), 700);
  }
  async function pushShared(tid, r) {
    const k = tid + "|" + r, seq = SH.pending[k];
    try {
      const res = await wfetch(`/selfeval?team=${encodeURIComponent(tid)}&role=${r}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sharedBody(tid, r)) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.status !== "ok") throw new Error(d.reason || "HTTP " + res.status);
      Object.assign(SH, { status: "ok", at: d.saved.at, err: "" });
      team(tid).players[r].sharedAt = d.saved.at; team(tid).players[r].sharedRev = d.saved.rev || Date.now(); save();
    } catch (err) { Object.assign(SH, { status: "error", err: String(err.message || err) }); }
    if (SH.pending[k] === seq) delete SH.pending[k];   // 보내는 사이 또 바꿨으면 그 저장이 끝날 때까지 기다림
    shareNoteUpdate();
  }
  async function pullShared() {
    if (!SH.url) return;
    let changed = false;
    try {
      const res = await wfetch(`/selfeval?team=all`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.status !== "ok") throw new Error(d.reason || "HTTP " + res.status);
      S.teams.filter((t) => shareable(t.id)).forEach((t) => ROLES.forEach((r) => {
        if (SH.pending[t.id + "|" + r]) return;   // 내가 방금 바꾼 칸은 저장이 끝날 때까지 그대로
        const v = d.teams && d.teams[t.id] && d.teams[t.id][r], p = t.players[r];
        // 공유 저장소는 읽기가 최대 60초 늦게 바뀐다: 이 브라우저가 방금 저장한 것보다 옛 값이면 덮지 않는다
        if (v && p.sharedRev && (v.rev || 0) < p.sharedRev) return;
        if (!v) { if (editedLocally(t.id, r)) shareChanged(t.id, r); return; }   // 공유 전에 이 브라우저에만 넣어 둔 입력은 올린다
        // 한 번도 올리지 못한 이 브라우저 입력이 있는데 다른 사람이 먼저 올렸으면 덮지 않고 합쳐서 다시 올린다
        if (!p.sharedAt && editedLocally(t.id, r)) {
          const mine = normPool(p.pool), seen = new Set(v.pool.map((e) => e[0]));
          const merged = v.pool.concat(mine.filter((e) => !seen.has(e[0])));
          const tier = (p.tier || "") !== (seedP(t.id, r).tier || "") ? p.tier : v.tier || seedP(t.id, r).tier || p.tier;
          if (!sameJ(merged, v.pool) || (v.tier || "") !== (tier !== seedP(t.id, r).tier ? tier : "")) { p.pool = merged; p.tier = tier; p.sharedAt = v.at; changed = true; shareChanged(t.id, r); return; }
        }
        // 계정별 솔랭·자랭(rk)이 오면 그것을 쓰고 반영 티어는 다시 계산(옛 형식은 티어 한 칸)
        if (v.rk) { if (!sameJ(normPool(p.pool), v.pool) || !sameJ(p.rk || {}, v.rk)) { p.pool = v.pool; p.rk = v.rk; changed = true; } }
        else { const tier = v.tier || seedP(t.id, r).tier || p.tier;
          if (!sameJ(normPool(p.pool), v.pool) || (!p.rk && p.tier !== tier)) { p.pool = v.pool; if (!p.rk) p.tier = tier; changed = true; } }
        p.sharedAt = v.at; if (v.rev) p.sharedRev = v.rev;
      }));
      Object.assign(SH, { status: "ok", err: "" });
    } catch (err) { Object.assign(SH, { status: "error", err: String(err.message || err) }); }
    if (changed) {
      save(); render();
      // 편집 창이 열려 있으면 다시 그리되, 쓰던 챔프 이름 칸은 살린다
      if (editing) { const a = document.activeElement, keep = a && a.dataset && a.dataset.add ? [a.dataset.add, a.value] : null; renderEditor();
        if (keep) { const n = document.querySelector(`[data-add="${keep[0]}"]`); if (n) { n.value = keep[1]; n.focus(); } } }
    } else shareNoteUpdate();
  }
  function shareNote() {
    if (!SH.url) return "지금은 이 브라우저에만 저장됩니다 — 팀원과 나누려면 「팀 공간」에서 팀을 만들거나 초대 링크로 들어오세요.";
    if (SH.status === "error") return `<b>팀 공유 저장 실패</b>(${esc(SH.err)}) — 이 브라우저에는 저장됐고, 다시 바꾸면 또 올립니다.`;
    if (Object.keys(SH.pending).length) return "팀 공유 저장 중…";
    return `입력하면 팀 공간${SPACE && SPACE.name ? ` 「${esc(SPACE.name)}」` : ""} 팀원에게만 공유됩니다${SH.at ? ` · 마지막 저장 ${esc(SH.at)}` : ""}.`;
  }
  // 라인마다 팀 공유 저장소에 올라간 때(없으면 「아직 안 올라옴」)
  function shareRoles(t) {
    const on = ROLES.filter((r) => t.players[r].sharedAt), off = ROLES.filter((r) => !t.players[r].sharedAt);
    return `<p class="help">${on.length ? `공유됨: ${on.map((r) => `${ROLE_KO[r]} ${esc(t.players[r].sharedAt.slice(5))}`).join(" · ")}` : "아직 공유된 라인 없음"}${on.length && off.length ? ` · 아직 안 올라옴: ${off.map((r) => ROLE_KO[r]).join("·")}` : ""}</p>`;
  }
  function shareNoteUpdate() { const n = document.getElementById("shareNote"); if (n) n.innerHTML = shareNote(); }

  // ---------- 피드백 노트(시안 B: 주제별 보드) ----------
  // 팀 공유(Worker /notes). 노트는 분류 칸(챔프·개인 / 오더·콜 / 역할 / 시야·운영)에 쌓이고, 고칠 점은 「고칠 점 → 연습 중 → 고침 확인」으로 추적.
  // 게임 연결: 「우리 팀 함께 한 경기」(Riot 기록) 줄의 「피드백」, 「저장한 밴픽」 세트의 「피드백」 버튼에서 그 게임이 연결된 채로 쓴다.
  const NT = { list: null, status: "idle", err: "", form: null };
  const NOTE_CAT = [["champ", "챔프·개인"], ["order", "오더·콜"], ["role", "역할"], ["ops", "시야·운영"]];
  const NOTE_ST = { todo: ["고칠 점", "bad"], practice: ["연습 중", "gold"], done: ["고침 확인", "good"] };
  const NOTE_WHO = [["team", "팀 전체"]].concat(ROLES.map((r) => [r, ROLE_KO[r]]));
  const GAMEREF = {};   // 화면에 그린 게임 버튼 → 게임 정보
  const gameKeyRiot = (g) => `${g.date}|${g.queue}|${ROLES.map((r) => (g.picks && g.picks[r]) || "").join(",")}`;
  const noteTeam = () => { const t = team(S.ourTeam); return t && !t.solo ? t.id : null; };
  const noteUrl = () => (SH.url ? `/notes` : "");   // 노트는 팀 공간마다 하나
  async function loadNotes() {
    if (!noteUrl()) { NT.status = "unset"; return; }
    NT.status = NT.list ? NT.status : "loading";
    try {
      const res = await wfetch(noteUrl());
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.status !== "ok") throw new Error(d.reason || "HTTP " + res.status);
      NT.list = d.notes; NT.status = "ok"; NT.err = "";
    } catch (e) { NT.status = "error"; NT.err = String(e.message || e); }
    if (S.tab === "notes" || S.tab === "our" || S.tab === "live") render();
  }
  async function sendNote(body) {
    const res = await wfetch(noteUrl(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d.status !== "ok") throw new Error(d.reason || "HTTP " + res.status);
    NT.list = d.notes; NT.status = "ok";
  }
  const notesOfGame = (g) => (NT.list || []).filter((n) => n.game && (g.k === "riot" ? n.game.k === "riot" && n.game.key === g.key : n.game.k === "saved" && n.game.sid === g.sid && n.game.g === g.g));
  // 게임 버튼(피드백 쓰기 + 노트 N 보기)
  function noteBtns(g) {
    if (!noteUrl()) return "";
    const k = g.k === "riot" ? g.key : `saved:${g.sid}:${g.g}`;
    GAMEREF[k] = g;
    const n = notesOfGame(g).length;
    return `<span class="nbtns">${n ? `<button class="btn sm ghost" data-act="ngame" data-gk="${esc(k)}" aria-label="노트 ${n}개 보기" title="노트 ${n}개 보기">${ico("note")}<span class="ib-n">${n}</span></button>` : ""}<button class="ib btn sm" data-act="nnew" data-gk="${esc(k)}" aria-label="피드백" title="피드백">${ico("notePlus")}</button></span>`;
  }
  // 연결 경기 표시: 날짜·시간 없이 팀명·세트·승패(Riot 기록 판은 큐·인원·승패)
  const gameText = (g) => !g ? "" : g.k === "riot" ? `${QUEUE[g.queue] || g.queue} ${g.n}인 ${g.win ? "승" : "패"}` : `${String(g.label).replace(/^[\d.\s:]+/, "")}${g.win === true ? " 승" : g.win === false ? " 패" : ""}`;
  // 노트의 연결 경기로 이동: 사설방 = 실시간 벤픽 「피어리스·저장」의 그 세트, Riot 기록 = 우리팀 전략 「함께 한 경기」의 그 줄
  function goGame(g) {
    if (!g) return;
    if (g.k === "saved") {
      if (!loadSaved().some((x) => x.sid === g.sid)) { alert("이 저장 기록은 이 브라우저에 없습니다(저장한 사람의 브라우저에만 있음)."); return; }
      S.tab = "live"; S.ui.dock = "series"; S.ui.dockAt = S.draft.idx; S.ui.savedOpen = g.sid; S.ui.savedFocus = { sid: g.sid, g: g.g };
      save(); render();
      const el = document.getElementById(`sv-${g.sid}-${g.g}`); if (el) el.scrollIntoView({ block: "center" });
      return;
    }
    const st = E.groupsOf(team(S.ourTeam)) || [];
    const i = st.findIndex((x) => gameKeyRiot(x) === g.key);
    if (i < 0) { alert("이 경기는 지금 「함께 한 경기」 자료에 없습니다(연습 기간 밖이거나 아직 수집 전)."); return; }
    S.tab = "our"; S.ui.gPage = { ...(S.ui.gPage || {}), our: Math.floor(i / 5) + 1, ourM: Math.floor(i / 3) + 1 }; S.ui.gFocus = g.key;
    save(); render();
    const row = [...document.querySelectorAll("tr[data-gkey]")].find((r) => r.dataset.gkey === g.key); if (row) row.scrollIntoView({ block: "center" });
  }
  function renderNotesPC() {
    const t = team(S.ourTeam);
    const empty = (m) => `<div class="home notes-pc"><p class="help">${m}</p></div>`;
    if (!noteUrl()) return empty(t && t.solo ? "솔랭·자랭에는 노트를 쓸 수 없습니다. 사이드바에서 우리 팀을 고르세요." : "팀 공간에 들어오면 팀원과 노트를 나눕니다 — 설정에서 팀을 만들거나 초대 링크로 들어오세요.");
    if (NT.status === "error" && !NT.list) return empty(`노트를 불러오지 못했습니다: ${esc(NT.err)} <button class="soft-b" data-act="nrefresh">다시 시도</button>`);
    if (!NT.list) return empty("노트 불러오는 중…");
    const f = S.ui.nf || {};
    const gsel = f.game ? GAMEREF[f.game] : null;
    const champs = [...new Set(NT.list.map((n) => n.champ).filter((c) => c && CH[c]))].sort((a, b) => CH[a].ko.localeCompare(CH[b].ko, "ko"));
    const seg = (k, cur, items, label) => `<div class="seg" role="group" aria-label="${label}">${items.map(([v, n]) => `<button data-act="nf" data-k="${k}" data-v="${v}" aria-pressed="${(cur || "") === v}">${n}</button>`).join("")}</div>`;
    const bar = `<div class="n-bar">${seg("st", f.st, [["", "전체"], ["fix", "고칠 점"], ["good", "잘한 점"]], "종류")}
      ${seg("cat", f.cat, [["", "모든 분류"]].concat(NOTE_CAT), "분류")}
      <label class="n-sel"><select data-act="nfc" aria-label="챔프로 거르기"><option value="">챔프로 거르기</option>${champs.map((c) => `<option value="${c}" ${f.champ === c ? "selected" : ""}>${esc(CH[c].ko)}</option>`).join("")}</select></label>
      ${f.game ? `<button class="n-chip" data-act="nf" data-k="game" data-v="" aria-label="경기 거르기 풀기">${esc(gsel ? gameText(gsel) : "선택한 경기")} ×</button>` : ""}
      <span class="n-sp"></span><button class="ib mh-ib" data-act="nrefresh" aria-label="새로고침" title="새로고침">${lbi("refresh", 20)}</button>
      <button class="n-new" data-act="nnew">${lbi("plus", 18)}노트 쓰기</button></div>`;
    const ok = (n) => (!f.st || n.kind === (f.st === "good" ? "good" : "fix")) && (!f.cat || n.cat === f.cat) && (!f.champ || n.champ === f.champ)
      && (!f.game || (gsel ? notesOfGame(gsel).includes(n) : true));
    const all = NT.list.filter(ok).sort((a, b) => String(b.upd || b.at).localeCompare(String(a.upd || a.at)));
    const day = (n) => esc(String(n.at || "").slice(5, 10).replace("-", "/"));
    const gameLine = (n) => { const g = n.game; if (!g) return "";
      const ps = g.picks ? ROLES.filter((r) => g.picks[r] && CH[g.picks[r]]).map((r) => icon(g.picks[r], "xs")).join("") : "";
      return `<button class="nc-g" data-act="ngo" data-id="${n.id}" title="이 경기 기록으로 이동"><b class="${g.win === false ? "l" : "w"}">${esc(gameText(g))}</b>${ps ? `<span class="nc-gp">${ps}</span>` : ""}</button>`; };
    const card = (n) => `<article class="nc ${n.kind}"><div class="nc-h">${n.champ && CH[n.champ] ? icon(n.champ, "xs") : ""}<b>${esc(n.title)}</b><span class="nc-k ${n.kind}">${n.kind === "fix" ? "고칠 점" : "잘한 점"}</span></div>
      ${n.body ? `<p class="nbody" data-act="nmore">${esc(n.body)}</p>` : ""}
      ${gameLine(n)}
      <div class="nc-f"><span class="dim">${esc((NOTE_CAT.find((c) => c[0] === n.cat) || ["", ""])[1])}</span><span class="n-sp"></span><span class="dim">${day(n)}</span><button class="nc-a" data-act="nedit" data-id="${n.id}">고치기</button><button class="nc-a del" data-act="ndel" data-id="${n.id}">지우기</button></div></article>`;
    const teamNotes = all.filter((n) => n.who === "team");
    const teamSec = `<section class="h-sec"><h3 class="h-h">팀 전체<small>${teamNotes.length}개</small><button class="nc-add" data-act="nnew" data-who="team" aria-label="팀 전체 노트 쓰기" title="팀 전체 노트 쓰기">${lbi("plus", 18)}</button></h3>${teamNotes.length ? `<div class="n-team">${teamNotes.map(card).join("")}</div>` : `<p class="help">팀 전체 노트 없음</p>`}</section>`;
    const cols = ROLES.map((r) => {
      const cs = all.filter((n) => n.who === r), p = (t && t.players && t.players[r]) || {};
      const fx = cs.filter((n) => n.kind === "fix").length, gd = cs.length - fx;
      return `<section class="n-col"><div class="n-ch"><span class="l5-r">${ROLE_KO[r]}</span><b>${esc(nick(p.riot) || "—")}</b>
        <span class="n-cnt"><span class="nc-k fix">고칠 점 ${fx}</span><span class="nc-k good">잘한 점 ${gd}</span><button class="nc-add" data-act="nnew" data-who="${r}" aria-label="${ROLE_KO[r]} 노트 쓰기" title="${ROLE_KO[r]} 노트 쓰기">${lbi("plus", 18)}</button></span></div>
        ${cs.map(card).join("") || `<p class="help">노트 없음</p>`}</section>`;
    }).join("");
    return `<div class="home notes-pc">${bar}${NT.status === "error" ? `<p class="help warn">저장 실패: ${esc(NT.err)}</p>` : ""}${teamSec}<div class="n-cols">${cols}</div></div>`;
  }
  function renderNotes() {
    const t = team(S.ourTeam);
    const head = `<div class="section-title"><h2>피드백 노트</h2><p>${t ? esc(t.name) : ""} · 링크를 받은 팀원 모두에게 공유</p>
      ${noteUrl() ? `<button class="btn sm primary" data-act="nnew">+ 노트 쓰기</button><button class="ib btn sm ghost" data-act="nrefresh" aria-label="새로고침" title="새로고침">${ico("refresh")}</button>` : ""}</div>`;
    if (!noteUrl()) return head + `<div class="note">${t && t.solo ? "솔랭·자랭 우리팀에는 노트를 쓸 수 없습니다. 위에서 우리 팀을 고르세요." : "팀 공간에 들어오면 팀원과 노트를 나눕니다 — 「팀 공간」에서 팀을 만들거나 초대 링크로 들어오세요."}</div>`;
    if (NT.status === "error" && !NT.list) return head + `<div class="note">노트를 불러오지 못했습니다: ${esc(NT.err)} <button class="btn sm" data-act="nrefresh">다시 시도</button></div>`;
    if (!NT.list) return head + `<div class="note">노트 불러오는 중…</div>`;
    const f = S.ui.nf || {};
    const seg = (k, cur, items) => `<div class="seg" role="group">${items.map(([v, n]) => `<button data-act="nf" data-k="${k}" data-v="${v}" aria-pressed="${(cur || "") === v}">${n}</button>`).join("")}</div>`;
    const champs = [...new Set(NT.list.map((n) => n.champ).filter((c) => c && CH[c]))].sort((a, b) => CH[a].ko.localeCompare(CH[b].ko, "ko"));
    const gsel = f.game ? GAMEREF[f.game] : null;
    const filters = `<div class="nfilters">${seg("st", f.st, [["", "전체"], ["fix", "고칠 점"], ["good", "잘한 점"]])}
      ${seg("who", f.who, [["", "모두"]].concat(NOTE_WHO))}
      <select class="input" data-act="nfc" aria-label="챔프로 거르기"><option value="">챔프: 전체</option>${champs.map((c) => `<option value="${c}" ${f.champ === c ? "selected" : ""}>${esc(CH[c].ko)}</option>`).join("")}</select>
      ${f.game ? `<button class="btn sm" data-act="nf" data-k="game" data-v="">게임: ${esc(gsel ? gameText(gsel) : "선택한 게임")} ×</button>` : ""}</div>`;
    const ok = (n) => (!f.st || n.kind === (f.st === "good" ? "good" : "fix")) && (!f.who || n.who === f.who) && (!f.champ || n.champ === f.champ)
      && (!f.game || (gsel ? notesOfGame(gsel).includes(n) : true));
    const list = NT.list.filter(ok).sort((a, b) => String(b.upd || b.at).localeCompare(String(a.upd || a.at)));
    const card = (n) => {
      return `<article class="ncard ${n.kind}"><div class="ncard-h">${n.champ && CH[n.champ] ? icon(n.champ, "sm") : ""}<b>${esc(n.title)}</b>
        ${n.kind === "fix" ? `<span class="pill bad nst">고칠 점</span>` : `<span class="pill good nst">잘한 점</span>`}</div>
        ${n.body ? `<p class="nbody" data-act="nmore">${esc(n.body)}</p>` : ""}
        <div class="ncard-f"><span class="pill">${esc((NOTE_WHO.find((w) => w[0] === n.who) || ["", ""])[1])}</span>${n.game ? `<button class="ng" data-act="ngo" data-id="${n.id}" title="이 경기 기록으로 이동">${esc(gameText(n.game))}</button>` : ""}
          <span class="nby">${esc(String(n.at || "").slice(5, 10).replace("-", "/"))}</span>
          <button class="ib btn sm ghost" data-act="nedit" data-id="${n.id}" aria-label="고치기" title="고치기">${ico("pencil")}</button><button class="ib btn sm ghost" data-act="ndel" data-id="${n.id}" aria-label="지우기" title="지우기">${ico("trash")}</button></div></article>`;
    };
    const cols = NOTE_CAT.map(([c, name]) => { const cs = list.filter((n) => n.cat === c);
      return `<section class="ncol"><h3>${name} <span class="pill">${cs.length}</span><button class="ib btn sm ghost" data-act="nnew" data-cat="${c}" aria-label="+" title="+">${ico("plus")}</button></h3>${cs.map(card).join("") || `<p class="help">노트 없음</p>`}</section>`; }).join("");
    return head + filters + (NT.status === "error" ? `<p class="help warn">저장 실패: ${esc(NT.err)}</p>` : "") + `<div class="nboard">${cols}</div>`;
  }
  // 노트 쓰기 창(새로·고치기). 입력 중에는 다시 그리지 않고, 저장할 때 칸 값을 읽는다
  function openNoteForm(init) {
    NT.form = init;
    const n = init.note || {};
    const g = init.game || n.game || null;
    const root = document.getElementById("nmodal") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "nmodal" }));
    const opt = (list, cur) => list.map(([v, l]) => `<option value="${v}" ${v === cur ? "selected" : ""}>${l}</option>`).join("");
    const champ = n.champ && CH[n.champ] ? CH[n.champ].ko : "";
    const picks = g && g.picks ? ROLES.filter((r) => g.picks[r] && CH[g.picks[r]]).map((r) => `<button class="chip" type="button" data-act="nfpick" data-r="${r}" data-c="${g.picks[r]}">${icon(g.picks[r], "sm")}${esc(CH[g.picks[r]].ko)}<small>${ROLE_KO[r]}</small></button>`).join("") : "";
    root.innerHTML = `<div class="modal-bg" data-act="nclose"><div class="modal nmodal" role="dialog" aria-modal="true" aria-label="피드백 노트 쓰기">
      <div class="modal-h"><h2>${init.note ? "노트 고치기" : "피드백 노트 쓰기"}</h2><button class="ib btn sm" data-act="nclose" aria-label="닫기" title="닫기">${ico("x")}</button></div>
      ${g ? `<div class="nf-game"><span class="help">연결 게임</span><b>${esc(gameText(g))}</b>${picks ? `<div class="row-chips">${picks}</div><span class="help">챔프를 누르면 대상·챔프가 채워집니다</span>` : ""}<label class="help"><input type="checkbox" id="nfLink" checked> 이 게임에 연결</label></div>` : ""}
      <div class="nf-grid">
        <label>분류<select class="input" id="nfCat">${opt(NOTE_CAT, n.cat || init.cat || "champ")}</select></label>
        <label>종류<select class="input" id="nfKind">${opt([["fix", "고칠 점"], ["good", "잘한 점"]], n.kind || "fix")}</select></label>
        <label>대상<select class="input" id="nfWho">${opt(NOTE_WHO, n.who || init.who || "team")}</select></label>
        <label>챔프(선택)<input class="input" id="nfChamp" list="champList" value="${esc(champ)}" placeholder="예: 야스오"></label>
      </div>
      <label class="nf-full">제목<input class="input" id="nfTitle" maxlength="60" value="${esc(n.title || "")}" placeholder="예: 라인전 W 낭비"></label>
      <label class="nf-full">내용<textarea class="input" id="nfBody" maxlength="600" rows="4" placeholder="무엇을, 왜, 다음엔 어떻게">${esc(n.body || "")}</textarea></label>
      <p class="help" id="nfMsg" role="status"></p>
      <div class="dnav"><button class="btn primary" data-act="nsave">저장</button><button class="btn ghost" data-act="nclose">취소</button></div></div></div>`;
    const t = document.getElementById("nfTitle"); if (t) t.focus();
  }
  async function saveNoteForm() {
    const v = (id) => (document.getElementById(id) || {}).value || "";
    const msg = document.getElementById("nfMsg");
    const ch = findChamp(v("nfChamp"));
    if (v("nfChamp").trim() && !ch) { msg.textContent = "챔프 이름을 찾지 못했습니다."; return; }
    if (!v("nfTitle").trim()) { msg.textContent = "제목을 적어 주세요."; return; }
    const link = document.getElementById("nfLink");
    const g = NT.form.game || (NT.form.note && NT.form.note.game) || null;
    // 상태는 보드에서 눌러 바꾼다(새 고칠 점은 「고칠 점」으로 시작, 고칠 때는 그대로 둠)
    const prev = NT.form.note;
    const note = { cat: v("nfCat"), kind: v("nfKind"), status: v("nfKind") === "fix" ? (prev && prev.status) || "todo" : null, who: v("nfWho"), champ: ch ? ch.id : null,
      title: v("nfTitle").trim(), body: v("nfBody").trim(), by: (prev && prev.by) || "", game: g && (!link || link.checked) ? g : null };
    msg.textContent = "저장 중…";
    try {
      await sendNote(NT.form.note ? { op: "update", id: NT.form.note.id, note } : { op: "add", note });
      closeNoteForm(); render();
    } catch (e) { msg.textContent = "저장 실패: " + (e.message || e); }
  }
  function closeNoteForm() { NT.form = null; const r = document.getElementById("nmodal"); if (r) r.innerHTML = ""; }

  // ---------- 「팀 공간」 창: 팀 만들기(팀장 아이콘 인증) · 초대 링크 · 링크 새로 만들기 · 나가기 ----------
  const TM = { open: false, step: "form", nonce: "", icon: null, riot: "", name: "", msg: "", busy: false, link: "" };
  const inviteLink = () => (SPACE ? `${location.origin}${location.pathname}#join=${SPACE.id}.${SPACE.key}` : "");
  const ICON_IMG = (i) => `https://ddragon.leagueoflegends.com/cdn/${window.DDRAGON_VERSION}/img/profileicon/${i}.png`;
  // 대회 팀 명단(subin 전용): 열쇠로 받아 이 브라우저에 사본 저장, 판이 바뀌었거나 명단이 비어 있으면 반영
  async function loadSeed() {
    if (!SPACE || SPACE.bad || SPACE.id !== "subin" || !WURL()) return;
    try {
      const res = await wfetch(`/data/teams`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.status !== "ok" || !d.data || !Array.isArray(d.data.teams)) return;
      const sd = d.data, was = S.seed;   // 이 브라우저 저장 상태가 반영한 명단 판
      try { localStorage.setItem("lolban.seed.v1", JSON.stringify(sd)); } catch (e) { /* 저장 못 해도 이번엔 씀 */ }
      window.SEED_TEAMS = sd.teams; window.SEED_OUR_TEAM = sd.our; window.SEED_VERSION = sd.version;
      let changed = false, added = false;
      sd.teams.forEach((st) => {
        const t = S.teams.find((x) => x.id === st.id);
        const blank = t && ROLES.every((r) => !(t.players[r] && t.players[r].riot));
        if (!t || blank) { if (t) S.teams.splice(S.teams.indexOf(t), 1, clone(st)); else S.teams.push(clone(st)); changed = added = true; return; }
        if (was !== sd.version) { Object.keys(st.players).forEach((r) => { const p = t.players[r] || (t.players[r] = { pool: [] }); Object.assign(p, { riot: st.players[r].riot, tier: st.players[r].tier, pts: st.players[r].pts }); delete p.rk; }); changed = true; }
      });
      if (S.ourTeam === SOLO.our || !team(S.ourTeam)) { S.ourTeam = sd.our; E.setOurTeam(S.ourTeam); changed = true; }
      if (!team(S.enemyTeam) || S.enemyTeam === S.ourTeam || (added && S.enemyTeam === SOLO.enemy)) { S.enemyTeam = (S.teams.find((x) => !x.solo && x.id !== S.ourTeam) || { id: SOLO.enemy }).id; changed = true; }
      S.seed = sd.version;
      if (changed) { save(); render(); }
    } catch (e) { /* 다음에 */ }
  }
  // 팀 공간에 들어온 직후: 공유 자료를 서버에서 다시 읽는다
  function spaceJoined() {
    SH.url = window.SELF_EVAL_SHARE_URL || ""; SH.status = SH.url ? "loading" : "unset";
    NT.list = null; NT.status = "idle";
    ensureSpaceTeam(true);
    RS.loaded = false; RS.last = "";
    pullShared(); loadNotes(); loadPrep(); loadRecent(); loadSeed(); loadRoster(); loadCollectStatus(); render();
  }
  async function checkSpace() {
    if (!SPACE || !WURL() || SPACE.viaLogin) return;   // 로그인 팀은 /auth/me가 이름·팀원 수를 줌
    try {
      const res = await wfetch(`/team/me`);
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.status === "ok") { SPACE.name = d.name; SPACE.owner = d.owner; SPACE.bad = false; saveSpace(); renderTop(); if (TM.open) renderTeam(); }
    } catch (e) { /* 연결 안 되면 다음에 */ }
  }
  async function teamPost(op, body) {
    const res = await fetch(`${WURL()}/team/${op}${op === "rotate" ? "?" + spaceQ() : ""}`, { method: "POST", cache: "no-store", credentials: "omit",
      headers: { "Content-Type": "application/json", ...(op === "rotate" && SPACE ? { "X-Team-Key": SPACE.key } : {}) }, body: JSON.stringify(body || {}) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d.status !== "ok") { const e = new Error(d.reason || "HTTP " + res.status); e.d = d; throw e; }
    return d;
  }
  // 팀 공간 본문은 설정 페이지 「팀 공간」 칸에 그린다(11-19 정식 배포: 설정을 한 곳에)
  function renderTeam() { if (S.tab === "settings" || S.tab === "team" || (S.tab === "our" && !MOB.matches)) render(); }
  function teamBody() {
    const msg = TM.msg ? `<p class="help tm-msg" role="status">${esc(TM.msg)}</p>` : `<p class="help tm-msg" role="status"></p>`;
    let body;
    if (SPACE && !SPACE.bad) {
      body = `<p class="tm-name"><b>${esc(SPACE.name || "팀 공간")}</b>${SPACE.owner ? `<span class="help">팀장 인증 ${esc(SPACE.owner)}</span>` : ""}</p>
        <label class="tm-l">팀원 초대 링크 — 팀 단톡방에 공유하세요<span class="tm-link"><input class="input" id="tmLink" readonly value="${esc(inviteLink())}" aria-label="초대 링크"><button class="ib btn sm primary" data-act="tcopy" aria-label="복사" title="복사">${ico("copy")}</button></span></label>
        <p class="help">링크를 연 브라우저가 우리 팀에 들어옵니다. 피드백 노트·자기평가·상대 메모·실시간 갱신은 우리 팀원만 보고 씁니다 — 상대가 명단을 알아도 이 링크가 없으면 볼 수 없습니다.</p>
        ${msg}
        <div class="dnav"><button class="btn sm" data-act="trotate">링크 새로 만들기</button><button class="btn sm ghost" data-act="tleave">이 브라우저에서 나가기</button></div>
        <p class="help">링크가 새어 나갔으면 「링크 새로 만들기」 — 옛 링크로 들어온 브라우저는 모두 막히니 새 링크를 팀원에게 다시 보내 주세요.</p>`;
    } else if (TM.step === "verify") {
      body = `<ol class="tm-steps"><li>롤 클라이언트에서 <b>${esc(TM.riot)}</b> 계정으로 로그인</li>
        <li>프로필 아이콘을 아래 기본 아이콘으로 바꾸기 <span class="tm-icon"><img src="${ICON_IMG(TM.icon)}" alt="기본 아이콘 ${TM.icon}번" width="56" height="56"><span class="help">${TM.icon}번</span></span></li>
        <li>바꾼 뒤 「확인」 — 15분 안에. 확인이 끝나면 원래 아이콘으로 돌려도 됩니다.</li></ol>
        ${msg}
        <div class="dnav"><button class="btn primary" data-act="tcheck" ${TM.busy ? "disabled" : ""}>${TM.busy ? "확인 중…" : "확인"}</button><button class="btn ghost" data-act="tback">처음으로</button></div>`;
    } else {
      body = `${SPACE && SPACE.bad ? `<p class="warn">이 브라우저의 팀 공간 열쇠가 바뀌었습니다. 팀원에게 새 초대 링크를 받아 여세요.</p>` : ""}
        <ol class="tm-flow"><li class="cur"><b>팀 만들기</b><small>팀 이름과 본인 라이엇 계정</small></li><li><b>본인 확인</b><small>롤 아이콘을 잠깐 바꾸기</small></li><li><b>초대 링크 공유</b><small>팀원은 링크만 열면 끝</small></li></ol>
        <p class="help">팀원에게 초대 링크를 받았다면 만들 필요 없이 그 링크를 여세요. 본인 확인은 남이 우리 명단으로 「우리팀」을 만들지 못하게 하려는 것입니다.</p>
        <div class="tm-form"><label>팀 이름<input class="input" id="tmName" maxlength="30" value="${esc(TM.name)}" placeholder="예: 새벽반"></label>
        <label>팀원 라이엇 ID(본인 계정)<input class="input" id="tmRiot" maxlength="42" value="${esc(TM.riot)}" placeholder="이름#태그"></label></div>
        ${msg}
        <div class="dnav"><button class="btn primary" data-act="tstart" ${TM.busy ? "disabled" : ""}>${TM.busy ? "확인 중…" : "팀 공간 만들기"}</button>${SPACE ? `<button class="btn ghost" data-act="tleave">열쇠 지우기</button>` : ""}</div>`;
    }
    return `<div class="tmodal">${body}</div>`;
  }
  async function teamAction(a) {
    const v = (id) => ((document.getElementById(id) || {}).value || "").trim();
    if (a === "team") { TM.msg = ""; openSettings("space"); checkSpace(); return; }
    if (a === "tclose") { TM.open = false; renderTeam(); return; }
    if (a === "tback") { TM.step = "form"; TM.msg = ""; renderTeam(); return; }
    if (a === "tcopy") { const i = document.getElementById("tmLink"); try { await navigator.clipboard.writeText(inviteLink()); TM.msg = "복사했습니다."; } catch (e) { if (i) { i.select(); TM.msg = "링크를 길게 눌러 복사하세요."; } } renderTeam(); return; }
    if (a === "tleave") { if (!confirm("이 브라우저에서 팀 공간 열쇠를 지울까요? 다시 들어오려면 초대 링크가 필요합니다.")) return; SPACE = null; saveSpace(); SH.url = ""; SH.status = "unset"; NT.list = null; TM.step = "form"; TM.msg = ""; render(); renderTeam(); return; }
    if (a === "trotate") {
      if (!confirm("초대 링크를 새로 만들까요? 옛 링크로 들어온 팀원 브라우저는 모두 막히고, 새 링크를 다시 보내야 합니다.")) return;
      try { const d = await teamPost("rotate"); SPACE = { ...SPACE, key: d.key, bad: false }; saveSpace(); TM.msg = "새 링크를 만들었습니다. 팀원에게 다시 보내 주세요."; }
      catch (e) { TM.msg = "실패: " + e.message; }
      renderTeam(); return;
    }
    if (a === "tstart") {
      TM.name = v("tmName"); TM.riot = v("tmRiot").replace(/\s*#\s*/, "#");
      if (!TM.name) { TM.msg = "팀 이름을 적어 주세요."; renderTeam(); return; }
      if (!/^[^#]+#[^#]+$/.test(TM.riot)) { TM.msg = "라이엇 ID는 이름#태그 형식으로 적어 주세요."; renderTeam(); return; }
      TM.busy = true; TM.msg = "계정 확인 중…"; renderTeam();
      try { const d = await teamPost("start", { name: TM.name, riot: TM.riot }); Object.assign(TM, { step: "verify", nonce: d.nonce, icon: d.icon, msg: "", at: Date.now() }); }
      catch (e) { TM.msg = e.message; }
      TM.busy = false; renderTeam(); return;
    }
    if (a === "tcheck") {
      TM.busy = true; TM.msg = "아이콘 확인 중…"; renderTeam();
      try {
        const d = await teamPost("check", { nonce: TM.nonce });
        SPACE = { id: d.space, key: d.key, name: d.name, owner: TM.riot }; saveSpace();
        Object.assign(TM, { step: "form", nonce: "", msg: "팀 공간을 만들었습니다. 아래 초대 링크를 팀원에게 보내세요." });
        spaceJoined();
      } catch (e) { TM.msg = e.message; if (e.d && e.d.reason && /시간이 지났/.test(e.d.reason)) TM.step = "form"; }
      TM.busy = false; renderTeam(); return;
    }
  }

  setInterval(() => { const el = document.getElementById("nuLeft"); if (!el) return; const left = Math.max(0, Math.round((Number(el.dataset.end) - Date.now()) / 1000)); el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`; }, 1000);
  {
    // 팀원이 새로 쓴 자기평가·피드백 노트도 보이게: 화면이 보이는 동안 45초마다, 다시 돌아왔을 때 읽는다(팀 공간에 들어와 있을 때만)
    const tick = () => { if (document.visibilityState === "visible" && SH.url) { pullShared(); loadRoster(); if (S.tab === "notes" && !NT.form) loadNotes(); } };
    setInterval(tick, 45000);
    document.addEventListener("visibilitychange", tick);
  }

  // ---------- 픽 후보 정보 카드 (PC 전용: 마우스 올림·키보드 초점) ----------
  const hc = document.createElement("div");
  hc.className = "hovercard"; hc.hidden = true; hc.setAttribute("role", "tooltip"); hc.id = "hovercard";
  document.body.appendChild(hc);
  let hcFor = null;
  const pcPointer = matchMedia("(hover: hover) and (pointer: fine) and (min-width: 761px)");
  // PC: 배지에 마우스를 올리면 초상화 팝업을 열고, 벗어나면 닫는다(휴대폰은 눌러서 펼침)
  document.addEventListener("mouseover", (ev) => { if (!pcPointer.matches) return; const b = ev.target.closest && ev.target.closest(".bdg"); if (b && !b.open) {
    b.open = true; b.dataset.hov = "1";
    const pop = b.querySelector(".bdg-pop");
    if (pop) { pop.classList.remove("flip"); if (pop.getBoundingClientRect().right > document.documentElement.clientWidth - 8) pop.classList.add("flip"); }
  } });
  document.addEventListener("mouseout", (ev) => { const b = ev.target.closest && ev.target.closest(".bdg"); if (b && b.dataset.hov && !b.contains(ev.relatedTarget)) { b.open = false; delete b.dataset.hov; } });
  function hcAllowed() { return pcPointer.matches && S.tab === "live" && !!curStep(); }
  function showHover(el) {
    const slot = !!el.dataset.hov;
    if (slot ? !(pcPointer.matches && S.tab === "live") : !hcAllowed()) return;
    const id = slot ? el.dataset.hov : el.dataset.id;
    if (!CH[id]) return;
    let who, role;
    if (slot) { who = el.dataset.hwho; role = el.dataset.hrole || E.guessRole(S, who, id); }
    else {
      // 누구의 챔프로 볼지: 우리 픽 차례이거나 우리 챔프폭에 있으면 우리 관점, 아니면 상대 관점
      const st = curStep();
      const turn = E.whoOfSide(S, st[0]);
      if (el.closest(".now-box")) who = st[1] === "pick" ? turn : turn === "our" ? "enemy" : "our";   // 추천·예상 카드: 픽 = 그 차례 팀 챔프, 밴 = 밴 당하는 팀 챔프
      else {
        const ourTurnPick = st[1] === "pick" && turn === "our";
        const inOurPool = ROLES.some((r) => E.poolMap(E.teamOf(S, "our"), r)[id]);
        who = ourTurnPick || inOurPool ? "our" : "enemy";
      }
      role = (who === "our" && el.dataset.role) || E.guessRole(S, who, id);
    }
    if (!role) return;
    const h = E.hoverInfo(S, who, id, role);
    const labels = slot
      ? (who === "our"
        ? { bad: h.laner ? "상대 같은 라인(이미 픽)" : "상대 대응 픽 예상 · " + ROLE_KO[role], good: "우리 팀 시너지", tag: "우리 픽" }
        : { bad: h.laner ? "우리 같은 라인(이미 픽)" : "우리 대응 픽 · " + ROLE_KO[role], good: "상대가 같이 꺼낼 만한 챔프", tag: "상대 픽" })
      : who === "our"
      ? { bad: h.laner ? "상대 같은 라인" : `${E.j(CH[id].ko, "을", "를")} 카운터하는 상대 ${ROLE_KO[role]}`, good: "우리 팀 시너지", tag: "우리" }
      : { bad: h.laner ? "우리 같은 라인" : `${E.j(CH[id].ko, "을", "를")} 카운터하는 우리 ${ROLE_KO[role]}`, good: "상대가 같이 꺼낼 만한 챔프", tag: "상대" };
    const row = (x) => `<li>${icon(x.id, "sm")}<span><b>${esc(CH[x.id].ko)}</b><small>${esc(x.d)}</small></span></li>`;
    hc.innerHTML = `<div class="hc-h">${icon(id, "sm")}<b>${esc(CH[id].ko)}</b><span class="pill">${labels.tag} ${ROLE_KO[role]}</span></div>
      <div class="hc-sec"><div class="hc-t ${who === "our" ? "bad" : "good"}">${labels.bad}</div>${h.threats.length ? `<ul>${h.threats.map(row).join("")}</ul>` : `<p class="help">뚜렷한 카운터 없음</p>`}</div>
      <div class="hc-sec"><div class="hc-t ${who === "our" ? "good" : "bad"}">${labels.good}</div>${h.synergy.length ? `<ul>${h.synergy.map(row).join("")}</ul>` : `<p class="help">남은 라인 챔프폭에서 뚜렷한 시너지 없음</p>`}</div>`;
    hc.hidden = false;
    hcFor = el;
    el.setAttribute("aria-describedby", "hovercard");
    const r = el.getBoundingClientRect(), w = hc.offsetWidth, hgt = hc.offsetHeight, gap = 10;
    let left = r.right + gap; if (left + w > innerWidth - 8) left = r.left - w - gap; if (left < 8) left = Math.min(innerWidth - w - 8, Math.max(8, r.left));
    let top = r.top;
    // 추천 카드: 아래 기록 줄(#recDetail — 시즌·연습·팀원)을 가리지 않게 그 줄 아래, 카드 왼쪽에 맞춤(사용자 지적 11-19)
    const det = el.closest(".lv-c") && document.getElementById("recDetail");
    const below = det && el.closest(".now-box") && det.offsetHeight;
    hc.style.maxHeight = "";
    if (below) { const d = det.getBoundingClientRect(); top = d.bottom + gap; left = Math.min(innerWidth - w - 8, Math.max(8, r.left)); hc.style.maxHeight = Math.max(160, innerHeight - top - 8) + "px"; }
    else { if (top + hgt > innerHeight - 8) top = Math.max(8, innerHeight - hgt - 8); if (top < 8) top = 8; }
    hc.style.left = left + "px"; hc.style.top = top + "px";
  }
  function hideHover() { if (hcFor) hcFor.removeAttribute("aria-describedby"); hc.hidden = true; hcFor = null; }
  document.addEventListener("mouseover", (ev) => {
    const el = ev.target.closest("[data-act='pick'][data-id], .slot-pick[data-hov]");
    if (el === hcFor) return;
    if (el) showHover(el); else if (hcFor && !ev.target.closest(".hovercard")) hideHover();
  });
  document.addEventListener("focusin", (ev) => { const el = ev.target.closest("[data-act='pick'][data-id], .slot-pick[data-hov]"); if (el) showHover(el); else hideHover(); });
  window.addEventListener("scroll", () => hcFor && hideHover(), { passive: true });

  document.getElementById("champList").innerHTML = window.CHAMPIONS.map((c) => `<option value="${esc(c.ko)}">`).join("");
  // 폭이 바뀌면(휴대폰 ↔ PC, 가로 돌림) 그 화면으로 다시 그림
  MOB.addEventListener("change", () => { MV.more = false; S.ui.sheet = false; render(); });
  if (!SPACE && S.ui.queue && QUEUE_TXT[S.ui.queue]) CFG.queue = S.ui.queue;
  ensureSpaceTeam(JUST_JOINED);
  if (guest() && S.tab === "our") S.tab = "live";   // 손님은 실시간 밴픽으로 시작(로그인 화면은 사이드바에서)
  if ((JUST_LOGGED || LOGIN_ERR) && guest()) S.tab = "our";   // 막 로그인했는데 팀이 없거나 로그인이 실패했으면 그 화면(안내가 보이게)
  render();
  checkSpace();
  loadSelfEval();
  pullShared();
  loadNotes();
  loadPrep();
  loadRecent();
  loadSeed();
  loadProviders();
  if (S.ui) { delete S.ui.rState; delete S.ui.pState; }   // 갱신 결과는 이번 화면에서만(사용자 지적 11-19: 새로고침해도 체크가 남음)
  loadMe();
  loadRoster();
  loadCollectStatus();
})();
