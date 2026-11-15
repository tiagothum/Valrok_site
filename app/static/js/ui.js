/** Utilidades de interface. Texto vindo da API é sempre inserido via textContent. */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Cria elemento com segurança: el("li", { class: "x", text: "y" }, [filhos]) */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = String(v);
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of [].concat(children)) if (c) node.append(c);
  return node;
}

export function icon(name, cls = "") {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", `ico ${cls}`.trim());
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(NS, "use");
  use.setAttribute("href", `/static/img/icons.svg#i-${name}`);
  svg.append(use);
  return svg;
}

export function toast(message, type = "info", ms = 4500) {
  const region = document.querySelector("[data-toasts]");
  if (!region) return;
  const t = el("div", { class: `toast toast--${type}`, role: type === "error" ? "alert" : "status", text: message });
  region.append(t);
  setTimeout(() => t.remove(), ms);
}

export function setBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  button.classList.toggle("is-loading", busy);
  button.setAttribute("aria-busy", busy ? "true" : "false");
}

export function formatDate(iso, withTime = false) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", withTime ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short", year: "numeric" });
}

export const formatNumber = (n) => (typeof n === "number" ? n.toLocaleString("pt-BR") : "—");

/* --- Cabeçalho, menu mobile e dropdowns ---------------------------------- */
export function initHeader() {
  const header = document.querySelector("[data-header]");
  const onScroll = () => header && header.classList.toggle("is-scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const burger = document.querySelector("[data-burger]");
  const nav = document.querySelector("[data-nav]");
  const setNav = (open) => {
    nav.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    burger.querySelector("use").setAttribute("href", `/static/img/icons.svg#i-${open ? "close" : "menu"}`);
    document.body.style.overflow = open ? "hidden" : "";
  };
  if (burger && nav) {
    burger.addEventListener("click", () => setNav(!nav.classList.contains("is-open")));
    window.addEventListener("resize", () => { if (window.innerWidth > 1279 && nav.classList.contains("is-open")) setNav(false); });
  }

  const closeAll = (except) => {
    document.querySelectorAll(".has-sub.is-open, .account-menu.is-open").forEach((n) => {
      if (n === except) return;
      n.classList.remove("is-open");
      const b = n.querySelector("[aria-expanded]");
      if (b) b.setAttribute("aria-expanded", "false");
    });
  };
  const bindToggle = (selector, parentSel) => {
    document.querySelectorAll(selector).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const parent = btn.closest(parentSel);
        const open = !parent.classList.contains("is-open");
        closeAll(parent);
        parent.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", String(open));
      });
    });
  };
  bindToggle("[data-subtoggle]", ".has-sub");
  bindToggle("[data-account-toggle]", ".account-menu");
  document.addEventListener("click", () => closeAll(null));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeAll(null);
    if (nav && nav.classList.contains("is-open")) { setNav(false); burger.focus(); }
  });
}

/* --- Revelação ao rolar -------------------------------------------------- */
export function initReveal() {
  const items = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window) || reduceMotion) { items.forEach((i) => i.classList.add("is-visible")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
  items.forEach((i) => io.observe(i));
}

/* --- Brasas (canvas) ------------------------------------------------------ */
export function initEmbers() {
  if (reduceMotion) return;
  document.querySelectorAll("canvas[data-embers]").forEach((canvas) => {
    const ctx = canvas.getContext("2d");
    const density = parseFloat(canvas.dataset.density || "1");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, parts = [], running = false, raf = 0;

    const spawn = (initial) => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : h + 10,
      r: Math.random() * 1.8 + 0.5,
      vy: -(Math.random() * 0.6 + 0.25),
      vx: (Math.random() - 0.5) * 0.3,
      life: 0,
      max: Math.random() * 500 + 300,
      // Partículas rúnicas em azul gelo (#69C0CA ~ hue 186); algumas faíscas douradas mantêm o clima medieval.
      hue: Math.random() < 0.12 ? 36 : 184 + Math.random() * 10,
      phase: Math.random() * Math.PI * 2,
    });
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(110, (w * h) / 14000) * density);
      parts = Array.from({ length: count }, () => spawn(true));
    };
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.life += 1; p.phase += 0.02;
        p.x += p.vx + Math.sin(p.phase) * 0.25; p.y += p.vy;
        const t = p.life / p.max;
        const alpha = Math.sin(Math.min(t, 1) * Math.PI) * 0.9;
        if (t >= 1 || p.y < -10) { parts[i] = spawn(false); continue; }
        const light = p.hue > 100 ? 72 : 62;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `hsla(${p.hue},${p.hue > 100 ? 55 : 60}%,${light}%,${alpha})`);
        g.addColorStop(1, `hsla(${p.hue},55%,50%,0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(tick); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    resize();
    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
    new IntersectionObserver(([en]) => (en.isIntersecting ? start() : stop())).observe(canvas);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  });
}

/* --- Formulários ---------------------------------------------------------- */
export function fieldError(form, name, message) {
  const input = form.querySelector(`[name="${name}"]`);
  const box = form.querySelector(`[data-error-for="${name}"]`);
  if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
  if (box) box.textContent = message || "";
}

export function clearErrors(form) {
  form.querySelectorAll("[aria-invalid]").forEach((i) => i.setAttribute("aria-invalid", "false"));
  form.querySelectorAll("[data-error-for]").forEach((b) => { b.textContent = ""; });
  const alert = form.querySelector("[data-form-alert]");
  if (alert) { alert.hidden = true; alert.textContent = ""; }
}

export function formAlert(form, message, type = "error") {
  const alert = form.querySelector("[data-form-alert]");
  if (!alert) return toast(message, type);
  alert.className = `alert alert--${type}`;
  alert.textContent = message;
  alert.hidden = false;
  alert.focus?.();
}

/** Bloqueia o botão por N segundos (429 Retry-After) sem tentar novamente sozinho. */
export function cooldown(button, seconds, label) {
  const original = label || button.textContent;
  let left = seconds;
  button.disabled = true;
  const t = setInterval(() => {
    left -= 1;
    button.textContent = `Aguarde ${left}s`;
    if (left <= 0) { clearInterval(t); button.disabled = false; button.textContent = original; }
  }, 1000);
  button.textContent = `Aguarde ${left}s`;
}

export function initPasswordToggles() {
  document.querySelectorAll("[data-pass-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Ocultar" : "Mostrar";
      btn.setAttribute("aria-pressed", String(show));
    });
  });
}

export function safeNext(fallback = "/conta") {
  const next = new URLSearchParams(location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
