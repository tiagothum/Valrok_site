/**
 * Vitrine cinematográfica das classes (home e página de Classes).
 *
 * Interações:
 *  - mover o mouse: câmera em parallax 3D (camadas em profundidades diferentes) + luz que segue o cursor;
 *  - clicar na cena: avança (clique no terço esquerdo volta), com flash anamórfico, letterbox,
 *    onda de choque e explosão de partículas a partir do ponto clicado;
 *  - linha das classes: clique numa classe; a barra avança sozinha (autoplay) e pausa com o mouse em cima;
 *  - teclado (setas), botões laterais e arrastar no celular.
 * Respeita prefers-reduced-motion (sem 3D, partículas ou autoplay).
 *
 * Os dados de cada cena vêm do HTML (data-saga-scene).
 */

const AUTOPLAY_MS = 8000;
const TRANSITION_LOCK_MS = 1000;
const ENTER_CLEANUP_MS = 2000;

/* Paleta de partículas por classe (casa com .class--<accent>). */
const PALETTES = {
  ember:   { hues: [24, 46],  sat: 92, light: 60, rise: -0.7, sway: 0.25, size: [0.8, 2.4], count: 80, glow: 4, alpha: 0.9 },
  shadow:  { hues: [258, 290], sat: 45, light: 58, rise: -0.18, sway: 0.5, size: [6, 16],  count: 34, glow: 2.2, alpha: 0.12 },
  verdant: { hues: [92, 138], sat: 62, light: 56, rise: -0.28, sway: 1.1, size: [1.4, 3.4], count: 64, glow: 3, alpha: 0.85, leaf: true },
  arcane:  { hues: [184, 198], sat: 72, light: 72, rise: -0.4, sway: 0.35, size: [0.8, 2.2], count: 78, glow: 4.5, alpha: 0.95, alt: [272, 0.18] },
};

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ------------------------------------------------------------------ Partículas */
class SagaFX {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.parts = [];
    this.rings = [];
    this.pal = PALETTES.arcane;
    this.mx = 0; this.my = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
  }
  resize() {
    const r = this.c.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.c.width = Math.round(this.w * this.dpr); this.c.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  setPalette(accent) { this.pal = PALETTES[accent] || PALETTES.arcane; }
  hue(p) {
    if (p.alt && Math.random() < p.alt[1]) return p.alt[0] + rand(-8, 8);
    return rand(p.hues[0], p.hues[1]);
  }
  spawn(initial = false) {
    const p = this.pal;
    return {
      pal: p, x: rand(0, this.w), y: initial ? rand(0, this.h) : this.h + 20,
      z: rand(0.3, 1), r: rand(p.size[0], p.size[1]), hue: this.hue(p),
      vx: rand(-0.2, 0.2), vy: p.rise * rand(0.5, 1.4), ph: rand(0, Math.PI * 2),
      life: 0, max: rand(260, 620), spin: rand(-0.04, 0.04), rot: rand(0, Math.PI),
    };
  }
  burst(x, y, accent) {
    const p = PALETTES[accent] || this.pal;
    for (let i = 0; i < 70; i++) {
      const a = rand(0, Math.PI * 2), s = rand(2, 10);
      this.parts.push({
        pal: p, burst: true, x, y, z: rand(0.6, 1.2), r: rand(p.size[0], p.size[1]) * (p.leaf ? 1.2 : 1),
        hue: this.hue(p), vx: Math.cos(a) * s, vy: Math.sin(a) * s, ph: 0, life: 0, max: rand(50, 95), spin: rand(-0.2, 0.2), rot: 0,
      });
    }
    this.rings.push({ x, y, r: 6, life: 0, max: 46, w: 3 }, { x, y, r: 2, life: -8, max: 54, w: 1.5 });
  }
  frame() {
    const { ctx, pal } = this;
    const target = pal.count;
    let ambient = 0;
    for (const p of this.parts) if (!p.burst) ambient++;
    for (let i = ambient; i < target; i++) this.parts.push(this.spawn(this.parts.length < target / 2));

    ctx.clearRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = "lighter";
    const next = [];
    for (const p of this.parts) {
      p.life += 1; p.ph += 0.02; p.rot += p.spin;
      if (p.burst) { p.vx *= 0.94; p.vy = p.vy * 0.94 + 0.03; }
      p.x += p.vx + Math.sin(p.ph) * p.pal.sway * 0.4;
      p.y += p.vy;
      const t = p.life / p.max;
      if (t >= 1 || p.y < -30) continue;
      const a = Math.sin(Math.min(t, 1) * Math.PI) * p.pal.alpha;
      const px = p.x + this.mx * 34 * p.z, py = p.y + this.my * 18 * p.z;
      const r = p.r * p.z;
      if (p.pal.leaf) {
        ctx.save(); ctx.translate(px, py); ctx.rotate(p.rot);
        ctx.fillStyle = `hsla(${p.hue},${p.pal.sat}%,${p.pal.light}%,${a})`;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 2.2, r, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        const g = ctx.createRadialGradient(px, py, 0, px, py, r * p.pal.glow);
        g.addColorStop(0, `hsla(${p.hue},${p.pal.sat}%,${p.pal.light}%,${a})`);
        g.addColorStop(1, `hsla(${p.hue},${p.pal.sat}%,${p.pal.light}%,0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px, py, r * p.pal.glow, 0, Math.PI * 2); ctx.fill();
      }
      next.push(p);
    }
    this.parts = next;

    // Ondas de choque (anel rúnico)
    const rings = [];
    for (const r of this.rings) {
      r.life += 1;
      if (r.life < 0) { rings.push(r); continue; }
      const t = r.life / r.max;
      if (t >= 1) continue;
      r.r += 14 * (1 - t) + 2;
      ctx.strokeStyle = `rgba(156,237,255,${(1 - t) * 0.7})`;
      ctx.lineWidth = r.w * (1 - t) + 0.5;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
      rings.push(r);
    }
    this.rings = rings;
    ctx.globalCompositeOperation = "source-over";
  }
}

/* ------------------------------------------------------------------ Saga */
export function initSaga() {
  const root = document.querySelector("[data-saga]");
  if (!root) return;
  const stage = root.querySelector("[data-saga-stage]");
  const scenes = [...root.querySelectorAll("[data-saga-scene]")];
  const nodes = [...root.querySelectorAll("[data-saga-go]")];
  const fill = root.querySelector("[data-saga-fill]");
  const flash = root.querySelector("[data-saga-flash]");
  const live = root.querySelector("[data-saga-live]");
  const timeline = root.querySelector(".saga__timeline");
  const n = scenes.length;
  if (!n) return;
  timeline.style.setProperty("--n", String(n));

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const accentOf = (el) => (el.className.match(/class--(\w+)/) || [])[1] || "arcane";

  // Título letra a letra (texto seguro via textContent)
  root.querySelectorAll("[data-saga-split]").forEach((el) => {
    const text = el.textContent.trim();
    el.textContent = "";
    el.setAttribute("aria-label", text);
    [...text].forEach((ch, i) => {
      const s = document.createElement("span");
      s.className = "ch";
      s.setAttribute("aria-hidden", "true");
      s.textContent = ch === " " ? " " : ch;
      s.style.setProperty("--i", String(i));
      el.append(s);
    });
  });

  let idx = 0, busy = false, autoT = 0, paused = false, visible = false, lastTs = 0;
  const cleanups = new Map();
  const fx = reduce ? null : new SagaFX(root.querySelector("[data-saga-fx]"));
  fx && fx.setPalette(accentOf(scenes[0]));

  const setFill = () => {
    const p = n > 1 ? clamp((idx + (idx < n - 1 ? autoT : 0)) / (n - 1), 0, 1) : 1;
    fill.style.width = `${p * 100}%`;
  };

  const flashAt = (xPct, yPct) => {
    stage.style.setProperty("--fx", `${xPct}%`);
    stage.style.setProperty("--fy", `${yPct}%`);
    flash.classList.remove("is-on");
    void flash.offsetWidth;
    flash.classList.add("is-on");
  };

  function go(next, dir, origin) {
    next = (next + n) % n;
    if (busy || next === idx) return;
    busy = true;
    dir = dir || (next > idx ? 1 : -1);
    const from = scenes[idx], to = scenes[next];
    const accent = accentOf(to);

    [from, to].forEach((s) => s.style.setProperty("--dir", String(dir)));
    clearTimeout(cleanups.get(to));
    clearTimeout(cleanups.get(from));
    from.classList.remove("is-active", "is-entering");
    from.classList.add("is-leaving");
    from.setAttribute("aria-hidden", "true");
    to.classList.remove("is-leaving");
    to.classList.add("is-active", "is-entering");
    to.setAttribute("aria-hidden", "false");

    const rect = stage.getBoundingClientRect();
    const ox = origin ? origin.x : rect.width / 2, oy = origin ? origin.y : rect.height * 0.55;
    if (!reduce) {
      stage.classList.add("is-transitioning");
      flashAt((ox / rect.width) * 100, (oy / rect.height) * 100);
      fx.burst(ox, oy, accent);
      fx.setPalette(accent);
    }

    nodes.forEach((b, i) => b.setAttribute("aria-pressed", String(i === next)));
    live.textContent = `Classe ${next + 1} de ${n}: ${to.querySelector("[data-saga-split]").getAttribute("aria-label")}`;
    idx = next; autoT = 0; setFill();

    setTimeout(() => {
      from.classList.remove("is-leaving");
      stage.classList.remove("is-transitioning");
      busy = false;
    }, reduce ? 50 : TRANSITION_LOCK_MS);
    cleanups.set(to, setTimeout(() => to.classList.remove("is-entering"), reduce ? 50 : ENTER_CLEANUP_MS));
  }

  // ---- Mouse: parallax + luz
  let tx = 0, ty = 0, cx = 0, cy = 0;
  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    stage.style.setProperty("--sx", `${e.clientX - r.left}px`);
    stage.style.setProperty("--sy", `${e.clientY - r.top}px`);
  });
  const hold = () => { paused = true; };
  const release = () => { paused = false; tx = 0; ty = 0; };
  stage.addEventListener("pointerenter", hold);
  stage.addEventListener("pointerleave", release);
  timeline.addEventListener("pointerenter", hold);
  timeline.addEventListener("pointerleave", () => { paused = false; });
  root.addEventListener("focusin", hold);
  root.addEventListener("focusout", () => { paused = false; });

  // ---- Clique / toque na cena
  let downX = null, swiped = false;
  stage.addEventListener("pointerdown", (e) => { downX = e.clientX; swiped = false; });
  stage.addEventListener("pointerup", (e) => {
    if (downX !== null && Math.abs(e.clientX - downX) > 60) {
      swiped = true;
      stage.classList.add("is-touched");
      go(idx + (e.clientX < downX ? 1 : -1), e.clientX < downX ? 1 : -1);
    }
    downX = null;
  });
  stage.addEventListener("click", (e) => {
    if (swiped || e.target.closest("a, button")) return;
    stage.classList.add("is-touched");
    const r = stage.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const back = x < r.width * 0.3;
    go(idx + (back ? -1 : 1), back ? -1 : 1, { x, y });
  });
  root.querySelector("[data-saga-prev]").addEventListener("click", () => go(idx - 1, -1));
  root.querySelector("[data-saga-next]").addEventListener("click", () => go(idx + 1, 1));
  nodes.forEach((b, i) => {
    b.addEventListener("click", () => go(i));
    // "Imã" no losango da linha do tempo
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      b.style.setProperty("--tx", `${((e.clientX - r.left) / r.width - 0.5) * 10}px`);
      b.style.setProperty("--ty", `${((e.clientY - r.top) / r.height - 0.5) * 8}px`);
    });
    b.addEventListener("pointerleave", () => { b.style.setProperty("--tx", "0px"); b.style.setProperty("--ty", "0px"); });
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(idx + 1, 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(idx - 1, -1); }
  });

  // ---- Laço de animação (só quando visível)
  const loop = (ts) => {
    if (!visible) return;
    const dt = lastTs ? Math.min(ts - lastTs, 64) : 16;
    lastTs = ts;
    if (!reduce) {
      cx += (tx - cx) * 0.07; cy += (ty - cy) * 0.07;
      stage.style.setProperty("--mx", cx.toFixed(4));
      stage.style.setProperty("--my", cy.toFixed(4));
      fx.mx = cx; fx.my = cy;
      fx.frame();
      if (!paused && !busy && n > 1) {
        autoT += dt / AUTOPLAY_MS;
        if (autoT >= 1) go(idx + 1, 1); else setFill();
      }
    }
    requestAnimationFrame(loop);
  };
  let revealed = false;
  new IntersectionObserver(([entry]) => {
    const was = visible;
    visible = entry.isIntersecting;
    if (visible && !revealed) {
      // Primeira vez que a seção aparece: a cena atual entra de forma cinematográfica.
      revealed = true;
      const s = scenes[idx];
      s.classList.add("is-entering");
      if (!reduce) { flashAt(55, 55); fx.burst(stage.clientWidth * 0.62, stage.clientHeight * 0.6, accentOf(s)); }
      cleanups.set(s, setTimeout(() => s.classList.remove("is-entering"), ENTER_CLEANUP_MS));
    }
    if (visible && !was) { lastTs = 0; requestAnimationFrame(loop); }
  }, { threshold: 0.25 }).observe(stage);

  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => fx && fx.resize(), 150); });
  document.addEventListener("visibilitychange", () => { paused = document.hidden; });

  setFill();
}
