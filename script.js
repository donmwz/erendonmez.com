/* ============================================
   Eren Dönmez — Portfolio Scripts
   ============================================ */

// ---------- Theme Toggle ----------
(function() {
  const toggle = document.getElementById('themeToggle');
  const html = document.documentElement;

  const saved = localStorage.getItem('theme');
  if (saved) {
    html.setAttribute('data-theme', saved);
  } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    html.setAttribute('data-theme', 'light');
  }

  toggle.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
})();

// ---------- Mobile Nav ----------
(function() {
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open);
  });

  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
})();

// ---------- Minimal constellation canvas ----------
(function() {
  const canvas = document.getElementById('fieldCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let hero, w, h, dots = [];
  const spacing = 55;
  const connectDist = 110;
  let mouse = { x: -9999, y: -9999 };
  let isDark = true;

  function getAccentColor() {
    const theme = document.documentElement.getAttribute('data-theme');
    isDark = theme !== 'light';
    return isDark ? '56, 189, 248' : '2, 132, 199';
  }

  function resize() {
    hero = canvas.parentElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = hero.offsetWidth;
    h = hero.offsetHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    dots = [];
    for (let y = spacing / 2; y < h; y += spacing) {
      for (let x = spacing / 2; x < w; x += spacing) {
        dots.push({
          x, y,
          ox: x, oy: y,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25
        });
      }
    }
  }

  function draw() {
    const accent = getAccentColor();
    ctx.clearRect(0, 0, w, h);

    if (!reduceMotion) {
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > w) d.vx *= -1;
        if (d.y < 0 || d.y > h) d.vy *= -1;

        const mdx = d.x - mouse.x;
        const mdy = d.y - mouse.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 130 && mdist > 0) {
          const force = (130 - mdist) / 130;
          d.x += (mdx / mdist) * force * 2;
          d.y += (mdy / mdist) * force * 2;
        }

        const pull = 0.02;
        d.x += (d.ox - d.x) * pull;
        d.y += (d.oy - d.y) * pull;
      }
    }

    for (let i = 0; i < dots.length; i++) {
      const a = dots[i];
      for (let j = i + 1; j < dots.length; j++) {
        const b = dots[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < connectDist) {
          const alpha = (1 - dist / connectDist) * (isDark ? 0.18 : 0.12);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${accent}, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    for (const d of dots) {
      const mdx = d.x - mouse.x;
      const mdy = d.y - mouse.y;
      const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
      const near = Math.max(0, 1 - mdist / 140);
      const r = 1.2 + near * 1.6;
      const alpha = (isDark ? 0.35 : 0.28) + near * 0.45;
      ctx.beginPath();
      ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${accent}, ${alpha})`;
      ctx.fill();
    }

    if (!reduceMotion) requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => {
    resize();
    if (reduceMotion) draw();
  });

  hero = canvas.parentElement;
  hero.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  hero.addEventListener('mouseleave', () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  const observer = new MutationObserver(() => {
    if (reduceMotion) draw();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  resize();
  draw();
})();

// ---------- Scroll Reveal ----------
(function() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();
