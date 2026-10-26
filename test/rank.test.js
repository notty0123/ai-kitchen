import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreOf, detailOf, plausible, SCORE_MAX } from '../public/js/rank.js';
import { score2 } from '../public/js/score2.js';

const st = (v) => (v === '?' ? { level: 0, unknown: true } : { level: v, unknown: false });
const make = (items, adv = [0, 0, 0, 0, 0], exp = 0, axes = 'BBBB', ach = [0, 0, 0]) => ({ axes, items: items.map(st), adv: adv.map(st), ach: ach.map(st), exp, material: 'M' });
const sc = (c) => scoreOf(c, score2(c));

test('満点の形と最大値', () => {
  const c = make(Array(25).fill(2), Array(5).fill(2), 1, 'BBBB', [2, 2, 2]);
  assert.equal(detailOf(c), 33 * 20 + 25 * 8 + 5 * 20 + 19); // 979
  const s = sc(c);
  assert.ok(s <= SCORE_MAX);
  assert.equal(Math.floor(s / 100000000), 15);
  assert.ok(plausible(s));
});

test('上の段が1でも大きければ必ず上（点数1点差は中身・指紋で逆転しない）', () => {
  // 同じ Lv で、点数が1点だけ違う2人
  const lo = make([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 0]); // 44点
  const hi = make([1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]); // 45点
  const a = score2(lo);
  const b = score2(hi);
  if (a.level === b.level) assert.ok(sc(hi) > sc(lo));
  else assert.ok(b.level > a.level && sc(hi) > sc(lo));
});

test('同じコードなら同じ、1項目違えば別の数字', () => {
  const items = Array(25).fill(1);
  assert.equal(sc(make(items)), sc(make(items)));
  const b = [...items];
  b[24] = '?';
  assert.notEqual(sc(make(items)), sc(make(b)));
  assert.notEqual(sc(make(items, undefined, 0, 'BBBB')), sc(make(items, undefined, 0, 'BBBA')));
});

test('霧は null', () => {
  const items = [2, 2, ...Array(23).fill('?')];
  assert.equal(sc(make(items)), null);
});

test('サーバー側の形のチェック', () => {
  assert.equal(plausible(99999999), false);
  assert.equal(plausible(1600000000), false);
  assert.equal(plausible(1588979999), true);
  assert.equal(plausible(1589000000), false); // 点数 89
  assert.equal(plausible(1088979000), true); // 点数 88・中身 979
  assert.equal(plausible(1060980000), false); // 中身 980
  assert.equal(plausible(1.5), false);
  assert.equal(plausible('1000000000'), false);
  assert.equal(plausible(1046919407), true);
});

import { topPercent } from '../public/js/rank.js';
test('上位◯%（切り上げ）', () => {
  assert.equal(topPercent(1, 10000), '0.01');
  assert.equal(topPercent(10, 10000), '0.1');
  assert.equal(topPercent(37, 1204), '3.1');
  assert.equal(topPercent(500, 1000), '50');
  assert.equal(topPercent(1, 1), '100');
  assert.equal(topPercent(1, 3), '34');
  assert.equal(topPercent(7, 100), '7');
  assert.equal(topPercent(14, 100), '14');
  assert.equal(topPercent(29, 100), '29');
  assert.equal(topPercent(57, 10000), '0.57');
  for (let t = 1; t <= 400; t++) for (let k = 1; k <= t; k++) assert.ok(Number(topPercent(k, t)) >= (k / t) * 100 - 1e-9, `${k}/${t}`);
});
