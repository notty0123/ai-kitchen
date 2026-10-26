import { extractCode, score2, nextGoal2, strength2, ELEMENT_NAMES, BASE_MIN } from './js/score2.js';
import { BOOK3 } from './js/codebook3.js';
import { ITEM_INFO, ADV_INFO, ACH_INFO, REFS, TIPS, idOf, markOf, toFullOf, growthPicks } from './js/items.js';
import { BANDS } from './js/types.js';
import { createFx } from './js/fx.js';
import { scoreOf, formatScore, topPercent } from './js/rank.js';

const $ = (id) => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const levelOfPoints = (pts) => BASE_MIN.filter((p) => pts >= p).length;
let skipping = false;

const sleep = (ms) => (skipping ? Promise.resolve() : new Promise((r) => setTimeout(r, reduce ? Math.min(ms, 100) : ms)));
// お店の絵（ラーメン屋 Lv1〜15、全タイプ共通）
const imgOf = (lv) => `img/shop/lv${String(Math.max(1, Math.min(15, lv))).padStart(2, '0')}.webp`;
const titleOf = (r) => (r.crown ? ' グランシェフ' : r.master ? ' マスター' : '');
const A = (n) => `img/anim/${n}`;
[...Array(15)].forEach((_, i) => { new Image().src = imgOf(i + 1); });
['hanamaru.png', 'check.png', 'question.png', 'stamper.png', 'star.png', 'kaiten.png', 'pen_hand.png', 'r1_menu.webp', 'r2_taste.webp', 'r3_improve.webp', 'r4_prep.webp', 'r5_flyer.webp', 'r6_system.webp'].forEach((f) => { new Image().src = A(f); });

// ラインボイル：線の揺れを 1 秒に約 8 回切り替える
if (!reduce) {
  let b = 0;
  setInterval(() => {
    document.documentElement.classList.remove('b0', 'b1', 'b2');
    document.documentElement.classList.add(`b${b++ % 3}`);
  }, 125);
}
document.querySelectorAll('.title img, .hero-cat, .scene, .badge, .world img, .polaroid img, .layer .w, .kaiten, .shop').forEach((n) => n.classList.add('boil'));

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function img(src, cls) {
  const i = el('img', cls);
  i.src = src;
  i.alt = '';
  return i;
}
function restart(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

// ── トップ ──
$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('prompt').textContent);
    // 何をコピーしたか、その場で見えるようにする
    $('peek').open = true;
  } catch {
    $('peek').open = true;
    const range = document.createRange();
    range.selectNodeContents($('prompt'));
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  }
  $('copy').classList.add('copied');
  $('copy-label').textContent = 'コピーした！';
  setTimeout(() => {
    $('copy').classList.remove('copied');
    $('copy-label').textContent = '診断文をコピー';
  }, 2400);
});

function explainBad(text) {
  if (text.length > 20000) return 'AK4- で始まるコードの行だけを貼ってください';
  const all = text.match(/AK\d[\w?-]*/g);
  if (!all) return 'AK4- で始まるコードが見つかりません';
  if (all.length > 1) return 'コードが2つあります。1つだけ貼ってください';
  if (!all[0].startsWith('AK4-')) return 'このページの診断文で出たコードを貼ってください';
  return 'コードが読めませんでした。AI に「コードを形どおりに出し直して」と頼んでください';
}

// ◎ でない項目に付ける「次の一手」。カードでは、参考の公式資料を会社名のリンクで 1 行に並べる（縦に長くしないため）
function growthNotes(v, id, withRefs) {
  const box = el('div', 'notes');
  const toFull = toFullOf(v, id);
  if (toFull) box.append(el('small', 'goal', toFull));
  box.append(el('small', 'tip', `→ ${TIPS[id]}`));
  const refs = withRefs ? REFS[id] ?? [] : [];
  if (refs.length) {
    const line = el('small', 'refs', '参考：');
    const count = (w) => refs.filter((r) => r[0] === w).length;
    refs.forEach(([who, title, url], k) => {
      // 同じ会社が重なるときだけ、資料の名前で見分けられるようにする
      const a = el('a', 'ref', count(who) > 1 ? `${who}「${title}」` : who);
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.title = `${who}「${title}」`;
      a.setAttribute('aria-label', `${who}「${title}」`);
      line.append(...(k ? [' ・ ', a] : [a]));
    });
    box.append(line);
  }
  return box;
}

let playing = false;
let RUN = 0;

// スコアの数字だけを送って、集計時点の順位をもらう。2 秒で返らなければ順位なし（再送しない）
async function submitScore(score) {
  try {
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ score }),
      signal: AbortSignal.timeout(2000),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) return null;
    const j = await res.json();
    return Number.isInteger(j.rank) && Number.isInteger(j.total) && j.rank >= 1 && j.rank <= j.total ? j : null;
  } catch {
    return null;
  }
}
$('go').addEventListener('click', async () => {
  if (playing) return;
  const text = $('code').value;
  const code = extractCode(text, BOOK3);
  if (!code) {
    $('error').textContent = explainBad(text);
    return;
  }
  $('error').textContent = '';
  const r = score2(code);
  playing = true;
  $('go').disabled = true;
  try {
    const runId = ++RUN;
    const score = scoreOf(code, r);
    const rankP = score == null ? Promise.resolve(null) : submitScore(score);
    await play(code, r);
    const rank = await rankP;
    if (runId === RUN) showResult(code, r, { score, rank });
  } finally {
    playing = false;
    $('go').disabled = false;
  }
});

// ── 演出：お店づくり ──
const show = $('show');
const fx = createFx($('fx'));
const TASKS = [
  ['メニューを作る', '伝える', 'r1_menu.webp', ['目的と完成', '背景・相手', '条件', '見本', '優先順位']],
  ['味見する', '確かめる', 'r2_taste.webp', ['出典・根拠', '基準で確かめる', '別の目でレビュー', '誤りを直させた', '自分で確認']],
  ['仕込みを改良', '直す', 'r3_improve.webp', ['具体的に注文', '情報を足す', '型にする', '失敗を仕組みに', '見直す']],
  ['開店準備', '任せる', 'r4_prep.webp', ['長い仕事を任せる', '実際に役立てた', '未経験に挑戦', '計画を立てさせる', '範囲を決める']],
  ['チラシを作る', '使い分け', 'r5_flyer.webp', ['機能を選ぶ', 'まとめる', 'つなぐ', '画像・声', '効率化']],
];
const EX = ['お店の仕組みづくり', '上級', 'r6_system.webp', ['品質の物差し', '手順を整える', '道具をつなぐ', '土台を育てる', '止め方を決める']];
const ACH = ['お店の外の評判', '成果', 'r5_flyer.webp', ['人の役に立っている', '手を離しても回る', '失敗から直し続ける']];
const ANIMALS = ['a_rabbit', 'a_cat', 'a_duck', 'a_bear', 'a_dog', 'a_squirrel', 'a_penguin', 'a_kitten'];

function setBadge(lv, master = false) {
  const b = $('s-badge');
  $('s-lv').textContent = lv;
  b.classList.toggle('gold', master);
  b.classList.toggle('red', !master && lv !== '?');
  restart(b, 'flip');
  restart(b, 'grow');
}

function setRound(task, idx, total) {
  [...$('s-dots').children].forEach((d, k) => { d.className = k < idx ? 'done' : k === idx ? 'on' : ''; });
  $('s-round').textContent = idx < 5 ? `ROUND ${idx + 1}/${total}` : 'ROUND EX';
  const t = $('s-task');
  t.replaceChildren(el('small', null, task[1]), task[0]);
  restart(t, 'in');
  const s = $('s-scene');
  s.src = A(task[2]);
  restart(s, 'in');
  $('s-list').replaceChildren(...task[3].map((label, k) => {
    const li = el('li');
    li.append(el('span', 'n', String(k + 1)), el('span', 't', label), el('span', 'mark'));
    return li;
  }));
}

// はんこ：印を軽くポンと置く（はんこの道具は出さない）
function stamp(li, v) {
  const mark = li.querySelector('.mark');
  if (v.unknown) {
    mark.append(img(A('question.png'), 'pop'));
    li.classList.add('unk');
    return;
  }
  if (v.level === 0) {
    li.classList.add('no');
    return;
  }
  mark.append(img(A(v.level === 2 ? 'hanamaru.png' : 'check.png'), 'pop'));
  if (v.level === 2 && !skipping) {
    const m = mark.getBoundingClientRect();
    fx.sparks(m.left + m.width / 2, m.top + m.height / 2, 8, ['#e23e32', '#f08c32', '#ffd666']);
  }
}

// 動物のお客が歩いてきて行列に並ぶ（1 ROUND に最大2匹）
let queueN = 0;
function addCustomer() {
  if (skipping) return;
  const q = $('s-queue');
  const w = q.clientWidth;
  const step = Math.max(40, Math.min(64, (w - 120) / Math.max(1, queueN + 1)));
  const name = ANIMALS[queueN % ANIMALS.length];
  const an = img(A(`${name}.png`), name === 'a_duck' ? 'flip' : '');
  an.style.left = '-120px';
  q.append(an);
  an.animate([{ left: '-120px' }, { left: `${w - 110 - queueN * step}px` }], { duration: 800, easing: 'steps(8)', fill: 'forwards' });
  queueN++;
}

async function layer(id, ms) {
  const L = $(id);
  L.hidden = false;
  L.querySelectorAll('*').forEach((n) => n.getAnimations?.().forEach((x) => { x.cancel(); x.play(); }));
  await sleep(ms);
  L.hidden = true;
}

// 最後に1回だけの大きな発表：屋台からあなたのお店まで、ペンで描き足して進化
async function reveal(to, tag) {
  $('evo-from').src = imgOf(1);
  $('evo-to').src = imgOf(to);
  $('evo-from-cap').textContent = `Lv1 ${BANDS[0]}`;
  $('evo-to-cap').textContent = `Lv${to} ${BANDS[to - 1]}`;
  $('lvup-band').textContent = BANDS[to - 1];
  $('lvup-tag').hidden = !tag;
  $('lvup-tag').textContent = tag;
  restart(document.querySelector('.draw'), 'go');
  restart($('pen'), 'go');
  setBadge(to, to > 10);
  fx.confetti(50);
  await layer('lvup', 1700);
}

// 1つの ROUND：見出しとリストを出し、はんこをリズムよく押して、読める間を取る
async function round(task, idx, values, r, state) {
  setRound(task, idx, 5);
  await sleep(300);
  const lis = [...$('s-list').children];
  let walkers = 0;
  for (let j = 0; j < values.length; j++) {
    const v = values[j];
    stamp(lis[j], v);
    if (!v.unknown && v.level > 0) {
      state.pts += idx < 5 ? v.level : 0;
      if (walkers < 2) {
        addCustomer();
        walkers++;
      }
    }
    await sleep(110);
  }
  // Lv の丸は、静かに数字を上げるだけ
  const lv = idx < 5 ? Math.min(levelOfPoints(state.pts), r.baseLevel ?? 1) : null;
  if (!r.fog && lv && lv > state.cur) {
    state.cur = lv;
    setBadge(lv);
  }
  await sleep(560);
}

async function play(code, r) {
  skipping = false;
  queueN = 0;
  show.hidden = false;
  $('home').inert = true;
  $('skip').focus();
  document.body.style.overflow = 'hidden';
  fx.resize();
  ['lvup', 'master', 'finale'].forEach((id) => { $(id).hidden = true; });
  $('s-queue').replaceChildren();
  setBadge(r.fog ? '?' : 1);

  const state = { pts: 0, cur: 1 };
  for (let i = 0; i < 5; i++) await round(TASKS[i], i, code.items.slice(i * 5, i * 5 + 5), r, state);
  if (code.adv.some((x) => x.level > 0)) await round(EX, 5, code.adv, r, state);
  if (code.ach.some((x) => x.level > 0)) await round(ACH, 6, code.ach, r, state);

  if (r.fog) return finale(r);

  // 最後に1回だけの発表（経験値ボーナスで上がった分も含める）
  const top = Math.min(r.level, 10);
  if (top > 1) await reveal(top, r.bonus ? '経験値ボーナス込み' : '');
  if (r.master) {
    $('master-img').src = imgOf(r.level);
    $('master-band').textContent = BANDS[r.level - 1];
    setBadge(r.level, true);
    fx.confetti(90);
    await layer('master', 1600);
  }
  return finale(r);
}

async function finale(r) {
  const lv = r.fog ? Math.max(1, levelOfPoints(r.base)) : r.level;
  $('f-img').src = imgOf(lv);
  $('f-img').parentElement.classList.toggle('fog', r.fog);
  document.querySelector('.finale .kaiten').hidden = r.fog;
  $('f-fog').hidden = !r.fog;
  $('f-fog').textContent = r.fog ? `湯気でよく見えない…（AI から見えなかった項目が ${r.unknown} つ）` : '';
  if (!r.fog) setTimeout(() => fx.confetti(r.level >= 10 ? 200 : 110), reduce ? 0 : 350);
  await layer('finale', 1300);
  finish();
}

function finish() {
  show.hidden = true;
  $('home').inert = false;
  document.body.style.overflow = '';
  fx.clear();
}
$('skip').addEventListener('click', () => {
  skipping = true;
  ['lvup', 'master'].forEach((id) => { $(id).hidden = true; });
});

// ── 結果 ──
let last = null;

// 前のカードの画像を手放す
function dropCard() {
  if (last?.url) URL.revokeObjectURL(last.url);
  last = null;
}

function renderCard() {
  const mine = last;
  if (mine.drawing) return; // 描いている途中は、二重に描かない
  mine.drawing = true;
  $('save').disabled = true;
  $('card-img').removeAttribute('src');
  $('card-wait').textContent = 'カードを描いています…';
  $('card-wait').hidden = false;
  drawCard(mine.code, mine.r, mine.score, mine.rank).finally(() => { mine.drawing = false; }).then((url) => {
    if (last !== mine) {
      URL.revokeObjectURL(url); // 間に合わなかったカードは捨てる
      return;
    }
    mine.url = url;
    $('card-img').src = url;
    $('card-wait').hidden = true;
    $('save').disabled = false;
  }, () => {
    if (last !== mine) return;
    // 描けなかったときは、要点を文字で出して、押すともう一度描く
    const band = mine.r.fog ? '霧の中の厨房' : BANDS[mine.r.level - 1];
    const lv = mine.r.fog ? '' : ` Lv${mine.r.level}`;
    const sc = mine.score == null ? '' : `\nスコア ${formatScore(mine.score)}${mine.rank ? `（${mine.rank.total}件中${mine.rank.rank}位）` : ''}`;
    $('card-wait').textContent = `${band}${lv}${sc}\n\nカードを描けませんでした。ここを押すと、もう一度描きます`;
  });
}
$('card-wait').addEventListener('click', () => { if (last && !last.url) renderCard(); });

function showResult(code, r, sr = {}) {
  const { score = null, rank = null } = sr;
  dropCard();
  last = { code, r, score, rank, url: null };
  $('home').hidden = true;
  $('result').hidden = false;
  $('save-hint').hidden = true;
  scrollTo(0, 0);
  document.querySelectorAll('#result *').forEach((n) => n.getAnimations?.().forEach((x) => { x.cancel(); x.play(); }));
  renderCard();

  const goal = nextGoal2(r, code.exp);
  const reachSet = new Set((goal?.short ?? []).map((x) => x.i));
  countUp($('r-count'), r.total);
  // 分野ごとの点数。行をタップすると 5 項目の判定が開く
  const rows = [
    ...ELEMENT_NAMES.map((name, i) => [name, r.perElement[i], 10, i, code.items.slice(i * 5, i * 5 + 5), ITEM_INFO.slice(i * 5, i * 5 + 5)]),
    ['上級', r.advPoints, 10, 5, code.adv, ADV_INFO],
    ['成果', r.achPoints, 6, 6, code.ach, ACH_INFO],
  ];
  $('r-grid').replaceChildren(...rows.map(([name, pts, max, i, vals, infos]) => {
    const box = el('details', 'bgroup');
    const line = el('summary', `brow ${i >= 5 ? 'adv' : ''} ${pts === max ? 'full' : ''}`);
    line.append(el('span', 'name', name), el('span', 'dots'), el('span', 'st', `${pts}/${max}`), el('span', 'open', '▾'));
    if (reachSet.has(i)) line.append(el('span', 'badge', '次はここ'));
    const list = el('ul', 'items');
    vals.forEach((v, k) => {
      const full = !v.unknown && v.level === 2;
      const li = el('li', v.unknown ? 'u' : full ? 'y' : '');
      li.append(el('b', null, markOf(v)), el('span', null, infos[k][0]));
      if (!full) li.append(growthNotes(v, idOf(i, k), true));
      list.append(li);
    });
    box.append(line, list);
    return box;
  }));
  // 伸ばすならここ：◎ でない項目を 3 つ、◎ になる目安つきで
  const picks = growthPicks(code, r, goal);
  $('r-grow').hidden = !picks.length;
  $('r-grow-list').replaceChildren(...picks.map(({ v, info, group, k }) => {
    const li = el('li');
    const where = group === 6 ? '成果' : group === 5 ? '上級' : ELEMENT_NAMES[group];
    li.append(el('b', null, markOf(v)), el('span', 'what', `${where}・${info[0]}`), growthNotes(v, idOf(group, k), true));
    return li;
  }));
  const strong = strength2(r.perElement);
  const fixNote = code.fixed ? `AI の書き間違いが ${code.fixed} か所あったので、そこは「見えない」として数えたよ` : '';
  const msgs = [['good', strong], ['reach', goal?.text], ['note', fixNote]].filter(([, t]) => t);
  $('r-msgs').replaceChildren(...msgs.map(([cls, t], k) => {
    const m = el('div', `msg ${cls}`, t);
    m.style.animationDelay = `${1400 + k * 150}ms`;
    return m;
  }));

  // シェアの文：帯・Lv・スコア・順位・強み
  const band = r.fog ? '霧の中の厨房' : BANDS[r.level - 1];
  const lvText = r.fog ? '' : ` Lv${r.level}${r.stars ? ` ${'★'.repeat(r.stars)}` : ''}${titleOf(r)}`;
  const scoreText = score == null ? '' : `\nスコア ${formatScore(score)}${rank ? `（${rank.total.toLocaleString()}件中${rank.rank.toLocaleString()}位・上位${topPercent(rank.rank, rank.total)}%）` : ''}`;
  const best = Math.max(...r.perElement);
  const tops = r.perElement.filter((p) => p === best).length;
  const strongText = r.fog || best === 0 ? '' : tops === 5 ? '\n全部まんべんなく強い！' : `\n${r.perElement.map((p, i) => (p === best ? `「${ELEMENT_NAMES[i]}」` : '')).join('')}が強み！`;
  const share = `わたしとAIでお店作ったら\n「${band}」${lvText}${scoreText}${strongText}\n#AIキッチン\n${location.origin}${location.pathname}`;
  $('share').href = `https://x.com/intent/post?text=${encodeURIComponent(share)}`;
}

function countUp(node, to) {
  if (reduce) { node.textContent = to; return; }
  const start = performance.now() + 500;
  const step = (t) => {
    const p = Math.max(0, Math.min(1, (t - start) / 900));
    node.textContent = Math.round(to * (1 - (1 - p) ** 3));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

$('again').addEventListener('click', () => {
  dropCard();
  $('card-img').removeAttribute('src');
  $('result').hidden = true;
  $('home').hidden = false;
  $('code').value = '';
  scrollTo(0, 0);
});

// ── 画像で保存（1080×1350、ブラウザの中だけで作る） ──
async function loadImg(src) {
  const i = new Image();
  i.src = src;
  await i.decode();
  return i;
}

$('save').addEventListener('click', () => {
  if (!last?.url) return;
  const link = document.createElement('a');
  link.href = last.url;
  link.download = 'ai-kitchen.png';
  link.click();
  $('save-hint').hidden = false;
});

// シェアカード（1080×1350）：お店のレシート風。ブラウザの中だけで描いて、画像の URL を返す
async function drawCard(code, r, score, rank) {
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const NAVY = '#1f2d60';
  const GRAY = '#6f6f78';
  const RED = '#d8352a';
  const HAND = '"UD Digi Kyokasho N-B", "UD デジタル 教科書体 N-B", "Hiragino Maru Gothic ProN", "BIZ UDPGothic", "Meiryo", sans-serif';
  const NUM = '"BIZ UDGothic", "BIZ UDPGothic", ui-monospace, "Hiragino Sans", monospace';
  let seed = (r.level ?? 0) * 97 + r.base + 7;
  const rnd = (n) => {
    seed = (seed * 9301 + 49297) % 233280;
    return (seed / 233280 - 0.5) * 2 * n;
  };

  // 机の紙
  ctx.fillStyle = '#efe8d8';
  ctx.fillRect(0, 0, W, H);
  for (let k = 0; k < 3000; k++) {
    ctx.fillStyle = `rgba(110,90,60,${Math.abs(rnd(0.06))})`;
    ctx.fillRect(Math.abs(rnd(W)), Math.abs(rnd(H)), 2, 2);
  }

  // レシート（少し傾けて、上下はギザギザ）
  const RX = 190;
  const RW = 700;
  const RY = 46;
  const RH = 1258;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.018);
  ctx.translate(-W / 2, -H / 2);
  const zig = 18;
  ctx.beginPath();
  ctx.moveTo(RX, RY + zig);
  for (let x = RX; x < RX + RW; x += zig * 2) {
    ctx.lineTo(x + zig, RY);
    ctx.lineTo(Math.min(x + zig * 2, RX + RW), RY + zig);
  }
  ctx.lineTo(RX + RW, RY + RH - zig);
  for (let x = RX + RW; x > RX; x -= zig * 2) {
    ctx.lineTo(x - zig, RY + RH);
    ctx.lineTo(Math.max(x - zig * 2, RX), RY + RH - zig);
  }
  ctx.closePath();
  ctx.shadowColor = 'rgba(60,40,10,.18)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#fffefa';
  ctx.fill();
  ctx.shadowColor = 'transparent';

  const L = RX + 56;
  const R = RX + RW - 56;
  const CX = RX + RW / 2;

  // 店名
  ctx.fillStyle = NAVY;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `60px ${HAND}`;
  ctx.fillText('AIとお店を作ったら', CX, RY + 120);
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(L + 30, RY + 146 + rnd(2));
  ctx.lineTo(R - 30, RY + 142 + rnd(2));
  ctx.stroke();

  // お店の絵
  const shopLv = r.fog ? Math.max(1, levelOfPoints(r.base)) : r.level;
  const photo = await loadImg(imgOf(shopLv));
  ctx.save();
  if (r.fog) ctx.filter = 'blur(14px)';
  ctx.drawImage(photo, CX - 200, RY + 160, 400, 400);
  ctx.restore();

  // 明細（点線でつなぐ）
  const line = (label, value, y, opt = {}) => {
    ctx.textBaseline = 'alphabetic';
    ctx.font = `${opt.size ?? 40}px ${HAND}`;
    ctx.fillStyle = NAVY;
    ctx.textAlign = 'left';
    ctx.fillText(label, L, y);
    const lw = ctx.measureText(label).width;
    // 値が長いときは、項目名と点線の間に収まるまで文字を小さくする
    const room = R - L - lw - 40;
    let vs = opt.vsize ?? opt.size ?? 40;
    const vfont = () => `${opt.bold ? '800 ' : ''}${vs}px ${opt.num ? NUM : HAND}`;
    ctx.font = vfont();
    while (ctx.measureText(value).width > room && vs > 22) {
      vs -= 2;
      ctx.font = vfont();
    }
    ctx.fillStyle = opt.color ?? NAVY;
    ctx.textAlign = 'right';
    ctx.fillText(value, R, y);
    const vw = ctx.measureText(value).width;
    ctx.fillStyle = 'rgba(31,45,96,.45)';
    for (let x = L + lw + 14; x < R - vw - 14; x += 14) ctx.fillRect(x, y - 8, 4, 4);
  };
  const dashed = (y) => {
    ctx.fillStyle = 'rgba(31,45,96,.5)';
    for (let x = L; x < R; x += 20) ctx.fillRect(x, y, 12, 3);
  };

  const band = r.fog ? '霧の中の厨房' : BANDS[r.level - 1];
  let y = RY + 632;
  dashed(y - 70); // Lv の数字（52px）の上端より上に引く
  const lvValue = r.fog ? '？' : `${r.level}${r.stars ? ` ${'★'.repeat(r.stars)}` : ''}`;
  line('Lv', lvValue, y, { size: 44, vsize: 52, bold: true, num: true, color: r.level > 10 ? '#c98a00' : NAVY });
  y += 64;
  line('本日の称号', band, y, { size: 40, vsize: 44 });
  if (r.master) {
    y += 52;
    line('肩書き', titleOf(r).trim(), y, { size: 36 });
  }
  if (score != null) {
    y += 64;
    line('スコア', formatScore(score), y, { size: 40, vsize: 46, num: true, bold: true });
  }
  if (rank) {
    y += 60;
    line('順位', `${rank.total.toLocaleString()}件中 ${rank.rank.toLocaleString()}位`, y, { size: 40, vsize: 42, color: RED });
    y += 64;
    line('上位', `${topPercent(rank.rank, rank.total)}%`, y, { size: 40, vsize: 54, bold: true, color: RED });
  }
  y += 46;
  dashed(y);

  // 強み（16 タイプの名前は、説明なしでは意味が伝わらないので出さない。診断の癖 4 軸はコードに残している）
  const best = Math.max(...r.perElement);
  const tops = r.perElement.map((p, i) => (p === best ? ELEMENT_NAMES[i] : '')).filter(Boolean);
  const strong = r.fog || best === 0 ? 'これから伸びる厨房' : tops.length === 5 ? '全部まんべんなく' : tops.join('・');
  // 幅に収まるまで文字を小さくして、左寄せで書く
  const fitText = (text, y0, size, color, maxW = R - L) => {
    let s = size;
    ctx.font = `${s}px ${HAND}`;
    while (ctx.measureText(text).width > maxW && s > 20) {
      s -= 2;
      ctx.font = `${s}px ${HAND}`;
    }
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(text, L, y0);
  };
  y += 58;
  fitText(`強み：${strong}`, y, 38, NAVY);

  // 赤いはんこ「あなたは何Lv？」
  ctx.save();
  ctx.translate(R - 84, RY + RH - 102);
  ctx.rotate(-0.22);
  ctx.globalAlpha = 0.88;
  ctx.strokeStyle = RED;
  for (let k = 0; k < 2; k++) {
    ctx.lineWidth = k ? 4 : 7;
    ctx.beginPath();
    ctx.ellipse(rnd(2), rnd(2), (k ? 82 : 94) + rnd(2), (k ? 82 : 94) + rnd(2), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = RED;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `34px ${HAND}`;
  ctx.fillText('あなたは', 0, -22);
  ctx.font = `46px ${HAND}`;
  ctx.fillText('何Lv？', 0, 26);
  ctx.restore();

  ctx.restore();
  return new Promise((resolve, reject) => c.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('toBlob'))), 'image/png'));
}
