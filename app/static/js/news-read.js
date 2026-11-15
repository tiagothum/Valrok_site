/**
 * Contador de notícias não lidas no item "Notícias" do header.
 *
 * - Conta as notícias da semana (itens [data-news-item] do dropdown) que o visitante
 *   ainda não abriu.
 * - "Cache de leitura": a lista de slugs já abertos fica no localStorage deste navegador.
 *   É só uma preferência de leitura — nenhum dado de conta, sessão ou token é guardado aqui.
 * - Abrir a página da notícia (ou clicar nela no dropdown) marca como lida.
 */
const KEY = "valrok.news.read.v1";
const MAX_SLUGS = 200;

function readSet() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw.filter((s) => typeof s === "string") : []);
  } catch {
    return new Set();
  }
}

function writeSet(set) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set].slice(-MAX_SLUGS)));
  } catch {
    /* navegação privada / armazenamento bloqueado: o contador só não persiste */
  }
}

export function markRead(slug) {
  if (!slug) return;
  const set = readSet();
  if (set.has(slug)) return;
  set.add(slug);
  writeSet(set);
  render();
}

function render() {
  const read = readSet();
  const items = [...document.querySelectorAll("[data-news-item]")];
  let unread = 0;
  for (const el of items) {
    const isUnread = !read.has(el.dataset.newsItem);
    el.classList.toggle("is-unread", isUnread);
    if (isUnread) unread += 1;
  }
  document.querySelectorAll("[data-news-count]").forEach((badge) => {
    badge.hidden = unread === 0;
    badge.textContent = unread > 9 ? "9+" : String(unread);
    badge.setAttribute("aria-label", `${unread} ${unread === 1 ? "notícia não lida" : "notícias não lidas"}`);
  });
}

export function initNewsRead() {
  // Página de uma notícia: marca como lida ao abrir.
  const article = document.querySelector("[data-news-slug]");
  if (article) markRead(article.dataset.newsSlug);

  document.querySelectorAll("[data-news-item]").forEach((el) =>
    el.addEventListener("click", () => markRead(el.dataset.newsItem))
  );
  // Mantém o contador sincronizado entre abas.
  window.addEventListener("storage", (e) => { if (e.key === KEY) render(); });
  render();
}
