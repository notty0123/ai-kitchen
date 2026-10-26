// 結果画面のひと言。決まった文の型だけで作る（AI の自由な文章は使わない）
import { elementNeed, levelOf } from './scoring.js';

export const ELEMENT_NAMES = ['伝える', '確かめる', '直す', '任せる', '使い分け'];
export const STAR_NAMES = { 8: 'ひとつ星', 9: 'ふたつ星', 10: '三ツ星' };

export const goalName = (lv) => (STAR_NAMES[lv] ? `${'★'.repeat(lv - 7)} ${STAR_NAMES[lv]}` : `Lv${lv}`);

// 次の Lv まで、あといくつ ✅ が要るか。経験値ボーナスも含めた本当の判定で数える
function minAdditions(perElement, exp, target) {
  let best = Infinity;
  const rec = (i, cur, added) => {
    if (added >= best) return;
    if (i === 5) {
      if (levelOf(cur, exp).level >= target) best = added;
      return;
    }
    for (let k = 0; perElement[i] + k <= 5; k++) rec(i + 1, [...cur, perElement[i] + k], added + k);
  };
  rec(0, [], 0);
  return best;
}

// 次の Lv まで、どの要素があといくつ足りないか
export function nextGoal(perElement, level, exp = 0) {
  if (level == null || level >= 10) return null;
  const target = level + 1;
  const need = elementNeed(target);
  const short = perElement.map((c, i) => ({ i, lack: Math.max(0, need - c) })).filter((x) => x.lack > 0);
  const shortSum = short.reduce((a, x) => a + x.lack, 0);
  const total = minAdditions(perElement, exp, target);
  let text;
  if (short.length) {
    const parts = short.map((x) => `「${ELEMENT_NAMES[x.i]}」をあと${x.lack}つ`).join('、');
    text = `${parts}${total > shortSum ? `、全体であと${total}つ` : ''}で ${goalName(target)}！`;
  } else {
    text = `あと${total}つ ✅ が増えると ${goalName(target)}！`;
  }
  return { target, total, short, text };
}

// いちばんの強み
export function strength(perElement) {
  const full = perElement.map((c, i) => (c === 5 ? i : -1)).filter((i) => i >= 0);
  if (full.length) return `${full.map((i) => `「${ELEMENT_NAMES[i]}」`).join('')}は満点！ ここがあなたの強み`;
  const max = Math.max(...perElement);
  if (max === 0) return 'これから伸びる厨房。どこからでも始められる';
  const i = perElement.indexOf(max);
  return `いちばん強いのは「${ELEMENT_NAMES[i]}」`;
}

export function unseenText(unknown) {
  return unknown ? `AI から見えなかった項目が ${unknown} つ。いつもの AI で占うと、もっと見つかるかも` : null;
}

// ボーナスが条件で止まったとき、どの要素があと何個足りないか（演出の「惜しい！」用）
export function bonusMiss(perElement, baseLevel) {
  if (baseLevel == null || baseLevel >= 10) return null;
  const need = elementNeed(baseLevel + 1);
  const short = perElement.map((c, i) => ({ i, lack: Math.max(0, need - c) })).filter((x) => x.lack > 0);
  if (!short.length) return null;
  return `${short.map((x) => `「${ELEMENT_NAMES[x.i]}」があと${x.lack}つ`).join('、')}足りない！`;
}
