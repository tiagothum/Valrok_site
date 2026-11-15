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
        if js.name == "news-read.js":
            # Único uso permitido: lista de notícias já lidas (preferência de leitura, não é sessão).
            code = src.lower()
            for forbidden in ("token", "csrf", "session", "password", "senha", "cookie", "auth"):
                assert forbidden not in code.replace("nenhum dado de conta, sessão ou token", ""), forbidden
        else:
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


def test_skill_icon_master_rule():
    """Regra fixa: ícones de skills só da versão "_m" (master); maior versão vence; Square > solto."""
    import sys
    sys.path.insert(0, str(APP_DIR.parent / "tools"))
    from import_skill_icons import pick_masters

    names = [
        "UI/Skills/Mercenary/Icons/FireArrow/Square/mercenary_fire_arrow_g_icon.png",
        "UI/Skills/Mercenary/Icons/FireArrow/Square/mercenary_fire_arrow_m_icon.png",
        "UI/Skills/Mercenary/Icons/FireArrow/Square/mercenary_fire_arrow_m_icon_v5.png",
        "UI/Skills/Mercenary/Icons/FireArrow/Square/mercenary_fire_arrow_m_icon_v2.png",
        "UI/Skills/Mercenary/Icons/FireArrow/Hotbar_45x59/mercenary_fire_arrow_m_hotbar.png",
        "UI/Skills/Mercenary/Icons/mercenary_fire_arrow_m_icon.png",
        "UI/Skills/Mercenary/Icons/mercenary_hemlock_blade_m_icon.png",
        "UI/Skills/Mercenary/Icons/PiercingMastery/Square/mercenary_piercing_mastery_x_icon.png",
        "UI/Skills/Mercenary/Icons/PiercingMastery/Square/mercenary_piercing_mastery_m_icon.png",
        "UI/Skills/Druid/Icons/Wither/Square/wither_p.png",
        "UI/Skills/Druid/Icons/Wither/Square/wither_m.png",
        "UI/Skills/Mage/Icons/RunicReflection/Square/mage_runic_reflection_icon.png",
        "UI/Skills/Warrior/Icons/warrior_shield_wall_icon.png",
    ]
    chosen, missing = pick_masters(names)
    assert chosen[("Mercenary", "fire-arrow")].endswith("Square/mercenary_fire_arrow_m_icon_v5.png")
    assert chosen[("Mercenary", "hemlock-blade")].endswith("Icons/mercenary_hemlock_blade_m_icon.png")
    assert chosen[("Mercenary", "piercing-mastery")].endswith("_m_icon.png")
    assert chosen[("Druid", "wither")].endswith("wither_m.png")
    assert ("Mage", "runic-reflection") in missing and ("Mage", "runic-reflection") not in chosen
    assert ("Warrior", "shield-wall") not in chosen  # arquivo sem "_m" nunca é usado


def test_header_full_menu_and_news_dropdown():
    """Header: todos os itens visíveis (sem "..."), Discord como ícone, Notícias com contador e dropdown."""
    html = client.get("/").text
    assert "main-nav__more" not in html and "Mais links" not in html
    for href in ('href="/jogo"', 'href="/guia"', 'href="/suporte"', 'href="/regras"', 'href="/download"'):
        assert href in html, href
    assert 'class="nav-icon"' in html and 'aria-label="Discord do Valrok"' in html
    assert "data-news-count" in html and 'id="sub-news"' in html
    assert '<span class="badge">Novo</span>' not in html


def test_week_news_window():
    from datetime import date
    from app.main import week_news

    slugs = [n["slug"] for n in week_news(date(2026, 11, 15))]
    assert "bem-vindo-ao-novo-portal" in slugs and "diario-de-desenvolvimento-combate" in slugs
    assert "alfa-fechado-como-participar" not in slugs  # 30/10: fora da semana
    assert week_news(date(2027, 1, 1)) == []


def test_classes_data_complete():
    """Toda skill tem especialização válida, skill_id, nível necessário e campo de descrição."""
    from app.main import load_classes

    for c in load_classes():
        branch_keys = {b["key"] for b in c["branches"]}
        assert all(b.get("specialization_id") for b in c["branches"])
        for b in branch_keys:
            assert sum(1 for s in c["skills"] if s["branch"] == b) == 6, (c["slug"], b)
        for s in c["skills"]:
            assert s["branch"] in branch_keys, s
            assert s["skill_id"].endswith(s["key"].replace("-", "_")), s
            assert isinstance(s["required_level"], int), s
            assert "description" in s, s


def test_classes_page_branch_filter_markup():
    html = client.get("/classes").text
    assert html.count('data-branch="') == 8
    assert html.count("data-skill-branch=") == 48
    assert 'class="skill__desc"' in html and "skill__level" not in html


SAMPLE_FEED = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>Valrok MMORPG</title>
 <entry><yt:videoId>14QfItlE4GM</yt:videoId><title>Todas as Classes Prontas | Devlog</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=14QfItlE4GM"/><published>2026-11-14T18:58:09+00:00</published>
  <media:group><media:community><media:statistics views="73"/></media:community></media:group></entry>
 <entry><yt:videoId>vbj5Z3tG8eo</yt:videoId><title>Mage Elemental PVP | Valrok Devlog #godot #mmorpg #shorts</title>
  <link rel="alternate" href="https://www.youtube.com/shorts/vbj5Z3tG8eo"/><published>2026-11-04T18:15:56+00:00</published></entry>
 <entry><yt:videoId>../../etc</yt:videoId><title>inválido</title><published>2026-11-01T00:00:00+00:00</published></entry>
</feed>"""


def test_youtube_feed_parsing():
    from app.youtube import parse_feed

    vids = parse_feed(SAMPLE_FEED)
    assert [v.id for v in vids] == ["14QfItlE4GM", "vbj5Z3tG8eo"]  # id inválido descartado
    assert vids[0].url == "https://www.youtube.com/watch?v=14QfItlE4GM" and vids[0].views == 73
    assert vids[1].is_short and vids[1].url.endswith("/shorts/vbj5Z3tG8eo")
    assert vids[1].title == "Mage Elemental PVP | Valrok Devlog"  # hashtags removidas
    assert vids[0].thumb == "/yt-thumb/14QfItlE4GM.jpg"


def test_home_videos_and_social_links(monkeypatch):
    import app.main as m
    from app.youtube import parse_feed

    async def fake(channel_id, limit=4):
        return parse_feed(SAMPLE_FEED)[:limit]

    monkeypatch.setattr(m, "latest_videos", fake)
    html = client.get("/").text
    assert "Últimos vídeos" in html and 'href="https://www.youtube.com/watch?v=14QfItlE4GM"' in html
    assert 'src="/yt-thumb/14QfItlE4GM.jpg"' in html
    assert "https://www.instagram.com/valrok.mmorpg/" in html and "https://www.youtube.com/@ValrokMMORPG" in html
    assert "tiktok" not in html.lower()


def test_home_without_videos_shows_channel_link(monkeypatch):
    import app.main as m

    async def empty(channel_id, limit=4):
        return []

    monkeypatch.setattr(m, "latest_videos", empty)
    html = client.get("/").text
    assert "Assistir no YouTube" in html


def test_yt_thumb_rejects_invalid_id():
    assert client.get("/yt-thumb/..%2F..%2Fetc.jpg").status_code == 404
    assert client.get("/yt-thumb/abc.jpg").status_code == 404


def test_classes_saga_roadmap_section():
    """Roadmap cinematográfico: uma cena e um capítulo por classe, sem script/estilo inline."""
    from app.main import load_classes

    n = len(load_classes())
    html = client.get("/classes").text
    assert 'data-saga-stage' in html and "Crônicas das Classes" in html
    assert html.count("data-saga-scene=") == n and html.count("data-saga-go=") == n
    assert '/static/css/saga.css' in html
    # nada do que já existia foi removido
    assert html.count("data-class-panel=") == n and html.count('data-branch="') == 2 * n


def test_home_has_saga_instead_of_classes_teaser():
    from app.main import load_classes

    n = len(load_classes())
    html = client.get("/").text
    assert "classes-teaser" not in html and "Escolha seu caminho" not in html
    assert html.count("data-saga-scene=") == n and "/static/css/saga.css" in html
    assert 'href="/classes#guerreiro"' in html  # "Ver a classe" leva à página de Classes
