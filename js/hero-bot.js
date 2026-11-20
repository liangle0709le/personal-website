/* ============================================================
   Hero 3D 角色 · 光标跟随的机械小助手
   ------------------------------------------------------------
   · Three.js 懒加载（首屏空闲后才下载，不阻塞首屏）
   · 尊重 prefers-reduced-motion（只渲染静态一帧）
   · 仅在 hero 可见时渲染，离开视口自动暂停
   · 小屏 / WebGL 不可用 / 网络失败 → 静默跳过，不影响页面
   ============================================================ */
(function () {
  'use strict';

  const canvas = document.getElementById('heroBot');
  if (!canvas) return;

  // 小屏不加载，省流量也避免遮挡
  if (window.matchMedia('(max-width: 900px)').matches) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let booted = false;

  const whenIdle = (fn) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(fn, { timeout: 2500 });
    } else {
      setTimeout(fn, 1200);
    }
  };

  whenIdle(boot);

  async function boot() {
    if (booted) return;
    booted = true;

    // 优先本地文件（离线可用、国内网络稳定），失败再回退 CDN
    const SOURCES = [
      './vendor/three.module.min.js',
      'https://unpkg.com/three@0.160.0/build/three.module.js',
      'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'
    ];

    let THREE = null;
    for (const url of SOURCES) {
      try {
        THREE = await import(url);
        break;
      } catch (e) {
        THREE = null;
      }
    }
    if (!THREE) return; // 全部失败：静默跳过

    try {
      create(THREE);
    } catch (e) {
      // WebGL 不可用等：静默跳过
    }
  }

  function create(THREE) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    camera.position.set(0, 0.45, 6.6);
    camera.lookAt(0, 0.1, 0);

    /* ---------- 灯光（青 + 紫，呼应站点配色） ---------- */
    scene.add(new THREE.AmbientLight(0x5a6fa8, 0.95));

    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(3, 5, 4);
    scene.add(key);

    const rimCyan = new THREE.PointLight(0x22d3ee, 24, 13);
    rimCyan.position.set(-3.2, 1.4, -2);
    scene.add(rimCyan);

    const rimPurple = new THREE.PointLight(0xa855f7, 18, 13);
    rimPurple.position.set(3.4, 0.6, -1.6);
    scene.add(rimPurple);

    const fill = new THREE.PointLight(0x22d3ee, 7, 8);
    fill.position.set(1, -1.4, 3);
    scene.add(fill);

    /* ---------- 角色 ---------- */
    const character = new THREE.Group();
    scene.add(character);

    const headGroup = new THREE.Group();
    headGroup.position.y = 0.45;
    character.add(headGroup);

    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0xc9d4f0,
      roughness: 0.42,
      metalness: 0.18,
      clearcoat: 0.7,
      clearcoatRoughness: 0.3,
      sheen: 0.6,
      sheenColor: new THREE.Color(0x22d3ee)
    });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.92, 48, 36), shellMat);
    head.scale.set(1.05, 1.0, 0.96);
    headGroup.add(head);

    // 深色面罩（正对镜头）
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.925, 48, 36, Math.PI / 2 - 0.85, 1.7, 1.0, 0.95),
      new THREE.MeshPhysicalMaterial({
        color: 0x070b16,
        roughness: 0.14,
        metalness: 0.9,
        clearcoat: 1,
        clearcoatRoughness: 0.06
      })
    );
    visor.scale.set(1.05, 1.01, 0.985);
    headGroup.add(visor);

    // 发光眼睛
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x35e6ff });
    const eyes = [];
    [-1, 1].forEach((s) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 16), eyeMat);
      eye.scale.set(1, 1.15, 0.55);
      eye.position.set(0.24 * s, 0.12, 0.885);
      headGroup.add(eye);
      eyes.push(eye);
    });

    // 侧耳胶囊 + 光环
    const podMat = new THREE.MeshPhysicalMaterial({
      color: 0x9aa8d6,
      roughness: 0.35,
      metalness: 0.55,
      clearcoat: 0.8
    });
    [-1, 1].forEach((s) => {
      const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.18, 4, 14), podMat);
      pod.position.set(0.92 * s, 0.12, 0);
      pod.rotation.z = (Math.PI / 2) * s * 0.85;
      headGroup.add(pod);

      const earRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.17, 0.02, 10, 28),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.7 })
      );
      earRing.position.set(0.98 * s, 0.12, 0);
      earRing.rotation.y = Math.PI / 2;
      headGroup.add(earRing);
    });

    // 天线
    const antRod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.4, 8), podMat);
    antRod.position.set(0, 1.02, 0);
    headGroup.add(antRod);

    const antTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.058, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xa855f7 })
    );
    antTip.position.set(0, 1.25, 0);
    headGroup.add(antTip);

    // 身体 + 核心
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.58, 40, 30), shellMat);
    body.scale.set(1, 0.86, 0.9);
    body.position.y = -0.72;
    character.add(body);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 24, 20),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );
    core.position.set(0, -0.66, 0.51);
    character.add(core);

    // 地面能量环
    const ringA = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.011, 6, 80),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.5 })
    );
    ringA.rotation.x = Math.PI / 2;
    ringA.position.y = -1.4;
    scene.add(ringA);

    const ringB = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.007, 6, 64),
      new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.35 })
    );
    ringB.rotation.x = Math.PI / 2;
    ringB.position.y = -1.39;
    scene.add(ringB);

    /* ---------- 指针跟随 ---------- */
    const pointer = new THREE.Vector2(0, 0);
    const smooth = new THREE.Vector2(0, 0);
    let curYaw = 0;
    let curPitch = 0;

    const setPointer = (x, y) => {
      pointer.x = (x / window.innerWidth) * 2 - 1;
      pointer.y = -(y / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', (e) => setPointer(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches[0]) setPointer(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    /* ---------- 尺寸自适应 ---------- */
    function resize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    /* ---------- 渲染循环 ---------- */
    const MAX_YAW = THREE.MathUtils.degToRad(32);
    const MAX_PITCH = THREE.MathUtils.degToRad(18);
    const clock = new THREE.Clock();
    let running = false;
    let rafId = null;

    function renderFrame() {
      const t = clock.getElapsedTime();

      if (!reduceMotion) {
        smooth.x += (pointer.x - smooth.x) * 0.05;
        smooth.y += (pointer.y - smooth.y) * 0.05;
      }

      curYaw += (smooth.x * MAX_YAW - curYaw) * 0.085;
      curPitch += (smooth.y * MAX_PITCH - curPitch) * 0.085;

      headGroup.rotation.y = curYaw;
      headGroup.rotation.x = -curPitch;
      character.rotation.y = curYaw * 0.26;
      character.rotation.x = -curPitch * 0.16;

      eyes.forEach((eye, i) => {
        const baseX = 0.24 * (i === 0 ? -1 : 1);
        eye.position.x = baseX + smooth.x * 0.03;
        eye.position.y = 0.12 + smooth.y * 0.026;
      });

      if (reduceMotion) {
        ringA.rotation.z = 0.4;
        ringB.rotation.z = 1.1;
      } else {
        character.position.y = Math.sin(t * 1.15) * 0.05;
        headGroup.position.y = 0.45 + Math.sin(t * 1.15 + 0.5) * 0.028;
        core.scale.setScalar(0.92 + Math.sin(t * 2.2) * 0.12);
        antTip.material.color.setHSL(0.75 + Math.sin(t * 0.7) * 0.05, 0.95, 0.68);
        ringA.rotation.z += 0.0024;
        ringB.rotation.z -= 0.0034;
      }

      renderer.render(scene, camera);
    }

    function tick() {
      if (!running) return;
      rafId = requestAnimationFrame(tick);
      renderFrame();
    }

    // 首帧立即显示
    renderFrame();
    canvas.classList.add('is-ready');

    if (reduceMotion) return; // 静态即可，不循环

    // 仅在 hero 可见时渲染
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (!running) {
            running = true;
            tick();
          }
        } else {
          running = false;
          if (rafId) cancelAnimationFrame(rafId);
        }
      });
    }, { threshold: 0 });
    io.observe(canvas);

    // 切到后台时暂停
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
      } else if (canvas.getBoundingClientRect().bottom > 0) {
        if (!running) {
          running = true;
          tick();
        }
      }
    });
  }
})();
