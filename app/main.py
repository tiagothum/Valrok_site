"""Site Valrok — FastAPI.

Responsável apenas por páginas, arquivos estáticos e conteúdo editorial próprio
(notícias). Contas, sessão, personagens e dados do jogo pertencem à valrokapi,
consumida pelo navegador em /api/... na mesma origem (Nginx remove o prefixo).
"""
from __future__ import annotations

import json
import time
from datetime import date
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import BASE_DIR, settings

app = FastAPI(
    title="Valrok Site",
    # Documentação automática só em desenvolvimento local (não em staging/produção).
    docs_url="/_docs" if settings.env == "development" else None,
    redoc_url=None,
    openapi_url="/_openapi.json" if settings.env == "development" else None,
)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

CONTENT_DIR = BASE_DIR / "content"
HERO_VIDEO = BASE_DIR / "static" / "media" / "hero.mp4"

# ---------------------------------------------------------------------------
# Cabeçalhos de segurança (guia, seção 7)
# ---------------------------------------------------------------------------
CSP = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "font-src 'self'",
        "img-src 'self' data:",
        "media-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
    ]
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    ctype = response.headers.get("content-type", "")
    if ctype.startswith("text/html"):
        header = "Content-Security-Policy-Report-Only" if settings.csp_report_only else "Content-Security-Policy"
        response.headers[header] = CSP
        response.headers["Cache-Control"] = "no-cache"
    elif request.url.path.startswith("/static/"):
        # Fontes e imagens mudam raramente: cache longo fora de dev.
        # CSS/JS: módulos importados (ui.js, api.js...) não levam ?v=, então sempre revalidar (ETag)
        # para nunca misturar JS antigo com HTML novo após um deploy.
        long_cache = settings.env != "development" and request.url.path.startswith(("/static/fonts/", "/static/img/"))
        response.headers["Cache-Control"] = "public, max-age=604800" if long_cache else "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    return response


# ---------------------------------------------------------------------------
# Conteúdo editorial (notícias) — propriedade do site, não do banco do jogo.
# ---------------------------------------------------------------------------
@lru_cache(maxsize=1)
def _load_news_cached(mtime: float) -> list[dict]:
    data = json.loads((CONTENT_DIR / "news.json").read_text(encoding="utf-8"))
    return sorted(data, key=lambda n: n["date"], reverse=True)


def load_news() -> list[dict]:
    path = CONTENT_DIR / "news.json"
    return _load_news_cached(path.stat().st_mtime)


@lru_cache(maxsize=1)
def _load_classes_cached(mtime: float) -> list[dict]:
    return json.loads((CONTENT_DIR / "classes.json").read_text(encoding="utf-8"))


def load_classes() -> list[dict]:
    return _load_classes_cached((CONTENT_DIR / "classes.json").stat().st_mtime)


MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
NEWS_WINDOW_DAYS = 7  # dropdown "Notícias" do header: publicadas na última semana
NEWS_DROPDOWN_MAX = 5


def week_news(today: date | None = None) -> list[dict]:
    """Notícias dos últimos 7 dias (mais recentes primeiro) para o dropdown do header."""
    today = today or date.today()
    out = []
    for n in load_news():
        d = date.fromisoformat(n["date"])
        if 0 <= (today - d).days <= NEWS_WINDOW_DAYS:
            out.append({**n, "date_br": f"{d.day} {MESES[d.month - 1]} {d.year}"})
    return out[:NEWS_DROPDOWN_MAX]


def ctx(request: Request, page: str, **extra) -> dict:
    return {
        "header_news": week_news(),
        "request": request,
        "page": page,
        "settings": settings,
        # Dev: versão muda a cada requisição para nunca servir CSS/JS antigo do cache.
        "v": str(time.time_ns()) if settings.env == "development" else settings.asset_version,
        "hero_video": HERO_VIDEO.exists(),
        **extra,
    }


def render(request: Request, template: str, page: str, status_code: int = 200, **extra) -> HTMLResponse:
    return templates.TemplateResponse(request, template, ctx(request, page, **extra), status_code=status_code)


# ---------------------------------------------------------------------------
# Páginas
# ---------------------------------------------------------------------------
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return render(request, "index.html", "inicio", news=load_news()[:3], classes=load_classes())


@app.get("/classes", response_class=HTMLResponse)
async def classes(request: Request):
    return render(request, "classes.html", "classes", classes=load_classes())


@app.get("/jogo", response_class=HTMLResponse)
async def jogo(request: Request):
    return render(request, "jogo.html", "jogo")


@app.get("/noticias", response_class=HTMLResponse)
async def noticias(request: Request, categoria: str | None = None):
    news = load_news()
    categories = sorted({n["category"] for n in news})
    if categoria:
        news = [n for n in news if n["category"].lower() == categoria.lower()]
    return render(request, "noticias.html", "noticias", news=news, categories=categories, current=categoria)


@app.get("/noticias/{slug}", response_class=HTMLResponse)
async def noticia(request: Request, slug: str):
    news = load_news()
    item = next((n for n in news if n["slug"] == slug), None)
    if item is None:
        raise HTTPException(status_code=404)
    others = [n for n in news if n["slug"] != slug][:3]
    return render(request, "noticia.html", "noticias", item=item, others=others)


SIMPLE_PAGES = {
    "download": "download.html",
    "ranking": "ranking.html",
    "guia": "guia.html",
    "regras": "regras.html",
    "suporte": "suporte.html",
    "entrar": "entrar.html",
    "cadastro": "cadastro.html",
    "conta": "conta.html",
}


def _simple(name: str, template: str):
    async def handler(request: Request):
        return render(request, template, name)

    handler.__name__ = f"page_{name}"
    return handler


for _name, _tpl in SIMPLE_PAGES.items():
    app.add_api_route(f"/{_name}", _simple(_name, _tpl), methods=["GET"], response_class=HTMLResponse)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse(BASE_DIR / "static" / "img" / "logo-icon.png", media_type="image/png")


@app.get("/robots.txt", include_in_schema=False)
async def robots():
    body = "User-agent: *\nDisallow: /conta\nDisallow: /api/\n"
    body += f"Sitemap: {settings.site_url}/sitemap.xml\n"
    return Response(body, media_type="text/plain")


@app.get("/sitemap.xml", include_in_schema=False)
async def sitemap():
    paths = ["/", "/jogo", "/classes", "/noticias", "/download", "/ranking", "/guia", "/regras", "/suporte", "/cadastro"]
    paths += [f"/noticias/{n['slug']}" for n in load_news()]
    urls = "".join(f"<url><loc>{settings.site_url}{p}</loc></url>" for p in paths)
    xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>'
    return Response(xml, media_type="application/xml")


# ---------------------------------------------------------------------------
# Proxy de desenvolvimento /api/* -> valrokapi (NUNCA em produção; lá é o Nginx).
# Remove o prefixo /api, como o Nginx fará. Não encaminha /internal/*.
# ---------------------------------------------------------------------------
if settings.dev_api_proxy:
    import httpx

    HOP = {"host", "content-length", "connection", "transfer-encoding", "keep-alive"}

    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
    async def dev_api_proxy(path: str, request: Request):
        if path.startswith("internal"):
            return JSONResponse({"detail": "Não encontrado."}, status_code=404)
        headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP}
        async with httpx.AsyncClient(base_url=settings.valrokapi_url, timeout=15) as client:
            upstream = await client.request(
                request.method, f"/{path}", params=request.query_params, content=await request.body(), headers=headers
            )
        out = Response(upstream.content, status_code=upstream.status_code)
        for k, v in upstream.headers.multi_items():
            if k.lower() not in HOP and k.lower() != "content-encoding":
                out.headers.append(k, v)
        return out


# ---------------------------------------------------------------------------
# Erros em HTML
# ---------------------------------------------------------------------------
@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    if request.url.path.startswith(("/api/", "/static/")):
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
    return render(request, "erro.html", "erro", status_code=exc.status_code, code=exc.status_code)
