import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractCode as extractAK3 } from '../public/js/score2.js';
import { BOOK3 } from '../public/js/codebook3.js';

// 状態の並び：◎(2) ○(1) ×(0) ？(?)
const IDX = { 2: 0, 1: 1, 0: 2, '?': 3 };
const AX = ['A', 'B', 'a', 'b', '?'];
function encode(axes, items, adv, exp, material, ach = ACH) {
  const a = [...axes].map((s, i) => BOOK3.axes[i][AX.indexOf(s)]).join('');
  const it = items.map((v, k) => BOOK3.items[k][IDX[v]]);
  const g = [0, 1, 2, 3, 4].map((r) => it.slice(r * 5, r * 5 + 5).join('')).join('-');
  const p = adv.map((v, k) => BOOK3.adv[k][IDX[v]]).join('');
  const s = ach.map((v, k) => BOOK3.ach[k][IDX[v]]).join('');
  return `AK4-${a}-${g}-${p}-${s}-${BOOK3.exp[[1, 0, 2].indexOf(exp)]}${BOOK3.material[['L', 'M', 'H'].indexOf(material)]}`;
}
const ITEMS = [2, 2, 1, 0, '?', 2, 1, 1, 2, 2, 0, 0, '?', 1, 2, 2, 2, 2, 2, 1, 1, '?', 2, 0, 2];
const ADV = [2, 1, 0, '?', 2];
const ACH = [1, '?', 2];

test('作ったコードが、意味を取り違えずに読める', () => {
  const c = extractAK3(`返事の全文…\n${encode('BbA?', ITEMS, ADV, 1, 'H')}\n`, BOOK3);
  assert.equal(c.axes, 'BbA?');
  assert.deepEqual(c.items.map((x) => (x.unknown ? '?' : x.level)), ITEMS);
  assert.deepEqual(c.adv.map((x) => (x.unknown ? '?' : x.level)), ADV);
  assert.deepEqual(c.ach.map((x) => (x.unknown ? '?' : x.level)), ACH);
  assert.equal(c.items[4].level, 0);
  assert.equal(c.items[4].unknown, true);
  assert.equal(c.items[0].unknown, false);
  assert.equal(c.exp, 1);
  assert.equal(c.material, 'H');
});

test('表にない文字・2つ・古い版・長い返事', () => {
  const code = encode('ABAB', ITEMS, ADV, 0, 'M');
  const bad = [...'ABCDEFGHJKMNPQRSTUVWXYZ'].find((ch) => !BOOK3.items[0].includes(ch));
  assert.equal(extractAK3(code.slice(0, 9) + bad + code.slice(10), BOOK3).fixed, 1); // 表にない文字 1 つは「？」として読む
  assert.equal(extractAK3(`${code}\n${code}`, BOOK3), null);
  assert.equal(extractAK3('AK2-CRSQ-TVDHR-BCAZG-FFCCF-VXTQG-KYNMW-FQ', BOOK3), null);
  assert.equal(extractAK3('AK3-VFTC-JWRGN-AJJDG-SZMEE-CNEJM-PDSSG-FWVTJ-JC', BOOK3), null);
  assert.ok(extractAK3(`${'あ'.repeat(15000)}\n${code}`, BOOK3), '返事の全文（長め）でも読める');
});

test('表にない文字は 2 か所まで「？」として読み、3 か所以上は読めない', () => {
  const code = encode('ABab', ITEMS, ADV, 1, 'L');
  const ok = extractAK3(code, BOOK3);
  assert.equal(ok.fixed, 0);
  // T1（5文字目）に表にない文字を入れる
  const badT1 = [...'ABCDEFGHJKMNPQRSTUVWXYZ'].find((ch) => !BOOK3.items[0].includes(ch));
  const p = code.indexOf('-', 4) + 1;
  const one = extractAK3(code.slice(0, p) + badT1 + code.slice(p + 1), BOOK3);
  assert.equal(one.fixed, 1);
  assert.equal(one.items[0].unknown, true);
  assert.deepEqual(one.items.slice(1), ok.items.slice(1));
  const badT2 = [...'ABCDEFGHJKMNPQRSTUVWXYZ'].find((ch) => !BOOK3.items[1].includes(ch));
  const badT3 = [...'ABCDEFGHJKMNPQRSTUVWXYZ'].find((ch) => !BOOK3.items[2].includes(ch));
  const two = code.slice(0, p) + badT1 + badT2 + code.slice(p + 2);
  assert.equal(extractAK3(two, BOOK3).fixed, 2);
  assert.equal(extractAK3(code.slice(0, p) + badT1 + badT2 + badT3 + code.slice(p + 3), BOOK3), null);
  // 実際にあった書き間違い（K4 に表にない A）
  assert.equal(extractAK3('AK4-VFUC-JWRGR-AADAN-SYMXT-CNSJM-PJSSG-FAVFB-WSX-JC', BOOK3).fixed, 1);
});

test('診断文に書いた変換表と、サイトの変換表が同じ', () => {
  const prompt = readFileSync('prompt/diagnosis.txt', 'utf8');
  BOOK3.items.forEach(([a, b, c, d], k) => {
    const id = `${'TKNMU'[Math.floor(k / 5)]}${(k % 5) + 1}`;
    assert.match(prompt, new RegExp(`${id} .*◎${a} ○${b} ×${c} ？${d}`), id);
  });
  BOOK3.adv.forEach(([a, b, c, d], k) => {
    assert.match(prompt, new RegExp(`P${k + 1} .*◎${a} ○${b} ×${c} ？${d}`), `P${k + 1}`);
  });
  BOOK3.ach.forEach(([a, b, c, d], k) => {
    assert.match(prompt, new RegExp(`S${k + 1} .*◎${a} ○${b} ×${c} ？${d}`), `S${k + 1}`);
  });
});
