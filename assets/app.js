(function () {
  'use strict';
  var A = window.ASCII;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ------------------------------------------------------------------ */
  /* i18n (EN default, TR)                                               */
  /* ------------------------------------------------------------------ */
  var TR = window.I18N_TR || {};
  var EN = {};
  $$('[data-i18n]').forEach(function (el) { EN[el.dataset.i18n] = el.innerHTML; });
  function setLang(l) {
    var dict = l === 'tr' ? TR : EN;
    $$('[data-i18n]').forEach(function (el) {
      var k = el.dataset.i18n;
      if (dict[k] != null) el.innerHTML = dict[k];
    });
    document.documentElement.lang = l;
    $$('#lang b').forEach(function (b) { b.classList.toggle('on', b.dataset.l === l); });
    try { localStorage.setItem('lang', l); } catch (e) {}
    buildLegend();
  }
  var lang = 'en';
  try { lang = localStorage.getItem('lang') || ((navigator.language || '').toLowerCase().indexOf('tr') === 0 ? 'tr' : 'en'); } catch (e) {}
  $('#lang').addEventListener('click', function () { lang = lang === 'en' ? 'tr' : 'en'; setLang(lang); });

  /* ------------------------------------------------------------------ */
  /* Hero + background                                                   */
  /* ------------------------------------------------------------------ */
  var tide = A.glyphTide($('#tide'), { cellSize: 14 });
  // only animate the background while the hero is on screen
  new IntersectionObserver(function (en) { tide.setActive(en[0].isIntersecting); }).observe($('.hero'));
  A.asciiCascade($('#wordmark'), A.blockText('MFOSEC'));

  // nav gets a solid background once the page scrolls
  var nav = $('#nav'), navOn = null;
  function navState() { var on = window.scrollY > 24; if (on !== navOn) { navOn = on; nav.classList.toggle('scrolled', on); } }
  window.addEventListener('scroll', navState, { passive: true });
  navState();
  $('#yr').textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------ */
  /* ASCII textures for the MacBook parts                                */
  /* ------------------------------------------------------------------ */
  var COLS = 80, ROWS = 33;
  function grid(c, r, ch) { var g = []; for (var y = 0; y < r; y++) { g.push([]); for (var x = 0; x < c; x++) g[y].push(ch || ' '); } return g; }
  function put(g, x, y, s) { for (var i = 0; i < s.length; i++) if (g[y] && x + i >= 0 && x + i < g[y].length) g[y][x + i] = s[i]; }
  function box(g, x, y, w, h, label, fill) {
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
      var ch = fill || ' ';
      if (j === 0) ch = i === 0 ? '┌' : i === w - 1 ? '┐' : '─';
      else if (j === h - 1) ch = i === 0 ? '└' : i === w - 1 ? '┘' : '─';
      else if (i === 0 || i === w - 1) ch = '│';
      put(g, x + i, y + j, ch);
    }
    if (label) { var ls = [].concat(label); for (var k = 0; k < ls.length; k++) put(g, x + Math.floor((w - ls[k].length) / 2), y + Math.floor(h / 2) - Math.floor(ls.length / 2) + k, ls[k]); }
  }
  function str(g) { return g.map(function (r) { return r.join(''); }).join('\n'); }
  var rnd = (function (seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; })(1337);

  var GEN = {
    bottom: function () {
      var g = grid(COLS, ROWS);
      for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) if (rnd() < 0.05) g[y][x] = '.';
      for (var vx = 14; vx < 66; vx += 2) { put(g, vx, 2, '¦'); put(g, vx, 3, '¦'); }
      ['(●)', '(●)'].forEach(function (f, i) { put(g, i ? COLS - 7 : 4, 6, f); put(g, i ? COLS - 7 : 4, ROWS - 4, f); });
      [[1, 1], [COLS - 2, 1], [1, ROWS - 2], [COLS - 2, ROWS - 2], [39, 1], [39, ROWS - 2]].forEach(function (p) { put(g, p[0], p[1], '⊕'); });
      box(g, 22, 13, 36, 7, ['>_ mfosec // model A-2026', 'designed in istanbul', 'assembled on demand']);
      return str(g);
    },
    battery: function () {
      var g = grid(COLS, ROWS);
      var cw = 22, ch = 12, gx = 4, ox = Math.floor((COLS - (cw * 3 + gx * 2)) / 2), oy = 3;
      for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) {
        var x = ox + c * (cw + gx), y = oy + r * (ch + 3);
        box(g, x, y, cw, ch);
        var lvl = [10, 9, 10, 8, 10, 9][r * 3 + c];
        for (var j = 0; j < ch - 4; j++) put(g, x + 2, y + 2 + j, (j >= ch - 4 - lvl ? '▓' : '░').repeat(cw - 4));
        put(g, x + 2, y + 1, '+'); put(g, x + cw - 3, y + 1, '-');
        put(g, x + 3, y + Math.floor(ch / 2), ' Li-ion 3.85V ');
      }
      put(g, ox, ROWS - 2, '72.6Wh · 6 cells · BMS ok · cycle 0042');
      return str(g);
    },
    board: function () {
      var g = grid(COLS, ROWS);
      for (var y = 1; y < ROWS - 1; y += 3) for (var x = 2; x < COLS - 2; x += 4) g[y][x] = '·';
      for (var i = 0; i < 28; i++) {
        var yy = 1 + Math.floor(rnd() * (ROWS - 2)), xx = Math.floor(rnd() * (COLS - 20)), len = 6 + Math.floor(rnd() * 26);
        for (var k = 0; k < len && xx + k < COLS; k++) g[yy][xx + k] = '─';
        var yy2 = Math.max(1, yy - Math.floor(rnd() * 6)), xe = Math.min(COLS - 1, xx + len);
        for (var v = yy2; v < yy; v++) g[v][xe] = '│';
        if (yy2 < yy) { g[yy][xe] = '┘'; g[yy2][xe] = '○'; }
      }
      box(g, 30, 10, 20, 11, ['M-SEC', 'SoC', '', '16-core'], ' ');
      box(g, 18, 11, 9, 4, 'RAM'); box(g, 18, 16, 9, 4, 'RAM');
      box(g, 53, 9, 12, 5, 'NAND'); box(g, 53, 16, 12, 5, 'NAND');
      box(g, 4, 3, 10, 4, 'USB-C'); box(g, 4, 25, 10, 4, 'USB-C');
      box(g, 67, 3, 10, 5, 'WIFI'); box(g, 67, 24, 10, 5, 'PMIC');
      box(g, 32, 25, 16, 4, 'T-AUDIT');
      return str(g);
    },
    shell: function () {
      var g = grid(COLS, ROWS);
      for (var y = 0; y < ROWS; y += 2) for (var x = (y / 2) % 2 ? 1 : 3; x < COLS; x += 4) g[y][x] = '.';
      box(g, 27, 13, 26, 7, ['', '>_  mfosec', ''], ' ');
      return str(g);
    },
    panel: function () {
      var g = grid(COLS, ROWS);
      for (var y = 1; y < ROWS - 1; y++) {
        var row = y % 4 === 1 ? '═' : y % 4 === 3 ? '·' : ' ';
        for (var x = 2; x < COLS - 2; x++) g[y][x] = row === '·' ? (x % 3 ? ' ' : '·') : row;
      }
      put(g, 18, 16, ' ASCII-XDR · 254 ppi · 120 Hz · LED backlight ');
      return str(g);
    },
    trackpad: function () {
      var g = grid(44, 12);
      for (var y = 0; y < 12; y += 2) for (var x = (y / 2) % 2 ? 0 : 2; x < 44; x += 4) g[y][x] = '+';
      return str(g);
    }
  };
  $$('pre[data-gen]').forEach(function (p) { p.textContent = GEN[p.dataset.gen](); });

  var KB = [
    ['esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', '⏻'],
    ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', '⌫:w15'],
    ['⇥:w15', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
    ['⇪:w18', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', '\'', '⏎:w18'],
    ['⇧:w22', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', '⇧:w22'],
    ['fn', '⌃', '⌥', '⌘:w15', ':w6', '⌘:w15', '⌥', '◂', '▴▾', '▸']
  ];
  var kb = $('#keyboard');
  KB.forEach(function (row, ri) {
    var r = document.createElement('div');
    r.className = 'krow' + (ri === 0 ? ' fn' : '');
    row.forEach(function (k) {
      var parts = k.split(':'), d = document.createElement('div');
      d.className = 'key' + (parts[1] ? ' ' + parts[1] : '');
      d.textContent = parts[0];
      r.appendChild(d);
    });
    kb.appendChild(r);
  });

  /* ------------------------------------------------------------------ */
  /* Terminal on the screen                                              */
  /* ------------------------------------------------------------------ */
  var TERM = [
    { c: './build --client you --platforms ios,android,web' },
    { o: '<span class="ok">[✓]</span> brief parsed <span class="mu">· 3 screens · auth · payments</span>' },
    { o: '<span class="ok">[✓]</span> prototype <span class="mu">→ figma · approved</span>' },
    { o: '<span class="ok">[✓]</span> expo + next.js scaffold <span class="mu">· one codebase</span>' },
    { c: 'forge test --mt invariant_ && ./audit --web' },
    { o: '<span class="wa">[!]</span> IDOR on /api/orders/:id <span class="mu">→ patched</span>' },
    { o: '<span class="ok">[✓]</span> 128 invariants hold <span class="mu">· 0 criticals</span>' },
    { c: 'wrangler deploy' },
    { o: '<span class="ok">[✓]</span> live → <span class="mg">https://your-app.com</span>' },
    { o: '<span class="mu">ship it.</span>' }
  ];
  var term = $('#term'), termTimer = null, termStarted = false;
  var PROMPT = '<span class="ok">mfosec</span><span class="mu">@ist</span> ~ % ';
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function runTerm() {
    if (termStarted) return;
    termStarted = true;
    var li = 0, ci = 0, done = '';
    function tick() {
      if (li >= TERM.length) { term.innerHTML = done + PROMPT + '<span class="blink">▌</span>'; return; }
      var L = TERM[li];
      if (L.o) { done += L.o + '\n'; li++; term.innerHTML = done; termTimer = setTimeout(tick, 260); return; }
      ci++;
      term.innerHTML = done + PROMPT + esc(L.c.slice(0, ci)) + '<span class="blink">▌</span>';
      if (ci >= L.c.length) { done += PROMPT + esc(L.c) + '\n'; li++; ci = 0; termTimer = setTimeout(tick, 380); }
      else termTimer = setTimeout(tick, 22);
    }
    tick();
  }
  function resetTerm() { clearTimeout(termTimer); termStarted = false; term.innerHTML = PROMPT + '<span class="blink">▌</span>'; }
  resetTerm();

  /* ------------------------------------------------------------------ */
  /* Teardown: scroll-driven exploded MacBook                            */
  /* ------------------------------------------------------------------ */
  var section = $('#teardown'), stage = $('#stage'), mac = $('#mac'), lid = $('#lid');
  var P = {};
  $$('.part', mac).forEach(function (el) { P[el.dataset.part] = el; });
  var edge = $('.edge', mac);
  var labels = $$('.label', stage);
  var labelsBox = $('#labels');
  var progBar = $('#tdBar'), progStage = $('#tdStage');
  var W = 440, D = 300;

  function buildLegend() {
    var old = $('.legend', labelsBox); if (old) old.remove();
    var lg = document.createElement('div'); lg.className = 'legend';
    labels.forEach(function (l) {
      var d = document.createElement('div');
      d.innerHTML = '<b>' + $('b', l).textContent + '</b>' + $('strong', l).textContent.split('→').pop().trim();
      lg.appendChild(d);
    });
    labelsBox.appendChild(lg);
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  var STAGES = ['booting', 'opening lid', 'rotating chassis', 'unhinging display', 'exploding layers', 'inventory'];
  var lastP = -1, ticking = false, force = true, litState = null;

  function render() {
    ticking = false;
    var r = section.getBoundingClientRect();
    // off-screen or unchanged: touch nothing (writing 3D transforms forces a costly restyle)
    if (r.bottom < 0 || r.top > window.innerHeight) { if (!force) return; }
    var total = section.offsetHeight - window.innerHeight;
    var p = clamp(-r.top / total, 0, 1);
    if (!force && Math.abs(p - lastP) < 0.0005) return;
    force = false;
    var sr = stage.getBoundingClientRect(); // read before any writes this frame
    var narrow = sr.width < 860;

    var a = ease(seg(p, 0.02, 0.16));   // lid opens
    var b = ease(seg(p, 0.16, 0.32));   // camera swings to 3/4 view
    var c = ease(seg(p, 0.32, 0.48));   // lid lays flat
    var d = ease(seg(p, 0.48, 0.68));   // lid stacks on top, base explodes
    var e = ease(seg(p, 0.62, 0.78));   // lid layers separate
    var f = seg(p, 0.78, 1);            // slow drift

    var g = 72; // layer gap (px, pre-scale)
    var lidAngle = 104 * a + 76 * c;

    // base layers
    P.bottom.style.transform = 'translateZ(0px)';
    P.battery.style.transform = 'translateZ(' + lerp(3, g, d) + 'px)';
    P.board.style.transform = 'translateZ(' + lerp(6, 2 * g, d) + 'px)';
    P.deck.style.transform = 'translateZ(' + lerp(10, 3 * g, d) + 'px)';
    edge.style.transform = 'translateZ(10px) rotateX(-90deg)';
    edge.style.opacity = String(1 - d);

    // lid group: hinge at the back edge (y=0)
    var lidZ = lerp(11, 4 * g + 4, d);
    lid.style.transform = 'translateY(' + (D * d) + 'px) translateZ(' + lidZ + 'px) rotateX(' + lidAngle + 'deg)';
    P.glass.style.transform = 'translateZ(' + lerp(0, -2 * g, e) + 'px) rotateX(180deg)';
    P.panel.style.transform = 'translateZ(' + lerp(1.5, -g, e) + 'px) rotateX(180deg)';
    P.shell.style.transform = 'translateZ(3px)';

    // camera
    var rx = lerp(lerp(66, 58, b), 63, d);
    var rz = -30 * b - 8 * f + 30 * 0; // swing
    // bigger while assembled, shrink to fit the tall exploded stack
    var sA = Math.min(1.15, sr.width / (narrow ? 640 : 900), sr.height / 520);
    var sE = Math.min(1, sr.width / (narrow ? 820 : 1180), sr.height / (narrow ? 1150 : 800));
    var scale = Math.max(0.4, lerp(sA, sE, d));
    // keep the composition centred as its footprint changes
    var cy = lerp(0, D / 2, c) * (1 - d);                       // lid lying behind -> shift forward
    var cz = -lerp(lerp(D * 0.35 * a, D * 0.05, c), 3 * g, d);  // tall stack -> pull down
    var sy = lerp(14, 4, b) + lerp(0, narrow ? -46 : 24, d); // narrow: leave room for the legend
    mac.style.transform = 'translateY(' + sy + 'px) scale3d(' + scale + ',' + scale + ',' + scale + ') rotateX(' + rx + 'deg) rotateZ(' + rz + 'deg) translate3d(0,' + cy + 'px,' + cz + 'px)';

    // screen + highlights
    if (p > 0.08) runTerm(); else if (p < 0.01 && termStarted) resetTerm();
    var exploded = d > 0.7;
    if (exploded !== litState) { litState = exploded; Object.keys(P).forEach(function (k) { P[k].classList.toggle('lit', exploded); }); }

    // labels next to each layer
    var show = e > 0.55;
    labels.forEach(function (l, i) {
      var part = P[l.dataset.for];
      var on = show && p > 0.7 + i * 0.012;
      l.classList.toggle('on', on);
      if (!on) return;
      var pr = part.getBoundingClientRect();
      var y = pr.top + pr.height * 0.42 - sr.top - 9;
      if (l.classList.contains('right')) {
        var x = pr.right - sr.left + 6;
        if (narrow) x = Math.min(x, sr.width - 56); // keep the number tag on screen
        l.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      } else {
        l.style.transform = 'translate(calc(' + (pr.left - sr.left - 6) + 'px - 100%),' + y + 'px)';
      }
    });
    labelsBox.classList.toggle('legend-on', show);

    // progress readout
    var st = STAGES[Math.min(STAGES.length - 1, p < 0.02 ? 0 : p < 0.16 ? 1 : p < 0.32 ? 2 : p < 0.48 ? 3 : p < 0.78 ? 4 : 5)];
    progBar.style.width = (p * 100).toFixed(1) + '%';
    if (progStage.textContent !== st) progStage.textContent = st;
    lastP = p;
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(render); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { force = true; onScroll(); });

  setLang(lang);
  render();
})();
