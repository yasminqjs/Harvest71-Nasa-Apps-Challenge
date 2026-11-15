"""Cultivares brasileiros de artigos (cultivars_br.json) -> arquivos de genética do DSSAT e catálogo.

    python3 tools/br_cultivars.py genotype /opt/dssat/Genotype   # acrescenta linhas .CUL/.ECO (idempotente)
    python3 tools/br_cultivars.py catalog                         # marca origem/fonte em crops.json (dssat + api)

Cada valor é escrito alinhado à direita na coluna do cabeçalho '@' do próprio arquivo, como o
DSSAT lê (largura fixa). Campos que o artigo não informa vêm do cultivar/ecótipo base.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
REGISTRY = HERE / "cultivars_br.json"


def load(path: Path = REGISTRY) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _spans(header: str):
    """(nome, início, fim) de cada coluna; a coluna termina no fim do nome no cabeçalho."""
    out, prev = [], 0
    for m in re.finditer(r"\S+", header):
        out.append((m.group().lstrip("@").rstrip("."), prev, m.end()))
        prev = m.end()
    return out


def _fmt(v, width: int) -> str:
    if isinstance(v, str):
        s = v
    else:
        s = None
        for d in (3, 2, 1, 0):
            t = f"{v:.{d}f}" if d else f"{v:.0f}."
            t = t.lstrip("0") if t.startswith("0.") and len(t) > width - 1 else t
            if len(t) <= width - 1:
                s = t
                break
        if s is None:
            raise ValueError(f"valor {v} não cabe em {width} colunas")
    if len(s) > width - 1:
        raise ValueError(f"'{s}' não cabe em {width} colunas")
    return s.rjust(width)


def _header_and_row(text: str, row_id: str):
    hdr = None
    for line in text.splitlines():
        if line.startswith("@"):
            hdr = line
        elif line[:6] == row_id and hdr:
            return hdr, line
    raise KeyError(row_id)


def build_line(header: str, base_row: str, new_id: str, name: str | None, values: dict) -> str:
    sp = _spans(header)
    cols = {n: (a, b) for n, a, b in sp}
    unknown = set(values) - set(cols)
    if unknown:
        raise KeyError(f"colunas inexistentes no arquivo: {sorted(unknown)}")
    row = base_row.ljust(sp[-1][2])
    out = new_id.ljust(6) + row[6:]
    if name is not None:
        a = 7
        b = next(s for n, s, e in sp if n not in ("VAR#", "ECO#") and s > 6)  # início da coluna após o nome
        out = out[:a] + name[: b - a - 1].ljust(b - a) + out[b:]
    for k, v in values.items():
        a, b = cols[k]
        old = row[a:b].strip()
        if not isinstance(v, str) and old and re.fullmatch(r"-?\d+", old) and float(v).is_integer():
            v = str(int(v))  # coluna inteira no arquivo original: mantém inteiro
        out = out[:a] + _fmt(v, b - a) + out[b:]
    return out.rstrip()


def cul_line(gdir: Path, c: dict) -> str:
    cul = gdir / f"{c['genotype_file']}.CUL"
    base = c.get("base", "DFAULT")
    hdr, row = _header_and_row(cul.read_text(errors="replace"), base)
    vals = dict(c["cul"])
    if c.get("eco_id"):
        vals["ECO#"] = c["eco_id"]
    elif c.get("eco_override"):
        vals["ECO#"] = c["eco_override"]
    return build_line(hdr, row, c["id"], c["name"], vals)


def eco_line(gdir: Path, c: dict) -> str:
    eco = gdir / f"{c['genotype_file']}.ECO"
    hdr, row = _header_and_row(eco.read_text(errors="replace"), c.get("eco_base", "DFAULT"))
    return build_line(hdr, row, c["eco_id"], c["name"], c["eco"])


def _append(path: Path, lines: list[str]) -> int:
    text = path.read_text(errors="replace")
    have = {l[:6] for l in text.splitlines()}
    new = [l for l in lines if l[:6] not in have]
    if new:
        sep = "" if text.endswith("\n") else "\n"
        path.write_text(text + sep + "\n! Field Shift: cultivares brasileiros de artigos (fontes em cultivars_br.json)\n"
                        + "\n".join(new) + "\n")
    return len(new)


def apply_genotype(gdir: Path, reg: dict | None = None) -> int:
    reg = reg or load()
    n = 0
    by_file: dict[Path, list[str]] = {}
    for c in reg["cultivars"]:
        if c.get("eco_id"):
            by_file.setdefault(gdir / f"{c['genotype_file']}.ECO", []).append(eco_line(gdir, c))
        by_file.setdefault(gdir / f"{c['genotype_file']}.CUL", []).append(cul_line(gdir, c))
    for path, lines in by_file.items():
        n += _append(path, lines)
    return n


def merge_catalog(doc: dict, reg: dict | None = None) -> dict:
    """Marca cultivares brasileiros (biblioteca e artigos) e acrescenta os de artigos ao catálogo."""
    reg = reg or load()
    src = reg["sources"]
    for crop in doc["crops"]:
        code = crop["code"]
        lib = set(reg["library_brazil"].get(code, []))
        known = {x["id"]: x for x in crop["cultivars"]}
        for x in crop["cultivars"]:
            if x["id"] in lib:
                x["origin"] = "Brasil"
                x["source"] = "biblioteca oficial do DSSAT 4.8"
        for c in reg["cultivars"]:
            if c["crop"] != code:
                continue
            s = src[c["source"]]
            entry = known.get(c["id"])
            if entry is None:
                entry = {"id": c["id"]}
                crop["cultivars"].append(entry)
            entry.update({
                "name": c["name"], "origin": "Brasil",
                "source": s["citation"], "source_institution": s["institution"],
                "source_location": s["location"], "source_url": s.get("url"),
                "calibration_model": s["model"], "inherited": c.get("inherited", {}),
            })
    doc["brazil_cultivars"] = {"registry": "apps/dssat/cultivars_br.json",
                               "not_imported": reg["not_imported"]}
    return doc


def write_catalog() -> None:
    for dest in (HERE / "crops.json", HERE.parent / "api" / "app" / "crops.json"):
        doc = json.loads(dest.read_text(encoding="utf-8"))
        dest.write_text(json.dumps(merge_catalog(doc), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    if sys.argv[1:2] == ["genotype"]:
        print(f"{apply_genotype(Path(sys.argv[2]))} linhas acrescentadas")
    elif sys.argv[1:2] == ["catalog"]:
        write_catalog()
        print("catálogo atualizado")
    else:
        sys.exit(__doc__)
