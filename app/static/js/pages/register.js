import { auth, ApiError } from "../api.js";
import { setBusy, clearErrors, fieldError, formAlert, cooldown } from "../ui.js";

const USER_RE = /^[A-Za-z0-9_]{3,16}$/;
const MAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function strength(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4);
}

export function init() {
  const form = document.querySelector("[data-register-form]");
  if (!form) return;
  const submit = form.querySelector("[type=submit]");
  const bar = form.querySelector("[data-strength] span");
  const colors = ["var(--err)", "var(--err)", "var(--warn)", "var(--ok)", "var(--ok)"];

  form.password.addEventListener("input", () => {
    const s = strength(form.password.value);
    bar.style.width = `${(s / 4) * 100}%`;
    bar.style.background = colors[s];
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submit.disabled) return;
    clearErrors(form);

    const username = form.username.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirm = form.confirm.value;
    let invalid = false;
    // Validação de conveniência; a valrokapi é a autoridade final.
    if (!USER_RE.test(username)) { fieldError(form, "username", "Use 3 a 16 caracteres: letras, números ou _."); invalid = true; }
    if (email && !MAIL_RE.test(email)) { fieldError(form, "email", "E-mail inválido."); invalid = true; }
    if (password.length < 8) { fieldError(form, "password", "A senha precisa de pelo menos 8 caracteres."); invalid = true; }
    if (password !== confirm) { fieldError(form, "confirm", "As senhas não conferem."); invalid = true; }
    if (!form.terms.checked) { fieldError(form, "terms", "Você precisa aceitar as regras do jogo."); invalid = true; }
    if (invalid) { form.querySelector("[aria-invalid=true]")?.focus(); return; }

    setBusy(submit, true);
    try {
      await auth.register({ username, email: email || null, password });
      form.reset();
      bar.style.width = "0";
      form.hidden = true;
      const done = document.querySelector("[data-register-done]");
      done.querySelector("[data-done-name]").textContent = username;
      done.hidden = false;
      done.focus();
    } catch (err) {
      setBusy(submit, false);
      if (err instanceof ApiError) {
        for (const [k, v] of Object.entries(err.fields)) fieldError(form, k, v);
        formAlert(form, err.message);
        if (err.isRateLimited) cooldown(submit, err.retryAfter || 30, "Criar conta");
      } else formAlert(form, "Erro inesperado. Tente novamente.");
    }
  });
}
