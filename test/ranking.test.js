// 集計の数え方（src/counter.js）を、素朴な数え方と照らし合わせる
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Counter, cellOf, CELLS } from '../src/counter.js';
import { plausible, SCORE_MAX } from '../public/js/rank.js';

const key = (s) => Math.floor(s / 1000); // 指紋（下3桁）を除いたもの

test('マスの順位が、素朴に数えた順位と一致する（指紋だけ違う人は先着順）', () => {
  const c = new Counter();
  const seen = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let k = 0; k < 3000; k++) {
    // 同じマスがよく出るように、狭い範囲から選ぶ
    const lv = 1 + Math.floor(rnd() * 15);
    const pts = Math.floor(rnd() * 5);
    const s = lv * 100000000 + pts * 1000000 + Math.floor(rnd() * 3) * 1000 + Math.floor(rnd() * 4);
    const { higher, same } = c.standing(cellOf(s));
    assert.equal(higher, seen.filter((x) => key(x) > key(s)).length);
    assert.equal(same, seen.filter((x) => key(x) === key(s)).length);
    c.add(cellOf(s), 1);
    seen.push(s);
    assert.equal(c.total, seen.length);
  }
});

test('マスの番号は、受け付けるスコアの範囲で 0〜CELLS-1 に収まり、スコアの順と同じ向き', () => {
  assert.equal(cellOf(100000000), 0);
  assert.equal(cellOf(SCORE_MAX), CELLS - 1);
  assert.ok(plausible(SCORE_MAX));
  const a = 512345678;
  const b = 512346000;
  assert.ok(cellOf(a) < cellOf(b));
  assert.ok(cellOf(1488979999) < cellOf(1500000000));
});

test('21億件を超えても順位が壊れない', () => {
  const c = new Counter();
  c.add(0, 2147483647);
  c.add(0, 1);
  assert.deepEqual(c.standing(1), { higher: 0, same: 0 });
  assert.equal(c.standing(0).same, 2147483648);
});

test('1 分たった接続元は、分が変わったときに消える', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('src/worker.js', 'utf8');
  const body = src.slice(src.indexOf('  limited(ip, now) {'), src.indexOf('  // 数える・足す・返す'));
  const L = new Function(`const PER_MINUTE = 3000, MAX_IPS = 20000, PER_IP = 5; return class { constructor() { this.minute = 0; this.minuteN = 0; this.hits = new Map(); }\n${body}\n}`)();
  const x = new L();
  x.limited('old', 60000);
  x.limited('new', 86400000);
  assert.equal(x.hits.has('old'), false);
  for (let i = 0; i < 4; i++) assert.equal(x.limited('new', 86400001), false); // 1 回目は上で送った分
  assert.equal(x.limited('new', 86400002), true);
});
