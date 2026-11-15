/**
 * SIMULAÇÃO da valrokapi — SOMENTE DESENVOLVIMENTO (guia, seção 8.2).
 * Carregado apenas quando body[data-mock-api="true"] (MOCK_API=true no site).
 * O servidor recusa iniciar com MOCK_API em produção.
 *
 * Para testar estados de erro, use estes nomes de usuário no login/cadastro:
 *   erro500 -> 500 · lento -> resposta demorada · offline -> falha de rede
 * Após 5 logins errados seguidos -> 429 com Retry-After: 30.
 */

const K_USERS = "valrok.mock.users";
const K_SESSION = "valrok.mock.session"; // apenas o nome de usuário simulado
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failedLogins = 0;
let csrfToken = null;

function store(key, fallback) {
  try { return JSON.parse(sessionStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* sem armazenamento */ }
}
function headers(obj = {}) {
  const m = new Map(Object.entries(obj));
  return { get: (k) => m.get(k) ?? null };
}
const ok = (data, status = 200) => ({ status, headers: headers(), data });
const err = (status, data = {}, h = {}) => ({ status, headers: headers(h), data });

function users() {
  const u = store(K_USERS, null);
  if (u) return u;
  const seed = { teste: { id: 1024, username: "teste", email: "teste@example.com", password: "valrok123", role: "player", created_at: "2026-09-02T18:21:00Z" } };
  save(K_USERS, seed);
  return seed;
}

function currentUser() {
  const name = store(K_SESSION, null);
  return name ? users()[name] || null : null;
}

const PLAYERS = [
  ["Drakmor", 42, "Lâminas de Ferro"], ["Ysolde", 41, "Ordem Rúnica"], ["Kaelthar", 40, "Lâminas de Ferro"],
  ["Brannoc", 38, "Cinzas do Norte"], ["Velka", 37, "Ordem Rúnica"], ["Thoren", 36, "—"], ["Myrra", 35, "Cinzas do Norte"],
  ["Gorvath", 34, "Lobos de Aço"], ["Eldrin", 33, "—"], ["Saphira", 33, "Lobos de Aço"], ["Ragnir", 31, "Ordem Rúnica"],
  ["Ilvana", 30, "—"], ["Torgrim", 29, "Lâminas de Ferro"], ["Nyx", 28, "Cinzas do Norte"], ["Halvard", 27, "—"],
].map(([name, level, guild], i) => ({ position: i + 1, name, level, guild, experience: 1_850_000 - i * 97_310 }));

const GUILDS = [
  ["Lâminas de Ferro", "Drakmor", 48, 12], ["Ordem Rúnica", "Ysolde", 41, 11], ["Cinzas do Norte", "Brannoc", 37, 9],
  ["Lobos de Aço", "Gorvath", 29, 8], ["Corvos de Valrok", "Ilvana", 18, 5], ["Juramento de Sangue", "Halvard", 12, 3],
].map(([name, leader, members, level], i) => ({ position: i + 1, name, leader, members, level }));

export async function handle(method, path, body = {}, csrf) {
  const name = (body && body.username ? String(body.username) : "").toLowerCase();
  if (name === "offline") throw new TypeError("Simulated network failure");
  await wait(name === "lento" ? 3500 : 350 + Math.random() * 450);
  if (name === "erro500") return err(500, { detail: "Simulated internal error" });

  const route = `${method} ${path}`;
  switch (route) {
    case "POST /auth/register": {
      const fields = {};
      const username = String(body.username || "").trim();
      if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) fields.username = "Use 3 a 16 caracteres: letras, números ou _.";
      if (body.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) fields.email = "E-mail inválido.";
      if (String(body.password || "").length < 8) fields.password = "A senha precisa de pelo menos 8 caracteres.";
      if (Object.keys(fields).length) return err(422, { message: "Revise os campos destacados.", fields });
      const all = users();
      if (all[username.toLowerCase()]) return err(409, { message: "Este nome de usuário já está em uso.", fields: { username: "Nome indisponível." } });
      all[username.toLowerCase()] = { id: 2000 + Object.keys(all).length, username, email: body.email || null, password: body.password, role: "player", created_at: new Date().toISOString() };
      save(K_USERS, all);
      return ok({ id: all[username.toLowerCase()].id, username }, 201);
    }
    case "POST /auth/web/login": {
      if (failedLogins >= 5) return err(429, { message: "Muitas tentativas." }, { "Retry-After": "30" });
      const u = users()[name];
      if (!u || u.password !== body.password) {
        failedLogins += 1;
        return err(401, { message: "Usuário ou senha incorretos." });
      }
      failedLogins = 0;
      save(K_SESSION, u.username.toLowerCase());
      return ok({ ok: true }); // a API real responde com Set-Cookie; nenhum token no corpo
    }
    case "GET /auth/web/session": {
      const u = currentUser();
      if (!u) return err(401, { detail: "Not authenticated" });
      csrfToken = csrfToken || "mock-" + Math.random().toString(36).slice(2);
      return ok({ user: { id: u.id, username: u.username, role: u.role }, csrf_token: csrfToken });
    }
    case "POST /auth/web/logout": {
      if (!csrf || csrf !== csrfToken) return err(403, { message: "CSRF inválido." });
      try { sessionStorage.removeItem(K_SESSION); } catch { /* */ }
      csrfToken = null;
      return ok({ ok: true });
    }
    case "GET /account/overview": {
      const u = currentUser();
      if (!u) return err(401, {});
      const chars = u.username === "teste"
        ? [{ name: "Aldric", level: 24, map: "Vale de Cinzas", last_seen: "2026-11-14T22:10:00Z" }, { name: "Mirela", level: 11, map: "Fortaleza de Hrun", last_seen: "2026-11-02T19:40:00Z" }]
        : [];
      return ok({
        account: { id: u.id, username: u.username, email: u.email, role: u.role, status: "active", created_at: u.created_at },
        characters: chars,
      });
    }
    case "GET /public/server-status":
      return ok({ status: "maintenance", phase: "Pré-Alfa", accounts: 1284 + Object.keys(users()).length });
    case "GET /public/ranking/players":
      return ok({ updated_at: new Date().toISOString(), items: PLAYERS });
    case "GET /public/ranking/guilds":
      return ok({ updated_at: new Date().toISOString(), items: GUILDS });
    default:
      return err(404, { detail: "Not found" });
  }
}
