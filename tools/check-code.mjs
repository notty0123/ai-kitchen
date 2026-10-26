// AI の返事（AK4 のコード）を読んで、Lv・点数の内訳を出す
// 使い方：node tools/check-code.mjs "AK4-...."
import { extractCode, score2 } from '../public/js/score2.js';
import { BOOK3 } from '../public/js/codebook3.js';

for (const text of process.argv.slice(2)) {
  const code = extractCode(text, BOOK3);
  if (!code) {
    console.log(text, '→ 読めない');
    continue;
  }
  const r = score2(code);
  console.log(text.trim(), `→ Lv${r.level ?? '霧'}｜基本 ${r.base}（${r.perElement.join('・')}）｜上級 ${r.advPoints}｜成果 ${r.achPoints}｜経験値 ${code.exp}`);
}
