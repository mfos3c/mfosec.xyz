/*
 * ASCII effects — vanilla-JS ports of two 21st.dev community components
 * by @nikolas-sapa (https://21st.dev/community/ascii):
 *   - "Background ASCII Plasma" (GlyphTide)  -> glyphTide(canvas)
 *   - "Text ASCII Cascade" (AsciiCascadeText) -> asciiCascade(el, text)
 * Ported from React to plain DOM so the site stays a dependency-free static build,
 * and tuned for a full-page background: glyph atlas + drawImage instead of fillText,
 * 1x resolution, ~30 fps cap, paused when the tab is hidden.
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
  var FRAME_MS = 1000 / 30;

  function fieldValue(x, y, t) {
    var a = Math.sin(x * 0.045 + t * 0.16) + Math.sin(y * 0.05 - t * 0.12) + Math.sin((x - y) * 0.03 + t * 0.07);
    var b = Math.sin(x * 0.13 - t * 0.34) + Math.sin(y * 0.11 + t * 0.27);
    var c = Math.sin(x * 0.29 + y * 0.24 + t * 0.85) + Math.sin((x + y) * 0.34 - t * 1.05);
    return (a * 0.42 + b * 0.34 + c * 0.24) / 5 + 0.5;
  }

  /* GPU path: the same plasma field + cursor warp, evaluated per pixel in a
     fragment shader that samples a pre-rendered glyph atlas. The CPU does
     nothing per frame except set four uniforms. */
  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform vec2 uRes; uniform vec2 uCell; uniform float uT; uniform vec3 uCur;',
    'uniform sampler2D uAtlas; uniform vec3 uColor;',
    'float field(vec2 p, float t){',
    '  float a = sin(p.x*0.045 + t*0.16) + sin(p.y*0.05 - t*0.12) + sin((p.x-p.y)*0.03 + t*0.07);',
    '  float b = sin(p.x*0.13 - t*0.34) + sin(p.y*0.11 + t*0.27);',
    '  float c = sin(p.x*0.29 + p.y*0.24 + t*0.85) + sin((p.x+p.y)*0.34 - t*1.05);',
    '  return (a*0.42 + b*0.34 + c*0.24)/5.0 + 0.5;',
    '}',
    'void main(){',
    '  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);',
    '  vec2 cell = floor(px / uCell);',
    '  vec2 local = (px - cell*uCell) / uCell;',
    '  vec2 s = cell;',
    '  if (uCur.z > 0.002) {',
    '    vec2 d = cell - uCur.xy; float d2 = dot(d,d);',
    '    if (d2 < 486.0) { float push = uCur.z * exp(-d2/81.0) * 3.2; s = cell + (d / max(sqrt(d2), 1e-4)) * push; }',
    '  }',
    '  float lum = pow(clamp(field(s, uT), 0.0, 1.0), 1.6);',
    '  float ci = floor(lum*12.0);',
    '  if (ci < 1.0) discard;',
    '  float alpha = 0.18 + min(5.0, floor(lum*6.0))/5.0*0.82;',
    '  float g = texture2D(uAtlas, vec2((ci + local.x)/13.0, local.y)).a;',
    '  gl_FragColor = vec4(uColor, g*alpha);',
    '}'
  ].join('\n');
  var VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';

  function glyphTideGL(canvas, cellSize) {
    var gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) return null;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ['uRes', 'uCell', 'uT', 'uCur', 'uAtlas', 'uColor'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    var tex = gl.createTexture();
    // one full-screen pass over a cleared buffer: write straight alpha, no blending (blending would square it)
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);

    var cellW = cellSize, cellH = cellSize, raf = 0, last = 0, acc = 0, t = 0;
    var cur = { x: -1e5, y: -1e5, tx: -1e5, ty: -1e5, energy: 0 };

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var box = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(box.width * dpr)), h = Math.max(1, Math.round(box.height * dpr));
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      var cs = getComputedStyle(canvas), size = cellSize * dpr;
      var m = document.createElement('canvas').getContext('2d');
      m.font = size + 'px ' + cs.fontFamily;
      cellW = m.measureText('MMMMMMMMMM').width / 10; cellH = size;
      // atlas: 13 glyph slots (slot 0 = space) in one row, white on transparent
      var aw = Math.ceil(cellW), ah = Math.ceil(cellH);
      var ac = document.createElement('canvas'); ac.width = aw * RAMP.length; ac.height = ah;
      var a = ac.getContext('2d');
      a.font = size + 'px ' + cs.fontFamily; a.textAlign = 'center'; a.textBaseline = 'middle'; a.fillStyle = '#fff';
      for (var i = 1; i < RAMP.length; i++) a.fillText(RAMP[i], i * aw + aw / 2, ah / 2);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ac);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var col = cs.color.match(/[\d.]+/g) || [198, 255, 0];
      gl.uniform3f(U.uColor, col[0] / 255, col[1] / 255, col[2] / 255);
      gl.uniform2f(U.uRes, w, h);
      gl.uniform2f(U.uCell, cellW, cellH);
      gl.uniform1i(U.uAtlas, 0);
      cur.dpr = dpr;
    }
    function draw() {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(U.uT, t % 6283.0);
      gl.uniform3f(U.uCur, cur.x * cur.dpr / cellW, cur.y * cur.dpr / cellH, cur.energy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (!last) last = now;
      acc += now - last; last = now;
      if (acc < FRAME_MS) return;
      var step = Math.min(0.1, acc / 1000); acc = 0;
      t += step;
      cur.x += (cur.tx - cur.x) * CURSOR_EASE * 2;
      cur.y += (cur.ty - cur.y) * CURSOR_EASE * 2;
      cur.energy *= Math.exp(-step / WARP_TAU);
      draw();
    }
    var active = true;
    function start() { if (active && !raf && !reducedMotion && !document.hidden) { last = 0; acc = FRAME_MS; raf = requestAnimationFrame(loop); } }
    function stop() { cancelAnimationFrame(raf); raf = 0; }
    function setActive(on) { active = on; if (on) start(); else stop(); }
    window.addEventListener('pointermove', function (e) {
      if (!active) return;
      var box = canvas.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
      if (cur.tx > -1e4) cur.energy = Math.min(1, cur.energy + Math.hypot(x - cur.tx, y - cur.ty) * ENERGY_GAIN * 0.02);
      cur.tx = x; cur.ty = y;
    }, { passive: true });
    var rt = null;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { resize(); draw(); }, 150); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); stop(); });
    document.fonts.ready.then(function () { resize(); draw(); start(); });
    return { start: start, stop: stop, setActive: setActive, gl: true };
  }

  function glyphTide(canvas, opts) {
    opts = opts || {};
    var cellSize = opts.cellSize || 14;
    var viaGL = glyphTideGL(canvas, cellSize);
    if (viaGL) return viaGL;
    // Canvas 2D fallback: too costly to animate full-screen, so draw a single still frame.
    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    var cellW = cellSize, cellH = cellSize, cols = 0, rows = 0;
    var atlas = null, aw = 0, ah = 0;
    var sinAx, sinAy, sinAxy, sinBx, sinBy, sinCxy;
    var sized = false, raf = 0, last = 0, acc = 0, t = 0;
    var cur = { x: -1e5, y: -1e5, tx: -1e5, ty: -1e5, energy: 0 };

    // pre-render every (glyph, alpha bucket) once; each frame is then just blits
    function buildAtlas(fam, fg) {
      aw = Math.ceil(cellW); ah = Math.ceil(cellH);
      atlas = document.createElement('canvas');
      atlas.width = aw * RAMP.length;
      atlas.height = ah * BUCKETS;
      var a = atlas.getContext('2d');
      a.font = cellSize + 'px ' + fam;
      a.textAlign = 'center';
      a.textBaseline = 'middle';
      a.fillStyle = fg;
      for (var b = 0; b < BUCKETS; b++) {
        a.globalAlpha = 0.18 + (b / (BUCKETS - 1)) * 0.82;
        for (var i = 1; i < RAMP.length; i++) a.fillText(RAMP[i], i * aw + aw / 2, b * ah + ah / 2);
      }
    }

    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      var cs = getComputedStyle(canvas);
      ctx.font = cellSize + 'px ' + cs.fontFamily;
      cellW = Math.max(4, ctx.measureText('MMMMMMMMMM').width / 10);
      cellH = cellSize;
      buildAtlas(cs.fontFamily, cs.color);
      cols = Math.max(1, Math.floor(w / cellW));
      rows = Math.max(1, Math.floor(h / cellH));
      sinAx = new Float64Array(cols); sinBx = new Float64Array(cols);
      sinAy = new Float64Array(rows); sinBy = new Float64Array(rows);
      sinAxy = new Float64Array(cols + rows - 1); sinCxy = new Float64Array(cols + rows - 1);
      sized = true;
    }

    function draw() {
      if (!sized) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var cgx = cur.x / cellW, cgy = cur.y / cellH, r2 = WARP_RADIUS * WARP_RADIUS, energy = cur.energy;
      var rowOff = rows - 1, gx, gy, n;
      for (gx = 0; gx < cols; gx++) { sinAx[gx] = Math.sin(gx * 0.045 + t * 0.16); sinBx[gx] = Math.sin(gx * 0.13 - t * 0.34); }
      for (gy = 0; gy < rows; gy++) { sinAy[gy] = Math.sin(gy * 0.05 - t * 0.12); sinBy[gy] = Math.sin(gy * 0.11 + t * 0.27); }
      for (n = 0; n < cols + rows - 1; n++) { sinAxy[n] = Math.sin((n - rowOff) * 0.03 + t * 0.07); sinCxy[n] = Math.sin(n * 0.34 - t * 1.05); }
      var warpOn = energy > 0.002, maxIdx = RAMP.length - 1;
      for (gy = 0; gy < rows; gy++) {
        var py = gy * cellH, ay = sinAy[gy], by = sinBy[gy];
        for (gx = 0; gx < cols; gx++) {
          var v = 0, hit = false;
          if (warpOn) {
            var dx = gx - cgx, dy = gy - cgy, d2 = dx * dx + dy * dy;
            if (d2 < r2 * 6) {
              var push = energy * Math.exp(-d2 / r2) * WARP_MAX, dist = Math.sqrt(d2) || 1e-4;
              v = fieldValue(gx + (dx / dist) * push, gy + (dy / dist) * push, t);
              hit = true;
            }
          }
          if (!hit) {
            var a = sinAx[gx] + ay + sinAxy[gx - gy + rowOff];
            var bb = sinBx[gx] + by;
            var c = Math.sin(gx * 0.29 + gy * 0.24 + t * 0.85) + sinCxy[gx + gy];
            v = (a * 0.42 + bb * 0.34 + c * 0.24) / 5 + 0.5;
          }
          if (v <= 0) continue;
          if (v > 1) v = 1;
          var lum = Math.pow(v, 1.6);
          var ci = (lum * maxIdx) | 0;
          if (ci === 0) continue;
          var bucket = Math.min(BUCKETS - 1, (lum * BUCKETS) | 0);
          ctx.drawImage(atlas, ci * aw, bucket * ah, aw, ah, gx * cellW, py, aw, ah);
        }
      }
    }

    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (!last) last = now;
      var dt = now - last;
      last = now;
      acc += dt;
      if (acc < FRAME_MS) return; // ~30 fps is plenty for a background
      var step = Math.min(0.1, acc / 1000);
      acc = 0;
      t += step;
      cur.x += (cur.tx - cur.x) * CURSOR_EASE * 2;
      cur.y += (cur.ty - cur.y) * CURSOR_EASE * 2;
      cur.energy *= Math.exp(-step / WARP_TAU);
      draw();
    }
    function start() { /* still frame only */ }
    function stop() { cancelAnimationFrame(raf); raf = 0; }

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
      rt = setTimeout(function () { resize(); draw(); }, 150);
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    document.fonts.ready.then(function () { resize(); draw(); start(); });

    return { start: start, stop: stop, setActive: function () {} };
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
      states.push({ el: sp, dx: 0, op: 1, ox: 0, oy: 0, glyph: ch, shown: ch, target: ch, col: 0 });
    }
    el.appendChild(frag);
    if (reducedMotion) return;

    var hover = false, visible = true, raf = 0, timer = 0;
    var phase = 'settled', phaseStart = performance.now();
    var DROP = 46, DROP_HOVER = 96, HOLD = 3200, FALL = 620, DWELL = 520, REFORM = 720;

    function write(s) {
      s.el.style.transform = (s.ox || s.oy) ? 'translate(' + s.ox.toFixed(1) + 'px,' + s.oy.toFixed(1) + 'px)' : '';
      s.el.style.opacity = s.op === 1 ? '' : s.op.toFixed(2);
      if (s.shown !== s.glyph) { s.el.textContent = s.glyph; s.shown = s.glyph; }
      var stray = Math.round(Math.min(1, (1 - s.op) / 0.72) * 10) * 7;
      if (stray !== s.col) { s.el.style.color = stray ? 'color-mix(in oklab, var(--lime) ' + stray + '%, var(--fg))' : ''; s.col = stray; }
    }

    function schedule(delay) {
      clearTimeout(timer);
      // while settled nothing moves: sleep with a timer instead of spinning rAF
      timer = setTimeout(function () { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop); }, delay);
    }

    function loop(now) {
      raf = 0;
      var drop = hover ? DROP_HOVER : DROP;
      var el2 = now - phaseStart, i, s, p, e, n = states.length;
      if (phase === 'settled') {
        if (el2 < (hover ? 0 : HOLD)) { schedule(HOLD - el2); return; }
        phase = 'falling'; phaseStart = now; el2 = 0;
        for (i = 0; i < n; i++) states[i].dx = (Math.random() - 0.5) * 18;
      }
      if (phase === 'falling') {
        p = Math.min(1, el2 / FALL); e = 1 - Math.pow(1 - p, 3);
        for (i = 0; i < n; i++) {
          s = states[i]; s.ox = s.dx * e; s.oy = drop * e; s.op = 1 - 0.72 * e;
          if (Math.random() < 0.35) s.glyph = pick();
        }
        if (p >= 1) { phase = 'field'; phaseStart = now; }
      } else if (phase === 'field') {
        for (i = 0; i < n; i++) if (Math.random() < 0.18) states[i].glyph = pick();
        if (el2 > (hover ? DWELL * 0.4 : DWELL)) { phase = 'reforming'; phaseStart = now; }
      } else if (phase === 'reforming') {
        p = Math.min(1, el2 / REFORM);
        for (i = 0; i < n; i++) {
          s = states[i];
          var stagger = (i / n) * 0.35;
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
      for (i = 0; i < n; i++) write(states[i]);
      if (phase === 'settled') schedule(hover ? 0 : HOLD);
      else if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    }

    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    }).observe(el);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && !raf) raf = requestAnimationFrame(loop); });
    el.addEventListener('pointerenter', function () { hover = true; if (!raf) raf = requestAnimationFrame(loop); });
    el.addEventListener('pointerleave', function () { hover = false; });
    schedule(HOLD);
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
