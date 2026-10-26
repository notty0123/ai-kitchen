import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('public/index.html', 'utf8');
const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('サイトに表示する診断文が prompt/diagnosis.txt と同じ', () => {
  const shown = unesc(html.match(/<!--PROMPT-->([\s\S]*?)<!--\/PROMPT-->/)[1]);
  assert.equal(shown, readFileSync('prompt/diagnosis.txt', 'utf8').replace(/\n+$/, ''));
});

test('診断文に URL が入っていない', () => {
  assert.doesNotMatch(readFileSync('prompt/diagnosis.txt', 'utf8'), /https?:|www\./);
});

test('外部のスクリプト・フォントを読まず、通信はこのサイトのスコア集計だけ', () => {
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  assert.doesNotMatch(html, /<link[^>]+href="https?:/);
  assert.match(html, /connect-src 'self'/);
  assert.match(readFileSync('public/_headers', 'utf8'), /connect-src 'self'/);
  const app = readFileSync('public/app.js', 'utf8');
  assert.doesNotMatch(app, /XMLHttpRequest|sendBeacon|WebSocket/);
  // fetch は 1 か所だけ、送り先は /api/score、送る中身は score だけ
  assert.deepEqual(app.match(/fetch\(/g), ['fetch(']);
  assert.match(app, /fetch\('\/api\/score'/);
  assert.match(app, /body: JSON\.stringify\(\{ score \}\)/);
});
