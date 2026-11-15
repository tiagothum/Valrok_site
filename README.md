# Valrok — site oficial

Site do Valrok em **HTML/CSS/JS puro** servido por **FastAPI** (Python 3.12), seguindo o
*Guia de desenvolvimento e integração do novo site Valrok* (09/11/2026).

O site **não** acessa o banco do jogo e **não** possui `JWT_SECRET_KEY`, `GAME_SERVER_TOKEN`
nem credenciais do PostgreSQL. Contas, sessão, personagens e dados do jogo pertencem à
**valrokapi**, consumida pelo navegador em `/api/...` na mesma origem.

## Executar localmente

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt      # Windows
.venv\Scripts\python -m uvicorn app.main:app --port 8080
```

Abra http://127.0.0.1:8080. Em desenvolvimento o **modo simulado** fica ligado (selo amarelo no
canto inferior): as respostas da API vêm de `app/static/js/mock.js`.

- Conta de teste simulada: usuário `teste`, senha `valrok123` (existe só no navegador, em `sessionStorage`).
- Estados de erro: use o usuário `erro500`, `lento` ou `offline`; 5 logins errados seguidos → `429` com `Retry-After`.

Para usar a valrokapi real em dev: `MOCK_API=false DEV_API_PROXY=true VALROKAPI_URL=http://127.0.0.1:8000`
(o proxy de dev remove o prefixo `/api`, como o Nginx fará, e recusa `/internal/*`).

### Testes

```bash
.venv\Scripts\python -m pytest -q
```

Cobrem: todas as páginas (200 + cabeçalhos CSP/segurança), 404 em HTML, robots/sitemap, ausência de
script/estilo/handlers inline, ausência de `localStorage`, `innerHTML`, `Authorization` e
`X-Game-Server-Token` no JS.

## Configuração (variáveis de ambiente)

Ver `.env.example`. `VALROK_ENV` aceita `development`, `staging` ou `production`. Principais: `VALROK_ENV`, `MOCK_API`, `DEV_API_PROXY`, `VALROKAPI_URL`,
`CSP_REPORT_ONLY`, `DISCORD_URL`, `SITE_URL`, `ASSET_VERSION`.
Com `VALROK_ENV=production` o processo **recusa iniciar** se `MOCK_API` ou `DEV_API_PROXY` estiverem ligados.

## Estrutura

```
app/
  main.py            FastAPI: páginas, cabeçalhos de segurança, sitemap, health, proxy de dev
  config.py          configuração não secreta e validada
  content/news.json  notícias (conteúdo editorial do site, não do banco do jogo)
  content/classes.json  classes, especializações e skills (textos editáveis)
  templates/         Jinja2: base.html (header/footer), _macros.html e uma página por rota
  static/css/main.css   design system: paleta "Azul Gelo Rúnico" (tokens --vk-* em :root)
  static/js/
    app.js           entrada comum (header, efeitos, sessão, módulo da página)
    api.js           ÚNICO cliente HTTP: base /api, fetch, parsing, ApiError (0/400/401/403/409/422/429/5xx)
    session.js       estado visual da sessão; token CSRF só em memória; logout via API
    mock.js          simulação da valrokapi (somente dev)
    ui.js widgets.js utilidades de interface e widgets públicos
    pages/           login.js, register.js, account.js, ranking.js
  static/fonts/      Alegreya (principal: títulos e texto) e Lato (interface) — auto-hospedadas (OFL)
  static/img/        logo e sprite de ícones SVG
  static/media/      coloque hero.mp4 aqui para ativar o vídeo de fundo da home
tests/test_site.py
```

## Inventário

### Páginas e rotas do site (FastAPI)

| Rota | Página | Dados |
|---|---|---|
| `/` | Início: hero, status, notícias, pilares, ranking, roadmap, CTA | notícias (site) + API pública |
| `/jogo` | Visão geral do jogo | estático |
| `/classes` (`#guerreiro`, `#mercenario`, `#druida`) | Classes: retrato, especializações e habilidades | `content/classes.json` |
| `/noticias`, `/noticias/{slug}` | Lista (filtro por categoria) e artigo | `content/news.json` |
| `/download` | Plataformas, passos, requisitos | estático + status |
| `/ranking` (`#jogadores`, `#guildas`) | Ranking com abas e busca | API pública |
| `/guia`, `/regras`, `/suporte` | Guia, regras, FAQ | estático |
| `/entrar`, `/cadastro`, `/conta` | Login, cadastro, minha conta | API (sessão web) |
| `/health`, `/robots.txt`, `/sitemap.xml`, `/favicon.ico` | utilitários | — |

### Endpoints da valrokapi consumidos (vistos pelo navegador)

| Chamada | Uso | Situação |
|---|---|---|
| `POST /api/auth/register` | Cadastro | **Real hoje** (contrato final de erros/senha a fechar) |
| `POST /api/auth/web/login` | Login → cookie `__Host-valrok_session` | **Proposto** — simulado |
| `GET /api/auth/web/session` | Usuário, papel e `csrf_token` | **Proposto** — simulado |
| `POST /api/auth/web/logout` (com `X-CSRF-Token`) | Revoga sessão | **Proposto** — simulado |
| `GET /api/account/overview` | Minha conta + personagens | Existe com JWT; **adaptar à sessão web** — simulado |
| `GET /api/public/server-status` | Status/fase/contas | **Sem contrato** — simulado |
| `GET /api/public/ranking/players` · `/guilds` | Ranking | **Sem contrato** — simulado |

Formatos assumidos pela interface (ajustar quando o contrato fechar): sessão
`{user:{id,username,role}, csrf_token}`; overview `{account:{id,username,email,role,status,created_at}, characters:[{name,level,map,last_seen}]}`;
ranking `{updated_at, items:[...]}`; erros `{message?, detail?, fields?:{campo:msg}}` + `Retry-After` em 429.

### Recursos externos

**Nenhum.** Fontes, ícones e imagens são locais. A CSP pode começar com tudo em `'self'`
(única exceção: `img-src data:` para a textura de ruído inline no CSS).

## Publicar na Vercel

Arquivos já preparados: `pyproject.toml` (entrada `app.main:app` + dependências), `.python-version` (3.12),
`vercel.json` e `.vercelignore` (não envia `.venv`, testes nem caches — o envio fica em ~4 MB).

### 1. Primeira publicação (prévia, com dados simulados)

Dentro da pasta `valrok-site`:

```bash
npm i -g vercel
vercel login
vercel          # cria o projeto e gera um link de prévia
vercel --prod   # publica em produção (domínio *.vercel.app)
```

Ou pelo GitHub: suba o repositório, importe em vercel.com/new e defina **Root Directory = `valrok-site`**.

Na Vercel, sem nenhuma variável, o site sobe como `staging` com `MOCK_API=true` (selo amarelo "Modo simulado").
Defina em *Settings → Environment Variables*: `SITE_URL` (URL pública) e `DISCORD_URL`.

### 2. Integração real (quando a valrokapi tiver as rotas de sessão web)

1. Copie o conteúdo de `vercel.api-rewrites.example.json` para `vercel.json` e troque `HOST-DA-VALROKAPI` pelo
   host HTTPS público da API. Só as rotas web são repassadas; `/internal/*` nunca é exposto.
2. Variáveis: `VALROK_ENV=production`, `MOCK_API=false`, `SITE_URL=https://valrok.com.br`.
   O site se recusa a iniciar em produção com `MOCK_API=true`.
3. Teste em um subdomínio (ex.: `novo.valrok.com.br`) o cookie `__Host-valrok_session`, CSRF e Origin antes de mover
   o domínio principal — trocar o Nginx pela Vercel exige essa revisão (guia, seção 2).
4. Antes de apontar `valrok.com.br` para a Vercel, confirme que o cliente Godot e o gameserver não usam esse mesmo host para a API.

A versão de CSS/JS usa automaticamente o ID do deploy (`VERCEL_DEPLOYMENT_ID`). CSS/JS são sempre revalidados (ETag);
fontes e imagens têm cache de 7 dias.

## Publicação em servidor próprio (Nginx + Supervisor — proposta)

Supervisor (processo separado da valrokapi):

```ini
[program:valrok-site]
directory=/srv/valrok-site
command=/srv/valrok-site/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8081 --workers 2 --proxy-headers --forwarded-allow-ips=127.0.0.1
environment=VALROK_ENV="production",MOCK_API="false",SITE_URL="https://valrok.com.br",ASSET_VERSION="2026111501",CSP_REPORT_ONLY="true"
autorestart=true
```

Nginx (trecho):

```nginx
location /static/ { alias /srv/valrok-site/app/static/; expires 7d; add_header X-Content-Type-Options nosniff; }

# Somente rotas web que o navegador usa; nunca /internal/
location ~ ^/api/(auth/register|auth/web/|account/|public/) {
    rewrite ^/api/(.*)$ /$1 break;
    proxy_pass http://127.0.0.1:8000;   # valrokapi
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
location /api/ { return 404; }

location / { proxy_pass http://127.0.0.1:8081; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
```

A CSP é enviada pelo FastAPI em toda resposta HTML (inclusive erros). Comece com
`CSP_REPORT_ONLY=true`, navegue por todas as telas, e só então mude para `false`. Não duplique a
CSP no Nginx.

## Pendências antes da integração final (guia, seção 11)

- valrokapi publicar `/auth/web/login|session|logout`, adaptar `/account/overview` e definir rotas públicas de status e ranking.
- Fechar política de senha, formato de erros e recuperação de senha (hoje a página orienta o suporte).
- Substituir as artes procedurais por screenshots/vídeo do jogo (`static/media/hero.mp4`).
- Revisar textos de notícias, regras, roadmap e requisitos de sistema (são rascunhos).
- Classes, especializações e skills usam os nomes em inglês dos arquivos do jogo (`UI.zip`); as descrições em `content/classes.json` estão em português e devem ser revisadas. Wither (Druid) substituiu Erosion, que saiu do jogo.

### Arte do jogo

As imagens em `static/img/art/` (telas de loading) e `static/img/classes/` (retratos, emblemas e ícones de skills) vieram dos pacotes `Icons_Valrok.zip` e `UI.zip`, convertidas para WebP. Para adicionar uma skill: coloque `{classe}-{chave}.webp` (128×128) em `static/img/classes/skills/` e inclua `{"key", "name"}` no `classes.json`.
