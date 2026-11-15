/**
 * Estado visual da sessão web (guia, seção 6).
 * - A identidade vem de GET /api/auth/web/session a cada carregamento.
 * - O token CSRF fica SOMENTE em memória (variável deste módulo).
 * - Logout chama a API (revogação no servidor) e só então limpa o estado visual.
 */
import { auth, ApiError } from "./api.js";
import { toast } from "./ui.js";

let state = { user: null, csrf: null, ready: false, error: null };
const listeners = new Set();
let pending = null;

export function getUser() { return state.user; }
export function getCsrf() { return state.csrf; }
export function onSessionChange(fn) { listeners.add(fn); if (state.ready) fn(state); return () => listeners.delete(fn); }

function emit() {
  applyHeader();
  listeners.forEach((fn) => fn(state));
}

export function clearSession() {
  state = { user: null, csrf: null, ready: true, error: null };
  emit();
}

export function loadSession({ force = false } = {}) {
  if (pending && !force) return pending;
  pending = (async () => {
    try {
      const data = await auth.session();
      state = { user: data && data.user ? data.user : null, csrf: data ? data.csrf_token || null : null, ready: true, error: null };
    } catch (e) {
      // 401 = visitante. Outros erros: tratar como visitante, mas registrar o estado.
      state = { user: null, csrf: null, ready: true, error: e instanceof ApiError && e.status !== 401 ? e : null };
    }
    emit();
    return state;
  })();
  return pending;
}

export async function logout() {
  try {
    await auth.logout(state.csrf);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) {
      toast("Não foi possível encerrar a sessão no servidor. Tente novamente.", "error");
      return false;
    }
  }
  clearSession();
  toast("Você saiu da sua conta.", "ok");
  return true;
}

function applyHeader() {
  const logged = !!state.user;
  document.querySelectorAll("[data-guest-only]").forEach((el) => { el.hidden = logged; });
  document.querySelectorAll("[data-user-only]").forEach((el) => { el.hidden = !logged; });
  document.querySelectorAll("[data-username]").forEach((el) => { el.textContent = logged ? state.user.username : ""; });
}
