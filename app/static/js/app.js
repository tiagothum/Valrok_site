/** Ponto de entrada comum a todas as páginas. */
import { initHeader, initReveal, initEmbers, initPasswordToggles } from "./ui.js";
import { loadSession, logout } from "./session.js";
import { initServerStatus, initRankPreview } from "./widgets.js";
import { initNewsRead } from "./news-read.js";

document.documentElement.classList.add("js");

const PAGE_MODULES = {
  entrar: "./pages/login.js",
  cadastro: "./pages/register.js",
  conta: "./pages/account.js",
  ranking: "./pages/ranking.js",
  classes: "./pages/classes.js",
};

function boot() {
  initHeader();
  initReveal();
  initEmbers();
  initPasswordToggles();
  initServerStatus();
  initRankPreview();
  initNewsRead();

  document.querySelectorAll("[data-logout]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const done = await logout();
      btn.disabled = false;
      if (done && document.body.dataset.page === "conta") location.assign("/entrar");
    })
  );

  loadSession();

  const mod = PAGE_MODULES[document.body.dataset.page];
  if (mod) import(mod).then((m) => m.init && m.init());

  // Roadmap cinematográfico (home e Classes): carrega só onde a seção existe.
  if (document.querySelector("[data-saga]")) import("./saga.js").then((m) => m.initSaga());
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
