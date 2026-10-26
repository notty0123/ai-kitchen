import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score2, nextGoal2, strength2 } from '../public/js/score2.js';

// 要素ごとの点の並び（各5項目 0/1/2、'?' は不明）から code を作る
const st = (v) => (v === '?' ? { level: 0, unknown: true } : { level: v, unknown: false });
function make(rows, adv = [0, 0, 0, 0, 0], exp = 0, ach = [0, 0, 0]) {
  return { axes: 'BBBB', items: rows.flat().map(st), adv: adv.map(st), ach: ach.map(st), exp, material: 'M' };
}
const row = (n2, n1 = 0) => [...Array(n2).fill(2), ...Array(n1).fill(1), ...Array(5 - n2 - n1).fill(0)];
const full = (pts) => {
  const per = [0, 0, 0, 0, 0];
  for (let k = 0; k < pts; k++) per[k % 5]++;
  return per.map((p) => row(Math.floor(p / 2), p % 2));
};

test('基本点で Lv1〜10（境目）', () => {
  const lvOf = (pts) => score2(make(full(pts))).level;
  assert.deepEqual([0, 4, 5, 9, 10, 14, 15, 19, 20, 24, 25, 29, 30, 34, 35, 39, 40, 44, 45, 50].map(lvOf), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10]);
});

test('Lv10 までは上級なしで行ける', () => {
  const r = score2(make([row(5), row(5), row(5), row(4, 1), row(4, 1)])); // 48点・上級0
  assert.equal(r.level, 10);
  assert.equal(r.master, false);
  assert.equal(r.stars, 3);
});

test('分野の条件：いちばん低い分野で、Lv10・11 は 2 点、Lv12・13 は 3 点、Lv14・15 は 4 点以上', () => {
  const lv = (per, adv, ach, exp = 0) => score2(make(per.map((p) => row(Math.floor(p / 2), p % 2)), adv, exp, ach)).level;
  const A = [2, 2, 2, 2, 2];
  const S = [2, 2, 2];
  assert.equal(lv([10, 10, 10, 10, 1], A, S), 9);
  assert.equal(lv([10, 10, 10, 10, 2], A, S), 11);
  assert.equal(lv([10, 10, 10, 10, 3], A, S), 13);
  assert.equal(lv([10, 10, 10, 10, 4], A, S), 15);
  assert.equal(lv([10, 10, 10, 10, 1], undefined, undefined), 9); // 41点 → 合計の Lv9
  assert.equal(lv([10, 10, 10, 10, 6], undefined, undefined), 10);
});

test('経験値ボーナスは +1、Lv10 で止まり、条件も再チェック', () => {
  const a = score2(make(full(40), undefined, 1)); // 40点 Lv9 → 10
  assert.equal(a.baseLevel, 9);
  assert.equal(a.level, 10);
  assert.equal(a.bonus, true);
  const b = score2(make([row(5), row(5), row(5), row(5), row(0, 1)], undefined, 1)); // 41点 Lv9 → 10 だが1分野1点 → 9
  assert.equal(b.level, 9);
  assert.equal(b.bonus, false);
  const c = score2(make(full(50), undefined, 1)); // もう Lv10
  assert.equal(c.level, 10);
  assert.equal(c.bonus, false);
});

test('合計点（基本＋上級×2＋成果×3）で Lv、上の Lv には条件', () => {
  const lv = (base, adv, ach) => score2(make(full(base), adv, 0, ach)).level;
  assert.equal(lv(46, [2, 1, 0, 0, 0]), 11); // 合計 52・上級3
  assert.equal(lv(46, [1, 1, 0, 0, 0]), 10); // 合計 50
  assert.equal(lv(50, [1, 1, 0, 0, 0]), 10); // 合計 54 だが上級2点 → 10 止まり
  assert.equal(lv(40, [2, 2, 2, 0, 0], [1, 0, 0]), 11); // 合計 55
  assert.equal(lv(40, [2, 2, 2, 2, 2], [0, 0, 0]), 12); // 合計 60（上級10点）
  assert.equal(lv(46, [2, 2, 2, 2, 2], [0, 0, 0]), 13); // 合計 66
  assert.equal(lv(50, [2, 2, 2, 2, 2], [1, 1, 1]), 13); // 合計 79 だが成果3点 → 13 止まり
  assert.equal(lv(40, [2, 2, 2, 2, 1], [2, 2, 1]), 14); // 合計 73・成果5
  assert.equal(lv(46, [2, 2, 2, 2, 1], [2, 2, 2]), 15); // 合計 82・成果満点・上級9
  assert.equal(lv(40, [2, 2, 2, 2, 1], [2, 2, 2]), 14); // 合計 76 < 78
  const top = score2(make(full(50), [2, 2, 2, 2, 2], 0, [2, 2, 2]));
  assert.equal(top.level, 15);
  assert.equal(top.crown, true);
  assert.equal(top.total, 88);
  // 基本が少なくても、上級・成果で上がる（ただし合計点のぶんだけ）
  assert.equal(lv(20, [2, 2, 2, 2, 2], [2, 2, 2]), 12); // 合計 58
  // 上級を盛っても、上級だけでは Lv11 に届かない
  assert.equal(lv(15, [2, 2, 2, 2, 2]), 8); // 合計 35
});

test('霧は ? が23個以上（上級の ? は数えない）', () => {
  const q = ['?', '?', '?', '?', '?'];
  assert.equal(score2(make([[2, 2, '?', '?', '?'], q, q, q, q])).fog, true);
  const light = score2(make([[2, 2, 1, '?', '?'], q, q, q, q], ['?', '?', '?', '?', '?']));
  assert.equal(light.fog, false);
  assert.equal(light.level, 2);
});

test('次の目標の文', () => {
  assert.equal(nextGoal2(score2(make(full(30))), 0).text, '合計点をあと5点で ★ ひとつ星！');
  assert.equal(nextGoal2(score2(make(full(30), undefined, 1)), 1).text, '合計点をあと5点で ★★ ふたつ星！'); // 35点で Lv8 → ボーナスで 9
  assert.equal(nextGoal2(score2(make([row(5), row(5), row(5), row(5), row(0, 1)])), 0).text, '「使い分け」をあと1点、さらに合計点をあと3点で ★★★ 三ツ星！');
  assert.equal(nextGoal2(score2(make(full(50), [1, 1, 0, 0, 0])), 0).text, '上級の仕組みをあと1点で Lv11 マスター！');
  assert.equal(nextGoal2(score2(make(full(46), [2, 2, 1, 0, 0])), 0).text, '合計点をあと2点で Lv12 マスター！');
  assert.equal(nextGoal2(score2(make(full(46), [2, 2, 2, 0, 0])), 0).text, '上級の仕組みをあと1点、さらに合計点をあと4点で Lv13 マスター！');
  assert.equal(nextGoal2(score2(make(full(50), [2, 2, 2, 2, 2], 0, [1, 1, 1])), 0).text, '成果をあと1点で Lv14 マスター！');
  assert.equal(nextGoal2(score2(make(full(46), [2, 2, 2, 2, 1], 0, [2, 2, 0])), 0).text, '成果をあと2点で 👑 グランシェフ！');
  assert.equal(nextGoal2(score2(make(full(50), [2, 2, 2, 2, 2], 0, [2, 2, 2])), 0), null);
});

test('強み', () => {
  assert.equal(strength2([10, 8, 6, 10, 9]), '「伝える」「任せる」は満点！ ここがあなたの強み');
  assert.equal(strength2([3, 7, 2, 0, 1]), 'いちばん強いのは「確かめる」');
});
