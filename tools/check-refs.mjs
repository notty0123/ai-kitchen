// 結果画面の参考資料（public/js/items.js の REFS）が、今も開けるかを確かめる
// 使い方：node tools/check-refs.mjs（月に 1 回くらい、または公式の名前が変わったと聞いたとき）
// 名前が古くなっていないかは、ここでは見ない（公式サイトのメニューに古い名前が残ることがあり、機械では見分けられない）。人が資料の名前を確かめる
import { REFS } from '../public/js/items.js';

const urls = [...new Set(Object.values(REFS).flat().map((r) => r[2]))];
let bad = 0;
for (const url of urls) {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const ok = res.ok;
    if (!ok) bad++;
    console.log(`${ok ? 'OK ' : 'NG '} ${res.status} ${url}`);
  } catch (e) {
    bad++;
    console.log(`NG  ---  ${url}  ${e.message}`);
  }
}
console.log(bad ? `開けないもの ${bad} 件` : `全 ${urls.length} 件、開けた`);
process.exitCode = bad ? 1 : 0;
