// 대회 팀 명단(처음 쓴 팀 공간 subin 전용)은 공개 파일이 아니라 Worker /data/teams(팀 열쇠)로 받는다(11-19).
// 여기서는 이 브라우저에 받아 둔 사본으로 바로 시작하고, app.js가 열쇠로 새로 받아 바뀌었으면 반영한다. 사본이 없으면 빈 명단.
(function () {
  let c = null;
  try { c = JSON.parse(localStorage.getItem("lolban.seed.v1") || "null"); } catch (e) { c = null; }
  window.SEED_TEAMS = c && Array.isArray(c.teams) ? c.teams : [];
  window.SEED_OUR_TEAM = (c && c.our) || "subin";
  window.SEED_VERSION = (c && c.version) || 0;
})();
