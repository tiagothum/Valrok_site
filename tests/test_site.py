"""Smoke tests das rotas do site e de requisitos de segurança do guia de integração."""
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app, load_news

client = TestClient(app)
APP_DIR = Path(__file__).resolve().parents[1] / "app"

PAGES = ["/", "/jogo", "/classes", "/noticias", "/download", "/ranking", "/guia", "/regras", "/suporte", "/entrar", "/cadastro", "/conta"]


@pytest.mark.parametrize("path", PAGES)
def test_pages_render_with_security_headers(path):
    r = client.get(path)
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    csp = r.headers.get("content-security-policy-report-only") or r.headers.get("content-security-policy")
    assert csp and "script-src 'self'" in csp and "frame-ancestors 'none'" in csp
    assert "unsafe-inline" not in csp
    assert r.headers["x-content-type-options"] == "nosniff"


def test_news_detail_and_404():
    slug = load_news()[0]["slug"]
    assert client.get(f"/noticias/{slug}").status_code == 200
    r = client.get("/noticias/nao-existe")
    assert r.status_code == 404 and "Caminho perdido" in r.text
    assert "content-security-policy" in {k.lower().replace("-report-only", "") for k in r.headers}


def test_health_robots_sitemap():
    assert client.get("/health").json() == {"status": "ok"}
    assert "Disallow: /conta" in client.get("/robots.txt").text
    assert "<urlset" in client.get("/sitemap.xml").text


def test_no_inline_scripts_styles_or_handlers():
    """Guia, seção 7: sem <script> inline, on*= ou style= no HTML."""
    for tpl in (APP_DIR / "templates").glob("*.html"):
        html = tpl.read_text(encoding="utf-8")
        assert not re.search(r"<script(?![^>]*\bsrc=)[^>]*>", html), tpl.name
        assert not re.search(r"\son[a-z]+\s*=", html), tpl.name
        assert "style=" not in html, tpl.name
        assert "javascript:" not in html, tpl.name


def test_no_secrets_or_token_storage_in_frontend():
    """Nada de JWT/token em localStorage nem segredos do gameserver no código do navegador."""
    for js in (APP_DIR / "static" / "js").rglob("*.js"):
        src = js.read_text(encoding="utf-8")
        assert "localStorage" not in src, js.name
        assert "X-Game-Server-Token" not in src, js.name
        assert "Authorization" not in src, js.name
        assert ".innerHTML" not in src, js.name


def test_api_paths_are_same_origin():
    src = (APP_DIR / "static" / "js" / "api.js").read_text(encoding="utf-8")
    assert 'const API_BASE = "/api"' in src
    assert "credentials: \"same-origin\"" in src
    assert "/internal/" not in src


def test_class_assets_exist():
    """Cada classe/skill do classes.json precisa ter sua imagem."""
    from app.main import load_classes

    img = APP_DIR / "static" / "img" / "classes"
    for c in load_classes():
        assert (img / f"{c['slug']}-retrato-900.webp").exists()
        for b in c["branches"]:
            assert (img / f"{c['slug']}-ramo-{b['key']}.webp").exists(), b
        for s in c["skills"]:
            assert (img / "skills" / f"{c['slug']}-{s['key']}.webp").exists(), s


def test_settings_environments(monkeypatch):
    from app.config import load_settings

    for k in ("VALROK_ENV", "MOCK_API", "DEV_API_PROXY", "VERCEL", "ASSET_VERSION", "VERCEL_DEPLOYMENT_ID"):
        monkeypatch.delenv(k, raising=False)
    assert load_settings().env == "development"

    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("VERCEL_DEPLOYMENT_ID", "dpl_abc")
    s = load_settings()
    assert s.env == "staging" and s.mock_api and s.asset_version == "dpl_abc"

    monkeypatch.setenv("VALROK_ENV", "production")
    monkeypatch.setenv("MOCK_API", "true")
    with pytest.raises(RuntimeError):
        load_settings()
    monkeypatch.setenv("MOCK_API", "false")
    assert load_settings().is_production

    monkeypatch.setenv("VALROK_ENV", "prod")
    with pytest.raises(RuntimeError):
        load_settings()
