// 演出の粒（火花・湯気・紙吹雪・星・フラッシュ）を1枚の canvas に描く
export function createFx(canvas) {
  const ctx = canvas.getContext('2d');
  let parts = [];
  let flashA = 0;
  let flashColor = '255,255,255';
  let running = false;
  const dpr = Math.min(2, devicePixelRatio || 1);

  function resize() {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize);

  function loop() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      p.life -= 1;
      p.vy += p.g;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      const a = Math.min(1, p.life / p.fade);
      ctx.save();
      ctx.globalAlpha = a * p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.kind === 'rect') {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else if (p.kind === 'text') {
        ctx.fillStyle = p.color;
        ctx.font = `900 ${p.size}px "Hiragino Maru Gothic ProN", "Meiryo", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, 0, 0);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.r * (p.grow ? 1 + (1 - a) * 1.5 : 1), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (flashA > 0) {
      ctx.fillStyle = `rgba(${flashColor},${flashA})`;
      ctx.fillRect(0, 0, innerWidth, innerHeight);
      flashA = Math.max(0, flashA - 0.06);
    }
    if (parts.length || flashA > 0) requestAnimationFrame(loop);
    else running = false;
  }
  function kick() {
    if (!running) {
      running = true;
      requestAnimationFrame(loop);
    }
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const base = { g: 0, drag: 0.98, rot: 0, vr: 0, alpha: 1, grow: false };

  return {
    resize,
    clear() { parts = []; flashA = 0; },
    sparks(x, y, n = 20, colors = ['#ffd23f', '#ff9f0a', '#ff4b3e', '#fff']) {
      for (let i = 0; i < n; i++) {
        const ang = rnd(-Math.PI, 0);
        const sp = rnd(3, 9);
        parts.push({ ...base, kind: 'dot', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: 0.32, r: rnd(2, 4.5), color: colors[i % colors.length], life: rnd(24, 44), fade: 14 });
      }
      kick();
    },
    steam(x, y, n = 12) {
      for (let i = 0; i < n; i++) {
        parts.push({ ...base, kind: 'dot', x: x + rnd(-40, 40), y: y + rnd(-10, 10), vx: rnd(-0.6, 0.6), vy: rnd(-2.6, -1), drag: 0.99, r: rnd(10, 22), color: 'rgba(255,255,255,.9)', alpha: 0.55, grow: true, life: rnd(50, 80), fade: 40 });
      }
      kick();
    },
    word(x, y, text, color = '#1d212b') {
      parts.push({ ...base, kind: 'text', x, y, vx: 0, vy: -1.6, drag: 0.97, text, color, size: 34, life: 46, fade: 20 });
      kick();
    },
    confetti(n = 80) {
      const colors = ['#ff4b3e', '#ffc93c', '#4fc6a6', '#6fb6ff', '#b06bff', '#ffffff'];
      for (let i = 0; i < n; i++) {
        parts.push({ ...base, kind: 'rect', x: rnd(0, innerWidth), y: rnd(-80, -10), vx: rnd(-2, 2), vy: rnd(2, 6), g: 0.08, drag: 0.995, vr: rnd(-0.25, 0.25), w: rnd(6, 11), h: rnd(10, 16), color: colors[i % colors.length], life: rnd(110, 180), fade: 30 });
      }
      kick();
    },
    stars(n) {
      for (let i = 0; i < n * 6; i++) {
        parts.push({ ...base, kind: 'text', x: rnd(innerWidth * 0.2, innerWidth * 0.8), y: rnd(-60, -10), vx: rnd(-1, 1), vy: rnd(3, 7), g: 0.15, vr: rnd(-0.1, 0.1), text: '★', color: '#ffd23f', size: rnd(26, 52), life: rnd(90, 140), fade: 30 });
      }
      kick();
    },
    // 飛んでいく具材のうしろに残す光の軌跡
    trail(x, y) {
      parts.push({ ...base, kind: 'dot', x, y, vx: rnd(-0.4, 0.4), vy: rnd(-0.4, 0.4), r: rnd(5, 9), color: 'rgba(255,214,90,.9)', alpha: 0.75, life: 22, fade: 22 });
      if (Math.random() < 0.5) parts.push({ ...base, kind: 'text', x: x + rnd(-14, 14), y: y + rnd(-14, 14), vx: 0, vy: -0.3, text: '✦', color: '#fff6c2', size: rnd(10, 18), life: 26, fade: 20 });
      kick();
    },
    burst(x, y, n = 40) {
      for (let i = 0; i < n; i++) {
        const ang = rnd(0, Math.PI * 2);
        const sp = rnd(4, 12);
        parts.push({ ...base, kind: 'text', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, drag: 0.94, text: '✦', color: i % 3 ? '#ffffff' : '#ffd23f', size: rnd(12, 26), life: rnd(36, 60), fade: 24 });
      }
      kick();
    },
    // 宙を舞うオムレツのまわりの金のらせん
    spiral(cx, cy, ms = 1200) {
      const n = 70;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 5;
        const rad = 30 + i * 2.6;
        parts.push({ ...base, kind: 'dot', x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad * 0.6, vx: Math.cos(a + 1.6) * 1.2, vy: Math.sin(a + 1.6) * 1.2 - 0.4, r: rnd(3, 6), color: i % 4 ? 'rgba(255,205,70,.95)' : '#ffffff', life: Math.round((ms / 16) * (0.4 + (i / n) * 0.6)), fade: 30 });
      }
      kick();
    },
    flash(strong = false) {
      flashColor = '255,255,255';
      flashA = strong ? 1 : 0.7;
      kick();
    },
  };
}
