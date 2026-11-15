import { auth, ApiError } from "../api.js";
import { loadSession } from "../session.js";
import { setBusy, clearErrors, fieldError, formAlert, cooldown, safeNext } from "../ui.js";

export function init() {
  const form = document.querySelector("[data-login-form]");
  if (!form) return;
  const submit = form.querySelector("[type=submit]");

  loadSession().then((s) => { if (s.user) location.replace(safeNext()); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submit.disabled) return; // evita envio duplo
    clearErrors(form);
    const username = form.username.value.trim();
    const password = form.password.value;
    let invalid = false;
    if (!username) { fieldError(form, "username", "Informe seu usuário."); invalid = true; }
    if (!password) { fieldError(form, "password", "Informe sua senha."); invalid = true; }
    if (invalid) return;

    setBusy(submit, true);
    try {
      await auth.login({ username, password });
      form.password.value = "";
      const s = await loadSession({ force: true });
      if (!s.user) throw new ApiError(500, "Login concluído, mas a sessão não foi confirmada. Tente novamente.");
      location.assign(safeNext());
    } catch (err) {
      setBusy(submit, false);
      form.password.value = "";
      if (err instanceof ApiError && err.status === 401) formAlert(form, "Usuário ou senha incorretos.");
      else if (err instanceof ApiError && err.isRateLimited) {
        formAlert(form, err.message);
        cooldown(submit, err.retryAfter || 30, "Entrar");
      } else formAlert(form, err.message || "Erro inesperado.");
    }
  });
}
