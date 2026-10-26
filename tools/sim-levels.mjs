// Lv のルールの段差を機械で調べる。分野ごとの点の偏りも含めて、到達できる状態を全部ためす
// 1 項目ぶん（分野の 1 点・上級 1 点・成果 1 点）だけ違う2人で、Lv が何段変わるか
// 使い方：node tools/sim-levels.mjs
import { score2 } from '../public/js/score2.js';

const st = (v) => ({ level: v, unknown: false });
const itemsOf = (p) => [...Array(Math.floor(p / 2)).fill(2), ...Array(p % 2).fill(1), ...Array(5 - Math.floor(p / 2) - (p % 2)).fill(0)];
function spread(total, n) {
  const a = Array(n).fill(0);
  for (let k = 0; k < total; k++) a[k % n]++;
  return a;
}
const lvOf = (per, adv, ach, exp) => score2({ axes: 'BBBB', items: per.flatMap(itemsOf).map(st), adv: spread(adv, 5).map(st), ach: spread(ach, 3).map(st), exp, material: 'M' }).level;

// 分野の点は並びを気にしないので、小さい順の組み合わせだけ（3003 通り）
const combos = [];
for (let a = 0; a <= 10; a++) for (let b = a; b <= 10; b++) for (let c = b; c <= 10; c++) for (let d = c; d <= 10; d++) for (let e = d; e <= 10; e++) combos.push([a, b, c, d, e]);

let worst = 0;
const found = [];
for (const per of combos)
  for (let adv = 0; adv <= 10; adv++)
    for (let ach = 0; ach <= 6; ach++)
      for (let exp = 0; exp <= 1; exp++) {
        const lv = lvOf(per, adv, ach, exp);
        const next = [];
        for (let i = 0; i < 5; i++) if (per[i] < 10 && (i === 4 || per[i] < per[i + 1])) next.push([per.map((p, k) => (k === i ? p + 1 : p)), adv, ach, `分野${i + 1}`]);
        if (adv < 10) next.push([per, adv + 1, ach, '上級']);
        if (ach < 6) next.push([per, adv, ach + 1, '成果']);
        for (const [p2, a2, s2, what] of next) {
          const d = lvOf(p2, a2, s2, exp) - lv;
          if (d < 0) found.push(`下がる：${what}+1 で Lv${lv}→${lv + d}（分野${per.join('・')} 上級${adv} 成果${ach} 経験${exp}）`);
          if (d > worst) worst = d;
          if (d >= 3) found.push(`段差${d}：${what}+1 で Lv${lv}→${lv + d}（分野${per.join('・')} 上級${adv} 成果${ach} 経験${exp}）`);
        }
      }
console.log(`1 項目ぶんの違いで変わる Lv の最大：${worst} 段`);
console.log(found.length ? found.slice(0, 20).join('\n') + `\n…全 ${found.length} 件` : '3 段以上の段差・下がる所はなし');
