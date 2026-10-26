# AIとお店を作ったら

いつも使っている AI に診断文を貼ると、AI の使いこなし度に合わせてラーメン屋が Lv1〜15 まで育つ診断ゲームです。

https://ai-kitchen.plglab.com

## しくみ

1. サイトの「診断文をコピー」で、[prompt/diagnosis.txt](prompt/diagnosis.txt) と同じ文がコピーされます
2. 自分の AI（ChatGPT・Claude・Gemini など）に貼ると、AI がこれまでのやり取りを思い出して 33 項目を判定し、`AK4-` で始まるコードを出します
3. コードをサイトに貼ると、採点・演出・シェアカードづくりは、すべてブラウザの中で行います（[public/js/score2.js](public/js/score2.js)）

採点は、基本 25 項目（伝える・確かめる・直す・任せる・使い分け）、上級 5 項目、成果 3 項目を ◎（2 点）・○（1 点）・×・？（0 点）で判定し、合計点＝基本＋上級×2＋成果×3（最大 88 点）で Lv を決めます。上の Lv には、上級・成果・分野ごとの最低点の条件があります。

結果画面の「次の一手」と参考資料は [public/js/items.js](public/js/items.js) にあります。参考資料は Anthropic・OpenAI・Google の公式ページだけです。

## 送るもの・残すもの

- サイトが外に送るのは、スコアの数字 1 つだけです（順位を出すため。[public/app.js](public/app.js) の `submitScore`）
- 貼った文・診断コード・カード画像は送りません。CSP で、このサイト以外への通信をブラウザ側で止めています（[public/_headers](public/_headers)）
- 集計（[src/worker.js](src/worker.js)）が保存するのは「スコアのマスごとの人数」だけです。接続元は連打を止めるためにメモリで少しの間だけ使い、保存しません
- 順位は送られた数字をそのまま数えた参考の値です。本物の診断かどうかは確かめていません

## 診断文について

- 診断文には URL も、送信・実行の指示も入っていません。入っているものは偽物です
- Claude Code や Codex で遊ぶときは、読むだけのモード（plan モードなど）で貼ってください

## 動かす

```sh
npm install
npm test            # node --test
npx wrangler dev    # http://localhost:8787
```

- 診断文を直したら `node tools/codebook3.mjs` → `node tools/build-prompt.mjs` で、変換表と `public/index.html` に反映します
- `node tools/check-code.mjs "AK4-…"` でコードの採点結果を、`node tools/sim-levels.mjs` で Lv の段差を、`node tools/check-refs.mjs` で参考資料のリンクを確かめられます
