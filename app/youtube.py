"""Últimos vídeos do canal do Valrok no YouTube (feed público, sem chave de API).

- Lê https://www.youtube.com/feeds/videos.xml?channel_id=<id> no servidor.
- Cache em memória (TTL) para não consultar o YouTube a cada visita.
- Falha de rede/parse => lista vazia (a página mostra só o link do canal).
- Miniaturas são servidas pelo próprio site (/yt-thumb/<id>.jpg), então o navegador
  do visitante não carrega nada do Google e a CSP continua em 'self'.
"""
from __future__ import annotations

import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime

import httpx

FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
THUMB_URL = "https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"
VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
CACHE_TTL = 15 * 60  # segundos
MAX_FEED_BYTES = 2_000_000
NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015",
      "media": "http://search.yahoo.com/mrss/"}
MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]


@dataclass(frozen=True)
class Video:
    id: str
    title: str
    published: datetime
    views: int | None
    is_short: bool

    @property
    def url(self) -> str:
        return f"https://www.youtube.com/shorts/{self.id}" if self.is_short else f"https://www.youtube.com/watch?v={self.id}"

    @property
    def thumb(self) -> str:
        return f"/yt-thumb/{self.id}.jpg"

    @property
    def date_br(self) -> str:
        d = self.published
        return f"{d.day} {MESES[d.month - 1]} {d.year}"


def clean_title(title: str) -> str:
    """Remove as hashtags do fim do título ("... | Devlog #godot #shorts" -> "... | Devlog")."""
    return re.sub(r"(\s+#[\w\-]+)+\s*$", "", title).strip()


def parse_feed(xml_text: str, limit: int = 8) -> list[Video]:
    root = ET.fromstring(xml_text)
    out: list[Video] = []
    for e in root.findall("a:entry", NS):
        vid = (e.findtext("yt:videoId", default="", namespaces=NS) or "").strip()
        if not VIDEO_ID_RE.match(vid):
            continue
        raw_title = e.findtext("a:title", default="", namespaces=NS) or ""
        stats = e.find("media:group/media:community/media:statistics", NS)
        views = int(stats.get("views")) if stats is not None and (stats.get("views") or "").isdigit() else None
        link = e.find("a:link", NS)
        href = link.get("href", "") if link is not None else ""
        is_short = "/shorts/" in href or "#shorts" in raw_title.lower()
        published = datetime.fromisoformat(e.findtext("a:published", default="1970-01-01T00:00:00+00:00", namespaces=NS))
        out.append(Video(id=vid, title=clean_title(raw_title), published=published, views=views, is_short=is_short))
    out.sort(key=lambda v: v.published, reverse=True)
    return out[:limit]


_cache: dict[str, tuple[float, list[Video]]] = {}


async def latest_videos(channel_id: str, limit: int = 4) -> list[Video]:
    if not channel_id:
        return []
    now = time.monotonic()
    hit = _cache.get(channel_id)
    if hit and now - hit[0] < CACHE_TTL:
        return hit[1][:limit]
    try:
        async with httpx.AsyncClient(timeout=3.0, follow_redirects=True) as client:
            r = await client.get(FEED_URL.format(channel_id=channel_id))
        r.raise_for_status()
        if len(r.content) > MAX_FEED_BYTES:
            raise ValueError("feed grande demais")
        videos = parse_feed(r.text)
    except Exception:
        # Mantém o último resultado bom, se houver; senão, lista vazia.
        videos = hit[1] if hit else []
        _cache[channel_id] = (now - CACHE_TTL + 60, videos)  # tenta de novo em ~1 min
        return videos[:limit]
    _cache[channel_id] = (now, videos)
    return videos[:limit]


_thumb_cache: dict[str, tuple[float, bytes]] = {}


async def fetch_thumb(video_id: str) -> bytes | None:
    """Baixa a miniatura do vídeo (só ids válidos -> sem SSRF). Cache de 6 h."""
    if not VIDEO_ID_RE.match(video_id):
        return None
    now = time.monotonic()
    hit = _thumb_cache.get(video_id)
    if hit and now - hit[0] < 6 * 3600:
        return hit[1]
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.get(THUMB_URL.format(video_id=video_id))
        if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image/") or len(r.content) > 500_000:
            return None
    except Exception:
        return None
    if len(_thumb_cache) > 200:
        _thumb_cache.clear()
    _thumb_cache[video_id] = (now, r.content)
    return r.content
