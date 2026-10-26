// 順位の数え方（docs/SCORE_RANK.md）。どれだけ送られても使うメモリが決まった大きさになるよう、
// スコアを「Lv・点数・中身」のマス（最大 1,308,300 個）に分けて数える。指紋（下3桁）は数えない
// → 指紋だけ違う人どうしは先着順になる
const LV = 15;
const POINTS = 89; // 合計点 0〜88
const DETAIL = 980; // 0〜979
export const CELLS = LV * POINTS * DETAIL;

// plausible() を通ったスコアだけを渡すこと。上のスコアほど大きい番号になる
export function cellOf(score) {
  const lv = Math.floor(score / 100000000);
  const points = Math.floor((score % 100000000) / 1000000);
  const detail = Math.floor((score % 1000000) / 1000);
  return ((lv - 1) * POINTS + points) * DETAIL + detail;
}

export class Counter {
  constructor() {
    this.cell = new Float64Array(CELLS); // マス → 人数（約 10.5MB。Int32 だと21億件であふれるので小数の型で持つ）
    this.tree = new Float64Array(CELLS + 1); // 「ここまでの人数の合計」をすぐ出すための木（Fenwick 木、約 10.5MB）
    this.total = 0;
  }

  add(idx, n) {
    this.cell[idx] += n;
    this.total += n;
    for (let i = idx + 1; i <= CELLS; i += i & -i) this.tree[i] += n;
  }

  // 番号が idx 以下のマスの人数の合計
  upTo(idx) {
    let c = 0;
    for (let i = idx + 1; i > 0; i -= i & -i) c += this.tree[i];
    return c;
  }

  // 自分より上のマスの人数と、同じマスにすでにいる人数
  standing(idx) {
    return { higher: this.total - this.upTo(idx), same: this.cell[idx] };
  }
}
