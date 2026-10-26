// 33 項目の短い名前と「◎になるのは」の一言（結果画面の「伸ばすならここ」と、行を開いたときの中身）
// 言葉は採点の図解（assets-src/scoring/ai-kitchen-items-*.png）とそろえる
export const ITEM_INFO = [
  ['目的と完成の条件を伝える', '目的と「こうなったら完成」を、依頼や設定で伝えている'],
  ['背景・相手を伝える', 'だれ向けか・前提をいつも書く'],
  ['条件を伝える', '「ここは変えないで」と、その理由も伝える'],
  ['見本を渡す', '似すぎない見本を数個と、まねてほしい所を渡す'],
  ['優先順位を伝える', '両立しないとき、どちらを取るかを言う'],
  ['出典・根拠を求める', '出典を出させて自分で確かめる'],
  ['基準を渡して確かめさせる', 'テストや完成の条件を渡して確かめさせる'],
  ['別の AI にレビュー', '大事な仕事は別の AI にも見せ、正確さや要件に関わる指摘を直す'],
  ['誤りを指摘する', 'まちがいを指摘して直させる'],
  ['出す前に自分で確認', '送る・公開する前に毎回見る'],
  ['不満を具体的に言う', '「ここが長い」と具体的に言う'],
  ['足りない情報を足して頼み直す', 'だめなら言い方より、情報や理由を足す'],
  ['型にして使う', 'うまくいった頼み方を使い回す'],
  ['失敗をルールにする', '失敗をメモにして効かせ、古いルールは見直す'],
  ['方向を見直す', '「この方向はやめよう」と切り替える'],
  ['長い仕事を任せる', '手順の多い仕事を、まとめて任せる'],
  ['実際に役立てる', '仕事や生活でくり返し使っている'],
  ['苦手な分野に使う', '未経験のことも AI と進める'],
  ['計画を立てさせて任せる', 'AI に計画と進み具合を任せ、大事な分かれ目だけ確かめる'],
  ['任せる範囲を決める', '自分で決めることと任せることを分ける'],
  ['目的で機能を選ぶ', '目的でモデルや設定（思考の深さなど）を使い分ける'],
  ['設定で作業をまとめる', 'プロジェクトやルールが効いている'],
  ['外のデータや道具をつなぐ', 'ファイルや道具を渡してつなぐ'],
  ['画像・音声・図を使う', '自分から画像や音声を使う'],
  ['くり返しの作業を楽にする', '毎週の作業を AI で時短している'],
];
export const ADV_INFO = [
  ['品質の物差しを作る', '例題や評価表をつくり、それで判定して差し戻す'],
  ['任せる手順を整える', 'よく使う手順をスキルや型にして AI に使わせる'],
  ['道具をつないで回す', 'API・MCP などを自分で設定して使う'],
  ['AI に読ませる土台を育てる', 'ルールやスキルを使いながら育て、古いものは見直す'],
  ['安全と止め方を決める', '権限・本番前の確認・費用の上限で事故を止めた'],
];
export const ACH_INFO = [
  ['他の人の役に立っている', 'AI と作ったサービスや道具が、世の中で使われている'],
  ['手を離しても回る', '見ていない間に動いて、仕事を肩代わり'],
  ['失敗から直し続ける', '失敗のたびに直し、同じ失敗が減った'],
];

// 判定の印
export const markOf = (v) => (v.unknown ? '？' : v.level === 2 ? '◎' : v.level === 1 ? '○' : '×');

// 伸ばすならここ：◎ でない項目から 3 つ。次の目標で足りない分野 → 点の低い分野 → ○（あと少し）→ ？ → × の順
// Lv10 からは、上級・成果も候補に入れる（合計点に効く重みが大きいので先に出す）
export function growthPicks(code, r, goal, n = 3) {
  const short = new Set((goal?.short ?? []).map((x) => x.i));
  const stateRank = (v) => (v.level === 1 ? 0 : v.unknown ? 1 : 2);
  const list = [];
  code.items.forEach((v, k) => {
    if (!v.unknown && v.level === 2) return;
    const el = Math.floor(k / 5);
    list.push({ group: el, k: k % 5, v, info: ITEM_INFO[k], key: [short.has(el) ? 0 : 1, 2, r.perElement[el], stateRank(v)] });
  });
  if (r.level >= 10) {
    code.adv.forEach((v, k) => { if (v.unknown || v.level < 2) list.push({ group: 5, k, v, info: ADV_INFO[k], key: [1, 1, r.advPoints, stateRank(v)] }); });
    code.ach.forEach((v, k) => { if (v.unknown || v.level < 2) list.push({ group: 6, k, v, info: ACH_INFO[k], key: [1, 0, r.achPoints, stateRank(v)] }); });
  }
  list.sort((a, b) => {
    for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return a.key[i] - b.key[i];
    return 0;
  });
  return list.slice(0, n);
}

// 項目ごとの公式の参考資料（Anthropic・OpenAI・Google の公式ページだけ）。結果のカードには全部を会社名のリンクで並べる（1 つだけだと根拠が足りないことがあるため）。キーは T1〜U5・P1〜P5・S1〜S3
// [発行元, 資料の名前, URL]。URL は 2026-10-27 に開けることを確かめたもの（tools/check-refs.mjs でもう一度確かめられる）
// 引退した名前（RETIRED）の資料は使わない。古い名前が見えると、診断そのものが古く見えるため
const R = {
  A: ['Anthropic', 'プロンプティングのベストプラクティス', 'https://platform.claude.com/docs/ja/build-with-claude/prompt-engineering/claude-prompting-best-practices'],
  B: ['Anthropic', 'Claude Code のベストプラクティス', 'https://code.claude.com/docs/ja/best-practices'],
  C: ['Anthropic', 'Claude Code の記憶（CLAUDE.md）', 'https://code.claude.com/docs/ja/memory'],
  D: ['Anthropic', 'AI Fluency Index（英語）', 'https://academy.claude.com/tutorials/the-ai-fluency-index'],
  E: ['Anthropic', '成功基準と評価づくり', 'https://platform.claude.com/docs/ja/test-and-evaluate/develop-tests'],
  F: ['Anthropic', 'サブエージェントを 1 つのループにまとめる（英語）', 'https://claude.com/ja/resources/articles/building-agents-when-to-fold-subagents-into-your-main-agent-loop'],
  G: ['Google', 'Gemini のプロンプト設計', 'https://ai.google.dev/gemini-api/docs/prompting-strategies?hl=ja'],
  O: ['OpenAI', '最新モデルのプロンプト指針（英語）', 'https://developers.openai.com/api/docs/guides/latest-model'],
  H: ['Anthropic', 'ハルシネーションを減らす', 'https://platform.claude.com/docs/ja/test-and-evaluate/strengthen-guardrails/reduce-hallucinations'],
  SK: ['Anthropic', 'Agent Skills の概要', 'https://platform.claude.com/docs/ja/agents-and-tools/agent-skills/overview'],
  RC: ['Anthropic', '月間レポート（振り返り）を確認する', 'https://support.claude.com/ja/articles/15672559'],
  MD: ['Anthropic', 'モデルや思考の設定を変える', 'https://support.claude.com/ja/articles/8664678'],
  PJ: ['Anthropic', 'プロジェクトとは', 'https://support.claude.com/ja/articles/9517075'],
  CN: ['Anthropic', 'コネクタで機能を広げる', 'https://support.claude.com/ja/articles/11176164'],
  MCP: ['Anthropic', 'Claude Code で MCP を使う', 'https://code.claude.com/docs/ja/mcp'],
  RL: ['Anthropic', 'API の使用量の上限', 'https://platform.claude.com/docs/ja/api/rate-limits'],
  PM: ['Anthropic', '権限モードを選ぶ', 'https://code.claude.com/docs/ja/permission-modes'],
  HL: ['Anthropic', 'Claude Code をプログラムで動かす', 'https://code.claude.com/docs/ja/headless'],
  EV: ['Anthropic', 'AI エージェントの評価入門（英語）', 'https://www.anthropic.com/research/demystifying-evals-for-ai-agents'],
  OC: ['OpenAI', 'ChatGPT の頼み方（英語）', 'https://learn.chatgpt.com/docs/prompting'],
  OL: ['OpenAI', '長い仕事の任せ方（英語）', 'https://learn.chatgpt.com/docs/long-running-work'],
  OS: ['OpenAI', 'スキルとプラグイン（英語）', 'https://learn.chatgpt.com/docs/skills-and-plugins'],
  OP: ['OpenAI', 'プロジェクトとチャット（英語）', 'https://learn.chatgpt.com/docs/projects'],
  OE: ['OpenAI', '評価のベストプラクティス（英語）', 'https://developers.openai.com/api/docs/guides/evaluation-best-practices'],
  OM: ['OpenAI', 'リモート MCP サーバー（英語）', 'https://developers.openai.com/api/docs/guides/tools-connectors-mcp'],
  GM: ['Google', 'Gemini のモデルについて', 'https://support.google.com/gemini/answer/18648722?hl=ja'],
  GA: ['Google', 'Gemini のアプリ連携', 'https://support.google.com/gemini/answer/13695044?hl=ja'],
  GI: ['Google', 'Gemini で画像を作る・直す', 'https://support.google.com/gemini/answer/14286560?hl=ja'],
  OV: ['OpenAI', 'ChatGPT Voice（英語）', 'https://learn.chatgpt.com/docs/features/voice'],
};
// M2（実際に役立てる）・M3（苦手な分野）・S1（他の人が使っている）は、本人の使い方や成果そのものなので、公式の資料は付けない
export const REFS = {
  T1: [R.OC, R.A], T2: [R.G, R.A], T3: [R.G, R.A], T4: [R.G, R.A], T5: [R.G, R.O],
  K1: [R.H], K2: [R.OL, R.B], K3: [R.B, R.E], K4: [R.D], K5: [R.OC, R.B],
  N1: [R.OC, R.B], N2: [R.B, R.A], N3: [R.OS, R.SK], N4: [R.C], N5: [R.B, R.OC],
  M1: [R.OL, R.A], M4: [R.B, R.D], M5: [R.O, R.RC],
  U1: [R.GM, R.MD], U2: [R.OP, R.PJ], U3: [R.CN, R.GA], U4: [R.GI, R.OV], U5: [R.SK, R.OS],
  P1: [R.OE, R.F], P2: [R.SK, R.F], P3: [R.OM, R.MCP], P4: [R.C, R.F], P5: [R.PM, R.RL],
  S2: [R.HL, R.B], S3: [R.OE, R.EV],
};
// Cowork は 2026-09 に Claude 本体へ統合され、名前としては引退（support.claude.com の「Claude Cowork and chat are one Claude」）
export const RETIRED = ['Cowork'];
export const OFFICIAL_HOSTS = ['learn.chatgpt.com', 'claude.com', 'platform.claude.com', 'code.claude.com', 'academy.claude.com', 'developers.openai.com', 'docs.claude.com', 'docs.anthropic.com', 'www.anthropic.com', 'anthropic.com', 'support.claude.com', 'support.anthropic.com', 'platform.openai.com', 'cookbook.openai.com', 'help.openai.com', 'openai.com', 'ai.google.dev', 'cloud.google.com', 'support.google.com', 'modelcontextprotocol.io'];
export const idOf = (group, k) => (group === 6 ? `S${k + 1}` : group === 5 ? `P${k + 1}` : `${'TKNMU'[group]}${k + 1}`);

// 今どきのやり方（◎ に近づく次の一手）。中身は REFS の公式資料に書いてあることから作る
// 資料のない M2・M3・S1 は、本人の使い方そのものなので一般的な一言にとどめる
export const TIPS = {
  T1: '頼むときは最初に、「何のために」と「どうなったら完成か」を 1 行ずつ書く',
  T2: 'だれに向けたものか、今わかっている前提を添える。理由も書くと、AI が意図に合わせて書きやすくなる',
  T3: '守ってほしい条件は、理由と一緒に書く（「〜なので、ここは変えないで」）',
  T4: '見本は似すぎないものを 2〜3 個渡し、「形はまねて、中身はまねないで」のように、まねる範囲も伝える',
  T5: '「速さと正確さがぶつかったら正確さ」のように、迷ったときにどちらを取るかを先に書く',
  K1: '大事な事実は出典を出させ、リンク先を自分で開いて確かめる',
  K2: '「確認して」と頼むだけでなく、合格かどうかが分かる条件（テスト・チェック項目・完成の見本）を渡す',
  K3: '大事なものは別の AI や新しい会話にも見せ、指摘の根拠を確かめてから、正確さや要件に関わる所を直す',
  K4: '仕上がって見える答えほど一度疑い、おかしい所を具体的に指摘する',
  K5: '送る前・公開する前に、AI に実行結果やスクショを見せてもらい、自分の目で確かめる',
  N1: '「いまいち」ではなく「ここが長い」「数字を先に」のように、場所と直し方を伝える',
  N2: '2 回直してもうまくいかないときは、分かったことを書き足して、新しい会話でやり直す',
  N3: 'うまくいった頼み方は、テンプレや保存したプロンプトに残して使い回す',
  N4: '同じ失敗が 2 回起きたらルールに書く。古いルールや食い違う指示は定期的に消す',
  N5: '方向がずれたら早めに止めて直し、何度直しても戻らないときは巻き戻す',
  M1: '長い仕事は、完成の条件と確かめ方を一緒に渡して、まとめて任せる',
  M2: '毎日の仕事の中で AI に任せる作業を 1 つ決めて、続けてみる',
  M3: '知らない分野は、まず AI に質問して全体像と用語をつかむ',
  M4: '大きな仕事や慣れない仕事は先に計画を出させ、大事な分かれ目だけ自分で決める（範囲と進め方がはっきりした小さな仕事なら、計画は省いてよい）',
  M5: '何を任せて、何を自分で持つか（判断や最後の確認など）を最初に伝える',
  U1: '簡単なことは軽い設定で、難しいことは思考を深くする設定や強いモデルで頼む',
  U2: 'よく使う資料と指示はプロジェクトにまとめ、毎回貼らなくて済むようにする',
  U3: 'コネクタや MCP でいつものアプリをつなぎ、AI に直接読ませる',
  U4: '図や画像を作らせる、声で話しかけるなど、文字以外のやり取りも自分から使う',
  U5: '毎週くり返す作業は、スキルや定期の実行で AI にまとめて任せ、手作業を減らす',
  P1: '正解つきの例題を 10 個ほど作り、指示やモデルを変えるたびに何回か流して結果を比べる',
  P2: 'よく使う手順はスキルにして、必要なときだけ AI に読ませる。AI を何体にも分けるかは、並行して進めたいかと、品質や費用を比べて決める',
  P3: 'よく使う道具を MCP やコネクタでつなぐ。つなぐのは信頼できるものだけにする',
  P4: 'ルールやスキルを定期的に見直し、要らなくなった指示や食い違う指示を直したり消したりして、変えたあとの結果を確かめる',
  P5: '確認なしでやってよい範囲（権限）と、使う量・費用の上限を先に決めておく',
  S1: 'AI と一緒に作ったサービスや道具を、自分以外の人が使える形で世の中に出す',
  S2: '自動で動く仕組みに、終わったか・うまくいったかを自分で確かめる手順を入れる。人のレビュー待ちで止まりにくくなる',
  S3: '起きた失敗を例題（テスト）にして、同じ失敗がまた起きていないか確かめ続ける',
};

// ※（本人がくり返した跡が要る）の項目
export const SELF_IDS = new Set(['K4', 'K5', 'N1', 'N2', 'N5', 'M2', 'M3', 'M5', 'U1', 'U4']);

// 上級・成果で「具体例 1 つ」と数える単位（prompt/diagnosis.txt の数え方と同じ）
const UNIT = { P: '別々の仕組み', S1: '別々の作ったもの', S2: '別々の自動の仕組み', S3: '別々の失敗' };

// 満点にならなかった理由（判定から決まる、ざっくりした一言）
export function reasonOf(v, id) {
  const strict = /^[PS]/.test(id);
  let r;
  if (v.unknown) r = '判定に使える根拠を、AI が十分に確かめられなかった。やっていない、という意味ではない';
  else if (v.level === 0) r = 'やっていない、と判定された';
  else if (strict) r = `${UNIT[id[0] === 'S' ? id : 'P']}が 1〜2 つ見えた。別の日・別の場面で 3 つ以上あり、使いながら直した跡もあると ◎`;
  else if (SELF_IDS.has(id)) r = '1 回だけ見えた。本人がくり返した跡があると ◎';
  else r = '1 回だけ見えた。くり返すか、自分の仕組み（ルール・テンプレなど）が効いた例があると ◎';
  return r;
}

// ○（1 回だけ・具体例 1〜2 つ）の項目で、◎ までに足りないもの。やり方より「数」が足りないことが多いので、何を数えるかを書く
export function toFullOf(v, id) {
  if (v.unknown || v.level !== 1) return null;
  if (/^[PS]/.test(id)) return `◎ まで：${UNIT[id[0] === 'S' ? id : 'P']}を 3 つ以上に（今は 1〜2 つ）`;
  if (SELF_IDS.has(id)) return '◎ まで：本人がやった跡を、別の機会にもう 1 回以上';
  return '◎ まで：別の機会にもくり返す（または、自分のルールやテンプレでいつもそうなる）';
}
