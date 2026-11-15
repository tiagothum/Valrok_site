"""Configuração do site Valrok.

Somente valores NÃO secretos. O site não precisa (e não deve ter) credenciais do
banco, JWT_SECRET_KEY ou GAME_SERVER_TOKEN — ver guia de integração, seção 5.
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on", "sim"}


@dataclass(frozen=True)
class Settings:
    env: str
    site_url: str
    # Respostas simuladas da valrokapi no navegador (somente desenvolvimento).
    mock_api: bool
    # Proxy local /api/* -> VALROKAPI_URL (somente desenvolvimento; em produção o Nginx faz isso).
    dev_api_proxy: bool
    valrokapi_url: str
    # CSP em modo observação (Report-Only) até todas as telas serem validadas.
    csp_report_only: bool
    discord_url: str
    youtube_url: str
    youtube_channel_id: str
    instagram_url: str
    asset_version: str

    @property
    def is_production(self) -> bool:
        return self.env == "production"


ENVS = {"development", "staging", "production"}


def _asset_version(env: str) -> str:
    explicit = os.getenv("ASSET_VERSION") or os.getenv("VERCEL_DEPLOYMENT_ID") or os.getenv("VERCEL_GIT_COMMIT_SHA", "")[:12]
    if explicit:
        return explicit
    return "1" if env == "production" else str(int(time.time()))


def load_settings() -> Settings:
    # Na Vercel (variável VERCEL=1), o padrão é staging; localmente, development.
    default_env = "staging" if os.getenv("VERCEL") else "development"
    env = os.getenv("VALROK_ENV", default_env).strip().lower()
    if env not in ENVS:
        raise RuntimeError(f"VALROK_ENV inválido: {env!r}. Use: {', '.join(sorted(ENVS))}.")
    s = Settings(
        env=env,
        site_url=os.getenv("SITE_URL", "http://127.0.0.1:8080").rstrip("/"),
        mock_api=_bool("MOCK_API", env != "production"),
        dev_api_proxy=_bool("DEV_API_PROXY", False),
        valrokapi_url=os.getenv("VALROKAPI_URL", "http://127.0.0.1:8000").rstrip("/"),
        csp_report_only=_bool("CSP_REPORT_ONLY", True),
        discord_url=os.getenv("DISCORD_URL", "#"),
        youtube_url=os.getenv("YOUTUBE_URL", "https://www.youtube.com/@ValrokMMORPG"),
        # Vazio desativa a seção de vídeos (fica só o link do canal).
        youtube_channel_id=os.getenv("YOUTUBE_CHANNEL_ID", "UCqMkw73corJp2z1P1QEmPzA"),
        instagram_url=os.getenv("INSTAGRAM_URL", "https://www.instagram.com/valrok.mmorpg/"),
        # ASSET_VERSION > ID do deploy na Vercel > commit; em dev muda a cada reinício.
        asset_version=_asset_version(env),
    )
    if s.is_production and (s.mock_api or s.dev_api_proxy):
        # Guia, seção 8.2: a simulação nunca pode ser habilitada em produção.
        raise RuntimeError("MOCK_API e DEV_API_PROXY devem estar desligados em produção.")
    return s


settings = load_settings()
