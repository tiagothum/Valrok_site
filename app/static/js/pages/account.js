/**
 * Minha conta: a página HTML é uma estrutura vazia; os dados vêm da API após
 * confirmar a sessão (guia, seção 5). Nada privado fica em cache local.
 */
import { account, ApiError } from "../api.js";
import { loadSession, onSessionChange } from "../session.js";
import { el, formatDate } from "../ui.js";

const ROLES = { player: "Jogador", admin: "Administrador", gm: "Game Master" };

function show(name) {
  document.querySelectorAll("[data-state]").forEach((s) => { s.hidden = s.dataset.state !== name; });
}

function renderOverview(data) {
  const a = data.account || {};
  document.querySelector("[data-avatar]").textContent = (a.username || "?").slice(0, 1).toUpperCase();
  document.querySelector("[data-acc-name]").textContent = a.username || "—";
  document.querySelector("[data-acc-role]").textContent = ROLES[a.role] || a.role || "Jogador";

  const kv = document.querySelector("[data-acc-kv]");
  const rows = [
    ["ID da conta", a.id ?? "—"],
    ["E-mail", a.email || "Não informado"],
    ["Status", a.status === "active" ? "Ativa" : a.status || "—"],
    ["Criada em", a.created_at ? formatDate(a.created_at) : "—"],
  ];
  kv.replaceChildren(...rows.flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })]));

  const chars = Array.isArray(data.characters) ? data.characters : [];
  const box = document.querySelector("[data-chars]");
  document.querySelector("[data-char-count]").textContent = String(chars.length);
  if (!chars.length) {
    box.replaceChildren(el("p", { class: "empty", text: "Nenhum personagem ainda. Crie o seu dentro do jogo quando o Alfa abrir." }));
  } else {
    box.replaceChildren(
      ...chars.map((c) =>
        el("div", { class: "char" }, [
          el("div", { class: "char__name", text: c.name }),
          el("div", { class: "char__meta", text: `Nível ${c.level ?? "—"} · ${c.map || "Local desconhecido"}` }),
          el("div", { class: "char__meta", text: c.last_seen ? `Visto em ${formatDate(c.last_seen, true)}` : "" }),
        ])
      )
    );
  }
  show("ready");
}

async function fetchOverview() {
  show("loading");
  try {
    renderOverview(await account.overview());
  } catch (err) {
    if (err instanceof ApiError && err.isAuth) return show("auth");
    if (err instanceof ApiError && err.isForbidden) return show("forbidden");
    document.querySelector("[data-error-msg]").textContent = err.message || "Erro inesperado.";
    show("error");
  }
}

export async function init() {
  document.querySelector("[data-retry]")?.addEventListener("click", fetchOverview);
  const s = await loadSession();
  if (!s.user) { show(s.error ? "error" : "auth"); if (s.error) document.querySelector("[data-error-msg]").textContent = s.error.message; return; }
  await fetchOverview();
  // Logout em outra ação da página: limpa a tela imediatamente.
  onSessionChange((st) => { if (st.ready && !st.user) show("auth"); });
}
