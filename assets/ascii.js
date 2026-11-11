/*
 * ASCII effects — vanilla-JS ports of two 21st.dev community components
 * by @nikolas-sapa (https://21st.dev/community/ascii):
 *   - "Background ASCII Plasma" (GlyphTide)  -> glyphTide(canvas)
 *   - "Text ASCII Cascade" (AsciiCascadeText) -> asciiCascade(el, text)
 * Ported from React to plain DOM so the site stays a dependency-free static build.
 */
(function () {
  'use strict';
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ */
  /* Background ASCII Plasma                                             */
  /* ------------------------------------------------------------------ */
  var RAMP = " .'`,:-=+*#%@";
  var BUCKETS = 6;
  var WARP_TAU = 1.3, WARP_RADIUS = 9, WARP_MAX = 3.2, ENERGY_GAIN = 0.09, CURSOR_EASE = 0.15;

  function fieldValue(x, y, t) {
    var a = Math.sin(x * 0.045 + t * 0.16) + Math.sin(y * 0.05 - t * 0.12) + Math.sin((x - y) * 0.03 + t * 0.07);
    var b = Math.sin(x * 0.13 - t * 0.34) + Math.sin(y * 0.11 + t * 0.27);
    var c = Math.sin(x * 0.29 + y * 0.24 + t * 0.85) + Math.sin((x + y) * 0.34 - t * 1.05);
    return (a * 0.42 + b * 0.34 + c * 0.24) / 5 + 0.5;
  }

  function glyphTide(canvas, opts) {
    opts = opts || {};
    var cellSize = opts.cellSize || 13;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var fg = '#c6ff00', cellW = cellSize, cellH = cellSize, cols = 0, rows = 0;
    var charBuf = new Uint8Array(0);
    var lists = [];
    for (var i = 0; i < BUCKETS; i++) lists.push([]);
    var sinAx, sinAy, sinAxy, sinBx, sinBy, sinCxy;
    var sized = false, raf = 0, last = 0, t = 0;
    var cur = { x: -1e5, y: -1e5, tx: -1e5, ty: -1e5, energy: 0 };

    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var fam = getComputedStyle(canvas).fontFamily;
      ctx.font = cellSize + 'px ' + fam;
      cellW = Math.max(4, ctx.measureText('MMMMMMMMMM').width / 10);
      cellH = cellSize;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fg = getComputedStyle(canvas).color;
      cols = Math.max(1, Math.floor(w / cellW));
      rows = Math.max(1, Math.floor(h / cellH));
      charBuf = new Uint8Array(cols * rows);
      sinAx = new Float64Array(cols); sinBx = new Float64Array(cols);
      sinAy = new Float64Array(rows); sinBy = new Float64Array(rows);
      sinAxy = new Float64Array(cols + rows - 1); sinCxy = new Float64Array(cols + rows - 1);
      sized = true;
    }

    function draw() {
      if (!sized) return;
      ctx.clearRect(0, 0, cols * cellW, rows * cellH);
      var cgx = cur.x / cellW, cgy = cur.y / cellH, r2 = WARP_RADIUS * WARP_RADIUS, energy = cur.energy;
      for (var b = 0; b < BUCKETS; b++) lists[b].length = 0;
      var rowOff = rows - 1, gx, gy, n;
      for (gx = 0; gx < cols; gx++) { sinAx[gx] = Math.sin(gx * 0.045 + t * 0.16); sinBx[gx] = Math.sin(gx * 0.13 - t * 0.34); }
      for (gy = 0; gy < rows; gy++) { sinAy[gy] = Math.sin(gy * 0.05 - t * 0.12); sinBy[gy] = Math.sin(gy * 0.11 + t * 0.27); }
      for (n = 0; n < cols + rows - 1; n++) { sinAxy[n] = Math.sin((n - rowOff) * 0.03 + t * 0.07); sinCxy[n] = Math.sin(n * 0.34 - t * 1.05); }
      var idx = 0;
      for (gy = 0; gy < rows; gy++) {
        for (gx = 0; gx < cols; gx++, idx++) {
          var v, warped = false, sx = gx, sy = gy;
          if (energy > 0.002) {
            var dx = gx - cgx, dy = gy - cgy, d2 = dx * dx + dy * dy;
            if (d2 < r2 * 6) {
              var push = energy * Math.exp(-d2 / r2) * WARP_MAX, dist = Math.sqrt(d2) || 1e-4;
              sx = gx + (dx / dist) * push; sy = gy + (dy / dist) * push; warped = true;
            }
          }
          if (warped) v = fieldValue(sx, sy, t);
          else {
            var a = sinAx[gx] + sinAy[gy] + sinAxy[gx - gy + rowOff];
            var bb = sinBx[gx] + sinBy[gy];
            var c = Math.sin(gx * 0.29 + gy * 0.24 + t * 0.85) + sinCxy[gx + gy];
            v = (a * 0.42 + bb * 0.34 + c * 0.24) / 5 + 0.5;
          }
          v = v < 0 ? 0 : v > 1 ? 1 : v;
          var lum = Math.pow(v, 1.6);
          var bucket = Math.min(BUCKETS - 1, Math.floor(lum * BUCKETS));
          var ci = Math.floor(lum * (RAMP.length - 1));
          charBuf[idx] = ci;
          if (ci !== 0) lists[bucket].push(idx);
        }
      }
      ctx.fillStyle = fg;
      for (b = 0; b < BUCKETS; b++) {
        var list = lists[b];
        ctx.globalAlpha = 0.18 + (b / (BUCKETS - 1)) * 0.82;
        for (var k = 0; k < list.length; k++) {
          var id = list[k], x = id % cols, y = (id - x) / cols;
          ctx.fillText(RAMP[charBuf[id]], x * cellW + cellW / 2, y * cellH + cellH / 2);
        }
      }
      ctx.globalAlpha = 1;
    }

    function loop(now) {
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      cur.x += (cur.tx - cur.x) * CURSOR_EASE;
      cur.y += (cur.ty - cur.y) * CURSOR_EASE;
      cur.energy *= Math.exp(-dt / WARP_TAU);
      draw();
      if (!document.hidden) raf = requestAnimationFrame(loop);
    }

    // canvas sits behind the content, so track the pointer on the window
    window.addEventListener('pointermove', function (e) {
      if (cur.tx > -1e4) {
        var s = Math.hypot(e.clientX - cur.tx, e.clientY - cur.ty);
        cur.energy = Math.min(1, cur.energy + s * ENERGY_GAIN * 0.02);
      }
      cur.tx = e.clientX; cur.ty = e.clientY;
    }, { passive: true });
    document.addEventListener('pointerleave', function () { cur.tx = -1e5; cur.ty = -1e5; });
    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { resize(); if (reducedMotion) draw(); }, 150);
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !reducedMotion) { cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(loop); }
    });
    document.fonts.ready.then(function () {
      resize();
      if (reducedMotion) draw(); else raf = requestAnimationFrame(loop);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Text ASCII Cascade                                                  */
  /* ------------------------------------------------------------------ */
  var NOISE = '#%&@*+=-:.░▒▓';
  function pick() { return NOISE[(Math.random() * NOISE.length) | 0]; }

  function asciiCascade(el, text) {
    el.textContent = '';
    var states = [];
    var frag = document.createDocumentFragment();
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '\n' || ch === ' ') { frag.appendChild(document.createTextNode(ch)); continue; }
      var sp = document.createElement('span');
      sp.textContent = ch;
      sp.setAttribute('aria-hidden', 'true');
      frag.appendChild(sp);
      states.push({ el: sp, dx: 0, op: 1, ox: 0, oy: 0, glyph: ch, shown: ch, target: ch, col: -1 });
    }
    el.appendChild(frag);
    if (reducedMotion) return;

    var hover = false, visible = true, raf = 0, last = 0;
    var phase = 'settled', phaseStart = performance.now();
    var DROP = 46, DROP_HOVER = 96, HOLD = 2600, FALL = 620, DWELL = 520, REFORM = 720;

    function startFall(now) {
      phase = 'falling'; phaseStart = now;
      for (var i = 0; i < states.length; i++) states[i].dx = (Math.random() - 0.5) * 18;
    }

    function loop(now) {
      raf = 0;
      var drop = hover ? DROP_HOVER : DROP;
      var el2 = now - phaseStart, i, s, p, e;
      if (phase === 'settled' && el2 > (hover ? 0 : HOLD)) startFall(now);
      else if (phase === 'falling') {
        p = Math.min(1, el2 / FALL); e = 1 - Math.pow(1 - p, 3);
        for (i = 0; i < states.length; i++) {
          s = states[i]; s.ox = s.dx * e; s.oy = drop * e; s.op = 1 - 0.72 * e;
          if (Math.random() < 0.35) s.glyph = pick();
        }
        if (p >= 1) { phase = 'field'; phaseStart = now; }
      } else if (phase === 'field') {
        for (i = 0; i < states.length; i++) if (Math.random() < 0.18) states[i].glyph = pick();
        if (el2 > (hover ? DWELL * 0.4 : DWELL)) { phase = 'reforming'; phaseStart = now; }
      } else if (phase === 'reforming') {
        p = Math.min(1, el2 / REFORM);
        var n = states.length;
        for (i = 0; i < n; i++) {
          s = states[i];
          // stagger left -> right across the banner (by column, not by index)
          var stagger = Math.min(0.35, (i / n) * 0.35);
          var local = Math.max(0, Math.min(1, (p - stagger) / (1 - stagger)));
          e = 1 - Math.pow(1 - local, 3);
          s.ox = s.dx * (1 - e); s.oy = drop * (1 - e); s.op = 0.28 + 0.72 * e;
          if (local < 1 && Math.random() < 0.25) s.glyph = pick();
          else if (local >= 1) s.glyph = s.target;
        }
        if (p >= 1) {
          for (i = 0; i < n; i++) { s = states[i]; s.ox = 0; s.oy = 0; s.op = 1; s.glyph = s.target; }
          phase = 'settled'; phaseStart = now;
        }
      }
      for (i = 0; i < states.length; i++) {
        s = states[i];
        s.el.style.transform = 'translate3d(' + s.ox.toFixed(1) + 'px,' + s.oy.toFixed(1) + 'px,0)';
        s.el.style.opacity = s.op.toFixed(3);
        if (s.shown !== s.glyph) { s.el.textContent = s.glyph; s.shown = s.glyph; }
        var stray = Math.round(Math.min(1, (1 - s.op) / 0.72) * 70);
        if (stray !== s.col) { s.el.style.color = 'color-mix(in oklab, var(--lime) ' + stray + '%, var(--fg))'; s.col = stray; }
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    }

    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    }).observe(el);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && !raf) raf = requestAnimationFrame(loop); });
    el.addEventListener('pointerenter', function () { hover = true; });
    el.addEventListener('pointerleave', function () { hover = false; });
    raf = requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------------ */
  /* "ANSI Shadow" block letters                                         */
  /* ------------------------------------------------------------------ */
  var FONT = {
    M: ['███╗   ███╗', '████╗ ████║', '██╔████╔██║', '██║╚██╔╝██║', '██║ ╚═╝ ██║', '╚═╝     ╚═╝'],
    F: ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '██║     ', '╚═╝     '],
    O: [' ██████╗ ', '██╔═══██╗', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
    S: ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'],
    E: ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '███████╗', '╚══════╝'],
    C: [' ██████╗', '██╔════╝', '██║     ', '██║     ', '╚██████╗', ' ╚═════╝']
  };
  function blockText(word) {
    var lines = [];
    for (var r = 0; r < 6; r++) {
      var line = '';
      for (var i = 0; i < word.length; i++) line += FONT[word[i]][r];
      lines.push(line.replace(/\s+$/, ''));
    }
    return lines.join('\n');
  }

  window.ASCII = { glyphTide: glyphTide, asciiCascade: asciiCascade, blockText: blockText, reducedMotion: reducedMotion };
})();
