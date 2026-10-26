import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCode, score, judgeType, missingItems } from '../public/js/scoring.js';

// 要素ごとの ✅ 数・❓ 数から 5文字×5 を作る（残りは ❌）
function rows(yesPer, unknownPer = [0, 0, 0, 0, 0]) {
  return yesPer.map((y, i) => '1'.repeat(y) + '2'.repeat(unknownPer[i]) + '0'.repeat(5 - y - unknownPer[i])).join('-');
}
const make = (yesPer, { axes = 'ABAB', exp = 0, mat = 'M', unk } = {}) => `AK1-${axes}-${rows(yesPer, unk)}-${exp}${mat}`;
const run = (s) => score(extractCode(s));

test('読める形だけを1つ取り出す', () => {
  const c = make([1, 1, 1, 1, 1]);
  assert.ok(extractCode(c));
  assert.ok(extractCode(`判定しました。\n\n${c}\n`));
  assert.ok(extractCode(`\`${c}\``));
  assert.equal(extractCode(`${c}\n${c}`), null, '2つあれば読まない');
  assert.equal(extractCode('AK2-ABAB-11111-11111-11111-11111-11111-1M'), null, '知らない版');
  assert.equal(extractCode('AK1-ABAX-11111-11111-11111-11111-11111-1M'), null, '軸の文字');
  assert.equal(extractCode('AK1-ABAB-11113-11111-11111-11111-11111-1M'), null, '項目の文字');
  assert.equal(extractCode('AK1-ABAB-1111-11111-11111-11111-11111-1M'), null, '短い');
  assert.equal(extractCode('AK1-ABAB-11111-11111-11111-11111-11111-1m'), null, '材料は大文字');
  assert.equal(extractCode(`X${c}`), null, '前に英字が続く');
  assert.equal(extractCode(`${c}9`), null, '後ろに数字が続く');
  assert.equal(extractCode(`${c}_extra`), null, '後ろに _ が続く');
  assert.equal(extractCode(`_${c}`), null, '前に _ が続く');
  assert.ok(extractCode(`コード：${c}。`), '日本語の句読点は区切りとして読む');
  assert.equal(extractCode('a'.repeat(2001)), null, '長すぎる');
  assert.equal(extractCode(null), null);
});

test('✅ の数で基本の Lv が決まる（境目）', () => {
  const cases = [[0, 1], [2, 1], [3, 2], [5, 2], [6, 3], [7, 3], [8, 4], [10, 4], [11, 5], [12, 5], [13, 6], [15, 6], [16, 7], [17, 7], [18, 8], [20, 8]];
  for (const [n, lv] of cases) {
    const per = [0, 0, 0, 0, 0];
    for (let k = 0; k < n; k++) per[k % 5]++;
    assert.equal(run(make(per)).level, lv, `✅${n}`);
  }
});

test('Lv9・10 の条件で下がる', () => {
  assert.equal(run(make([5, 5, 5, 5, 5])).level, 10);
  assert.equal(run(make([5, 5, 5, 4, 4])).level, 10); // 23・全要素4以上
  assert.equal(run(make([5, 5, 5, 5, 3])).level, 9); // 23 だが3の要素あり → 9
  assert.equal(run(make([5, 5, 5, 5, 2])).level, 8); // 22 だが2の要素あり → 8
  assert.equal(run(make([5, 5, 4, 4, 3])).level, 9); // 21・全要素3以上
  assert.equal(run(make([5, 5, 5, 4, 2])).level, 8); // 21 だが2の要素あり
});

test('経験値ボーナスは +1 で、足したあとも条件を当てる', () => {
  const r1 = run(make([4, 4, 3, 3, 3], { exp: 1 })); // 17 → 7、+1 → 8
  assert.equal(r1.baseLevel, 7); assert.equal(r1.level, 8); assert.equal(r1.bonus, true);
  const r2 = run(make([5, 5, 5, 5, 3], { exp: 1 })); // 9、+1 → 10 だが要素3 → 9 のまま
  assert.equal(r2.level, 9); assert.equal(r2.bonus, false);
  const r3 = run(make([5, 5, 5, 5, 1], { exp: 1 })); // 21 で 8、+1 → 9 だが要素1 → 8
  assert.equal(r3.baseLevel, 8); assert.equal(r3.level, 8); assert.equal(r3.bonus, false);
  const r4 = run(make([5, 5, 5, 5, 5], { exp: 1 })); // 10 が上限
  assert.equal(r4.level, 10); assert.equal(r4.bonus, false);
  const r6 = run(make([4, 4, 4, 4, 4], { exp: 1 })); // 20 で 8、+1 → 9（全要素4）
  assert.equal(r6.baseLevel, 8); assert.equal(r6.level, 9); assert.equal(r6.bonus, true);
  const r7 = run(make([5, 5, 4, 4, 4], { exp: 1 })); // 22 で 9、+1 → 10（全要素4）
  assert.equal(r7.baseLevel, 9); assert.equal(r7.level, 10); assert.equal(r7.bonus, true);
  const r5 = run(make([2, 2, 2, 2, 2], { exp: 2 })); // 分からない → 加点なし
  assert.equal(r5.bonus, false); assert.equal(r5.level, 4);
});

test('❓ が10個以上で霧', () => {
  const nine = run(make([1, 1, 1, 1, 1], { unk: [2, 2, 2, 2, 1] }));
  assert.equal(nine.fog, false); assert.equal(nine.unknown, 9);
  const ten = run(make([1, 1, 1, 1, 1], { unk: [2, 2, 2, 2, 2], exp: 1 }));
  assert.equal(ten.fog, true); assert.equal(ten.level, null); assert.equal(ten.bonus, false); assert.equal(ten.yes, 5);
});

test('星は Lv8〜10', () => {
  assert.equal(run(make([4, 4, 4, 3, 3])).stars, 1); // 18 → 8
  assert.equal(run(make([5, 4, 4, 4, 4])).stars, 2); // 21 → 9
  assert.equal(run(make([5, 5, 5, 5, 5])).stars, 3);
  assert.equal(run(make([3, 3, 3, 3, 3])).stars, 0);
});

test('タイプ：16の名前・僅差・仮タイプ', () => {
  assert.equal(judgeType('AAAA').name, 'まかない料理人');
  assert.equal(judgeType('ABAB').name, 'ラーメン職人');
  assert.equal(judgeType('BABB').name, '給食の調理チーム');
  assert.equal(judgeType('BBBB').name, 'レストランのシェフ');
  const close = judgeType('aBAb');
  assert.equal(close.name, 'ラーメン職人'); // 小文字は僅差でも同じ側に決まる
  assert.equal(close.axes[0].close, true); assert.equal(close.axes[1].close, false);
  const prov = judgeType('AB?B');
  assert.equal(prov.provisional, true); assert.equal(prov.name, null); assert.equal(prov.axes[2].side, null);
  const names = new Set();
  for (const a of 'AB') for (const b of 'AB') for (const c of 'AB') for (const d of 'AB') names.add(judgeType(a + b + c + d).name);
  assert.equal(names.size, 16);
});

test('アドバイス用の ❌ 項目は ❓ を含めない', () => {
  const c = extractCode('AK1-ABAB-10200-11111-11111-11111-11112-0M');
  assert.deepEqual(missingItems(c), ['T2', 'T4', 'T5']);
});
