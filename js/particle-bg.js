/* ============================================================
   首屏背景 · GLSL 粒子星球（替换原 Canvas 星空）
   ------------------------------------------------------------
   · 单次 draw call 的 GPU 粒子云（斐波那契球壳 ↔ 三臂螺旋）
   · 鼠标排斥：着色器内距离场，不占 CPU
   · Three.js 本地优先，CDN 仅兜底；全部失败则静默跳过
   · 离开首屏淡出并暂停渲染；切到后台暂停；尊重「减少动态」
   · 按屏幕宽度自适应粒子数与相机距离（窄屏球体完整可见）
   ============================================================ */
(function () {
  'use strict';

  const canvas = document.getElementById('particleBg');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let booted = false;
  let THREE = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let points = null;
  let uniforms = null;
  let clock = null;
  let visible = true;      // 首屏是否在可见范围
  let running = false;
  let rafId = 0;

  const whenIdle = (fn) => {
    if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 2000 });
    else setTimeout(fn, 900);
  };

  whenIdle(boot);

  async function boot() {
    if (booted) return;
    booted = true;

    const SOURCES = [
      './vendor/three.module.min.js',
      'https://unpkg.com/three@0.160.0/build/three.module.js',
      'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'
    ];

    for (const url of SOURCES) {
      try {
        THREE = await import(url);
        break;
      } catch (e) {
        THREE = null;
      }
    }
    if (!THREE) return;

    try {
      create();
    } catch (e) {
      // WebGL 不可用等：静默跳过，页面照常
      return;
    }

    canvas.classList.add('is-ready');
    if (!reduceMotion) start();
    else renderOnce();
  }

  /* ---------- 根据屏幕挑选规模 ---------- */
  function quality() {
    const w = window.innerWidth;
    if (w < 700) return { count: 12000, size: 30 };
    if (w < 1100) return { count: 16000, size: 29 };
    return { count: 24000, size: 30 };
  }

  /* ---------- 布局：球体尺寸跟随「首屏」而不是整个视口 ---------- */
  const R = 4.15;                       // 球半径（世界单位）
  const TAN_HALF_FOV = Math.tan((48 * Math.PI) / 360);
  let camZ = 12;
  let heroCenterDoc = 0;                // 首屏中心在文档中的纵向位置
  let ballShiftY = null;                // 球体相对画面中心的纵向偏移（世界单位）

  function layout() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const aspect = vw / Math.max(vh, 1);

    // 球体目标屏幕直径：不超过首屏高度的 94%，也不超过 720px
    const hero = document.getElementById('hero');
    const heroH = hero ? hero.offsetHeight : vh;
    const heroTop = hero ? hero.getBoundingClientRect().top + window.scrollY : 0;
    heroCenterDoc = heroTop + heroH / 2;

    const frac = Math.min((heroH * 0.94) / vh, 720 / vh, 0.84);
    // 纵向：让球体正好落在首屏高度内
    const byHeight = R / Math.max(frac * TAN_HALF_FOV, 0.001);
    // 横向：窄屏时球体不得超出画面宽度（留 7% 边距）
    const byWidth = R / (0.86 * TAN_HALF_FOV * Math.max(aspect, 0.3));

    camZ = Math.max(byHeight, byWidth);
    camera.aspect = aspect;
    camera.position.z = camZ;
    camera.updateProjectionMatrix();

    // 点尺寸随相机距离等比放大：远近不同屏幕上的颗粒大小保持一致
    if (uniforms) uniforms.uSize.value = quality().size * (camZ / 12);
  }

  /* 让球心始终对齐首屏中心（滚动时也不会跑位） */
  function updateBallY(immediate) {
    if (!points) return;
    const vh = window.innerHeight;
    const heroCenterViewport = heroCenterDoc - window.scrollY;
    const dyPx = vh / 2 - heroCenterViewport;          // 首屏中心比视口中心高多少
    const worldPerPx = (2 * camZ * TAN_HALF_FOV) / vh;
    const target = dyPx * worldPerPx;

    if (ballShiftY === null || immediate) {
      ballShiftY = target;
      points.position.y = target;
      return;
    }
    ballShiftY += (target - ballShiftY) * 0.15;
    points.position.y = ballShiftY;
  }

  function create() {
    const q = quality();

    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 12);
    layout();

    const COUNT = q.count;
    const GOLDEN = Math.PI * (1 + Math.sqrt(5));

    const posA = new Float32Array(COUNT * 3);
    const posB = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;

      // 形状 A：斐波那契球壳（均匀分布，不会两极堆积）
      const phi = Math.acos(1 - (2 * (i + 0.5)) / COUNT);
      const theta = GOLDEN * i;
      const rA = R * (0.9 + Math.random() * 0.1);
      posA[i3] = rA * Math.sin(phi) * Math.cos(theta);
      posA[i3 + 1] = rA * Math.cos(phi);
      posA[i3 + 2] = rA * Math.sin(phi) * Math.sin(theta);

      // 形状 B：三臂螺旋星系（xy 平面，正对相机才看得到旋臂）
      const t = i / COUNT;
      const arm = Math.floor(Math.random() * 3) * ((Math.PI * 2) / 3);
      const radius = 1.0 + Math.pow(t, 0.62) * 3.45;
      const angle = arm + radius * 0.95 + (Math.random() - 0.5) * 0.55;
      posB[i3] = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.4;
      posB[i3 + 1] = Math.sin(angle) * radius + (Math.random() - 0.5) * 0.4;
      posB[i3 + 2] = (Math.random() - 0.5) * (0.16 + radius * 0.13);

      seeds[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posA, 3));
    geo.setAttribute('aPosB', new THREE.BufferAttribute(posB, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const vertexShader = /* glsl */`
      uniform float uTime;
      uniform float uMorph;
      uniform vec2 uMouse;
      uniform float uMouseActive;
      uniform float uSize;
      uniform float uPixelRatio;

      attribute vec3 aPosB;
      attribute float aSeed;

      varying float vMix;
      varying float vFade;

      void main() {
        vec3 pA = position;
        vec3 pB = aPosB;

        // 变形带错峰：每个粒子按自身种子先后到位，像流动着聚拢
        float t = clamp(uMorph * 1.35 - aSeed * 0.35, 0.0, 1.0);
        t = t * t * (3.0 - 2.0 * t);
        vec3 pos = mix(pA, pB, t);

        // 有机漂浮：整体像在呼吸
        float n = sin(pos.x * 0.7 + uTime * 0.6)
                * cos(pos.y * 0.8 + uTime * 0.5)
                * sin(pos.z * 0.6 + uTime * 0.4);
        pos += normalize(pos + 0.0001) * n * 0.12;
        pos *= 1.0 + sin(uTime * 0.9) * 0.012;

        // 鼠标排斥（屏幕左侧的指针会把粒子推开）
        vec2 d = pos.xy - uMouse;
        float dist = length(d);
        float force = smoothstep(2.4, 0.0, dist) * uMouseActive;
        pos.xy += normalize(d + 0.0001) * force * 1.35;
        pos.z += force * 0.55;

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPixelRatio * (1.0 / max(-mv.z, 0.1));

        vMix = aSeed;
        vFade = (1.0 - smoothstep(0.0, 16.0, length(pos))) * (0.72 + t * 0.28);
      }
    `;

    const fragmentShader = /* glsl */`
      precision mediump float;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uOpacity;

      varying float vMix;
      varying float vFade;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float a = smoothstep(0.5, 0.02, d);
        if (a <= 0.001) discard;
        vec3 c = mix(uColorA, uColorB, vMix);
        gl_FragColor = vec4(c, a * vFade * uOpacity);
      }
    `;

    uniforms = {
      uTime: { value: 0 },
      uMorph: { value: 0 },
      uMouse: { value: new THREE.Vector2(999, 999) },
      uMouseActive: { value: 0 },
      uSize: { value: q.size * (camZ / 12) },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uOpacity: { value: 0.68 },
      uColorA: { value: new THREE.Color(0x22d3ee) },
      uColorB: { value: new THREE.Color(0xa855f7) }
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    points = new THREE.Points(geo, material);
    scene.add(points);

    clock = new THREE.Clock();

    bindEvents();
    onScroll();
    updateBallY(true);
  }

  /* ---------- 鼠标 / 触摸 → 世界坐标 ---------- */
  const ndc = { x: 0, y: 0 };
  let mouseOn = false;
  let mouseActive = 0;
  let mouseActiveTarget = 0;

  function bindEvents() {
    const planeZ = 0;
    const tmp = { x: 0, y: 0, z: 0 };

    function updateMouse(x, y) {
      ndc.x = (x / window.innerWidth) * 2 - 1;
      ndc.y = -(y / window.innerHeight) * 2 + 1;

      // 反投影到 z = planeZ 平面
      const dir = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(camera).sub(camera.position).normalize();
      const dist = (planeZ - camera.position.z) / dir.z;
      tmp.x = camera.position.x + dir.x * dist;
      tmp.y = camera.position.y + dir.y * dist;
      // 球体整体有纵向偏移，鼠标坐标要换算回球体局部空间才对得上
      uniforms.uMouse.value.set(tmp.x, tmp.y - (ballShiftY || 0));
      mouseActiveTarget = 1;
      mouseOn = true;
    }

    window.addEventListener('mousemove', (e) => updateMouse(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches[0]) updateMouse(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    document.addEventListener('mouseleave', () => { mouseActiveTarget = 0; mouseOn = false; });

    // 滚过首屏：淡出 + 停渲染
    window.addEventListener('scroll', onScroll, { passive: true });

    // 切到后台暂停
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else if (!reduceMotion && visible) start();
    });

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        layout();
        updateBallY(true);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.setSize(window.innerWidth, window.innerHeight);
        uniforms.uPixelRatio.value = renderer.getPixelRatio();
        if (reduceMotion) renderOnce();
      }, 160);
    });
  }

  function onScroll() {
    const hideAt = window.innerHeight * 0.55;
    const nextVisible = window.scrollY < hideAt;
    if (nextVisible === visible) return;
    visible = nextVisible;
    canvas.classList.toggle('is-off', !visible);
    if (reduceMotion) return;
    if (visible) start();
    else stop();
  }

  /* ---------- 形状自动 morph ---------- */
  let morphTarget = 0;
  setInterval(() => {
    morphTarget = morphTarget >= 0.5 ? 0 : 1;
  }, 9000);

  /* ---------- 渲染循环 ---------- */
  let elapsed = 0;

  function start() {
    if (running || !renderer) return;
    running = true;
    if (clock) clock.getDelta(); // 丢弃暂停期间的时间，恢复时不跳帧
    loop();
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  function loop() {
    if (!running) return;
    rafId = requestAnimationFrame(loop);

    // 累计时间（单帧上限 50ms，避免切回页面时动画突跳）
    elapsed += Math.min(clock.getDelta(), 0.05);
    const t = elapsed;
    uniforms.uTime.value = t;
    uniforms.uMorph.value += (morphTarget - uniforms.uMorph.value) * 0.022;

    mouseActive += (mouseActiveTarget - mouseActive) * 0.08;
    uniforms.uMouseActive.value = mouseActive;
    if (!mouseOn) {
      uniforms.uMouse.value.x += (999 - uniforms.uMouse.value.x) * 0.05;
      uniforms.uMouse.value.y += (999 - uniforms.uMouse.value.y) * 0.05;
    }

    points.rotation.z = t * 0.045;
    points.rotation.y = Math.sin(t * 0.18) * 0.16;
    points.rotation.x = Math.sin(t * 0.12) * 0.08;

    // 相机视差（幅度很小，只做呼吸感）
    camera.position.x += (ndc.x * 0.32 - camera.position.x) * 0.03;
    camera.position.y += (ndc.y * 0.22 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);

    // 球心跟随首屏中心
    updateBallY(false);

    renderer.render(scene, camera);
  }

  function renderOnce() {
    if (!renderer) return;
    uniforms.uTime.value = 0.9;
    uniforms.uMorph.value = 0;
    renderer.render(scene, camera);
  }
})();
