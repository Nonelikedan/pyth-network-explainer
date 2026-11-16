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
  const m = new THREE.MeshBasicMaterial({ color: 0x3a3a50, transparent: true });
  return [new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, 1.2), m), m];
};

// Perps vs spot: heights follow $122.1B : $1.95B exactly
const LIQ_H = 3.2;
const liqG = new THREE.Group();
liqG.position.y = BASE_Y;
grp.add(liqG);
const [perps, perpsM] = mkBar(0xbb66ff),
  [spot, spotM] = mkBar(0xc9c9d6); // light grey, so it stands out on the dark floor
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
const ZERO = { bell: 0, arc: 0, tower: 0, liq: 0, arr: 0, lift: 0 };

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
    lift: 1.2, // phones: raise the baseline above the card
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
    lift: 1.2,
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
let lastP = 0,
  onPulse = null; // sound hook: fires each time the bell chapter's pulse ring restarts
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
    yo + ph * cur.lift + (Math.random() - 0.5) * 0.16 * cur.shake * k,
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
  if (p < lastP && onPulse) onPulse(); // the ring just restarted
  lastP = p;
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
    sp[i * 3 + 1] = yo + s.y * (1 - p);
    sp[i * 3 + 2] = s.z * (1 - p);
  }
  stg.attributes.position.needsUpdate = true;
  renderer.render(scene, camera);
}
let xs = 1, // 1 on desktop; 0 on phones so objects sit centred
  yo = 0, // phones: lift the 3D scene up so it sits above the card
  ph = 0; // 1 on phones, 0 on desktop (switches the per-chapter "lift" on)
function resize() {
  const narrow = innerWidth <= 700;
  xs = narrow ? 0 : 1;
  yo = narrow ? 1.7 : 0;
  ph = narrow ? 1 : 0;
  grp.scale.setScalar(narrow ? 0.85 : 1); // slightly smaller so the whole scene fits above the card
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
    : "<b>●</b> Demo data. Drag the slider to see how the ring reacts";
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

/* ---------- 3b. Narration: one clip per chapter, played as you scroll ---------- */
// data-s of each chapter -> its file in /audio. The hero is silent; "contract" is the first spoken chapter.
const CLIPS = {
  contract: "contract.mp3",
  blind: "blind.mp3",
  pyth: "pyth.mp3",
  myth: "myth.mp3",
  chaos: "chaos.mp3",
  conf: "conf.mp3",
  bell: "bell.mp3",
  liq: "liq.mp3",
  arr: "arr.mp3",
  end: "end.mp3",
};
const FOLLOW = { end: "sources.mp3" }; // plays right after the recap clip

// ONE audio element, reused for every clip. Phones only unlock audio for an
// element the user has tapped, so a new Audio() per chapter would stay muted.
const voice = new Audio();
const narrBtn = $("#narrBtn"),
  narrAgain = $("#narrAgain");
let narrOn = false,
  narrChapter = "vault",
  narrT,
  token = 0,
  queue = [];

function playNext(my) {
  if (my !== token) return; // a newer request replaced this one
  const f = queue.shift();
  if (!f) return;
  voice.src = "audio/" + f;
  voice.volume = 1;
  voice.play().catch(() => {});
}
voice.addEventListener("ended", () => playNext(token)); // chains recap -> sources

function playChapter(name) {
  if (!CLIPS[name]) return; // no clip here: let the current one finish
  const my = ++token;
  queue = [CLIPS[name], FOLLOW[name]].filter(Boolean);
  gsap.killTweensOf(voice);
  if (voice.paused) return playNext(my);
  // fade the old clip out instead of cutting it mid-word
  gsap.to(voice, {
    volume: 0,
    duration: 0.3,
    onComplete: () => {
      voice.pause();
      playNext(my);
    },
  });
}
function stopVoice() {
  token++;
  clearTimeout(narrT);
  gsap.killTweensOf(voice);
  gsap.to(voice, { volume: 0, duration: 0.3, onComplete: () => voice.pause() });
}
function setNarr(on) {
  narrOn = on;
  narrBtn.setAttribute("aria-pressed", String(on));
  narrBtn.textContent = on ? "\u275A\u275A Sound on" : "\u25B6 Listen as you scroll";
  narrAgain.hidden = !on;
  if (!on) stopVoice();
}
narrBtn.addEventListener("click", () => {
  setNarr(!narrOn);
  if (narrOn) playChapter(narrChapter); // runs inside the tap, so phones allow it
});
narrAgain.addEventListener("click", () => playChapter(narrChapter));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) voice.pause();
  else if (narrOn && voice.src && !voice.ended && voice.currentTime > 0)
    voice.play().catch(() => {});
});

/* ---------- 3d. Sound design: synthesized live, timed to each chapter's animation ---------- */
// No audio files: every sound is built with the Web Audio API. The times inside each cue
// match the GSAP tweens in SEQ (delay + duration), so a rising tone peaks exactly when its bar lands.
let ac,
  duck,
  cueBus,
  noiseBuf,
  sfxOn = false,
  sfxWanted = true,
  sfxT;
const sfxBtn = $("#sfxBtn");

function audioCtx() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const master = ac.createGain();
    master.gain.value = 1.2; // effects sit under the narrator, which is ducked further while it speaks
    const comp = ac.createDynamicsCompressor(); // keeps layered sounds from clipping
    duck = ac.createGain(); // lowered while the voice is speaking
    duck.connect(master);
    master.connect(comp);
    comp.connect(ac.destination);
    // 2 seconds of white noise, reused for whooshes, ticks and rumbles
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === "suspended") ac.resume().catch(() => {});
  return ac;
}

// one pitched sound: a pitch glide (f -> to) and a volume envelope (attack, then decay)
function tone(f, t, dur, o = {}) {
  const { type = "sine", gain = 0.15, attack = 0.01, to = f } = o;
  t = Math.max(t, ac.currentTime + 0.005);
  const osc = ac.createOscillator(),
    g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  if (to !== f) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(attack, dur * 0.9));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(cueBus);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}
// filtered noise: whooshes (sweeping filter), clicks (short), rumbles (low filter)
function noise(t, dur, o = {}) {
  const { gain = 0.05, f0 = 800, f1 = 800, q = 1, attack = 0.02 } = o;
  t = Math.max(t, ac.currentTime + 0.005);
  const src = ac.createBufferSource(),
    bp = ac.createBiquadFilter(),
    g = ac.createGain();
  src.buffer = noiseBuf;
  src.loop = true;
  bp.type = "bandpass";
  bp.Q.value = q;
  bp.frequency.setValueAtTime(f0, t);
  bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(attack, dur * 0.9));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(cueBus);
  src.start(t);
  src.stop(t + dur + 0.05);
}
// a bell is several inharmonic partials with different decay times
function bellStrike(f, t, gain) {
  [
    [1, 1, 2.8],
    [2, 0.6, 2.2],
    [2.76, 0.5, 1.6],
    [5.4, 0.25, 1.1],
    [8.93, 0.12, 0.7],
  ].forEach(([r, a, d]) => tone(f * r, t, d, { gain: gain * a, attack: 0.004 }));
}
const chord = (fs, t, dur, gain) =>
  fs.forEach((f, i) =>
    tone(f, t + i * 0.04, dur, {
      gain,
      attack: dur * 0.35,
      type: i % 2 ? "triangle" : "sine",
    }),
  );
const tick = (t, f) => {
  noise(t, 0.05, { gain: 0.1, f0: f, f1: f, q: 6, attack: 0.002 });
  tone(f, t, 0.08, { gain: 0.04, attack: 0.002 });
};
// power1.inOut run backwards: given how far a tween has progressed (0-1), when was that (0-1)?
const inv1 = (p) => (p < 0.5 ? Math.sqrt(p / 2) : 1 - Math.sqrt((1 - p) / 2));

const CUES = {
  contract: (t) => {
    // a coin dropping into a vending machine
    tone(2093, t, 0.5, { gain: 0.1, type: "triangle", attack: 0.003 });
    tone(2637, t + 0.14, 0.6, { gain: 0.08, type: "triangle", attack: 0.003 });
    tone(130, t + 0.4, 0.3, { gain: 0.22, to: 55, attack: 0.005 }); // the clunk
  },
  blind: (t) => {
    // a hollow drone from two notes that don't quite agree
    tone(82.4, t, 3.2, { gain: 0.13, attack: 1.2 });
    tone(87.3, t, 3.2, { gain: 0.1, attack: 1.2 });
    noise(t, 3.2, { gain: 0.025, f0: 220, f1: 110, q: 0.7, attack: 1.2 });
  },
  pyth: (t) => {
    // data streaming in: a rising arpeggio over a shimmer
    [392, 494, 587, 740, 988].forEach((f, i) =>
      tone(f, t + 0.2 + i * 0.13, 0.9, {
        gain: 0.1,
        type: "triangle",
        attack: 0.005,
      }),
    );
    noise(t + 0.1, 1.4, { gain: 0.03, f0: 500, f1: 3500, q: 1.2, attack: 0.7 });
  },
  myth: (t) => {
    // three exchanges, three slightly different "prices": notes just out of tune
    [440, 446, 433].forEach((f, i) =>
      tone(f, t + 0.3 + i * 0.22, 1.6, { gain: 0.12, attack: 0.01 }),
    );
  },
  chaos: (t) => {
    // a heartbeat that speeds up as the exchanges drift apart
    let at = 0.1,
      gap = 0.55;
    for (let i = 0; i < 16; i++) {
      tone(72, t + at, 0.2, { gain: 0.22, to: 42, attack: 0.005 });
      noise(t + at, 0.1, {
        gain: 0.04,
        f0: 3000,
        f1: 800,
        q: 2,
        attack: 0.003,
      });
      at += gap;
      gap = Math.max(0.12, gap * 0.85);
    }
    // a rising hiss underneath = tension
    noise(t, at, { gain: 0.04, f0: 300, f1: 2500, q: 0.8, attack: at * 0.8 });
  },
  conf: (t) => {
    // the tension resolves as the ring springs into place
    tone(110, t, 1.4, { gain: 0.2, to: 220, attack: 0.9 });
    chord([220, 277.2, 329.6, 440], t + 0.3, 3, 0.06);
    bellStrike(880, t + 0.35, 0.06);
  },
  bell: (t) => {
    // riser -> strike when the tower peaks (1.8s) -> one tick per hour as the trail sweeps (1.4s to 4.4s)
    tone(180, t + 0.6, 1.2, {
      gain: 0.14,
      to: 900,
      type: "triangle",
      attack: 1.1,
    });
    noise(t + 0.6, 1.2, {
      gain: 0.06,
      f0: 400,
      f1: 4500,
      q: 0.8,
      attack: 1.1,
    });
    bellStrike(523.25, t + 1.8, 0.2);
    for (let h = 0; h <= 17; h++)
      tick(t + 1.4 + 3 * inv1(h / 17), 700 + h * 70);
  },
  liq: (t) => {
    // a low rumble builds as the tall bar grows... and spot is a tiny tick
    tone(55, t + 0.6, 1.7, { gain: 0.26, to: 110, attack: 1.4 });
    noise(t + 0.6, 1.7, { gain: 0.05, f0: 90, f1: 500, q: 0.8, attack: 1.4 });
    tick(t + 2.4, 3200);
  },
  arr: (t) => {
    // a riser, then one note as each bar lands (1.91s, 2.13s, 3.0s)
    tone(200, t + 0.6, 2.4, {
      gain: 0.1,
      to: 800,
      type: "triangle",
      attack: 2.2,
    });
    [
      [1.91, 261.63],
      [2.13, 329.63],
      [3.0, 392],
    ].forEach(([d, f]) => {
      tone(f, t + d, 1.6, { gain: 0.1, attack: 0.005, type: "triangle" });
      tone(f / 2, t + d, 0.4, { gain: 0.2, to: f / 4, attack: 0.004 }); // thud as it lands
    });
    bellStrike(784, t + 3.0, 0.08);
  },
  end: (t) => {
    // a warm chord to close
    chord([220, 277.2, 329.6, 415.3, 554.4], t + 0.2, 5, 0.055);
    noise(t, 2, { gain: 0.02, f0: 2000, f1: 6000, q: 0.9, attack: 1.4 });
  },
};

function fadeCue() {
  if (!cueBus) return;
  const old = cueBus;
  old.gain.setTargetAtTime(0, ac.currentTime, 0.08);
  setTimeout(() => old.disconnect(), 800);
  cueBus = null;
}
function cue(name) {
  const c = audioCtx();
  fadeCue(); // the previous chapter's sounds fade out
  if (!CUES[name]) return;
  cueBus = c.createGain();
  cueBus.connect(duck);
  // we waited ~100ms before starting, so shift the cue back to stay in step with the animation
  CUES[name](c.currentTime - 0.1);
}

// the bell chapter's ring pulses every ~2.9s: give each pulse a soft low thump
onPulse = () => {
  if (!sfxOn || narrChapter !== "bell" || !cueBus || cur.tower < 0.9) return;
  tone(98, ac.currentTime, 0.7, { gain: 0.1, to: 65, attack: 0.01 });
};

// turn the sound down while the narrator speaks
const setDuck = (on) => {
  if (ac) duck.gain.setTargetAtTime(on ? 0.45 : 1, ac.currentTime, 0.25);
};
voice.addEventListener("play", () => setDuck(true));
voice.addEventListener("pause", () => setDuck(false));
voice.addEventListener("ended", () => setDuck(false));

// buttons (these listeners run after the narration button's own, so narrOn is already updated)
function syncSfx() {
  sfxOn = narrOn && sfxWanted;
  sfxBtn.hidden = !narrOn;
  sfxBtn.setAttribute("aria-pressed", String(sfxWanted));
  if (sfxOn) cue(narrChapter);
  else if (ac) fadeCue();
}
narrBtn.addEventListener("click", syncSfx);
sfxBtn.addEventListener("click", () => {
  sfxWanted = !sfxWanted;
  syncSfx();
});
narrAgain.addEventListener("click", () => {
  if (sfxOn) cue(narrChapter);
});
document.addEventListener("visibilitychange", () => {
  if (!ac) return;
  if (document.hidden) ac.suspend();
  else if (sfxOn) ac.resume();
});

/* ---------- 3c. Chapter dots: click to jump to any chapter ---------- */
const rail = document.createElement("nav");
rail.id = "rail";
rail.setAttribute("aria-label", "Chapters");
const dots = {};
document.querySelectorAll(".step").forEach((s) => {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute("aria-label", s.dataset.n);
  b.dataset.label = s.dataset.n; // shown as a tooltip by the CSS
  b.addEventListener("click", () =>
    s.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" }),
  );
  rail.appendChild(b);
  dots[s.dataset.s] = b;
});
document.body.appendChild(rail);
function setDot(name) {
  for (const k in dots) {
    dots[k].classList.toggle("on", k === name);
    if (k === name) dots[k].setAttribute("aria-current", "step");
    else dots[k].removeAttribute("aria-current");
  }
}
setDot("vault");

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
  narrChapter = s.dataset.s;
  setDot(s.dataset.s);
  if (sfxOn) {
    clearTimeout(sfxT);
    sfxT = setTimeout(() => cue(narrChapter), 100); // short wait so fast scrolling doesn't machine-gun sounds
  }
  if (narrOn) {
    // wait a moment so fast scrolling past a chapter doesn't start its clip
    clearTimeout(narrT);
    narrT = setTimeout(() => playChapter(narrChapter), 350);
  }
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