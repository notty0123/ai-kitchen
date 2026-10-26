// 採点 v2/v5（docs/SCORING_v2.md の 4''' 章）：25項目 3段階＋上級5項目＋成果3項目、Lv1〜15、AK4 コード
import { judgeType } from './scoring.js';

export const MAX_INPUT = 20000;
export const ELEMENT_NAMES = ['伝える', '確かめる', '直す', '任せる', '使い分け'];
export const BASE_MIN = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45]; // index = Lv-1（Lv1〜10 に必要な基本点）
export const FOG_UNKNOWN = 23;
export const MAX_LEVEL = 15;

const CODE_RE = /AK4-([A-Z]{4})-([A-Z]{5})-([A-Z]{5})-([A-Z]{5})-([A-Z]{5})-([A-Z]{5})-([A-Z]{5})-([A-Z]{3})-([A-Z])([A-Z])/g;
const AXIS_SYMBOLS = ['A', 'B', 'a', 'b', '?'];
// 表の並び：◎(2) ○(1) ×(0) ？
const STATES = [{ level: 2, unknown: false }, { level: 1, unknown: false }, { level: 0, unknown: false }, { level: 0, unknown: true }];

// AI が表にない文字を書くことがある（項目の文字の取り違えなど）。2 か所までは、その項目を「？」として読む
export const MAX_FIXES = 2;
function decode(m, book) {
  let fixed = 0;
  const pick = (list, ch, values, fallback) => {
    const i = list.indexOf(ch);
    if (i >= 0) return values[i];
    fixed++;
    return fallback;
  };
  const axes = [...m[1]].map((ch, i) => pick(book.axes[i], ch, AXIS_SYMBOLS, '?'));
  const items = [2, 3, 4, 5, 6].flatMap((g, r) => [...m[g]].map((ch, c) => pick(book.items[r * 5 + c], ch, STATES, STATES[3])));
  const adv = [...m[7]].map((ch, k) => pick(book.adv[k], ch, STATES, STATES[3]));
  const ach = [...m[8]].map((ch, k) => pick(book.ach[k], ch, STATES, STATES[3]));
  const exp = pick(book.exp, m[9], [1, 0, 2], 2);
  const material = pick(book.material, m[10], ['L', 'M', 'H'], 'M');
  if (fixed > MAX_FIXES) return null;
  return { axes: axes.join(''), items, adv, ach, exp, material, fixed };
}

// 貼られた文章から AK4 のコードを1つだけ取り出して読む。読めなければ null
export function extractCode(text, book) {
  if (typeof text !== 'string' || text.length > MAX_INPUT) return null;
  const found = [...text.matchAll(CODE_RE)];
  if (found.length !== 1) return null;
  const m = found[0];
  const before = text[m.index - 1];
  const after = text[m.index + m[0].length];
  if ((before && /[\w-]/.test(before)) || (after && /[\w-]/.test(after))) return null;
  return decode(m, book);
}

export const levelOfPoints = (base) => BASE_MIN.filter((p) => base >= p).length;
// Lv の決め方 v5（docs/SCORING_v2.md の 4''' 章）：合計点で Lv を決め、上の Lv だけ条件を付ける
// 合計点 = 基本（0〜50）＋上級×2（0〜20）＋成果×3（0〜18）。1 点違いで何段も跳ばないようにする
export const TOTAL_MIN = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 52, 58, 64, 70, 78]; // index = Lv-1
export const totalOf = (base, adv, ach) => base + 2 * adv + 3 * ach;
// その Lv に要る条件（満たさなければ、その手前の Lv で止まる）
export const GATES = [
  // いちばん低い分野の点で、届く Lv を少しずつ広げる（1 点で何段も跳ばないように 2 段ずつ）
  { lv: 10, need: (r) => r.minEl >= 2, el: 2 }, // Lv10・11 は 2 点以上
  { lv: 12, need: (r) => r.minEl >= 3, el: 3 }, // Lv12・13 は 3 点以上
  { lv: 14, need: (r) => r.minEl >= 4, el: 4 }, // Lv14・15 は 4 点以上
  { lv: 11, need: (r) => r.advPoints >= 3, adv: 3 },
  { lv: 13, need: (r) => r.advPoints >= 7, adv: 7 },
  { lv: 14, need: (r) => r.achPoints >= 4, ach: 4 },
  { lv: 15, need: (r) => r.achPoints === 6 && r.advPoints >= 9, ach: 6, adv: 9 },
];
const cap = (lv, r) => GATES.reduce((m, g) => (m >= g.lv && !g.need(r) ? g.lv - 1 : m), lv);

// 計算の順番：霧 → 合計点の Lv → 経験値（Lv10 まで）→ 条件
export function score2(code) {
  const lv = code.items.map((x) => x.level);
  const perElement = [0, 1, 2, 3, 4].map((r) => lv.slice(r * 5, r * 5 + 5).reduce((a, b) => a + b, 0));
  const base = perElement.reduce((a, b) => a + b, 0);
  const advPoints = code.adv.reduce((a, x) => a + x.level, 0);
  const achPoints = code.ach.reduce((a, x) => a + x.level, 0);
  const unknown = code.items.filter((x) => x.unknown).length;
  const minEl = Math.min(...perElement);
  const total = totalOf(base, advPoints, achPoints);
  const out = { type: judgeType(code.axes), perElement, base, advPoints, achPoints, total, minEl, unknown, material: code.material };
  if (unknown >= FOG_UNKNOWN) return { ...out, fog: true, level: null, baseLevel: null, bonus: false, master: false, crown: false, stars: 0 };

  const raw = TOTAL_MIN.filter((t) => total >= t).length;
  const baseLevel = cap(raw, out);
  const level = code.exp === 1 && raw < 10 ? cap(raw + 1, out) : baseLevel;
  const bonus = level > baseLevel;
  const reached10 = level >= 10;
  return {
    ...out,
    fog: false,
    level,
    baseLevel,
    bonus,
    reached10,
    master: level > 10,
    crown: level === MAX_LEVEL,
    stars: level >= 10 ? 3 : level >= 8 ? level - 7 : 0,
  };
}

export function goalName(lv) {
  if (lv === MAX_LEVEL) return '👑 グランシェフ';
  if (lv > 10) return `Lv${lv} マスター`;
  if (lv === 10) return '★★★ 三ツ星';
  if (lv === 9) return '★★ ふたつ星';
  if (lv === 8) return '★ ひとつ星';
  return `Lv${lv}`;
}

// 次の Lv まで、何があと何点要るか
export function nextGoal2(r, exp) {
  if (r.fog || r.crown) return null;
  const target = r.level + 1;
  const parts = [];
  const short = [];
  let gained = 0; // 条件を満たすと、そのぶん合計点も増える
  const elNeed = Math.max(0, ...GATES.filter((g) => g.el && g.lv <= target).map((g) => g.el));
  r.perElement.forEach((p, i) => {
    if (p < elNeed) {
      short.push({ i, lack: elNeed - p });
      parts.push(`「${ELEMENT_NAMES[i]}」をあと${elNeed - p}点`);
      gained += elNeed - p;
    }
  });
  for (const g of GATES) {
    if (g.lv > target || g.need(r)) continue;
    if (g.adv && r.advPoints < g.adv) {
      parts.push(`上級の仕組みをあと${g.adv - r.advPoints}点`);
      gained += 2 * (g.adv - r.advPoints);
    }
    if (g.ach && r.achPoints < g.ach) {
      parts.push(`成果をあと${g.ach - r.achPoints}点`);
      gained += 3 * (g.ach - r.achPoints);
    }
  }
  const need = TOTAL_MIN[exp === 1 && target <= 10 ? target - 2 : target - 1];
  const rest = need - r.total - gained;
  if (rest > 0) parts.push(parts.length ? `さらに合計点をあと${rest}点` : `合計点をあと${rest}点`);
  if (!parts.length) parts.push('あと1点');
  return { short, text: `${parts.join('、')}で ${goalName(target)}！` };
}

export function strength2(perElement) {
  const full = perElement.map((p, i) => (p === 10 ? i : -1)).filter((i) => i >= 0);
  if (full.length) return `${full.map((i) => `「${ELEMENT_NAMES[i]}」`).join('')}は満点！ ここがあなたの強み`;
  const max = Math.max(...perElement);
  if (max === 0) return 'これから伸びる厨房。どこからでも始められる';
  return `いちばん強いのは「${ELEMENT_NAMES[perElement.indexOf(max)]}」`;
}
