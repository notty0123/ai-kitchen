// AIキッチン：静的配信＋スコアの集計（docs/SCORE_RANK.md）
import { DurableObject } from 'cloudflare:workers';
import { plausible } from '../public/js/rank.js';
import { Counter, cellOf } from './counter.js';

const API_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: API_HEADERS });
const MAX_BODY = 100;

// 本文をバイト単位で数えながら読み、MAX_BODY を超えたらその場で読むのをやめる
async function readSmall(request) {
  const declared = Number(request.headers.get('content-length'));
  if (declared > MAX_BODY) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}

const PER_IP = 5; // 1 分に 1 つの接続元から受け付ける回数
const PER_MINUTE = 3000; // 1 分に全体で受け付ける回数（請求額の上限を決めるため）
const MAX_IPS = 20000; // 連打の見張りでメモリに持つ接続元の数の上限

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/score') {
      if (request.method !== 'POST') return json({ error: 'method' }, 405);
      // 止めるスイッチ（wrangler.jsonc の RANKING_OFF を "1" にして配備）。サイトは順位なしで動く
      if (env.RANKING_OFF === '1') return json({ error: 'off' }, 503);
      // このサイトの画面から送られたものだけ受け付ける（ほかのサイトに来た人を使った水増しを防ぐ）
      if (request.headers.get('origin') !== url.origin) return json({ error: 'origin' }, 403);
      const site = request.headers.get('sec-fetch-site');
      if (site && site !== 'same-origin') return json({ error: 'origin' }, 403);
      if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) return json({ error: 'type' }, 415);
      const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
      // 集計に届く前に、Cloudflare の入口で連打を止める
      if (env.SUBMIT_LIMIT && !(await env.SUBMIT_LIMIT.limit({ key: ip })).success) return json({ error: 'rate' }, 429);
      // 全体の入口の上限（Cloudflare の拠点ごとの目安。厳密な全世界の上限ではない）
      if (env.TOTAL_LIMIT && !(await env.TOTAL_LIMIT.limit({ key: 'all' })).success) return json({ error: 'busy' }, 429);
      const text = await readSmall(request);
      if (text == null) return json({ error: 'size' }, 400);
      let score;
      try {
        ({ score } = JSON.parse(text));
      } catch {
        return json({ error: 'json' }, 400);
      }
      if (!plausible(score)) return json({ error: 'score' }, 400);
      const stub = env.RANKING.get(env.RANKING.idFromName('public-v2'));
      return stub.submit(score, ip).then((r) => (r.limited ? json({ error: 'rate' }, 429) : json(r)), () => json({ error: 'server' }, 500));
    }
    return env.ASSETS.fetch(request);
  },
};

export class Ranking extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    // 保存するのはマスごとの人数だけ（行は最大 1,308,300 行）。AK4 からは public-v2 で数え直す
    this.sql.exec('CREATE TABLE IF NOT EXISTS cells (idx INTEGER PRIMARY KEY, n INTEGER NOT NULL)');
    // 連打の制限用。接続元はメモリにだけ持ち、保存しない
    this.hits = new Map();
    this.minute = 0;
    this.minuteN = 0;
    // 順位はメモリの中で数える。起きたときに1回だけ、保存してある人数を全部読み込む
    this.counter = new Counter();
    ctx.blockConcurrencyWhile(async () => {
      for (const row of this.sql.exec('SELECT idx, n FROM cells')) this.counter.add(row.idx, row.n);
    });
  }

  limited(ip, now) {
    const m = Math.floor(now / 60000);
    if (m !== this.minute) {
      this.minute = m;
      this.minuteN = 0;
      // 1 分たった接続元は、分が変わるたびに消す（送信が止まったときは、Durable Object がメモリから外れるときに消える）
      for (const [k, h] of this.hits) if (now - h.t >= 60000) this.hits.delete(k);
    }
    if (++this.minuteN > PER_MINUTE) return true;
    if (this.hits.size >= MAX_IPS) {
      for (const [k, h] of this.hits) if (now - h.t >= 60000) this.hits.delete(k);
      if (this.hits.size >= MAX_IPS) this.hits.clear();
    }
    let h = this.hits.get(ip);
    if (!h || now - h.t >= 60000) {
      h = { n: 0, t: now };
      this.hits.set(ip, h);
    }
    return ++h.n > PER_IP;
  }

  // 数える・足す・返すを1回の処理で行う（Durable Object は1つずつ順に処理する）
  async submit(score, ip) {
    if (this.limited(ip, Date.now())) return { limited: true };
    const idx = cellOf(score);
    const { higher, same } = this.counter.standing(idx);
    this.sql.exec('INSERT INTO cells (idx, n) VALUES (?, 1) ON CONFLICT(idx) DO UPDATE SET n = n + 1', idx);
    this.counter.add(idx, 1);
    return { rank: higher + same + 1, total: this.counter.total };
  }
}
