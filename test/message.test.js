import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextGoal, strength, unseenText, bonusMiss } from '../public/js/message.js';

test('次の目標：要素の条件で止まっているとき', () => {
  // 作者の Claude Code：5,4,3,5,5 = 22 で Lv9
  assert.equal(nextGoal([5, 4, 3, 5, 5], 9).text, '「直す」をあと1つで ★★★ 三ツ星！');
  // 作者の Claude.ai：5,3,4,4,5 = 21 で Lv9（確かめるが1つ、全体で2つ）
  assert.equal(nextGoal([5, 3, 4, 4, 5], 9).text, '「確かめる」をあと1つ、全体であと2つで ★★★ 三ツ星！');
});

test('次の目標：数だけのとき・Lv10・霧', () => {
  assert.equal(nextGoal([3, 3, 3, 3, 3], 6).text, 'あと1つ ✅ が増えると Lv7！'); // 15 → 16
  assert.equal(nextGoal([4, 4, 3, 3, 3], 7).text, 'あと1つ ✅ が増えると ★ ひとつ星！'); // 17 → 18
  assert.equal(nextGoal([5, 5, 5, 5, 5], 10), null);
  assert.equal(nextGoal([1, 1, 1, 1, 1], null), null);
});

test('次の目標：経験値ボーナスを含めて数える', () => {
  // 15 で Lv6、ボーナスで Lv7。あと1つで 16 → Lv7、ボーナスで Lv8
  assert.equal(nextGoal([3, 3, 3, 3, 3], 7, 1).text, 'あと1つ ✅ が増えると ★ ひとつ星！');
  // ボーナスなしなら 18 まで3つ要る
  assert.equal(nextGoal([3, 3, 3, 3, 3], 6, 0).text, 'あと1つ ✅ が増えると Lv7！');
  assert.equal(nextGoal([3, 3, 3, 3, 4], 7, 0).text, 'あと2つ ✅ が増えると ★ ひとつ星！');
  // ボーナスで Lv9 → Lv10 は、要素の条件（全要素4）が要る
  assert.equal(nextGoal([5, 4, 3, 5, 5], 9, 1).text, '「直す」をあと1つで ★★★ 三ツ星！');
});

test('強み', () => {
  assert.equal(strength([5, 4, 3, 5, 5]), '「伝える」「任せる」「使い分け」は満点！ ここがあなたの強み');
  assert.equal(strength([2, 4, 1, 0, 3]), 'いちばん強いのは「確かめる」');
  assert.equal(strength([0, 0, 0, 0, 0]), 'これから伸びる厨房。どこからでも始められる');
});

test('見えなかった項目と、ボーナスの惜しい', () => {
  assert.equal(unseenText(0), null);
  assert.match(unseenText(3), /3 つ/);
  assert.equal(bonusMiss([5, 4, 3, 5, 5], 9), '「直す」があと1つ足りない！');
  assert.equal(bonusMiss([5, 5, 5, 5, 1], 8), '「使い分け」があと2つ足りない！');
  assert.equal(bonusMiss([4, 4, 3, 3, 3], 7), null); // 8 には要素の条件なし
});
