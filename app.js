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
const cur = { ...S.vault };
let stress = 0.1,
  last = "vault";
function setState(name) {
  last = name;
  const t = { ...S[name] },
    sh = t.shield;
  delete t.shield;
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
    cur.x + (Math.random() - 0.5) * 0.16 * cur.shake * k,
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
  stM.opacity = cur.stream;
  for (let i = 0; i < N; i++) {
    const s = seed[i],
      p = (t * 0.22 + s.t) % 1;
    sp[i * 3] = s.x + (cur.x - s.x) * p;
    sp[i * 3 + 1] = s.y * (1 - p);
    sp[i * 3 + 2] = s.z * (1 - p);
  }
  stg.attributes.position.needsUpdate = true;
  renderer.render(scene, camera);
}
function resize() {
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
