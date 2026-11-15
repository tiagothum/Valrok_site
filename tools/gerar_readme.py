"""Gera o README.md (apresentação do site) a partir dos dados reais do site.

Fontes: app/content/classes.json, app/content/news.json e as imagens em
app/static/img e docs/readme. Rode de novo sempre que classes, skills ou
notícias mudarem:

    python tools/gerar_readme.py
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "app" / "content"
IMG = "app/static/img"
DOCS = "docs/readme"
SITE = "https://valrok.com.br"

classes = json.loads((CONTENT / "classes.json").read_text(encoding="utf-8"))
news = sorted(json.loads((CONTENT / "news.json").read_text(encoding="utf-8")), key=lambda n: n["date"], reverse=True)
MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

def data_br(iso: str) -> str:
    a, m, d = iso.split("-")
    return f"{int(d)} {MESES[int(m) - 1]} {a}"

DIV = f'<p align="center"><img src="{DOCS}/divisor.png" width="640" alt=""></p>'
n_skills = sum(len(c["skills"]) for c in classes)
n_branches = sum(len(c["branches"]) for c in classes)

out: list[str] = []
w = out.append

# ------------------------------------------------------------------ Capa
w(f'''<p align="center">
  <img src="{DOCS}/banner.jpg" alt="Valrok — RPG de ação multiplayer persistente, desenvolvido no Brasil" width="100%">
</p>

<p align="center">
  <b>Site oficial do Valrok</b> — notícias, classes, ranking, guia e a sua conta em um só lugar.<br>
  <sub>Produção 100% brasileira e independente · Godot Engine · Pré-Alfa</sub>
</p>

<p align="center">
  <a href="{SITE}"><b>valrok.com.br</b></a> &nbsp;·&nbsp;
  <a href="#classes">Classes</a> &nbsp;·&nbsp;
  <a href="#paginas">Páginas</a> &nbsp;·&nbsp;
  <a href="#identidade-visual">Identidade visual</a> &nbsp;·&nbsp;
  <a href="#fase-do-projeto">Fase do projeto</a>
</p>

{DIV}

## ⚔️ O jogo

**Valrok** é um RPG de ação multiplayer persistente em desenvolvimento ativo. Ele resgata a essência desafiadora e a
progressão profunda dos RPGs que marcaram os anos 2000, unindo **combate melee físico** a um **mundo em constante evolução**.

<p align="center"><img src="{DOCS}/print-inicio.webp" alt="Página inicial do site do Valrok" width="100%"></p>

### Os pilares de Valrok

<table>
  <tr>
    <td width="33%" valign="top">
      <img src="{IMG}/art/viking-battle-800.webp" alt="" width="100%"><br>
      <h3>I · Combate de ação</h3>
      Combos fluidos de espada, esquivas táticas e reações físicas reais a cada impacto. Posicionamento e tempo decidem o confronto — nada de combate travado.
    </td>
    <td width="33%" valign="top">
      <img src="{IMG}/art/undead-clash-800.webp" alt="" width="100%"><br>
      <h3>II · Economia e guildas</h3>
      Um mundo de cooperação e disputa territorial. Comércio direto entre jogadores e a construção de um império ao lado da sua guilda.
    </td>
    <td width="33%" valign="top">
      <img src="{IMG}/art/soul-burst-800.webp" alt="" width="100%"><br>
      <h3>III · Progressão profunda</h3>
      Atributos, habilidades ativas e builds que recompensam estratégia. O grind volta a ter significado.
    </td>
  </tr>
</table>

{DIV}

<a id="classes"></a>

## 🛡️ As classes

**{len(classes)} classes, {n_branches} especializações e {n_skills} habilidades.** Cada classe tem duas formas de lutar.
Os nomes seguem os arquivos do jogo, e os ícones são sempre a versão **master** de cada skill.

<table>
  <tr>''')

for c in classes:
    w(f'''    <td align="center" width="{100 // len(classes)}%" valign="top">
      <img src="{IMG}/classes/{c["slug"]}-retrato-420.webp" alt="{c["name"]}" height="300"><br>
      <h3>{c["name"]}</h3>
      <sub><i>{c["tagline"]}</i></sub>
    </td>''')
w("  </tr>\n</table>\n")

for c in classes:
    b1, b2 = c["branches"]
    w(f'''### {c["name"]}

<img align="right" src="{IMG}/classes/{c["slug"]}-retrato-420.webp" alt="" width="150">

{c["description"]}

**Estilo:** {" · ".join(c["tags"])}

| | Especialização | |
|:-:|:--|:--|
| <img src="{IMG}/classes/{c["slug"]}-ramo-{b1["key"]}.webp" width="56" alt=""> | **{b1["name"]}** | {b1["text"]} |
| <img src="{IMG}/classes/{c["slug"]}-ramo-{b2["key"]}.webp" width="56" alt=""> | **{b2["name"]}** | {b2["text"]} |

<p>''')
    icons = []
    for s in c["skills"]:
        icons.append(f'<img src="{IMG}/classes/skills/{c["slug"]}-{s["key"]}.webp" width="52" title="{s["name"]}" alt="{s["name"]}">')
    w("  " + "\n  ".join(icons))
    w(f'''</p>
<sub>{" · ".join(s["name"] for s in c["skills"])}</sub>

<br clear="right">
''')

w(f'''<p align="center"><img src="{DOCS}/print-classes.webp" alt="Página de classes do site" width="100%"></p>

{DIV}

<a id="paginas"></a>

## 🗺️ O site, página por página

O menu segue o padrão dos sites da Blizzard: uma barra flutuante com a marca à esquerda, menus com título e subtítulo,
selos de destaque e a área da conta com o botão **Jogar grátis** à direita.

| Menu | O que tem lá |
|:--|:--|
| **Visão geral** | O que é Valrok, combate, progressão, economia e guildas, e a tecnologia por trás do jogo. |
| **Classes** ▾ | Warrior, Mercenary, Druid e Mage — retrato, estilo de jogo, especializações e todas as habilidades. |
| **Notícias** <sub>`NOVO`</sub> | Anúncios, diários de desenvolvimento e novidades sobre os testes, com filtro por categoria. |
| **Ranking** ▾ | Top jogadores e top guildas, com busca por nome. O ranking oficial começa com o Alfa. |
| **Download** <sub>`ALFA`</sub> | Plataformas, como entrar no Alfa fechado e requisitos de sistema. |
| **···** | Guia do iniciante, Suporte & FAQ, Regras e Discord. |
| **Conta** ▾ | Entrar e Criar conta — ou, já conectado, Minha conta e Sair. |

**Início** reúne tudo: o hero com a arte do jogo, o status do servidor, as últimas notícias, os pilares, as classes,
o ranking, a jornada do projeto e o convite para criar conta.

<table>
  <tr>
    <td width="50%"><img src="{DOCS}/print-noticias.webp" alt="Página de notícias" width="100%"></td>
    <td width="50%"><img src="{DOCS}/print-ranking.webp" alt="Página de ranking" width="100%"></td>
  </tr>
  <tr>
    <td align="center"><sub>Notícias</sub></td>
    <td align="center"><sub>Ranking</sub></td>
  </tr>
</table>

### 📜 Notícias publicadas

<table>
  <tr>''')
for n in news:
    w(f'''    <td width="{100 // len(news)}%" valign="top">
      <img src="{IMG}/art/{n.get("image", "magma-spires")}-800.webp" alt="" width="100%"><br>
      <sub><code>{n["category"].upper()}</code> · {data_br(n["date"])}</sub><br>
      <b>{n["title"]}</b><br>
      <sub>{n["excerpt"]}</sub>
    </td>''')
w(f'''  </tr>
</table>

### 👤 Conta do jogador

- **Criar conta** — grátis; reserva o nome do personagem e coloca o jogador na fila de convites do Alfa fechado.
- **Entrar** — acesso com usuário e senha.
- **Minha conta** — dados da conta, personagens criados e o status do convite do Alfa.

A sessão é protegida pelo servidor do jogo: o site nunca guarda senha, token ou dados sensíveis no navegador.
<sub>Enquanto a integração com o servidor é concluída, essas telas funcionam com dados de demonstração.</sub>

{DIV}

<a id="identidade-visual"></a>

## 🧊 Identidade visual

A identidade do site nasce da **tela de habilidades do jogo** e do **ValrokLauncher**: a paleta **Azul Gelo Rúnico**,
com detalhes em bronze e ouro para manter o clima de fantasia sombria medieval.

<p align="center"><img src="{DOCS}/paleta.png" alt="Paleta Azul Gelo Rúnico" width="100%"></p>

<p align="center"><img src="{DOCS}/tipografia.png" alt="Tipografia: Alegreya e Lato" width="100%"></p>

<p align="center"><img src="{DOCS}/componentes.png" alt="Botões, selos e etiquetas" width="100%"></p>

- **Botão principal** — gradiente de gelo luminoso com texto escuro, para ações como *Criar conta grátis* e *Jogar grátis*.
- **Botão rúnico** — fundo de gelo escuro com borda azul, fiel aos botões da tela de habilidades.
- **Cards** — superfície escura com borda ardósia; ao passar o mouse, ganham tinta de gelo e um brilho rúnico.
- **Molduras e ornamentos** — cantos e divisores em bronze, com o losango rúnico como assinatura.
- **Efeitos** — partículas rúnicas azul-gelo com algumas faíscas douradas, e arte do jogo em movimento lento no topo das páginas.

### A marca

<p align="center"><img src="{IMG}/logo-icon.png" alt="Logo do Valrok" width="160"></p>

<p align="center">O emblema <b>VK</b> em ferro forjado, com runas azuis e veios de brasa.</p>

### Arte do jogo

<p align="center">
  <img src="{IMG}/art/viking-battle-800.webp" width="19%" alt="Viking Battle">
  <img src="{IMG}/art/undead-clash-800.webp" width="19%" alt="Undead Clash">
  <img src="{IMG}/art/soul-burst-800.webp" width="19%" alt="Soul Burst">
  <img src="{IMG}/art/magma-spires-800.webp" width="19%" alt="Magma Spires">
  <img src="{IMG}/art/lethal-daggers-800.webp" width="19%" alt="Lethal Daggers">
</p>
<p align="center"><sub>Telas de carregamento do jogo, usadas no topo das páginas, nas notícias e nos destaques.</sub></p>

{DIV}

<a id="fase-do-projeto"></a>

## 🔥 Fase do projeto

| | Fase | |
|:-:|:--|:--|
| ◆ | **Protótipo** | Combate, movimentação e servidor persistente. |
| 🔷 | **Pré-Alfa** — *agora* | Habilidades, inventário, economia e telemetria. |
| ◇ | Alfa fechado | Primeiros jogadores convidados por ondas. |
| ◇ | Beta aberto | Guildas, territórios e balanceamento. |
| ◇ | Lançamento | O mundo de Valrok aberto a todos. |

**Crie sua conta em [valrok.com.br]({SITE}), reserve o nome do seu personagem e entre na fila do Alfa fechado.**

{DIV}

<p align="center">
  <img src="{IMG}/logo-icon.png" width="56" alt=""><br>
  <b>VALROK</b><br>
  <sub>© 2026 Valrok · Produção brasileira e independente · Em desenvolvimento ativo — conteúdo sujeito a mudanças</sub><br>
  <sub>Documentação técnica (instalação, testes e publicação): <a href="docs/DESENVOLVIMENTO.md">docs/DESENVOLVIMENTO.md</a></sub>
</p>
''')

(ROOT / "README.md").write_text("\n".join(out), encoding="utf-8")
print("README.md gerado:", len("\n".join(out).splitlines()), "linhas")
