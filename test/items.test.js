import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_INFO, ADV_INFO, ACH_INFO, growthPicks, markOf } from '../public/js/items.js';
import { score2, nextGoal2 } from '../public/js/score2.js';

const st = (v) => (v === '?' ? { level: 0, unknown: true } : { level: v, unknown: false });
const make = (items, adv = [0, 0, 0, 0, 0], ach = [0, 0, 0]) => ({ axes: 'BBBB', items: items.map(st), adv: adv.map(st), ach: ach.map(st), exp: 0, material: 'M' });
const picks = (c) => {
  const r = score2(c);
  return growthPicks(c, r, nextGoal2(r, 0)).map((p) => `${markOf(p.v)}${p.info[0]}`);
};

test('項目の説明は 25・5・3 個', () => {
  assert.equal(ITEM_INFO.length, 25);
  assert.equal(ADV_INFO.length, 5);
  assert.equal(ACH_INFO.length, 3);
});

test('伸ばすならここ：点の低い分野から、○ → ？ → × の順に 3 つ', () => {
  const items = [2, 2, 2, 2, 2, 2, 1, '?', 0, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
  assert.deepEqual(picks(make(items)), ['○基準を渡して確かめさせる', '？別の AI にレビュー', '×誤りを指摘する']);
});

test('Lv10 からは成果・上級を先に出す。全部 ◎ なら空', () => {
  const full = Array(25).fill(2);
  assert.deepEqual(picks(make(full, [2, 2, 2, 2, 1], [2, '?', 1])), ['○失敗から直し続ける', '？手を離しても回る', '○安全と止め方を決める']);
  assert.deepEqual(picks(make(full, [2, 2, 2, 2, 2], [2, 2, 2])), []);
  // Lv10 に届かない人には、上級・成果は出さない
  const low = [2, 2, 2, 0, 0, ...Array(20).fill(1)];
  assert.ok(picks(make(low, [0, 0, 0, 0, 0], [0, 0, 0])).every((s) => !s.includes('成果')));
});

test('参考資料は公式のページだけ・https・項目の名前が正しい', async () => {
  const { REFS, OFFICIAL_HOSTS } = await import('../public/js/items.js');
  const ids = [...'TKNMU'].flatMap((g) => [1, 2, 3, 4, 5].map((n) => `${g}${n}`)).concat(['P1', 'P2', 'P3', 'P4', 'P5', 'S1', 'S2', 'S3']);
  for (const [id, refs] of Object.entries(REFS)) {
    assert.ok(ids.includes(id), id);
    for (const [who, title, url] of refs) {
      const u = new URL(url);
      assert.equal(u.protocol, 'https:', url);
      assert.ok(OFFICIAL_HOSTS.includes(u.hostname), url);
      assert.ok(who && title, id);
    }
  }
});

test('引退した名前の資料を使っていない', async () => {
  const { REFS, RETIRED } = await import('../public/js/items.js');
  for (const refs of Object.values(REFS)) {
    for (const [, title, url] of refs) {
      for (const word of RETIRED) {
        assert.ok(!title.includes(word) && !url.toLowerCase().includes(word.toLowerCase()), `${title} ${url}`);
      }
    }
  }
});

test('「やってみる」は 33 項目すべてにあり、「なぜ」は判定どおり', async () => {
  const { TIPS, reasonOf } = await import('../public/js/items.js');
  const ids = [...'TKNMU'].flatMap((g) => [1, 2, 3, 4, 5].map((n) => `${g}${n}`)).concat(['P1', 'P2', 'P3', 'P4', 'P5', 'S1', 'S2', 'S3']);
  for (const id of ids) assert.ok(TIPS[id], id);
  assert.match(reasonOf({ level: 0, unknown: true }, 'T1'), /確かめられなかった/);
  assert.match(reasonOf({ level: 0, unknown: false }, 'T1'), /やっていない/);
  assert.match(reasonOf({ level: 1, unknown: false }, 'T1'), /1 回だけ/);
  assert.match(reasonOf({ level: 1, unknown: false }, 'P1'), /別々の仕組みが 1〜2 つ/);
  assert.match(reasonOf({ level: 1, unknown: false }, 'S3'), /別々の失敗が/);
  assert.match(reasonOf({ level: 1, unknown: false }, 'K4'), /本人がくり返した跡/);
  assert.match(reasonOf({ level: 1, unknown: false }, 'T1'), /自分の仕組み/);
});

test('○ の項目には「◎ まで」に何を数えるかを出す', async () => {
  const { toFullOf } = await import('../public/js/items.js');
  const o = { level: 1, unknown: false };
  assert.match(toFullOf(o, 'S2'), /別々の自動の仕組みを 3 つ以上/);
  assert.match(toFullOf(o, 'S1'), /別々の作ったもの/);
  assert.match(toFullOf(o, 'P3'), /別々の仕組みを 3 つ以上/);
  assert.match(toFullOf(o, 'K4'), /本人がやった跡/);
  assert.match(toFullOf(o, 'T1'), /別の機会にもくり返す/);
  assert.equal(toFullOf({ level: 0, unknown: true }, 'S2'), null);
  assert.equal(toFullOf({ level: 0, unknown: false }, 'S2'), null);
});
