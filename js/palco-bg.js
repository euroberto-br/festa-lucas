/* ============================================================
   PALCO MUSSA 60 FPS — Fundo animado compartilhado
   Holofotes, estrelas, skyline urbano, equalizador e notas musicais
   ============================================================ */
(function () {
  'use strict';
  if (document.getElementById('palcoCanvas')) return;

  var canvas = document.createElement('canvas');
  canvas.id = 'palcoCanvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var reduzMov = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, mouseX = 0.5;
  var estrelas = [], notas = [];
  var SIMBOLOS = ['♪', '♫', '★', '✦', '🎤'];
  var CORES = ['#FFD23F', '#E62E2D', '#1CC6E8', '#F44E8B', '#8A4FFF', '#3EC96B'];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    estrelas = [];
    for (var i = 0; i < 62; i++) {
      estrelas.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.72,
        r: 1 + Math.random() * 2.1,
        p: Math.random() * Math.PI * 2
      });
    }
    if (!notas.length) {
      for (var j = 0; j < 18; j++) {
        notas.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vy: 0.30 + Math.random() * 0.62,
          vx: (Math.random() - 0.5) * 0.28,
          sz: 16 + Math.random() * 20,
          sym: SIMBOLOS[j % SIMBOLOS.length],
          cor: CORES[j % CORES.length],
          op: 0.15 + Math.random() * 0.26
        });
      }
    }
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', function (e) {
    mouseX = e.clientX / Math.max(1, W);
  }, { passive: true });

  var t0 = performance.now();
  function desenha(now) {
    var t = (now - t0) / 1000;

    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#FFF4D6');
    g.addColorStop(0.42, '#FFE4EE');
    g.addColorStop(0.80, '#EADFFF');
    g.addColorStop(1, '#FFF0DF');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var rad = ctx.createRadialGradient(W * mouseX, H * 0.2, 10, W * mouseX, H * 0.2, Math.max(W, H) * 0.52);
    rad.addColorStop(0, 'rgba(255,210,63,0.30)');
    rad.addColorStop(0.55, 'rgba(230,46,45,0.08)');
    rad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, W, H);

    var sw1 = Math.sin(t * 0.8) * W * 0.18 + (mouseX - 0.5) * 80;
    var sw2 = Math.cos(t * 0.68) * W * 0.18 - (mouseX - 0.5) * 80;
    ctx.fillStyle = 'rgba(255,210,63,0.18)';
    ctx.beginPath();
    ctx.moveTo(W * 0.14, H);
    ctx.lineTo(W * 0.04 + sw1, 0);
    ctx.lineTo(W * 0.25 + sw1, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(28,198,232,0.14)';
    ctx.beginPath();
    ctx.moveTo(W * 0.86, H);
    ctx.lineTo(W * 0.75 + sw2, 0);
    ctx.lineTo(W * 0.96 + sw2, 0);
    ctx.closePath();
    ctx.fill();

    for (var i = 0; i < estrelas.length; i++) {
      var s = estrelas[i];
      ctx.fillStyle = 'rgba(212,155,0,' + (0.24 + 0.6 * Math.abs(Math.sin(t * 1.7 + s.p))) + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(138,79,255,0.10)';
    var bw = Math.max(46, Math.round(W / 18));
    for (var bx = 0; bx < W + bw; bx += bw) {
      var bh = 44 + ((bx * 37) % 82);
      ctx.fillRect(bx, H - bh - 32, bw - 4, bh + 32);
    }

    var cols = Math.max(14, Math.min(30, Math.floor(W / 38)));
    var colW = W / cols;
    for (var c = 0; c < cols; c++) {
      var wave = Math.abs(Math.sin(t * 2.5 + c * 0.45)) * 0.65 + Math.abs(Math.cos(t * 3.0 - c * 0.3)) * 0.35;
      var eh = 16 + wave * 56;
      ctx.fillStyle = CORES[c % CORES.length];
      ctx.globalAlpha = 0.28;
      ctx.fillRect(c * colW + 4, H - eh, Math.max(6, colW - 8), eh);
    }
    ctx.globalAlpha = 1;

    for (var j = 0; j < notas.length; j++) {
      var n = notas[j];
      if (!reduzMov) {
        n.y -= n.vy;
        n.x += n.vx + Math.sin(t + j) * 0.22;
        if (n.y < -40) { n.y = H + 30; n.x = Math.random() * W; }
        if (n.x < -30) n.x = W + 20;
        if (n.x > W + 30) n.x = -20;
      }
      ctx.globalAlpha = n.op;
      ctx.fillStyle = n.cor;
      ctx.font = '800 ' + Math.round(n.sz) + 'px "Baloo 2", Arial, sans-serif';
      ctx.fillText(n.sym, n.x, n.y);
    }
    ctx.globalAlpha = 1;

    if (!reduzMov) requestAnimationFrame(desenha);
  }

  desenha(performance.now());
})();
