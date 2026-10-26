// prompt/diagnosis.txt の中身を public/index.html の <!--PROMPT--> の間に入れる
import { readFileSync, writeFileSync } from 'node:fs';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const prompt = readFileSync('prompt/diagnosis.txt', 'utf8').replace(/\n+$/, '');
const html = readFileSync('public/index.html', 'utf8');
const next = html.replace(/<!--PROMPT-->[\s\S]*?<!--\/PROMPT-->/, `<!--PROMPT-->${esc(prompt)}<!--/PROMPT-->`);
writeFileSync('public/index.html', next);
console.log('prompt を埋め込みました');
