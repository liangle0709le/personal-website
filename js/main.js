// ===== 移动端菜单 =====
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
});

// 点击导航链接后关闭移动端菜单
navLinks.querySelectorAll('a').forEach((a) => {
  a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// ===== 导航滚动阴影 =====
const nav = document.getElementById('nav');
const onScroll = () => {
  nav.classList.toggle('is-scrolled', window.scrollY > 8);
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ===== 滚动淡入 =====
const revealEls = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
revealEls.forEach((el) => revealObserver.observe(el));

// ===== 导航高亮当前区块 =====
const sections = ['about', 'education', 'projects', 'experience', 'honors', 'leadership', 'skills', 'contact']
  .map((id) => document.getElementById(id))
  .filter(Boolean);
const linkMap = {};
navLinks.querySelectorAll('a').forEach((a) => {
  const id = a.getAttribute('href').slice(1);
  linkMap[id] = a;
});
const navObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      Object.values(linkMap).forEach((l) => l.classList.remove('active'));
      const active = linkMap[entry.target.id];
      if (active) active.classList.add('active');
    }
  });
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach((s) => navObserver.observe(s));

// ===== 页脚年份 =====
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ============================================================
   动态特效（尊重系统「减少动态效果」设置）
   ============================================================ */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 1. Canvas 星空粒子（缓慢上升 + 连线） ----------
(function () {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, particles = [];

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(90, Math.round((w * h) / 16000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.4 + 0.4,
      vx: (Math.random() - 0.5) * 0.16,
      vy: -(Math.random() * 0.22 + 0.05),
      a: Math.random() * 0.5 + 0.25,
      hue: Math.random() > 0.5 ? '34, 211, 238' : '168, 85, 247'
    }));
  };

  const LINK_DIST = 110;
  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      if (!reduceMotion) {
        p.x += p.vx; p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        else if (p.x > w + 10) p.x = -10;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.hue}, ${p.a})`;
      ctx.fill();
    }
    // 近距离连线
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(34, 211, 238, ${(1 - dist / LINK_DIST) * 0.16})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
    if (!reduceMotion) requestAnimationFrame(draw);
  };

  resize();
  draw();
  window.addEventListener('resize', () => { resize(); if (reduceMotion) draw(); });
})();

// ---------- 2. 鼠标跟随光晕 ----------
(function () {
  const glow = document.getElementById('cursorGlow');
  if (!glow || window.matchMedia('(pointer: coarse)').matches) return;
  let tx = window.innerWidth / 2, ty = window.innerHeight / 2;
  let cx = tx, cy = ty;
  window.addEventListener('mousemove', (e) => {
    tx = e.clientX; ty = e.clientY;
    glow.style.opacity = '1';
  }, { passive: true });
  document.addEventListener('mouseleave', () => { glow.style.opacity = '0'; });
  const follow = () => {
    cx += (tx - cx) * 0.12;
    cy += (ty - cy) * 0.12;
    glow.style.transform = `translate(${cx}px, ${cy}px)`;
    requestAnimationFrame(follow);
  };
  if (!reduceMotion) follow();
})();

// ---------- 3. 打字机标语 ----------
(function () {
  const el = document.querySelector('.hero__tagline');
  if (!el || reduceMotion) return;
  const text = el.textContent.trim();
  el.textContent = '';
  el.classList.add('typing');
  let i = 0;
  const timer = setInterval(() => {
    el.textContent = text.slice(0, ++i);
    if (i >= text.length) clearInterval(timer);
  }, 75);
})();

// ---------- 4. 滚动进度条（并入已有 onScroll） ----------
const progressBar = document.getElementById('scrollProgress');
const toTop = document.getElementById('toTop');
const onScrollFx = () => {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (progressBar) {
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = pct + '%';
  }
  if (toTop) toTop.classList.toggle('show', scrollTop > 400);
};
window.addEventListener('scroll', onScrollFx, { passive: true });
onScrollFx();
if (toTop) toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

// ---------- 5. 卡片 3D 倾斜跟随鼠标 ----------
(function () {
  if (reduceMotion || window.matchMedia('(pointer: coarse)').matches) return;
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty('--rx', (-y * 7).toFixed(2) + 'deg');
      card.style.setProperty('--ry', (x * 7).toFixed(2) + 'deg');
    });
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
})();
