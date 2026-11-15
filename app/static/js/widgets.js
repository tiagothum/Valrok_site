/** Widgets públicos: status do servidor e prévia do ranking. */
import { publicData } from "./api.js";
import { el, formatNumber } from "./ui.js";

const STATUS = {
  online: ["is-online", "Online"],
  maintenance: ["is-maintenance", "Em desenvolvimento"],
  offline: ["is-offline", "Offline"],
};

export async function initServerStatus() {
  const boxes = document.querySelectorAll("[data-server-status]");
  if (!boxes.length) return;
  let data = null;
  try { data = await publicData.serverStatus(); } catch { data = null; }
  boxes.forEach((box) => {
    const dot = box.querySelector("[data-status-dot]");
    const text = box.querySelector("[data-status-text]");
    const [cls, label] = (data && STATUS[data.status]) || ["", "Indisponível"];
    dot.className = `dot ${cls}`;
    text.textContent = label;
    box.querySelector("[data-status-phase]").textContent = (data && data.phase) || "—";
    box.querySelector("[data-status-accounts]").textContent = data ? formatNumber(data.accounts) : "—";
  });
}

export async function initRankPreview() {
  const lists = document.querySelectorAll("[data-rank-preview]");
  lists.forEach(async (list) => {
    const kind = list.dataset.rankPreview;
    try {
      const res = kind === "guilds" ? await publicData.rankingGuilds() : await publicData.rankingPlayers();
      const items = (res && res.items ? res.items : []).slice(0, 5);
      list.replaceChildren(
        ...items.map((it, i) =>
          el("li", {}, [
            el("span", { class: "rank-pos", text: it.position ?? i + 1 }),
            el("span", { class: "rank-name", text: it.name }, [
              el("span", { class: "rank-sub", text: kind === "guilds" ? `Líder: ${it.leader} · ${it.members} membros` : `Guilda: ${it.guild || "—"}` }),
            ]),
            el("span", { class: "rank-val", text: kind === "guilds" ? `Nv. ${it.level}` : `Nv. ${it.level}` }),
          ])
        )
      );
      if (!items.length) list.replaceChildren(el("li", { class: "empty", text: "O ranking abre junto com o Alfa." }));
    } catch {
      list.replaceChildren(el("li", { class: "empty", text: "Ranking indisponível no momento." }));
    }
    list.setAttribute("aria-busy", "false");
  });
}
