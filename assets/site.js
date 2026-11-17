/* Shared site script: light/dark toggle (all pages) and the hero heat mesh (home page).
   The theme itself is set before paint by the small inline script in each page's <head>. */
(function () {
  var root = document.documentElement;

  /* ---------- Light / dark toggle ---------- */
  function syncToggle() {
    var dark = root.dataset.theme === 'dark';
    document.querySelectorAll('.theme-toggle').forEach(function (b) {
      b.setAttribute('aria-label', dark ? 'Dark mode on. Switch to light mode' : 'Light mode on. Switch to dark mode');
      b.title = dark ? 'Dark mode (click for light)' : 'Light mode (click for dark)';
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(root).getPropertyValue('--canvas').trim();
  }
  document.querySelectorAll('.theme-toggle').forEach(function (b) {
    b.addEventListener('click', function () {
      var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) {}
      syncToggle();
      document.dispatchEvent(new Event('themechange'));
    });
  });
  syncToggle();

  /* ---------- Typing words in the intro ---------- */
  var tw = document.querySelector('.intro-words .tw');
  if (tw) {
    var list = (tw.dataset.words || '').split('|'), wi = 0, ci = list[0].length, del = true;
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    (function tick() {
      var w = list[wi], wait;
      if (still) { wi = (wi + 1) % list.length; setTimeout(function () { tw.textContent = list[wi]; tick(); }, 2200); return; }
      if (del) {
        ci--; wait = 45;
        if (ci <= 0) { ci = 0; del = false; wi = (wi + 1) % list.length; wait = 350; }
      } else {
        ci++; wait = 95;
        if (ci >= list[wi].length) { del = true; wait = 1600; }
      }
      tw.textContent = list[wi].slice(0, ci) || '\u200b';
      setTimeout(tick, wait);
    })();
  }

  /* ---------- Heat mesh: the cursor is a heat source ----------
     A jittered triangular mesh (like an FEA mesh). Each node has a temperature; the cursor heats
     nearby nodes and every node cools a little each frame, so the trail fades out behind the cursor.
     Colors come from the --heat-0..3 tokens, so the scale always matches the current theme. */
  function heat(band, pre, glowSel) {
  var cv = band && band.querySelector('canvas.heat');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, nodes = [], tris = [], stops, lineRGB, cap;
  var px = -1e4, py = -1e4, inside = false, lastMove = 0, raf = 0, pulses = [];
  var SIGMA = 85, COOL = 0.972;

  function hex(h) {
    h = h.trim().replace('#', '');
    if (h.length === 3) h = h.replace(/./g, '$&$&');
    return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); });
  }
  function readColors() {
    var cs = getComputedStyle(root);
    stops = [0, 1, 2, 3].map(function (i) { return hex(cs.getPropertyValue(pre + i)); });
    lineRGB = hex(cs.getPropertyValue(pre + 'line')).join(',');
    cap = parseFloat(cs.getPropertyValue(pre + 'alpha')) || 0.4;
  }
  function ramp(t) {
    t = Math.min(1, Math.max(0, t)) * 3;
    var i = Math.min(2, Math.floor(t)), f = t - i, a = stops[i], b = stops[i + 1];
    return [0, 1, 2].map(function (k) { return Math.round(a[k] + (b[k] - a[k]) * f); });
  }

  function build() {
    var r = band.getBoundingClientRect();
    W = r.width; H = r.height;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var s = W < 600 ? 28 : 34, h = s * 0.866;
    var cols = Math.ceil(W / s) + 2, rows = Math.ceil(H / h) + 2, seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; }
    // Resting heat: a soft glow around the headshot, so the mesh reads as a thermal plot before any interaction.
    var photo = band.querySelector(glowSel), gx = W * 0.75, gy = H * 0.55;
    if (photo) { var q = photo.getBoundingClientRect(); gx = q.left - r.left + q.width / 2; gy = q.top - r.top + q.height / 2; }
    nodes = []; tris = [];
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
      var nx = (x - 0.5 + (y % 2) * 0.5) * s + rnd() * s * 0.35, ny = (y - 0.5) * h + rnd() * s * 0.35;
      var d2 = (nx - gx) * (nx - gx) + (ny - gy) * (ny - gy);
      nodes.push({ x: nx, y: ny, base: 0.5 * Math.exp(-d2 / (2 * 120 * 120)), d: 0 });
    }
    function id(y, x) { return y * cols + x; }
    for (y = 0; y < rows - 1; y++) for (x = 0; x < cols - 1; x++) {
      if (y % 2 === 0) { tris.push([id(y, x), id(y, x + 1), id(y + 1, x)], [id(y, x + 1), id(y + 1, x + 1), id(y + 1, x)]); }
      else { tris.push([id(y, x), id(y + 1, x + 1), id(y + 1, x)], [id(y, x), id(y, x + 1), id(y + 1, x + 1)]); }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 0.8;
    for (var i = 0; i < tris.length; i++) {
      var a = nodes[tris[i][0]], b = nodes[tris[i][1]], c = nodes[tris[i][2]];
      var t = Math.min(1, (a.base + a.d + b.base + b.d + c.base + c.d) / 3);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
      if (t > 0.03) {
        var col = ramp(t);
        ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (cap * Math.pow(t, 0.8)).toFixed(3) + ')';
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(' + lineRGB + ',' + (0.07 + 0.2 * t).toFixed(3) + ')';
      ctx.stroke();
    }
  }

  function step(now) {
    var hot = 0, k = 1 / (2 * SIGMA * SIGMA);
    // Click bursts: a heat ring expands from the click point and fades.
    pulses = pulses.filter(function (P) {
      var age = (now - P.t0) / 1000;
      var f = Math.min(1, age / 0.9); P.r = 0.42 * H * (1 - (1 - f) * (1 - f)); // ring stops at ~7/8 of the header height across
      P.amp = Math.max(0, 1 - age / 1.1); P.core = Math.max(0, 1 - age / 0.45);
      return age < 1.1;
    });
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i], v = n.d * COOL;
      if (inside) {
        var dx = n.x - px, dy = n.y - py, g = Math.exp(-(dx * dx + dy * dy) * k);
        if (g > v) v = g;
      }
      for (var j = 0; j < pulses.length; j++) {
        var P = pulses[j], ex = n.x - P.x, ey = n.y - P.y, dist = Math.sqrt(ex * ex + ey * ey);
        var ring = P.amp * Math.exp(-((dist - P.r) * (dist - P.r)) / (2 * 30 * 30));
        var r2 = P.r * 0.55, ring2 = 0.6 * P.amp * Math.exp(-((dist - r2) * (dist - r2)) / (2 * 22 * 22));
        var core = P.core * Math.exp(-(dist * dist) / (2 * 55 * 55));
        if (ring2 > v) v = ring2;
        if (ring > v) v = ring;
        if (core > v) v = core;
      }
      n.d = v < 0.004 ? 0 : v;
      if (n.d > hot) hot = n.d;
    }
    draw();
    // Keep animating while the trail is cooling; stop once the cursor has rested for a moment.
    var resting = inside && now - lastMove > 1500;
    raf = pulses.length || (!inside && hot > 0) || (inside && !resting) ? requestAnimationFrame(step) : 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(step); }

  function setup() { readColors(); build(); draw(); }
  setup();

  if (!reduce) {
    band.addEventListener('pointermove', function (e) {
      var r = band.getBoundingClientRect();
      px = e.clientX - r.left; py = e.clientY - r.top;
      inside = true; lastMove = performance.now(); kick();
    });
    band.addEventListener('pointerleave', function () { inside = false; kick(); });
    band.addEventListener('pointerdown', function (e) {
      var r = band.getBoundingClientRect();
      pulses.push({ x: e.clientX - r.left, y: e.clientY - r.top, t0: performance.now(), r: 0, amp: 1, core: 1 });
      if (pulses.length > 6) pulses.shift();
      kick();
    });
  }
  document.addEventListener('themechange', function () { readColors(); draw(); });
  var lastW = W, timer;
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { var w = band.getBoundingClientRect().width; if (w !== lastW) { lastW = w; build(); draw(); } }, 120);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { build(); draw(); });
  }
  heat(document.querySelector('.hero-band'), '--heat-', '.hero-photo');
  heat(document.querySelector('.site-footer'), '--fheat-', '.to-top');
})();
