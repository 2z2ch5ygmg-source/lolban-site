// 팀·챔프폭 엑셀(사용자 요청 11-19): 한 시트에 팀마다 섹션. 내보내기 줄 만들기 · 불러오기 읽기·검사 · 바뀌는 것 계산.
// 엑셀 파일 읽고 쓰기는 js/vendor/xlsx(SheetJS 0.20.3)가 하고, 여기는 표(줄 배열)만 다룬다 — 화면 없이 시험할 수 있게.
//
// 시트 모양(섹션 하나):
//   팀     | 수빈이의아이들 | 우리팀            ← 셋째 칸: 「우리팀」 또는 「상대」(비우면 상대)
//   라인   | 본계정 | 부계정1 | 부계정2 | 티어 | 점수 | 챔프폭
//   탑     | loegu#kr1 |  |  | 에메랄드 4 24LP | 45 | 다리우스:상, 말파이트:상, 케넨:중
//   …(정글·미드·원딜·서폿)
//   (빈 줄)
(function (root) {
  const LANES = [["T", "탑"], ["J", "정글"], ["M", "미드"], ["A", "원딜"], ["S", "서폿"]];
  const LANE_OF = { 탑: "T", top: "T", t: "T", 정글: "J", jg: "J", jungle: "J", j: "J", 미드: "M", mid: "M", m: "M",
    원딜: "A", 바텀: "A", 봇: "A", ad: "A", adc: "A", bot: "A", a: "A", 서폿: "S", 서포터: "S", 서포트: "S", sup: "S", support: "S", s: "S" };
  const LV_OF = { 상: 3, 중: 2, 하: 1, 3: 3, 2: 2, 1: 1, high: 3, mid: 2, low: 1 };
  const ONE = /^(원챔|원챔프|원|one)$/i;
  const LV_TXT = { 3: "상", 2: "중", 1: "하" };
  const HEAD = ["라인", "본계정", "부계정1", "부계정2", "티어", "점수", "챔프폭"];
  const MAX = { teams: 40, rows: 2000, name: 30, tier: 30, pool: 40 };
  const txt = (v) => (v == null ? "" : String(v)).replace(/\s+/g, " ").trim();
  // 라이엇 ID: 「이름 #태그」처럼 # 앞뒤 빈칸은 붙임. 이름 1~32자·태그 1~8자(둘 다 가운데 빈칸 가능 — 실제 「Loki#살 하」 같은 태그가 있음)
  const riotOf = (v) => { const t = txt(v).replace(/\s*#\s*/, "#"); return /^[^#<>"`\\]{1,32}#[^#<>"`\\]{1,8}$/.test(t) ? t : null; };

  // ---- 내보내기: 팀 목록 → 줄 배열 ----
  // teams: [{id,name,players:{T:{riot,alts,tier,pts,pool}}}], nameOf(champId) → 화면 이름
  function toRows(teams, ourId, nameOf, at) {
    const rows = [["피어리스 밴픽 보드 · 팀 챔프폭", "", "", "", "", "", at ? `내보낸 날 ${at}` : ""],
      ["작성법: 「팀」 줄 셋째 칸에 우리팀/상대, 아래 라인 5줄. 계정은 이름#태그(라인당 3개까지), 챔프폭은 「챔프:상/중/하/원챔」을 쉼표로."], []];
    const sorted = teams.slice().sort((a, b) => (b.id === ourId) - (a.id === ourId));
    sorted.forEach((t) => {
      rows.push(["팀", t.name, t.id === ourId ? "우리팀" : "상대"]);
      rows.push(HEAD.slice());
      LANES.forEach(([r, ko]) => {
        const p = (t.players && t.players[r]) || {};
        const acc = [p.riot || ""].concat(p.alts || []).slice(0, 3);
        while (acc.length < 3) acc.push("");
        const pool = (p.pool || []).map(([id, lv, one]) => `${nameOf(id) || id}:${one ? "원챔" : LV_TXT[lv] || "중"}`).join(", ");
        rows.push([ko].concat(acc, [p.tier || "", p.pts == null ? "" : p.pts, pool]));
      });
      rows.push([]);
    });
    return rows;
  }

  // ---- 불러오기: 줄 배열 → 팀 목록 + 오류·주의 ----
  // resolve(이름) → 챔프 ID 또는 null. 줄 번호는 엑셀과 같은 1부터.
  function parse(rows, resolve) {
    const out = { teams: [], errors: [], warnings: [] };
    if (!Array.isArray(rows)) { out.errors.push({ row: 0, msg: "시트를 읽지 못했습니다" }); return out; }
    if (rows.length > MAX.rows) { out.errors.push({ row: 0, msg: `줄이 너무 많습니다(${MAX.rows}줄까지)` }); return out; }
    let cur = null;
    const err = (row, msg) => out.errors.push({ row, msg });
    rows.forEach((raw, i) => {
      const row = i + 1, c = (raw || []).map(txt);
      const first = (c[0] || "").toLowerCase();
      if (!c.some(Boolean)) return;
      if (first === "팀" || first === "팀명" || first === "team") {
        const name = c[1] || "";
        if (!name) { err(row, "팀 이름이 비어 있습니다"); cur = null; return; }
        if (name.length > MAX.name || /[<>"`\\]/.test(name)) { err(row, `팀 이름은 ${MAX.name}자까지, < > " 같은 기호 없이`); cur = null; return; }
        if (out.teams.some((t) => t.name === name)) { err(row, `「${name}」 팀이 두 번 나옵니다`); cur = null; return; }
        const kind = (c[2] || "").replace(/\s/g, "");
        cur = { name, our: kind === "우리팀" || kind === "우리", row, players: {} };
        out.teams.push(cur); return;
      }
      if (first === "라인" || /^피어리스|^작성법/.test(c[0] || "")) return;   // 머리·제목 줄
      const r = LANE_OF[first];
      if (!r) { if (cur) err(row, `라인 이름 「${c[0]}」을(를) 모릅니다(탑·정글·미드·원딜·서폿)`); return; }
      if (!cur) { err(row, "이 줄 위에 「팀」 줄이 없습니다"); return; }
      if (cur.players[r]) { err(row, `${cur.name}: ${LANES.find((x) => x[0] === r)[1]} 줄이 두 번 나옵니다`); return; }
      const acc = [];
      for (const v of c.slice(1, 4)) {
        if (!v) continue;
        const id = riotOf(v);
        if (!id) { err(row, `계정 「${v}」은(는) 이름#태그 형식이 아닙니다`); continue; }
        if (!acc.includes(id)) acc.push(id);
      }
      const tier = c[4] || "";
      if (tier.length > MAX.tier || /[<>"`\\]/.test(tier)) err(row, `티어는 ${MAX.tier}자까지`);
      let pts = null;
      if (c[5]) { const n = Number(c[5]); if (Number.isFinite(n) && n >= 0 && n <= 100) pts = Math.round(n); else err(row, `점수 「${c[5]}」는 0~100 숫자여야 합니다`); }
      const pool = [], seen = new Set();
      String(raw[6] == null ? "" : raw[6]).split(/[,，、\n;/]+/).map((x) => x.trim()).filter(Boolean).forEach((tok) => {
        const m = tok.match(/^(.+?)\s*[:：(]\s*([^)]*?)\s*\)?\s*$/) || tok.match(/^(.+?)\s+(상|중|하|원챔|원챔프|원)$/);
        const nm = m ? m[1].trim() : tok, lvTxt = m ? m[2].trim() : "";
        const id = resolve(nm);
        if (!id) { err(row, `챔프 이름 「${nm}」을(를) 모릅니다`); return; }
        if (seen.has(id)) return;
        seen.add(id);
        if (ONE.test(lvTxt)) pool.push([id, 3, true]);
        else if (!lvTxt) pool.push([id, 2]);
        else if (LV_OF[lvTxt.toLowerCase()]) pool.push([id, LV_OF[lvTxt.toLowerCase()]]);
        else err(row, `「${tok}」의 숙련도 「${lvTxt}」은(는) 상·중·하·원챔 중 하나여야 합니다`);
      });
      if (pool.length > MAX.pool) err(row, `챔프폭은 라인당 ${MAX.pool}개까지`);
      cur.players[r] = { row, riot: acc[0] || "", alts: acc.slice(1), tier, pts, pool };
    });
    if (out.teams.length > MAX.teams) err(0, `팀은 한 번에 ${MAX.teams}개까지`);
    if (out.teams.filter((t) => t.our).length > 1) err(out.teams.filter((t) => t.our)[1].row, "「우리팀」은 한 팀만 표시할 수 있습니다");
    out.teams.forEach((t) => {
      const miss = LANES.filter(([r]) => !t.players[r]).map(([, ko]) => ko);
      if (miss.length === 5) err(t.row, `${t.name}: 라인 줄이 없습니다`);
      else if (miss.length) out.warnings.push({ row: t.row, msg: `${t.name}: ${miss.join("·")} 줄이 없어 그 라인은 지금 그대로 둡니다` });
      LANES.forEach(([r, ko]) => { const p = t.players[r]; if (p && !p.riot) out.warnings.push({ row: p.row, msg: `${t.name} ${ko}: 계정이 비어 있어 전적을 못 가져옵니다` }); });
    });
    return out;
  }

  // ---- 바뀌는 것: 지금 팀 목록과 비교(팀 이름으로 맞춤) ----
  const sameList = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
  const poolKey = (pool) => (pool || []).map(([id, lv, one]) => `${id}:${one ? "one" : lv}`);
  function diff(current, parsed, ourId) {
    return parsed.teams.map((pt) => {
      const cur = current.find((t) => !t.solo && t.name === pt.name) || null;
      const lanes = [];
      LANES.forEach(([r, ko]) => {
        const n = pt.players[r];
        if (!n) return;
        const o = (cur && cur.players[r]) || {};
        const ch = [];
        const accO = [o.riot || ""].concat(o.alts || []).filter(Boolean), accN = [n.riot].concat(n.alts).filter(Boolean);
        if (!sameList(accO, accN)) ch.push({ k: "acc", from: accO, to: accN });
        if ((o.tier || "") !== n.tier) ch.push({ k: "tier", from: o.tier || "", to: n.tier });
        if (n.pts != null && o.pts !== n.pts) ch.push({ k: "pts", from: o.pts, to: n.pts });
        const pk = new Set(poolKey(o.pool)), nk = new Set(poolKey(n.pool));
        const add = n.pool.filter((e) => !pk.has(poolKey([e])[0])), del = (o.pool || []).filter((e) => !nk.has(poolKey([e])[0]));
        if (add.length || del.length) ch.push({ k: "pool", add, del });
        if (ch.length || !cur) lanes.push({ r, ko, ch });
      });
      return { name: pt.name, id: cur ? cur.id : null, isNew: !cur, our: pt.our, becomesOur: pt.our && (!cur || cur.id !== ourId), lanes };
    });
  }

  // ---- 적용: 새 팀 목록(원본은 그대로) ----
  // newId() → 새 팀 ID. 반환: { teams, ourId(바뀌면), touched:[[팀ID,라인]…] }
  function apply(current, parsed, ourId, newId) {
    const teams = JSON.parse(JSON.stringify(current));
    const touched = [];
    let our = ourId;
    parsed.teams.forEach((pt) => {
      let t = teams.find((x) => !x.solo && x.name === pt.name);
      if (!t) {
        t = { id: newId(), name: pt.name, players: Object.fromEntries(LANES.map(([r]) => [r, { riot: "", alts: [], tier: "", pts: 50, pool: [] }])) };
        teams.push(t);
      }
      LANES.forEach(([r]) => {
        const n = pt.players[r];
        if (!n) return;
        const p = t.players[r] || (t.players[r] = { pool: [] });
        if ((p.tier || "") !== (n.tier || "") || (p.riot || "") !== (n.riot || "")) delete p.rk;   // 계정별 솔랭·자랭은 엑셀 티어로 다시 시작
        p.riot = n.riot; p.alts = n.alts.slice(0, 2); p.tier = n.tier;
        if (n.pts != null) p.pts = n.pts; else if (p.pts == null) p.pts = 50;
        p.pool = n.pool.map((e) => e.slice());
        touched.push([t.id, r]);
      });
      if (pt.our) our = t.id;
    });
    return { teams, ourId: our, touched };
  }

  // ---- 내보내기 서식(사용자 요청 11-19: 글자만 있어 읽기 어려움 → 팀 띠·머리 줄·칸 선·줄무늬) ----
  // 줄 배열을 보고 칸마다 서식을 정한다(xlsx-js-style 형식). 엑셀 쓰기와 떨어져 있어 화면 없이 시험할 수 있다.
  const COLS = HEAD.length;
  const C = { line: "CBD5E1", ink: "1F2937", sub: "6B7280", our: "B45309", opp: "334155", head: "E2E8F0", laneBg: "F1F5F9", zebra: "F8FAFC" };
  const thin = { style: "thin", color: { rgb: C.line } };
  const box = { top: thin, bottom: thin, left: thin, right: thin };
  const font = (o) => Object.assign({ name: "맑은 고딕", sz: 10, color: { rgb: C.ink } }, o);
  const fill = (rgb) => ({ patternType: "solid", fgColor: { rgb } });
  function sheetLayout(rows) {
    const cells = {}, heights = [], merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 2 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } }];   // 제목(A1:F1)·작성법(A2:G2) 칸 합침 — 옆 빈칸에 글자가 잘리지 않게
    const put = (r, c, st) => { cells[r + "," + c] = st; };
    put(0, 0, { font: font({ sz: 15, bold: true }), alignment: { vertical: "center" } });
    put(0, COLS - 1, { font: font({ sz: 9, color: { rgb: C.sub } }), alignment: { horizontal: "right", vertical: "center" } });
    heights[0] = { hpt: 28 };
    put(1, 0, { font: font({ sz: 9, color: { rgb: C.sub } }), fill: fill("F8FAFC"), alignment: { wrapText: true, vertical: "center" } });
    heights[1] = { hpt: 30 };
    let n = 0, our = false;
    rows.forEach((row, r) => {
      const k = (row && row[0]) || "";
      if (k === "팀") {
        our = row[2] === "우리팀"; n = 0;
        const bg = our ? C.our : C.opp;
        for (let c = 0; c < COLS; c++) put(r, c, { font: font({ sz: c === 1 ? 12 : 10, bold: true, color: { rgb: "FFFFFF" } }), fill: fill(bg), alignment: { vertical: "center", horizontal: c === 0 || c === 2 ? "center" : "left" }, border: box });
        heights[r] = { hpt: 24 };
      } else if (k === "라인") {
        for (let c = 0; c < COLS; c++) put(r, c, { font: font({ bold: true, color: { rgb: "334155" } }), fill: fill(C.head), alignment: { horizontal: c === 0 || c === 4 || c === 5 ? "center" : "left", vertical: "center" }, border: Object.assign({}, box, { bottom: { style: "medium", color: { rgb: "94A3B8" } } }) });
        heights[r] = { hpt: 20 };
      } else if (LANE_OF[String(k).toLowerCase()] && r > 1) {
        const bg = n++ % 2 ? C.zebra : "FFFFFF";
        for (let c = 0; c < COLS; c++) {
          const st = { font: font(c === 0 ? { bold: true } : c === 2 || c === 3 ? { color: { rgb: "475569" } } : {}), fill: fill(c === 0 ? C.laneBg : bg), border: box,
            alignment: { vertical: "center", horizontal: c === 0 || c === 4 || c === 5 ? "center" : "left", wrapText: c === COLS - 1 } };
          put(r, c, st);
        }
        heights[r] = { hpt: 20 };
      }
    });
    return { cells, heights, merges, cols: [{ wch: 7 }, { wch: 26 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 7 }, { wch: 72 }] };
  }


  // ---- 텍스트 → 줄 배열(사용자 요청 11-19: 엑셀·사진·텍스트 어느 것이든 명단으로) ----
  // 받는 모양(섞여도 됨):
  //   팀: 반클러치 (상대)          ← 「팀」으로 시작하는 줄 = 새 팀. 「우리」가 있으면 우리팀
  //   탑 도도한낫츠#kr1 / 부계정#kr2 에메랄드 2 다리우스 상, 말파 중
  //   정글: 김진규#0516           ← 라인 이름이 없으면 나온 순서대로 탑·정글·미드·원딜·서폿
  //   부계정 장국보#KR1           ← 「부계정·부캐·서브」 줄은 바로 위 라인의 부계정
  //   엑셀에서 복사한 표(탭으로 나뉜 칸)도 그대로
  // opts: { team: 팀 이름이 없을 때 쓸 이름, our: 그 팀이 우리팀인지, ocr: 사진에서 읽은 글(팀 이름을 글에서 짐작하지 않음), resolve: 챔프 이름 → ID }
  const LANE_RE = /^(탑|top|정글|jg|jug|jungle|미드|mid|원딜|바텀|봇|adc?|bot|서폿|서포터|서포트|sup|support)(?=$|[\s:：.)\]\-–|]|\d)/i;
  const ALT_RE = /^(부계정|부계|부캐|서브|sub|alt)\s*\d?\s*[:：.)\-–]?\s*/i;
  const TIER_RE = /(아이언|브론즈|실버|골드|플래티넘|플래|에메랄드|에메|다이아몬드|다이아|그랜드마스터|그마|마스터|챌린저|챌)\s*([1-4])?\s*(\d{1,4}\s*LP)?/i;
  const TIER_FIX = { 플래: "플래티넘", 에메: "에메랄드", 다이아몬드: "다이아", 그마: "그랜드마스터", 챌: "챌린저" };
  // 라이엇 ID: 이름(1~16자, 가운데 빈칸 가능) + # + 태그(2~5자). 사진 글은 「＃」·「 # 」로도 읽힘
  const ID_RE = /([^\s#,，/|·\t:：()\[\]][^#,，/|·\t:：()\[\]]{0,15}?)\s*#\s*([0-9A-Za-z가-힣]{2,5})(?=$|[\s,，/|·\t)\]])/g;
  // 사진 글 잡음 정리: 「*」「&#」「#*」 → #, 태그의 l·I·| → 1(숫자 사이·kr 뒤), 칸 사이 「_」「|」「=」 잡음
  function ocrClean(line) {
    return String(line || "")
      .replace(/&#|#\s*[*＊]|[*＊]\s*#/g, "#")
      .replace(/\s*[*＊]\s*(?=[0-9A-Za-z가-힣]{2,5}(?:$|\s))/g, "#")
      .replace(/#\s*(kr|KR|Kr|kR)\s*[lI|!]/g, "#$11").replace(/#\s*([0-9]*)[Oo]([0-9]+)/g, "#$10$2")
      .replace(/(^|\s)[_|=©¦]+(?=\s)/g, "$1  ").replace(/\s*[…⋯]+\s*/g, "  ");
  }
  // 라인 이름 오인식(한 글자 차이): 성글·정굴 → 정글, 서풋 → 서폿 …
  const LANE_KO = ["탑", "정글", "미드", "원딜", "서폿"];
  function fuzzyLane(tok) {
    const t = String(tok || "").trim();
    if (!/^[가-힣]{1,2}$/.test(t)) return null;
    if (LANE_KO.includes(t)) return t;
    const near = LANE_KO.filter((k) => k.length === t.length && [...k].filter((c, i) => c !== t[i]).length === 1);
    return near.length === 1 && t.length === 2 ? near[0] : null;
  }
  function idsOf(line) {
    const out = []; let m; ID_RE.lastIndex = 0;
    while ((m = ID_RE.exec(line))) out.push({ id: `${m[1].trim()}#${m[2]}`, at: m.index, end: m.index + m[0].length });
    return out;
  }
  function fromText(text, opts) {
    opts = opts || {};
    const resolve = opts.resolve || (() => null);
    const src = String(text || "").replace(/\r/g, "").replace(/[＃♯]/g, "#").replace(/[  ]+/g, " ");
    const lines = src.split("\n").map((l) => l.trim());
    // 엑셀에서 복사한 표: 칸이 탭으로 나뉘고 첫 칸이 「팀」·라인 이름이면 그대로 줄 배열
    if (lines.some((l) => l.includes("\t")) && lines.filter((l) => l.includes("\t")).every((l) => /^(팀|팀명|team|라인|탑|정글|미드|원딜|서폿|top|jg|mid|ad|adc|bot|sup)?\t/i.test(l) || !l.split("\t")[0]))
      return { rows: lines.map((l) => l.split("\t").map((c) => c.trim())), notes: [] };
    const rows = [], notes = [];
    let team = null, nextLane = 0, last = null;
    const ORDER = ["탑", "정글", "미드", "원딜", "서폿"];
    const KO = { top: "탑", jg: "정글", jug: "정글", jungle: "정글", mid: "미드", 바텀: "원딜", 봇: "원딜", ad: "원딜", adc: "원딜", bot: "원딜", 서포터: "서폿", 서포트: "서폿", sup: "서폿", support: "서폿" };
    const newTeam = (name, our) => { team = { head: ["팀", name, our ? "우리팀" : "상대"], lanes: {} }; rows.push(team); nextLane = 0; last = null; };
    const hasIds = lines.map((l) => idsOf(l).length > 0);
    lines.forEach((l0, i) => {
      if (!l0) return;
      let l = l0.replace(/^\s*(\d{1,2}[.)]|[-•·*▶►])\s*/, "");   // 「1.」「-」 같은 줄머리
      let ocrLane = null;
      if (opts.ocr) {
        // 사진 글: 칸 사이가 넓은 빈칸·잡음으로 나뉨 → 첫 칸이 라인 이름(오인식 포함)이면 떼고, 계정은 # 있는 칸에서
        l = ocrClean(l);
        const segs = l.split(/\s{2,}/).map((x) => x.trim()).filter(Boolean);
        if (segs.length > 1) { const fl = fuzzyLane(segs[0]) || (LANE_RE.test(segs[0]) ? segs[0] : null); const withId = segs.filter((x) => idsOf(x).length);
          if (withId.length) { ocrLane = fl ? (LANE_KO.includes(fl) ? fl : null) : null; l = (fl ? fl + " " : "") + withId.join("  "); } }
        else { const m2 = l.match(/^([가-힣]{2})\s+(.+#.+)$/); if (m2 && fuzzyLane(m2[1])) l = fuzzyLane(m2[1]) + " " + m2[2]; }
        l = l.replace(/(^|\s)[^\s#가-힣A-Za-z0-9]+(?=[가-힣A-Za-z0-9])/g, "$1");   // 이름 앞 기호 잡음
      }
      const isAlt = ALT_RE.test(l), lm = isAlt ? null : l.match(LANE_RE);
      // 라인 이름·「부계정」 머리를 떼고 계정을 찾는다(머리가 이름에 붙지 않게)
      const body = isAlt ? l.replace(ALT_RE, "") : lm ? l.slice(lm[0].length).replace(/^[\s:：.)\]\-–|]+/, "") : l;
      const ids = idsOf(body);
      const head = l.match(/^(팀명?|team)\s*[:：]?\s*(.+)$/i);
      if (!ids.length) {
        // 팀 이름 줄: 「팀: 이름」, 또는 (사진 글이 아닐 때) 바로 아래가 계정 줄인 짧은 줄
        const nm = head ? head[2] : !opts.ocr && l.length <= 30 && hasIds.slice(i + 1).find((x, k) => lines[i + 1 + k]) && !LANE_RE.test(l) ? l : null;
        if (nm) { const our = /우리/.test(nm); newTeam(nm.replace(/[(（\[]?\s*(우리\s*팀?|상대\s*팀?)\s*[)）\]]?/g, "").replace(/[:：\-–]+$/, "").trim() || opts.team || "새 팀", our); }
        return;
      }
      if (!team) newTeam(opts.team || "새 팀", !!opts.our);
      // 부계정 줄 → 바로 위 라인
      if (isAlt && last) { ids.forEach((x) => { if (last.acc.length < 3 && !last.acc.includes(x.id)) last.acc.push(x.id); }); return; }
      let ko = lm ? (ORDER.includes(lm[1]) ? lm[1] : KO[lm[1].toLowerCase()] || null) : null;
      if (!ko) { ko = ORDER.find((x, k) => k >= nextLane && !team.lanes[x]) || ORDER.find((x) => !team.lanes[x]); if (!ko) { notes.push(`${team.head[1]}: 라인이 다 찼는데 계정 줄이 더 있습니다 — 「${l0.slice(0, 30)}」`); return; } }
      nextLane = ORDER.indexOf(ko) + 1;
      // 계정 뒤 남은 글: 티어 · 챔프폭
      const restRaw = body.slice(ids[ids.length - 1].end) + " " + body.slice(0, ids[0].at);
      let tier = "";
      const tm = restRaw.match(TIER_RE);
      if (tm) { const t = TIER_FIX[tm[1]] || tm[1]; tier = /마스터|챌린저/.test(t) ? `${t}${tm[3] ? " " + tm[3].replace(/\s/g, "") : ""}` : `${t}${tm[2] ? " " + tm[2] : ""}`; }
      const rest = restRaw.replace(TIER_RE, " ");
      const pool = rest.split(/[,，、;/]+/).map((x) => x.trim()).filter(Boolean).filter((tok) => { const nm = tok.replace(/\s*[:：(]?\s*(상|중|하|원챔|원)\s*\)?$/, "").trim(); return nm && resolve(nm); }).join(", ");
      const p = { acc: [], tier, pool };
      ids.forEach((x) => { if (p.acc.length < 3 && !p.acc.includes(x.id)) p.acc.push(x.id); });
      if (team.lanes[ko]) notes.push(`${team.head[1]} ${ko}: 두 번 나와 나중 것을 씁니다`);
      team.lanes[ko] = p; last = p;
    });
    const out = [];
    rows.forEach((t) => {
      out.push(t.head.slice()); out.push(HEAD.slice());
      ORDER.forEach((ko) => { const p = t.lanes[ko]; if (p) out.push([ko, p.acc[0] || "", p.acc[1] || "", p.acc[2] || "", p.tier, "", p.pool]); });
      out.push([]);
    });
    return { rows: out, notes };
  }
  root.TeamSheet = { LANES, HEAD, MAX, riotOf, toRows, parse, diff, apply, sheetLayout, fromText, idsOf, ocrClean };
})(typeof window !== "undefined" ? window : globalThis);
