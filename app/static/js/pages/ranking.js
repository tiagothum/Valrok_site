import { publicData } from "../api.js";
import { el, formatNumber, formatDate } from "../ui.js";

const cache = {};
let current = "players";

const COLS = {
  players: [["#", "pos"], ["Personagem", ""], ["Nível", "num"], ["Guilda", ""], ["Experiência", "num"]],
  guilds: [["#", "pos"], ["Guilda", ""], ["Líder", ""], ["Membros", "num"], ["Nível", "num"]],
};

function row(kind, it) {
  const cells = kind === "players"
    ? [it.position, it.name, it.level, it.guild || "—", formatNumber(it.experience)]
    : [it.position, it.name, it.leader, it.members, it.level];
  return el("tr", {}, cells.map((v, i) => el("td", { class: COLS[kind][i][1], text: v })));
}

function render() {
  const table = document.querySelector("[data-rank-table]");
  const status = document.querySelector("[data-rank-status]");
  const q = document.querySelector("[data-rank-search]").value.trim().toLowerCase();
  const data = cache[current];
  table.querySelector("thead").replaceChildren(el("tr", {}, COLS[current].map(([h, c]) => el("th", { class: c, scope: "col", text: h }))));
  if (!data) return;
  const items = data.items.filter((it) => !q || String(it.name).toLowerCase().includes(q));
  table.querySelector("tbody").replaceChildren(
    ...(items.length ? items.map((it) => row(current, it)) : [el("tr", {}, [el("td", { colspan: 5, class: "empty", text: "Nenhum resultado." })])])
  );
  status.textContent = data.updated_at ? `Atualizado em ${formatDate(data.updated_at, true)}` : "";
}

async function load(kind) {
  const status = document.querySelector("[data-rank-status]");
  const tbody = document.querySelector("[data-rank-table] tbody");
  current = kind;
  if (!cache[kind]) {
    tbody.replaceChildren(...Array.from({ length: 6 }, () => el("tr", {}, [el("td", { colspan: 5 }, [el("div", { class: "skeleton" })])])));
    status.textContent = "Carregando…";
    try {
      cache[kind] = await (kind === "guilds" ? publicData.rankingGuilds() : publicData.rankingPlayers());
    } catch (err) {
      render();
      tbody.replaceChildren(el("tr", {}, [el("td", { colspan: 5, class: "empty", text: err.message || "Ranking indisponível." })]));
      status.textContent = "";
      return;
    }
  }
  render();
}

export function init() {
  const tabs = document.querySelectorAll("[data-rank-tab]");
  tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      history.replaceState(null, "", tab.dataset.rankTab === "guilds" ? "#guildas" : "#jogadores");
      load(tab.dataset.rankTab);
    })
  );
  document.querySelector("[data-rank-search]").addEventListener("input", render);
  const fromHash = () => {
    const kind = location.hash === "#guildas" ? "guilds" : "players";
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.rankTab === kind)));
    load(kind);
  };
  window.addEventListener("hashchange", fromHash);
  fromHash();
}
