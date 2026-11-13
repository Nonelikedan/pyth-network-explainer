gsap.registerPlugin(ScrollTrigger);
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s) => document.querySelector(s);
const fmt = (n) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* ---------- 1. Three.js scene: one set of objects that morphs per chapter ---------- */
const renderer = new THREE.WebGLRenderer({
  canvas: $("#gl"),
  alpha: true,
  antialias: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
camera.position.z = 7;
const grp = new THREE.Group();
scene.add(grp);
const mat = (o) => new THREE.MeshBasicMaterial({ transparent: true, ...o });
const cubeM = mat({ wireframe: true }),
  coreM = mat({ wireframe: true }),
  shM = mat({ color: 0xbb66ff });
const cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), cubeM);
const core = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), coreM);
const shield = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.04, 16, 100), shM);
grp.add(cube, core, shield);
const nodes = [0, 1, 2].map(() => {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 12),
    mat({ color: 0xffffff }),
  );
  grp.add(m);
  return m;
});

const star = new Float32Array(900);
for (let i = 0; i < 900; i++)
  star[i] = (Math.random() - 0.5) * (i % 3 === 2 ? 20 : 40);
const sg = new THREE.BufferGeometry();
sg.setAttribute("position", new THREE.BufferAttribute(star, 3));
const stars = new THREE.Points(
  sg,
  new THREE.PointsMaterial({ size: 0.04, color: 0x8888aa }),
);
scene.add(stars);

const N = 160,
  sp = new Float32Array(N * 3),
  seed = Array.from({ length: N }, () => ({
    t: Math.random(),
    x: -10 + Math.random() * 2,
    y: (Math.random() - 0.5) * 6,
    z: (Math.random() - 0.5) * 3,
  }));
const stg = new THREE.BufferGeometry();
stg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
const stM = new THREE.PointsMaterial({
  size: 0.09,
  color: 0xbb66ff,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
scene.add(new THREE.Points(stg, stM));

/* ---------- After the Bell: a 24h dial ---------- */
const DIAL_R = 1.8,
  U = 0.036; // U = world height of "1x" (the usual hour)
// 20:00 UTC sits at 12 o'clock; hours run clockwise
const ang = (h) => Math.PI / 2 - ((h - 20) / 24) * Math.PI * 2;
const at = (h, r) => [Math.cos(ang(h)) * r, Math.sin(ang(h)) * r];

const dial = new THREE.Group();
grp.add(dial); // child of grp, so it moves with the chapter's x position

// 24 hour ticks (no data, just the clock face)
const tickM = new THREE.MeshBasicMaterial({
  color: 0x8888aa,
  transparent: true,
});
for (let h = 0; h < 24; h++) {
  const tk = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, h === 20 ? 0.34 : 0.16, 0.03),
    tickM,
  );
  tk.position.set(...at(h, DIAL_R));
  tk.rotation.z = ang(h) - Math.PI / 2; // point the long side outward
  dial.add(tk);
}

// SpaceX: tall bar = 56x, short bar = 1x (the usual 20:00 UTC hour)
const towerM = new THREE.MeshBasicMaterial({
  color: 0xffcc00,
  transparent: true,
});
const stubM = new THREE.MeshBasicMaterial({
  color: 0x8888aa,
  transparent: true,
});
const barGeo = new THREE.BoxGeometry(0.16, 1, 0.16).translate(0, 0.5, 0); // base sits at y = 0
const tower = new THREE.Mesh(barGeo, towerM);
const stub = new THREE.Mesh(barGeo, stubM);
tower.position.set(0, DIAL_R, 0);
stub.position.set(-0.3, Math.sqrt(DIAL_R ** 2 - 0.09), 0);
dial.add(tower, stub);

// Brazil: beads along the 20:00 Sun -> 13:00 Mon window (17 hours)
const M = 120;
const arcPos = new Float32Array(M * 3);
for (let i = 0; i < M; i++)
  arcPos.set([...at(20 + (17 * i) / (M - 1), DIAL_R - 0.28), 0], i * 3);
const arcG = new THREE.BufferGeometry();
arcG.setAttribute("position", new THREE.BufferAttribute(arcPos, 3));
const arcM = new THREE.PointsMaterial({
  size: 0.09,
  color: 0xbb66ff,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
dial.add(new THREE.Points(arcG, arcM));
const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 12, 12),
  new THREE.MeshBasicMaterial({ color: 0xffffff }),
); // bright bead at the front of the trail
dial.add(head);

// the "bell ringing" pulse
const pulseM = new THREE.MeshBasicMaterial({
  color: 0xffcc00,
  transparent: true,
  side: THREE.DoubleSide,
});
const pulse = new THREE.Mesh(
  new THREE.RingGeometry(DIAL_R - 0.015, DIAL_R + 0.015, 96),
  pulseM,
);
dial.add(pulse);

/* ---------- Where the Liquidity Lives + The Business of Data: honest bar charts ---------- */
const BASE_Y = -1.6; // the baseline both bar charts stand on
const mkBar = (color) => {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true });
  // base sits at y = 0, so scale.y grows the bar upward from the baseline
  const geo = new THREE.BoxGeometry(0.8, 1, 0.8).translate(0, 0.5, 0);
  return [new THREE.Mesh(geo, m), m];
};
const mkFloor = (w) => {
  const m = new THREE.MeshBasicMaterial({ color: 0x8888aa, transparent: true });
  return [new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, 1.2), m), m];
};

// Perps vs spot: heights follow $122.1B : $1.95B exactly
const LIQ_H = 3.2;
const liqG = new THREE.Group();
liqG.position.y = BASE_Y;
grp.add(liqG);
const [perps, perpsM] = mkBar(0xbb66ff),
  [spot, spotM] = mkBar(0x8888aa);
perps.position.x = -0.7;
spot.position.x = 0.7;
const [liqFloor, liqFloorM] = mkFloor(2.8);
liqG.add(perps, spot, liqFloor);

// ARR: Aug / Sep / Oct in $M, drawn from zero so growth isn't exaggerated
const ARR = [10.39, 11.49, 13.67],
  ARR_U = 3 / 13.67;
const arrG = new THREE.Group();
arrG.position.y = BASE_Y;
grp.add(arrG);
const arrBars = [],
  arrMs = [];
[0x7a4aa8, 0x9a58d6, 0xbb66ff].forEach((c, i) => {
  const [b, m] = mkBar(c);
  b.position.x = (i - 1) * 1.1;
  arrG.add(b);
  arrBars.push(b);
  arrMs.push(m);
});
const [arrFloor, arrFloorM] = mkFloor(3.8);
arrG.add(arrFloor);
liqG.visible = arrG.visible = false;

// Defaults for every chapter-specific key, so older chapters hide these objects automatically
const ZERO = { bell: 0, arc: 0, tower: 0, liq: 0, arr: 0 };

// Each chapter is just a set of target numbers. GSAP tweens "cur" toward them.
const S = {
  vault: {
    x: 2.4,
    cube: 1,
    core: 0,
    shield: 0,
    stream: 0,
    ex: 0,
    spread: 0,
    shake: 0,
    r: 0.45,
    g: 0.45,
    b: 0.6,
  },
  contract: {
    x: -2.4,
    cube: 1.15,
    core: 0,
    shield: 0,
    stream: 0,
    ex: 0,
    spread: 0,
    shake: 0,
    r: 0.4,
    g: 0.7,
    b: 1,
  },
  blind: {
    x: 2.4,
    cube: 0.9,
    core: 0,
    shield: 0,
    stream: 0,
    ex: 0,
    spread: 0,
    shake: 0,
    r: 0.3,
    g: 0.3,
    b: 0.4,
  },
  pyth: {
    x: -2.4,
    cube: 1,
    core: 0,
    shield: 0,
    stream: 1,
    ex: 0,
    spread: 0,
    shake: 0,
    r: 0.73,
    g: 0.4,
    b: 1,
  },
  myth: {
    x: 2.4,
    cube: 0,
    core: 1,
    shield: 0,
    stream: 0,
    ex: 1,
    spread: 0.15,
    shake: 0,
    r: 1,
    g: 0.8,
    b: 0,
  },
  chaos: {
    x: -2.4,
    cube: 0,
    core: 1,
    shield: 0,
    stream: 0,
    ex: 1,
    spread: 1,
    shake: 1,
    r: 1,
    g: 0.3,
    b: 0.3,
  },
  conf: {
    x: 2.4,
    cube: 0,
    core: 1,
    shield: 1,
    stream: 0,
    ex: 1,
    spread: 0.15,
    shake: 0,
    r: 0.73,
    g: 0.4,
    b: 1,
  },
  bell: {
    x: -2.4,
    cube: 0,
    core: 0.45,
    shield: 0,
    stream: 0,
    ex: 0,
    spread: 0,
    shake: 0,
    r: 0.73,
    g: 0.4,
    b: 1,
    bell: 1,
    arc: 1,
    tower: 1,
  },
  liq: {
    x: 2.4,
    cube: 0,
    core: 0,
    shield: 0,
    stream: 0,
    ex: 0,
    spread: 0,
    shake: 0,
    r: 0.73,
    g: 0.4,
    b: 1,
    liq: 1,
  },
  arr: {
    x: -2.4,
    cube: 0,
    core: 0,
    shield: 0,
    stream: 0,
    ex: 0,
    spread: 0,
    shake: 0,
    r: 0.73,
    g: 0.4,
    b: 1,
    arr: 1,
  },
  end: {
    x: 0,
    cube: 0,
    core: 1.2,
    shield: 1,
    stream: 0,
    ex: 0,
    spread: 0,
    shake: 0,
    r: 0.73,
    g: 0.4,
    b: 1,
  },
};
const cur = { ...ZERO, ...S.vault };
let stress = 0.1,
  last = "vault";
// Keys that rise AFTER the main move, with their own delay/duration.
// All use non-overshooting eases so a bar can never show more than its true value.
const SEQ = {
  tower: { delay: 0.6, dur: 1.2, ease: "power3.out" }, // the bell rings first...
  arc: { delay: 1.4, dur: 3, ease: "power1.inOut" }, // ...then the night sweeps round
  liq: { delay: 0.6, dur: 1.6, ease: "power3.out" },
  arr: { delay: 0.6, dur: 2.4, ease: "power2.inOut" },
};
function setState(name) {
  last = name;
  const t = { ...ZERO, ...S[name] }; // missing keys fall back to 0
  const sh = t.shield;
  delete t.shield;
  const seq = {};
  for (const k in SEQ) {
    seq[k] = t[k];
    delete t[k];
  }

  gsap.to(cur, {
    ...t,
    duration: 1.3,
    ease: "power3.inOut",
    overwrite: "auto",
  });
  // the shield pops out with a springy ease, like the confidence ring snapping into place
  gsap.to(cur, {
    shield: sh,
    duration: sh > cur.shield ? 1.6 : 0.6,
    ease: sh > cur.shield ? "elastic.out(1,0.5)" : "power2.out",
    overwrite: "auto",
  });
  for (const k in SEQ) {
    const up = seq[k] > cur[k];
    gsap.to(cur, {
      [k]: seq[k],
      duration: up ? SEQ[k].dur : 0.4,
      delay: up ? SEQ[k].delay : 0,
      ease: up ? SEQ[k].ease : "power2.out",
      overwrite: "auto",
    });
  }
}
const off = [0.4, 2.2, 1.3];
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const t = clock.getElapsedTime();
  const k = RM ? 0 : 1;
  cube.rotation.x = t * 0.2 * k;
  cube.rotation.y = t * 0.25 * k;
  core.rotation.y = t * 0.3 * k;
  shield.rotation.x = t * 0.6 * k;
  shield.rotation.y = t * 0.5 * k;
  stars.rotation.y = t * 0.01 * k;
  grp.position.set(
    cur.x * xs + (Math.random() - 0.5) * 0.16 * cur.shake * k,
    (Math.random() - 0.5) * 0.16 * cur.shake * k,
    0,
  );
  cube.scale.setScalar(Math.max(cur.cube, 1e-4));
  cubeM.opacity = Math.min(cur.cube, 1);
  cubeM.color.setRGB(cur.r, cur.g, cur.b);
  core.scale.setScalar(Math.max(cur.core, 1e-4));
  coreM.opacity = Math.min(cur.core, 1);
  coreM.color.setRGB(cur.r, cur.g, cur.b);
  shield.scale.setScalar(Math.max(cur.shield * (1.2 + stress * 1.3), 1e-4));
  shM.opacity = Math.min(cur.shield, 1) * 0.85;
  nodes.forEach((n, i) => {
    const a = t * 0.8 + i * 2.09,
      r = 1.7 + cur.spread * off[i];
    n.position.set(
      Math.cos(a) * r,
      Math.sin(a) * r * 0.6,
      Math.sin(a * 0.5) * 0.8,
    );
    n.scale.setScalar(Math.max(cur.ex, 1e-4));
  });
  // --- After the Bell ---
  dial.visible = cur.bell > 0.01;
  dial.scale.setScalar(Math.max(cur.bell, 1e-4));
  tickM.opacity = 0.8 * cur.bell;
  tower.scale.y = Math.max(cur.tower * 56 * U, 1e-4); // 56x the usual hour
  stub.scale.y = Math.max(cur.tower * U, 1e-4); // 1x
  towerM.opacity = stubM.opacity = Math.min(cur.tower, 1);
  const shown = Math.floor(cur.arc * (M - 1));
  arcG.setDrawRange(0, cur.arc > 0.001 ? shown + 1 : 0); // reveal beads in order
  arcM.opacity = cur.bell;
  head.visible = cur.arc > 0.01;
  head.position.set(arcPos[shown * 3], arcPos[shown * 3 + 1], 0);
  const p = (t * 0.35) % 1; // 0 -> 1 every ~3s
  pulse.scale.setScalar(1 + p * 1.1);
  pulseM.opacity = (1 - p) * 0.45 * Math.min(cur.tower, 1);
  // --- Where the Liquidity Lives: perps vs spot, true 122.1 : 1.95 ratio ---
  liqG.visible = cur.liq > 0.01;
  liqG.rotation.y = Math.sin(t * 0.4) * 0.35 * k;
  perps.scale.y = Math.max(cur.liq * LIQ_H, 1e-4);
  spot.scale.y = Math.max(cur.liq * LIQ_H * (1.95 / 122.1), 1e-4);
  perpsM.opacity = spotM.opacity = 0.9 * Math.min(cur.liq, 1);
  liqFloorM.opacity = 0.6 * Math.min(cur.liq, 1);
  // --- The Business of Data: ARR bars, starting from zero ---
  arrG.visible = cur.arr > 0.01;
  arrG.rotation.y = Math.sin(t * 0.4) * 0.35 * k;
  ARR.forEach((v, i) => {
    const g = Math.min(Math.max(cur.arr * 1.6 - i * 0.3, 0), 1); // bars rise one after another
    arrBars[i].scale.y = Math.max(g * v * ARR_U, 1e-4);
    arrMs[i].opacity = 0.9 * Math.min(cur.arr, 1);
  });
  arrFloorM.opacity = 0.6 * Math.min(cur.arr, 1);
  stM.opacity = cur.stream;
  for (let i = 0; i < N; i++) {
    const s = seed[i],
      p = (t * 0.22 + s.t) % 1;
    sp[i * 3] = s.x + (cur.x * xs - s.x) * p;
    sp[i * 3 + 1] = s.y * (1 - p);
    sp[i * 3 + 2] = s.z * (1 - p);
  }
  stg.attributes.position.needsUpdate = true;
  renderer.render(scene, camera);
}
let xs = 1; // 1 on desktop; 0 on phones so objects sit centred behind the card
function resize() {
  const narrow = innerWidth <= 700;
  xs = narrow ? 0 : 1;
  camera.position.z = narrow ? 8.5 : 7; // pull back a little so the dial and bars fit a portrait screen
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
frame();
if (!RM) {
  const qx = gsap.quickTo(camera.position, "x", { duration: 1 }),
    qy = gsap.quickTo(camera.position, "y", { duration: 1 });
  addEventListener("pointermove", (e) => {
    qx((e.clientX / innerWidth - 0.5) * 0.8);
    qy(-(e.clientY / innerHeight - 0.5) * 0.5);
  });
}

/* ---------- 2. Data: live from Pyth if reachable, otherwise simulated ---------- */
const ETH =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
let base = 3000,
  conf = 1.05,
  live = false,
  tkReady = false;
async function pull() {
  try {
    const c = new AbortController();
    setTimeout(() => c.abort(), 2500);
    // Our own Vercel function (api/price.js) calls Hermes with the secret key
    const r = await fetch("/api/price", {
      cache: "no-store",
      signal: c.signal,
    });
    if (!r.ok) throw new Error("price endpoint " + r.status);
    const d = await r.json();
    base = d.price;
    conf = d.conf;
    live = true;
    stress = Math.min(Math.max(((conf / base) * 1e4 - 1) / 12, 0), 1);
  } catch (e) {
    live = false;
    base += (Math.random() - 0.5) * 3;
    stress = $("#st").value / 100;
    conf = base * 0.00035 * (1 + stress * 9);
  }
  render();
}
const disp = { p: 0, c: 0 };
function render() {
  $("#sw").style.display = live ? "none" : "block";
  $("#tag").innerHTML = live
    ? "<b>●</b> Live from Pyth"
    : "<b>●</b> Simulated data (live feed unreachable here)";
  anime.remove(disp);
  anime({
    targets: disp,
    p: base,
    c: conf,
    duration: 900,
    easing: "linear",
    update: () => {
      $("#px").textContent = fmt(disp.p);
      $("#ci").textContent = "± $" + fmt(disp.c);
      $("#rg").textContent =
        `Safe range: $${fmt(disp.p - disp.c)} to $${fmt(disp.p + disp.c)}`;
      if (tkReady) $("#tk").textContent = "ETH/USD $" + fmt(disp.p);
    },
  });
  gsap.to("#band", { width: 12 + stress * 80 + "%", duration: 0.8 });
  document.querySelectorAll(".board").forEach(updBoard);
}
$("#st").addEventListener("input", () => {
  stress = $("#st").value / 100;
  conf = base * 0.00035 * (1 + stress * 9);
  render();
});

/* Exchange boards: same three venues, small spread vs. wide spread */
const names = ["Binance", "Coinbase", "Bybit"],
  off2 = [-1.4, 0.9, 0.3];
[
  ["#b1", 1],
  ["#b2", 14],
].forEach(([id, m]) => {
  const el = $(id);
  el.classList.add("board");
  el.dataset.m = m;
  el.innerHTML = names
    .map((n) => `<div class="row"><span>${n}</span><b>$---.--</b></div>`)
    .join("");
  el._v = [0, 0, 0];
});
function updBoard(el) {
  const m = +el.dataset.m,
    rows = el.querySelectorAll("b");
  off2.forEach((o, i) => {
    const v = { x: el._v[i] || base },
      to = base + o * m * (1 + Math.random() * 0.6);
    anime({
      targets: v,
      x: to,
      duration: 700,
      easing: "easeOutQuad",
      update: () => {
        rows[i].textContent = "$" + fmt(v.x);
        el._v[i] = v.x;
      },
    });
  });
}
pull();
setInterval(pull, 2000);

/* ---------- 3. Scroll storytelling ---------- */
document.querySelectorAll(".step").forEach((s) => {
  ScrollTrigger.create({
    trigger: s,
    start: "top 55%",
    end: "bottom 45%",
    onToggle: (self) => s.classList.toggle("on", self.isActive),
    onEnter: () => go(s),
    onEnterBack: () => go(s),
  });
});
function go(s) {
  setState(s.dataset.s);
  $("#chapt").textContent = s.dataset.n;
  if (s.dataset.s === "pyth" && !tkReady) {
    const o = { v: 0 };
    anime({
      targets: o,
      v: base,
      duration: 2200,
      easing: "easeOutExpo",
      update: () => {
        $("#tk").textContent = "ETH/USD $" + fmt(o.v);
      },
      complete: () => {
        tkReady = true;
      },
    });
  }
}
gsap.to("#bar", {
  scaleX: 1,
  ease: "none",
  scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
});
$("#again").addEventListener("click", () =>
  scrollTo({ top: 0, behavior: RM ? "auto" : "smooth" }),
);

/* Hero title: split into words, then one anime.js reveal on load */
const h1 = $("#h1");
h1.innerHTML = h1.textContent
  .split(" ")
  .map((w) => `<span class="w"><span class="wi">${w}</span></span>`)
  .join(" ");
if (!RM)
  anime({
    targets: ".wi",
    translateY: ["110%", 0],
    delay: anime.stagger(90),
    duration: 1000,
    easing: "easeOutExpo",
  });
document.querySelector(".step").classList.add("on");
