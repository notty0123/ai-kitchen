// AI キッチン診断：コードの解読と Lv 計算。決まりは docs/RULES.md

export const MAX_INPUT = 2000;

const CODE_RE = /AK1-([ABab?]{4})-([012]{5})-([012]{5})-([012]{5})-([012]{5})-([012]{5})-([012])([LMH])/g;

export const ELEMENTS = ['T', 'K', 'N', 'M', 'U'];

export const AXES = [
  { key: 'tell', A: 'ひと声で頼む', B: '条件を添える' },
  { key: 'pace', A: '一度で仕上げる', B: '対話で仕上げる' },
  { key: 'scope', A: '工程ごとに頼む', B: 'ひとまとまりで頼む' },
  { key: 'habit', A: 'その場で組み立てる', B: 'いつもの型を使う' },
];

// 暗号っぽいコード（AK2）を、数字の形（AK1 と同じ中身）に戻す。表にない文字があれば null
const AK2_RE = /AK2-([A-Z]{4})-([A-Z]{5})-([A-Z]{5})-([A-Z]{5})-([A-Z]{5})-([A-Z]{5})-([A-Z])([A-Z])/g;
const AXIS_SYMBOLS = ['A', 'B', 'a', 'b', '?'];
const ITEM_VALUES = [1, 0, 2];
const EXP_VALUES = [1, 0, 2];
const MATERIAL_VALUES = ['L', 'M', 'H'];

export function decodeAK2(m, book) {
  const axes = [...m[1]].map((ch, i) => AXIS_SYMBOLS[book.axes[i].indexOf(ch)]);
  const items = [2, 3, 4, 5, 6].map((g, r) => [...m[g]].map((ch, c) => ITEM_VALUES[book.items[r * 5 + c].indexOf(ch)]));
  const exp = EXP_VALUES[book.exp.indexOf(m[7])];
  const material = MATERIAL_VALUES[book.material.indexOf(m[8])];
  if (axes.includes(undefined) || items.flat().includes(undefined) || exp === undefined || !material) return null;
  return { axes: axes.join(''), items, exp, material };
}

export function extractAK2(text, book) {
  if (typeof text !== 'string' || text.length > MAX_INPUT) return null;
  const found = [...text.matchAll(AK2_RE)];
  if (found.length !== 1) return null;
  const m = found[0];
  const before = text[m.index - 1];
  const after = text[m.index + m[0].length];
  if ((before && /[\w-]/.test(before)) || (after && /[\w-]/.test(after))) return null;
  return decodeAK2(m, book);
}

// 行 = 伝え方+進め方、列 = 任せ方+育て方
const TYPE_NAMES = {
  AA: { AA: 'まかない料理人', AB: '屋台の焼きそば屋', BA: 'おまかせ弁当屋', BB: '「いつもの」の定食屋' },
  AB: { AA: '鉄板焼きの料理人', AB: 'ラーメン職人', BA: 'キッチンカーの店主', BB: '町の洋食屋' },
  BA: { AA: 'レシピ研究家', AB: 'パン職人', BA: 'ケータリング担当', BB: '給食の調理チーム' },
  BB: { AA: '創作料理のシェフ', AB: 'パティシエ', BA: 'パーティ料理の幹事', BB: 'レストランのシェフ' },
};

const LV_BY_COUNT = [1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 5, 5, 6, 6, 6, 7, 7, 8, 8, 8, 9, 9, 10, 10, 10];

export const FOG_THRESHOLD = 10;

// 条件をかける前の Lv（演出で絵を1段ずつ進化させるのに使う）
export const levelByCount = (yes) => LV_BY_COUNT[Math.max(0, Math.min(25, yes))];

// その Lv に必要な ✅ の最小数（index = Lv）
export const LV_MIN = [0, 0, 3, 6, 8, 11, 13, 16, 18, 21, 23];

// その Lv に上がるのに要素ごとに必要な ✅ の数
export const elementNeed = (lv) => (lv >= 10 ? 4 : lv >= 9 ? 3 : 0);

// 貼られた文章から診断コードを1つだけ取り出す。読めなければ null
export function extractCode(text) {
  if (typeof text !== 'string' || text.length > MAX_INPUT) return null;
  const found = [...text.matchAll(CODE_RE)];
  if (found.length !== 1) return null;
  const m = found[0];
  // 前後が英数字・「-」・「_」に続いていたら、別の長い文字列の一部とみなして読まない
  const before = text[m.index - 1];
  const after = text[m.index + m[0].length];
  if ((before && /[\w-]/.test(before)) || (after && /[\w-]/.test(after))) return null;
  return {
    axes: m[1],
    items: m.slice(2, 7).map((g) => g.split('').map(Number)),
    exp: Number(m[7]),
    material: m[8],
  };
}

function capByConditions(lv, perElement) {
  const minYes = Math.min(...perElement);
  if (lv >= 10 && minYes < 4) lv = 9;
  if (lv >= 9 && minYes < 3) lv = 8;
  return lv;
}

export function judgeType(axes) {
  const chars = axes.split('');
  const known = chars.map((c) => (c === '?' ? null : c.toUpperCase()));
  const close = chars.map((c) => c === 'a' || c === 'b');
  const provisional = known.includes(null);
  const name = provisional ? null : TYPE_NAMES[known[0] + known[1]][known[2] + known[3]];
  return {
    name,
    provisional,
    axes: AXES.map((ax, i) => ({
      key: ax.key,
      side: known[i],
      label: known[i] ? ax[known[i]] : null,
      close: close[i],
    })),
  };
}

// 要素ごとの ✅ 数と経験値から、最終の Lv を出す（霧の判定はしない）
export function levelOf(perElement, exp) {
  const yes = perElement.reduce((a, b) => a + b, 0);
  const baseLevel = capByConditions(LV_BY_COUNT[yes], perElement);
  const level = exp === 1 ? capByConditions(Math.min(10, baseLevel + 1), perElement) : baseLevel;
  return { baseLevel, level };
}

export function score(code) {
  const perElement = code.items.map((row) => row.filter((v) => v === 1).length);
  const yes = perElement.reduce((a, b) => a + b, 0);
  const unknown = code.items.flat().filter((v) => v === 2).length;
  const no = code.items.flat().filter((v) => v === 0).length;
  const type = judgeType(code.axes);
  const base = { type, yes, no, unknown, perElement, material: code.material };

  if (unknown >= FOG_THRESHOLD) {
    return { ...base, fog: true, level: null, baseLevel: null, bonus: false, stars: 0 };
  }

  const { baseLevel, level } = levelOf(perElement, code.exp);
  const bonus = level > baseLevel;
  const stars = level >= 8 ? level - 7 : 0;
  return { ...base, fog: false, level, baseLevel, bonus, stars };
}

// ❌ の項目 ID（例 'K3'）。❓ は含めない
export function missingItems(code) {
  const out = [];
  code.items.forEach((row, i) => row.forEach((v, j) => { if (v === 0) out.push(`${ELEMENTS[i]}${j + 1}`); }));
  return out;
}
