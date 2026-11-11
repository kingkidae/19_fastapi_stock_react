import * as THREE from 'three';

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const ease = (t) => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3;

// 히어로 뒤 3D 무대: 전체 기간 종가를 빛나는 선으로, 거래량을 바닥 막대로 그린다.
export function mountStage(canvas, data) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(new THREE.Color(cssVar('--bg')), 13, 22);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

  const n = data.length;
  const closes = data.map((d) => d.Close);
  const lo = Math.min(...closes), hi = Math.max(...closes);
  const W = 18, H = 3.2, FLOOR = -1.6;
  const px = (i) => (i / (n - 1) - 0.5) * W;
  const py = (v) => ((v - lo) / (hi - lo)) * H - 0.1;
  const last = data[n - 1];
  const nowColor = new THREE.Color(cssVar(last.Change >= 0 ? '--up' : '--down'));

  const trash = [];
  const keep = (o) => (trash.push(o), o);
  const world = new THREE.Group();
  world.rotation.y = -0.55; // 최근 구간(오른쪽)이 앞으로 나오게
  scene.add(world);

  // 가격 선: 가는 심지 + 넓은 가산 혼합 광채
  const curve = new THREE.CatmullRomCurve3(data.map((d, i) => new THREE.Vector3(px(i), py(d.Close), 0)), false, 'centripetal');
  const SEG = n * 3;
  const tube = (r, radial, mat) => new THREE.Mesh(keep(new THREE.TubeGeometry(curve, SEG, r, radial)), keep(mat));
  const core = tube(0.016, 6, new THREE.MeshBasicMaterial({ color: cssVar('--ink') }));
  const glow = tube(0.06, 8, new THREE.MeshBasicMaterial({
    color: cssVar('--down'), transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false,
  }));

  // 선 아래 커튼: 위는 옅은 파랑, 바닥으로 갈수록 투명
  const pos = [], col = [], idx = [];
  const tint = new THREE.Color(cssVar('--down'));
  data.forEach((d, i) => {
    pos.push(px(i), py(d.Close), 0, px(i), FLOOR, 0);
    col.push(tint.r, tint.g, tint.b, 0.14, tint.r, tint.g, tint.b, 0);
    if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  });
  const curtainGeo = keep(new THREE.BufferGeometry());
  curtainGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  curtainGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  curtainGeo.setIndex(idx);
  const curtain = new THREE.Mesh(curtainGeo, keep(new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  })));

  // 거래량 막대: 바닥에서 자라난다
  const maxVol = Math.max(...data.map((d) => d.Volume));
  const bars = new THREE.InstancedMesh(
    keep(new THREE.BoxGeometry((W / n) * 0.55, 1, 0.05)),
    keep(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false })),
    n,
  );
  const up = new THREE.Color(cssVar('--up')), down = new THREE.Color(cssVar('--down'));
  const m = new THREE.Matrix4();
  data.forEach((d, i) => {
    const h = (d.Volume / maxVol) * 0.9 + 0.01;
    m.makeScale(1, h, 1).setPosition(px(i), h / 2, -0.35);
    bars.setMatrixAt(i, m);
    bars.setColorAt(i, d.Close >= d.Open ? up : down);
  });
  const barGroup = new THREE.Group();
  barGroup.position.y = FLOOR;
  barGroup.add(bars);

  // 바닥 점 격자
  const grid = [];
  for (let gx = 0; gx <= 72; gx++) for (let gz = 0; gz <= 16; gz++) grid.push((gx / 72 - 0.5) * W * 1.3, FLOOR, -7 + gz * 0.6);
  const gridGeo = keep(new THREE.BufferGeometry());
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
  const dots = new THREE.Points(gridGeo, keep(new THREE.PointsMaterial({ color: cssVar('--muted'), size: 0.03, transparent: true, opacity: 0.45 })));

  // 오늘 표시: 점 + 퍼져 나가는 고리
  const nowPos = new THREE.Vector3(px(n - 1), py(last.Close), 0);
  const marker = new THREE.Mesh(keep(new THREE.SphereGeometry(0.075, 24, 16)), keep(new THREE.MeshBasicMaterial({ color: nowColor })));
  const ringMat = keep(new THREE.MeshBasicMaterial({ color: nowColor, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const ring = new THREE.Mesh(keep(new THREE.RingGeometry(0.11, 0.135, 48)), ringMat);
  marker.position.copy(nowPos);
  ring.position.copy(nowPos);

  world.add(dots, barGroup, curtain, glow, core, marker, ring);

  const coreTotal = core.geometry.index.count, glowTotal = glow.geometry.index.count, curtainTotal = idx.length;
  const target = new THREE.Vector3();
  let mx = 0, my = 0, cx = 0, cy = 0, raf = 0, running = false, onScreen = true;
  const start = performance.now();

  function frame(now) {
    const t = reduce ? 99 : (now - start) / 1000;
    const p = ease(t / 2.6);
    // index 수를 삼각형 단위(3의 배수)로 맞춰 선이 왼쪽부터 그려지게
    core.geometry.setDrawRange(0, Math.floor((coreTotal * p) / 3) * 3);
    glow.geometry.setDrawRange(0, Math.floor((glowTotal * p) / 3) * 3);
    curtainGeo.setDrawRange(0, Math.floor((curtainTotal * p) / 6) * 6);
    barGroup.scale.y = Math.max(ease((t - 0.4) / 1.8), 0.001);
    marker.visible = ring.visible = p > 0.995;
    const pulse = (t % 2.2) / 2.2;
    ring.scale.setScalar(1 + pulse * 3);
    ringMat.opacity = reduce ? 0.6 : (1 - pulse) * 0.8;
    ring.lookAt(camera.position);

    cx += (mx - cx) * 0.04;
    cy += (my - cy) * 0.04;
    const narrow = camera.aspect < 1;
    camera.position.set((narrow ? 5 : 3) + Math.sin(t * 0.07) * 0.5 + cx * 0.7, 4.6 - cy * 0.4, narrow ? 14 : 16);
    target.set(narrow ? 6.6 : 2.1, -1.1, 0);
    bars.material.opacity = narrow ? 0.12 : 0.3; // 좁은 화면에선 막대가 글자 뒤로 지나가므로 옅게
    camera.lookAt(target);
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }

  const play = () => {
    const should = !reduce && onScreen && !document.hidden;
    if (should && !running) { running = true; raf = requestAnimationFrame(frame); }
    if (!should && running) { running = false; cancelAnimationFrame(raf); }
  };
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!running) frame(performance.now());
  };
  const onPointer = (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; };

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; play(); });
  io.observe(canvas);
  document.addEventListener('visibilitychange', play);
  addEventListener('pointermove', onPointer, { passive: true });
  resize();
  play();

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', play);
    removeEventListener('pointermove', onPointer);
    trash.forEach((o) => o.dispose());
    bars.dispose();
    renderer.dispose();
  };
}
