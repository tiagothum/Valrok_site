/** Seletor de classes: abas com hash (#guerreiro). Sem JS, todas as classes ficam visíveis. */
export function init() {
  const tabs = [...document.querySelectorAll("[data-class-tab]")];
  const panels = [...document.querySelectorAll("[data-class-panel]")];
  if (!tabs.length) return;
  const slugs = tabs.map((t) => t.dataset.classTab);

  const select = (slug, { scroll = false, focus = false } = {}) => {
    if (!slugs.includes(slug)) slug = slugs[0];
    tabs.forEach((t) => {
      const on = t.dataset.classTab === slug;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panels.forEach((p) => {
      const on = p.dataset.classPanel === slug;
      p.hidden = !on;
      if (on) {
        p.classList.remove("is-in");
        void p.offsetWidth; // reinicia a animação de entrada
        p.classList.add("is-in");
        if (scroll) p.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  tabs.forEach((t, i) => {
    t.addEventListener("click", (e) => {
      e.preventDefault();
      history.replaceState(null, "", `#${t.dataset.classTab}`);
      select(t.dataset.classTab, { scroll: window.innerWidth < 820 });
    });
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      history.replaceState(null, "", `#${next.dataset.classTab}`);
      select(next.dataset.classTab, { focus: true });
    });
  });

  const fromHash = () => select(location.hash.slice(1), { scroll: !!location.hash });
  window.addEventListener("hashchange", fromHash);
  select(location.hash.slice(1));
  if (location.hash) requestAnimationFrame(() => document.querySelector("[data-class-tabs]").scrollIntoView({ block: "start" }));
}
