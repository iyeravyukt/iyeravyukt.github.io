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

  /* ---------- Typing words in the intro, written by a ceiling-mounted robot arm ----------
     A carriage slides along a rail at the top of the intro strip and a 2-link arm (solved with
     2-link inverse kinematics) holds a pointer-claw tool. Per word: write each letter, hold,
     wipe the word away right to left with the claw open, reset at the left edge, write the next. */
  var tw = document.querySelector('.intro-words .tw');
  if (tw) {
    var list = (tw.dataset.words || '').split('|'), wi = 0;
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var band = tw.closest('.intro-band'), wordsEl = tw.parentNode;
    if (still || !band || !document.createElementNS) {
      (function cycle() { setTimeout(function () { wi = (wi + 1) % list.length; tw.textContent = list[wi]; cycle(); }, 2200); })();
    } else {
      wordsEl.classList.add('has-arm'); band.classList.add('arm-on');
      var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'arm'); svg.setAttribute('aria-hidden', 'true'); band.appendChild(svg);
      var meas = document.createElement('span'); meas.className = 'tw-measure'; meas.setAttribute('aria-hidden', 'true'); wordsEl.appendChild(meas);
      var caretEl = wordsEl.querySelector('.caret');
      /* On/off lever fixed at the left end of the rail. Off parks the arm and leaves the whole word showing. */
      var sw = document.createElement('button'); sw.type = 'button'; sw.className = 'arm-lever'; sw.innerHTML = '<span class="lv"></span>';
      sw.setAttribute('aria-label', 'Robot arm animation'); band.appendChild(sw);
      var on = true; try { on = localStorage.getItem('arm') !== 'off'; } catch (e) {}
      sw.setAttribute('aria-pressed', String(on));
      var OFF = 78, BY = 34, L1 = 54, L2 = 50, TOOL = 58, CH = 95;
      var x0 = 0, base = 0, railR = 0, bandW = 0, cx = [], word = '';
      var f2 = function (v) { return Math.round(v * 10) / 10; };
      var measure = function () {
        var R = band.getBoundingClientRect(), keep = tw.textContent;
        tw.textContent = '​';
        var t = tw.getBoundingClientRect(), c = caretEl.getBoundingClientRect();
        x0 = t.left - R.left; base = c.top - R.top + c.height * 0.92; bandW = R.width;
        tw.textContent = keep;
        var maxW = 0;
        list.forEach(function (w) { meas.textContent = w; maxW = Math.max(maxW, meas.getBoundingClientRect().width); });
        railR = Math.min(bandW - 6, x0 + maxW + OFF + 40);
        sw.style.transform = 'translate(' + f2(Math.max(2, x0 - 24)) + 'px, 3px)';
        setWord(word || list[wi]);
        if (!on) park();
      };
      var setWord = function (w) {
        word = w; cx = [];
        for (var i = 0; i <= w.length; i++) { meas.textContent = w.slice(0, i); cx.push(x0 + (i ? meas.getBoundingClientRect().width : 0) + 1); }
      };
      var line = function (c, a, b, d, e, wd) { return '<line class="' + c + '" x1="' + f2(a) + '" y1="' + f2(b) + '" x2="' + f2(d) + '" y2="' + f2(e) + '"' + (wd ? ' stroke-width="' + wd + '"' : '') + '/>'; };
      var slot = function (a, b, d, e, wd) { return line('slot-o', a, b, d, e, wd) + line('slot-i', a, b, d, e, wd - 7); };
      var joint = function (x, y, r) { return '<circle class="jt" cx="' + f2(x) + '" cy="' + f2(y) + '" r="' + r + '"/><circle class="jd" cx="' + f2(x) + '" cy="' + f2(y) + '" r="' + f2(r * 0.32) + '"/>'; };
      var draw = function (tx, ty, open) {
        var bx = Math.min(tx + OFF, railR - 26);
        var ux = -0.34, uy = 0.94, nx = -uy, ny = ux;
        var P = function (s, n) { return [tx - ux * s + nx * n, ty - uy * s + ny * n]; };
        var pt = function (s, n) { var p = P(s, n); return f2(p[0]) + ',' + f2(p[1]); };
        var W = P(TOOL, 0), dx = W[0] - bx, dy = W[1] - BY;
        var d = Math.max(Math.abs(L1 - L2) + 1, Math.min(L1 + L2 - 1, Math.hypot(dx, dy)));
        var a = Math.atan2(dy, dx), b = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
        var e1 = [bx + L1 * Math.cos(a + b), BY + L1 * Math.sin(a + b)], e2 = [bx + L1 * Math.cos(a - b), BY + L1 * Math.sin(a - b)];
        var E = e1[1] > e2[1] ? e1 : e2, C = P(48, 0);
        /* Two jaws hinged at the collar. Closed, they meet in one pointed tip (a pointer);
           open, they swing apart into a claw for wiping. */
        var jaw = function (k) {
          var th = k * open * 0.55, c = Math.cos(th), sn = Math.sin(th);
          var R = function (s, n) { var ds = s - 40, nn = n * k; return pt(40 + ds * c - nn * sn, ds * sn + nn * c); };
          return '<polygon class="jaw" points="' + [R(40, 0), R(40, 6.5), R(26, 6), R(12, 3.6), R(0, 0)].join(' ') + '"/>';
        };
        var hex = [0, 1, 2, 3, 4, 5].map(function (i) { var t = i * Math.PI / 3; return pt(44 + 5 * Math.sin(t), 8.5 * Math.cos(t)); }).join(' ');
        svg.innerHTML =
          '<defs><linearGradient id="armg" gradientUnits="userSpaceOnUse" x1="' + f2(bx) + '" y1="' + BY + '" x2="' + f2(tx) + '" y2="' + f2(ty) + '"><stop class="g0" offset=".12"/><stop class="g1" offset=".8"/></linearGradient></defs>' +
          '<rect class="rail" x="' + f2(x0 - 20) + '" y="1" width="' + f2(railR - x0 + 20) + '" height="4" rx="2"/>' +
          '<rect class="rail" x="' + f2(x0 - 22) + '" y="0" width="5" height="11" rx="1.5"/><rect class="rail" x="' + f2(railR - 3) + '" y="0" width="5" height="11" rx="1.5"/>' +
          '<rect class="cart" x="' + f2(bx - 22) + '" y="9" width="44" height="14" rx="4"/>' +
          '<circle class="whl" cx="' + f2(bx - 12) + '" cy="5" r="3.5"/><circle class="whl" cx="' + f2(bx + 12) + '" cy="5" r="3.5"/>' +
          slot(bx, BY, E[0], E[1], 18) + slot(E[0], E[1], W[0], W[1], 15) +
          line('slot-o', W[0], W[1], C[0], C[1], 8) +
          jaw(1) + jaw(-1) +
          '<polygon class="collar" points="' + hex + '"/>' +
          joint(bx, BY, 11) + joint(E[0], E[1], 10) + joint(W[0], W[1], 7);
      };
      var ease = function (f) { return f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; };
      var HOLD = 1300, ERASE = 560, RESET = 380;
      var phase = 'write', t = 0, last = 0, visible = true;
      var park = function () { tw.textContent = word; draw(cx[word.length] + 10, base - 14, 0); };
      sw.addEventListener('click', function () {
        on = !on; sw.setAttribute('aria-pressed', String(on));
        try { localStorage.setItem('arm', on ? 'on' : 'off'); } catch (e) {}
        if (on) { phase = 'hold'; t = 300; last = 0; requestAnimationFrame(frame); } else park();
      });
      document.addEventListener('heatintrostart', function () { phase = 'write'; t = 0; last = 0; wi = 0; setWord(list[0]); });
      var frame = function (now) {
        if (!on) return;
        if (window.heatIntroPending) { // header intro playing: no word yet, arm waits at the start of the line
          tw.textContent = '\u200b'; if (visible) draw(cx[0], base - 4, 0); last = 0; requestAnimationFrame(frame); return;
        }
        var dt = last ? Math.min(50, now - last) : 16; last = now; t += dt;
        var N = word.length, x, y = base, open = 0, n, f;
        if (phase === 'write') {
          n = Math.min(N, Math.floor(t / CH)); f = Math.min(1, (t - n * CH) / CH);
          tw.textContent = word.slice(0, n) || '​';
          if (n < N) { x = cx[n] + (cx[n + 1] - cx[n]) * ease(f); y = base - Math.sin(f * Math.PI) * 8; }
          else { phase = 'hold'; t = 0; x = cx[N]; }
        }
        if (phase === 'hold') {
          f = ease(Math.min(1, t / 300)); x = cx[N] + 10 * f; y = base - 14 * f;
          if (t >= HOLD) { phase = 'erase'; t = 0; }
        }
        if (phase === 'erase') {
          f = Math.min(1, t / ERASE); var g = ease(f);
          x = cx[N] + 10 - (cx[N] + 16 - cx[0]) * g; y = base - 4 - 10 * Math.max(0, 1 - f * 5);
          open = Math.min(1, f * 4);
          var k = 0; while (k < N && cx[k + 1] < x - 2) k++;
          tw.textContent = word.slice(0, k) || '​';
          if (f >= 1) { phase = 'reset'; t = 0; wi = (wi + 1) % list.length; setWord(list[wi]); }
        }
        if (phase === 'reset') {
          f = Math.min(1, t / RESET);
          x = cx[0] - 6 + 6 * ease(f); y = base - 4 - Math.sin(f * Math.PI) * 14; open = 1 - ease(f);
          tw.textContent = '​';
          if (f >= 1) { phase = 'write'; t = 0; }
        }
        if (visible) draw(x, y, open);
        requestAnimationFrame(frame);
      };
      if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(band);
      var start = function () {
        measure(); if (!on) return;
        // Wait for the header's first-visit heat intro to finish before the arm starts writing.
        requestAnimationFrame(frame);
      };
      var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(measure, 120); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
    }
  }

  /* ---------- Heat mesh: the cursor is a heat source ----------
     A jittered triangular mesh for a 2D heat-conduction look. Each node has a temperature; the cursor heats
     nearby nodes and every node cools a little each frame, so the trail fades out behind the cursor.
     Colors come from the --heat-0..3 tokens, so the scale always matches the current theme. */
  function heat(band, pre, glowSel, sigma, intro) {
  var cv = band && band.querySelector('canvas.heat');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, nodes = [], tris = [], nbrs = [], next = [], stops, lineRGB, cap;
  var px = -1e4, py = -1e4, inside = false, lastMove = 0, raf = 0, pulses = [], glowX = 0, glowY = 0;
  var SIGMA = sigma || 50, COOL = 0.972, ALPHA = 0.22, iso = true; // isotherms on header and footer

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
    glowX = gx; glowY = gy;
    nodes = []; tris = []; nbrs = [];
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
    // Mesh neighbors (shared triangle edges) for the conduction step.
    var sets = nodes.map(function () { return {}; });
    tris.forEach(function (t) { for (var e = 0; e < 3; e++) { var a = t[e], b = t[(e + 1) % 3]; sets[a][b] = 1; sets[b][a] = 1; } });
    nbrs = sets.map(function (o) { return Object.keys(o).map(Number); });
    next = new Float32Array(nodes.length);
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
    }    if (iso) isotherms();
  }
  // Isotherms: contour lines at 10, 20 and 30 °C (t = .25, .5, .75 on the 0–40 °C ΔT scale), by marching triangles.
  function isotherms() {
    var levels = [0.25, 0.5, 0.75];
    ctx.lineWidth = 1.1;
    for (var L = 0; L < levels.length; L++) {
      var lv = levels[L];
      ctx.strokeStyle = 'rgba(' + lineRGB + ',' + (0.28 + 0.18 * L).toFixed(2) + ')';
      ctx.beginPath();
      for (var i = 0; i < tris.length; i++) {
        var tr = tris[i], hit = 0, x0 = 0, y0 = 0;
        for (var e = 0; e < 3; e++) {
          var A = nodes[tr[e]], B = nodes[tr[(e + 1) % 3]], va = A.base + A.d, vb = B.base + B.d;
          if ((va - lv) * (vb - lv) < 0) {
            var f = (lv - va) / (vb - va), x = A.x + (B.x - A.x) * f, y = A.y + (B.y - A.y) * f;
            if (hit) { ctx.moveTo(x0, y0); ctx.lineTo(x, y); } else { x0 = x; y0 = y; hit = 1; }
          }
        }
      }
      ctx.stroke();
    }
  }

  function step(now) {
    var hot = 0, k = 1 / (2 * SIGMA * SIGMA);
    // Click bursts: a heat ring expands from the click point and fades.
    pulses = pulses.filter(function (P) {
      var age = (now - P.t0) / 1000;
      if (P.big) { // first-visit intro: one hot spot at the photo spreads across the whole header, then cools
        var g = Math.min(1, age / 2.1); P.r = P.R * (1 - Math.pow(1 - g, 2)); P.w = 34 + 40 * g;
        P.amp = age < 0.3 ? age / 0.3 : Math.max(0, 1 - Math.pow((age - 0.3) / 2.1, 2)); P.core = Math.max(0, 1 - age / 1.1);
        return age < 2.4;
      }
      var f = Math.min(1, age / 0.9); P.r = 0.31 * H * (1 - (1 - f) * (1 - f)); // ring incl. its glow stays within ~3/4 of the band height across
      P.amp = Math.max(0, 1 - Math.pow(age / 1.1, 3)); P.core = Math.max(0, 1 - age / 0.45); // ring stays strong while expanding, fades at the end
      return age < 1.1;
    });
    // Conduction: explicit step of dT/dt = alpha * laplacian(T) - h * T on the mesh graph.
    for (var i = 0; i < nodes.length; i++) {
      var nb = nbrs[i], sum = 0;
      for (var m = 0; m < nb.length; m++) sum += nodes[nb[m]].d;
      next[i] = (nodes[i].d + ALPHA * (sum / nb.length - nodes[i].d)) * COOL;
    }
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i], v = next[i];
      if (inside) {
        var dx = n.x - px, dy = n.y - py, g = Math.exp(-(dx * dx + dy * dy) * k);
        if (g > v) v = g;
      }
      for (var j = 0; j < pulses.length; j++) {
        var P = pulses[j], ex = (n.x - P.x) / (P.sx || 1), ey = n.y - P.y, dist = Math.sqrt(ex * ex + ey * ey);
        var pw = P.w || 22, ring = P.amp * Math.exp(-((dist - P.r) * (dist - P.r)) / (2 * pw * pw));
        var r2 = P.r * 0.55, ring2 = 0.6 * P.amp * Math.exp(-((dist - r2) * (dist - r2)) / (2 * 15 * 15));
        var core = P.core * Math.exp(-(dist * dist) / (2 * 38 * 38));
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
  // Intro on every visit, and again whenever the header scrolls back into view: one heat pulse from the photo sweeps the header.
  if (intro && !reduce) {
    var introTimers = [];
    var playIntro = function () {
      introTimers.forEach(clearTimeout); introTimers = [];
      inside = false; pulses = pulses.filter(function (P) { return !P.big; });
      var SX = 2.4; // wide ellipse: spreads farther sideways than up and down
      var R = Math.max(Math.hypot(glowX / SX, glowY), Math.hypot((W - glowX) / SX, glowY), Math.hypot(glowX / SX, H - glowY), Math.hypot((W - glowX) / SX, H - glowY));
      window.heatIntroPending = true; document.dispatchEvent(new Event('heatintrostart'));
      introTimers.push(setTimeout(function () { pulses.push({ x: glowX, y: glowY, t0: performance.now(), r: 0, amp: 0, core: 1, big: 1, R: R, sx: SX }); kick(); }, 250));
      introTimers.push(setTimeout(function () { window.heatIntroPending = false; document.dispatchEvent(new Event('heatintrodone')); }, 250 + 2400));
    };
    playIntro();
  }


  if (!reduce) {
    band.addEventListener('pointermove', function (e) {
      if (window.heatIntroPending && intro) return; // no cursor heat while the intro pulse plays
      var r = band.getBoundingClientRect();
      px = e.clientX - r.left; py = e.clientY - r.top;
      inside = true; lastMove = performance.now(); kick();
    });
    band.addEventListener('pointerleave', function () { inside = false; kick(); });
    band.addEventListener('pointerdown', function (e) {
      if (window.heatIntroPending && intro) return;
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
  // Features carousel arrows: scroll one card at a time.
  document.querySelectorAll('.news-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.closest('section').querySelector('.news-track'), card = t && t.querySelector('.news-card');
      if (!card) return;
      var dir = Number(b.dataset.dir), end = t.scrollWidth - t.clientWidth;
      // Loop: past the last feature goes back to the first, and before the first goes to the last.
      if (dir > 0 && t.scrollLeft >= end - 4) t.scrollTo({ left: 0, behavior: 'smooth' });
      else if (dir < 0 && t.scrollLeft <= 4) t.scrollTo({ left: end, behavior: 'smooth' });
      else t.scrollBy({ left: (card.getBoundingClientRect().width + 20) * dir, behavior: 'smooth' });
    });
  });

  // Sticky section bar: show after the hero, underline the current section, fill the ΔT progress bar.
  var bar = document.querySelector('.navbar');
  if (bar) {
    var hero = document.querySelector('.hero-band'), fill = bar.querySelector('.heat-progress .fill');
    var secs = Array.prototype.map.call(bar.querySelectorAll('.navbar-links a'), function (a) {
      return { a: a, el: document.getElementById(a.dataset.sec), tick: bar.querySelector('.heat-progress b[data-sec="' + a.dataset.sec + '"]') };
    }).filter(function (x) { return x.el; });
    var ticking = false;
    function maxScroll() { return Math.max(1, document.documentElement.scrollHeight - innerHeight); }
    function placeTicks() {
      secs.forEach(function (x) { x.top = x.el.getBoundingClientRect().top + scrollY - 80; x.tick.style.left = Math.min(99.5, x.top / maxScroll() * 100) + '%'; });
    }
    function update() {
      ticking = false;
      var y = scrollY, p = Math.min(1, y / maxScroll());
      bar.classList.toggle('show', y > hero.offsetHeight - 40);
      fill.style.width = (p * 100) + '%';
      var cur = null;
      secs.forEach(function (x) { if (y >= x.top - 4) cur = x; x.tick.classList.toggle('passed', y >= x.top - 4); });
      secs.forEach(function (x) { x.a.classList.toggle('active', x === cur); });
    }
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', function () { placeTicks(); update(); });
    addEventListener('load', function () { placeTicks(); update(); });
    placeTicks(); update();
    var menu = bar.querySelector('.nav-menu');
    menu.addEventListener('click', function () { var o = bar.classList.toggle('open'); menu.setAttribute('aria-expanded', o); });
    bar.querySelectorAll('.navbar-links a').forEach(function (a) { a.addEventListener('click', function () { bar.classList.remove('open'); menu.setAttribute('aria-expanded', false); }); });
  }

  // Back to top: let the click's heat burst show for a moment, then scroll up.
  document.querySelectorAll('.to-top').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(function () { window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' }); }, still ? 0 : 350);
    });
  });
  // "How it works" panel inside the header.
  var howBtn = document.querySelector('.hud-how'), how = document.getElementById('heat-how');
  if (howBtn && how) {
    var setHow = function (o) { how.hidden = !o; howBtn.setAttribute('aria-expanded', String(o)); };
    howBtn.addEventListener('click', function () { setHow(how.hidden); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !how.hidden) setHow(false); });
    [howBtn, how].forEach(function (el) { el.addEventListener('pointerdown', function (e) { e.stopPropagation(); }); });
  }
  heat(document.querySelector('.hero-band'), '--heat-', '.hero-photo', 0, true);
  heat(document.querySelector('.site-footer'), '--fheat-', '.to-top', 38); // footer cursor heat ~3/4 the header's size
})();
