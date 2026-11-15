/**
 * Cliente central da valrokapi (guia, seções 4 e 5).
 *
 * - Todas as chamadas passam por aqui: caminho base, fetch, parsing e erros HTTP.
 * - O navegador chama /api/... na MESMA origem; o Nginx remove o prefixo /api.
 * - Sessão web por cookie HttpOnly (emitido pela API). Este código NUNCA lê,
 *   copia ou armazena o identificador de sessão, JWT ou token CSRF fora da memória.
 * - Em desenvolvimento (body[data-mock-api="true"]) as respostas vêm de mock.js.
 */

const API_BASE = "/api";
const MOCK = document.body.dataset.mockApi === "true";

export class ApiError extends Error {
  constructor(status, message, { retryAfter = null, fields = {} } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status; // 0 = falha de rede
    this.retryAfter = retryAfter; // segundos
    this.fields = fields; // { campo: mensagem } para 400/422
  }
  get isAuth() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isRateLimited() { return this.status === 429; }
}

const GENERIC = {
  0: "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
  400: "Dados inválidos. Revise os campos e tente novamente.",
  401: "Sua sessão expirou ou você não está conectado.",
  403: "Você não tem permissão para acessar este conteúdo.",
  404: "Recurso não encontrado.",
  409: "Conflito de dados. Atualize a página e tente novamente.",
  422: "Dados inválidos. Revise os campos e tente novamente.",
  429: "Muitas tentativas. Aguarde um pouco antes de tentar novamente.",
  500: "O servidor está indisponível no momento. Tente novamente em instantes.",
};

/** Só exibe mensagens curtas e de campos combinados; nunca detalhes internos. */
function pickMessage(status, data) {
  if ([400, 409, 422].includes(status) && data) {
    const msg = typeof data.message === "string" ? data.message : typeof data.detail === "string" ? data.detail : null;
    if (msg && msg.length <= 200) return msg;
  }
  if (status >= 500) return GENERIC[500];
  return GENERIC[status] || GENERIC[400];
}

/** FastAPI 422: detail = [{loc: [...,"campo"], msg}] -> { campo: msg } */
function pickFields(data) {
  const out = {};
  if (data && Array.isArray(data.detail)) {
    for (const d of data.detail) {
      const key = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null;
      if (key && !out[key]) out[key] = "Valor inválido.";
    }
  }
  if (data && data.fields && typeof data.fields === "object") {
    for (const [k, v] of Object.entries(data.fields)) if (typeof v === "string") out[k] = v;
  }
  return out;
}

async function transport(method, path, body, csrf) {
  if (MOCK) {
    const mock = await import("./mock.js");
    return mock.handle(method, path, body, csrf);
  }
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (csrf) headers["X-CSRF-Token"] = csrf;
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const ctype = res.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    try { data = await res.json(); } catch { data = null; }
  }
  return { status: res.status, headers: res.headers, data };
}

export async function request(method, path, { body, csrf } = {}) {
  let res;
  try {
    res = await transport(method, path, body, csrf);
  } catch {
    throw new ApiError(0, GENERIC[0]);
  }
  if (res.status >= 200 && res.status < 300) return res.data;

  let retryAfter = null;
  const ra = res.headers && res.headers.get ? res.headers.get("Retry-After") : null;
  if (ra && /^\d+$/.test(ra)) retryAfter = parseInt(ra, 10);
  throw new ApiError(res.status, pickMessage(res.status, res.data), { retryAfter, fields: pickFields(res.data) });
}

/* ------------------------------------------------------------------------ *
 * Endpoints. Estado do contrato (guia, seção 3/4):
 *   REAL HOJE:   POST /auth/register
 *   PROPOSTO:    /auth/web/login, /auth/web/session, /auth/web/logout,
 *                /account/overview (adaptado à sessão web)
 *   A DEFINIR:   /public/ranking/*, /public/server-status  (sem contrato ainda)
 * ------------------------------------------------------------------------ */
export const auth = {
  register: ({ username, email, password }) => request("POST", "/auth/register", { body: { username, email, password } }),
  login: ({ username, password }) => request("POST", "/auth/web/login", { body: { username, password } }),
  session: () => request("GET", "/auth/web/session"),
  logout: (csrf) => request("POST", "/auth/web/logout", { csrf }),
};

export const account = {
  overview: () => request("GET", "/account/overview"),
};

export const publicData = {
  serverStatus: () => request("GET", "/public/server-status"),
  rankingPlayers: () => request("GET", "/public/ranking/players"),
  rankingGuilds: () => request("GET", "/public/ranking/guilds"),
};
