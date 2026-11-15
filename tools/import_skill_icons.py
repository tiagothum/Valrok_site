"""Importa os ícones de skills do pacote de UI do jogo (UI.zip) para o site.

REGRA FIXA DO PROJETO — ícones de skills usam SEMPRE a versão "master":
  - Só arquivos da pasta  UI/Skills/<Classe>/Icons/<Skill>/Square/  cujo nome
    contém "_m" como marcador de versão (ex.: thunderstorm_m.png,
    warrior_shield_wall_m_icon.png, mage_blink_m_square.png).
  - Se houver mais de uma versão "_m" (ex.: _m_icon, _m_icon_v2, _m_icon_v5),
    usa a de MAIOR número de versão (sem sufixo = versão 1).
  - Se a skill não tiver pasta própria, aceita o arquivo "_m" solto em
    UI/Skills/<Classe>/Icons/ (ex.: mercenary_hemlock_blade_m_icon.png).
    A pasta Square tem prioridade.
  - Skills sem versão "_m" NÃO são importadas (são listadas como pendentes).

Saída: app/static/img/classes/skills/<slug-da-classe>-<chave>.webp (128x128).
A chave é o nome da pasta da skill em kebab-case (PredatorsFury -> predators-fury)
e precisa bater com "key" em app/content/classes.json.

Uso (requer Pillow, só para esta ferramenta):
    python tools/import_skill_icons.py caminho/para/UI.zip
    python tools/import_skill_icons.py caminho/para/UI.zip --dry-run
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "app" / "static" / "img" / "classes" / "skills"
CLASSES_JSON = ROOT / "app" / "content" / "classes.json"

CLASS_SLUG = {"Warrior": "guerreiro", "Mercenary": "mercenario", "Druid": "druida", "Mage": "mago"}
SQUARE_RE = re.compile(r"^(?:[^/]+/)?Skills/(?P<cls>[^/]+)/Icons/(?P<skill>[^/]+)/Square/(?P<file>[^/]+\.png)$")
LOOSE_RE = re.compile(r"^(?:[^/]+/)?Skills/(?P<cls>[^/]+)/Icons/(?P<file>[^/]+\.png)$")
MASTER_RE = re.compile(r"_m(?:_[a-z]+)*?(?:_v(?P<ver>\d+))?\.png$")
ICON_SIZE = 128


def kebab(name: str) -> str:
    """PredatorsFury -> predators-fury"""
    return re.sub(r"(?<!^)(?=[A-Z])", "-", name).lower()


def key_from_file(cls: str, file: str) -> str:
    """mercenary_hemlock_blade_m_icon.png -> hemlock-blade"""
    stem = re.sub(rf"^{cls.lower()}_", "", file)
    stem = MASTER_RE.sub("", stem)
    return stem.replace("_", "-")


def pick_masters(names: list[str]) -> tuple[dict[tuple[str, str], str], set[tuple[str, str]]]:
    """Retorna {(classe, chave-kebab): arquivo master} e as skills (com pasta) sem master.

    Prioridade: pasta Square > arquivo solto em Icons/. Dentro da mesma origem,
    vence a maior versão (_v2, _v5...).
    """
    best: dict[tuple[str, str], tuple[int, int, str]] = {}  # (prioridade, versão, nome)
    all_skills: set[tuple[str, str]] = set()
    for n in names:
        m = SQUARE_RE.match(n)
        prio = 2
        if m:
            key_name = kebab(m["skill"])
        else:
            m = LOOSE_RE.match(n)
            prio = 1
            if not m:
                continue
            key_name = key_from_file(m["cls"], m["file"]) if MASTER_RE.search(m["file"]) else None
        if m["cls"] not in CLASS_SLUG or key_name is None:
            continue
        key = (m["cls"], key_name)
        if prio == 2:
            all_skills.add(key)
        mm = MASTER_RE.search(m["file"])
        if not mm:
            continue
        rank = (prio, int(mm["ver"] or 1), n)
        if key not in best or rank[:2] > best[key][:2]:
            best[key] = rank
    chosen = {k: v[2] for k, v in best.items()}
    return chosen, all_skills - set(chosen)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("zip", type=Path)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    with zipfile.ZipFile(args.zip) as z:
        chosen, missing = pick_masters(z.namelist())
        site_keys = {(c["slug"], s["key"]) for c in json.loads(CLASSES_JSON.read_text(encoding="utf-8")) for s in c["skills"]}

        if not args.dry_run:
            from PIL import Image  # importado só quando vai gravar

            OUT_DIR.mkdir(parents=True, exist_ok=True)
        for (cls, skill), name in sorted(chosen.items()):
            out = OUT_DIR / f"{CLASS_SLUG[cls]}-{skill}.webp"
            flag = "" if (CLASS_SLUG[cls], skill) in site_keys else "   (não está no classes.json)"
            print(f"{cls:10} {skill:20} <- {name.rsplit('/', 1)[-1]}{flag}")
            if args.dry_run:
                continue
            im = Image.open(io.BytesIO(z.read(name))).convert("RGBA").resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS)
            im.save(out, "WEBP", quality=85, method=6)

    for cls, skill in sorted(missing):
        print(f"SEM MASTER: {cls}/{skill} — não importado")
    for slug, key in sorted(site_keys - {(CLASS_SLUG[c], s) for c, s in chosen}):
        print(f"ATENÇÃO: {slug}/{key} está no classes.json mas não tem ícone master no pacote")
    return 0


if __name__ == "__main__":
    sys.exit(main())
