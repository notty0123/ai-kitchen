// スコアの計算（docs/SCORE_RANK.md）：Lv → 点数 → 中身 → 指紋 の順に、上の段が必ず勝つ数字にする

export const SCORE_MAX = 1588979999;
export const POINTS_MAX = 88; // 合計点：基本 50 ＋上級×2 20 ＋成果×3 18
export const DETAIL_MAX = 979;

// コードの全文字から作る指紋（FNV-1a）
function fnv1a(text) {
  let h = 0x811c9dc5;
  for (const ch of text) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function codeText(code) {
  const st = (x) => (x.unknown ? '?' : String(x.level));
  return `${code.axes}|${code.items.map(st).join('')}|${code.adv.map(st).join('')}|${code.ach.map(st).join('')}|${code.exp}|${code.material}`;
}

// 中身：◎の数×20 ＋ いちばん長いコンボ×8 ＋ PERFECT の行×20 ＋ 経験値19
export function detailOf(code) {
  const all = [...code.items, ...code.adv, ...code.ach];
  const doubles = all.filter((x) => !x.unknown && x.level === 2).length;
  let combo = 0;
  let run = 0;
  for (const x of code.items) {
    run = !x.unknown && x.level === 2 ? run + 1 : 0;
    combo = Math.max(combo, run);
  }
  let perfect = 0;
  for (let r = 0; r < 5; r++) {
    if (code.items.slice(r * 5, r * 5 + 5).every((x) => !x.unknown && x.level === 2)) perfect++;
  }
  return doubles * 20 + combo * 8 + perfect * 20 + (code.exp === 1 ? 19 : 0);
}

// 霧なら null
export function scoreOf(code, r) {
  if (r.fog || r.level == null) return null;
  const points = r.total;
  return r.level * 100000000 + points * 1000000 + detailOf(code) * 1000 + (fnv1a(codeText(code)) % 1000);
}

// サーバーでも使う形のチェック（本物かどうかの証明ではない）
export function plausible(score) {
  if (!Number.isInteger(score) || score < 100000000 || score > SCORE_MAX) return false;
  const lv = Math.floor(score / 100000000);
  const points = Math.floor((score % 100000000) / 1000000);
  const detail = Math.floor((score % 1000000) / 1000);
  return lv >= 1 && lv <= 15 && points <= POINTS_MAX && detail <= DETAIL_MAX;
}

export const formatScore = (s) => s.toLocaleString('en-US');

// 上位◯%（切り上げて、実際より良く見せない）。1% 未満は小数2桁、10% 未満は小数1桁
// 小数の誤差で余分に切り上がらないよう、整数のまま割り算して切り上げる
const ceilDiv = (a, b) => Math.floor((a + b - 1) / b);
export function topPercent(rank, total) {
  if (rank * 100 < total) return String(ceilDiv(rank * 10000, total) / 100);
  if (rank * 10 < total) return String(ceilDiv(rank * 1000, total) / 10);
  return String(ceilDiv(rank * 100, total));
}
