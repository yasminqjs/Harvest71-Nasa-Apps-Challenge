"""Gera o catálogo de culturas (crops.json) a partir dos experimentos de referência do DSSAT.

Roda FORA da imagem, numa instalação completa do DSSAT + dssat-csm-data (commits fixos):
    python tools/build_crop_catalog.py --dssat /opt/dssat --data /caminho/dssat-csm-data

Para cada cultura: lê o FileX de referência (cultivar padrão, linha de plantio, colheita,
métodos), lista os cultivares do .CUL (sem entradas de origem chinesa), mede o ciclo no
próprio experimento e grava:
    apps/dssat/crops.json              usado pelo Job
    apps/api/app/crops.json            usado pela API (GET /crops)
    apps/dssat/genotype_keep.txt       arquivos de genética que ficam na imagem
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import runner  # noqa: E402
from tools.br_cultivars import merge_catalog  # noqa: E402

CHINA = re.compile(r"china|chinese|beijing|nanjing|gansu|lanzhou|shandong|henan|jiangsu|hebei|yangling|caas|wuhan|shanghai",
                   re.I)

# pasta, código, nome, produto, variável de produção, experimento de referência
CROPS = [
    ("Maize", "MZ", "Milho", "grãos", "HWAM", "BRPI0202.MZX"),
    ("Drybean", "BN", "Feijão", "grãos", "HWAM", "CCPA8629.BNX"),
    ("Cowpea", "CP", "Feijão-caupi", "grãos", "HWAM", "CCPA9701.CPX"),
    ("Soybean", "SB", "Soja", "grãos", "HWAM", "LQBR1905.SBX"),
    ("Peanut", "PN", "Amendoim", "grãos (vagens)", "HWAM", "UFGA7601.PNX"),
    ("Cassava", "CS", "Mandioca", "raízes (matéria seca)", "HWAM", "CCPA7801.CSX"),
    ("Sorghum", "SG", "Sorgo", "grãos", "HWAM", "ITHY8001.SGX"),
    ("PearlMillet", "ML", "Milheto", "grãos", "HWAM", "ITHY8201.MLX"),
    ("Rice", "RI", "Arroz", "grãos", "HWAM", "IRPI8001.RIX"),
    ("Sunflower", "SU", "Girassol", "grãos", "HWAM", "UAFD0801.SUX"),
    ("Cotton", "CO", "Algodão", "capulhos", "HWAM", "TXTE8401.COX"),
    ("Pigeonpea", "PP", "Feijão-guandu", "grãos", "HWAM", "UFGA8401.PPX"),
    ("Sugarcane", "SC", "Cana-de-açúcar", "biomassa (colmos + folhas, matéria seca)", "CWAM", "ESAL1401.SCX"),
    ("PineApple", "PI", "Abacaxi", "frutos (matéria seca)", "HWAM", "UHKN8901.PIX"),
    ("Taro", "TR", "Inhame (taro)", "cormos (matéria seca)", "HWAM", "IBHK8901.TRX"),
    ("Tanier", "TN", "Taioba (tanier)", "cormos (matéria seca)", "HWAM", "MTIS8901.TNX"),
    ("Tomato", "TM", "Tomate", "frutos (matéria seca)", "HWAM", "UFGA0602.TMX"),
    ("BellPepper", "PR", "Pimentão", "frutos (matéria seca)", "HWAM", "UFBR9601.PRX"),
    ("GreenBean", "GB", "Feijão-vagem", "vagens (matéria seca)", "HWAM", "UFGA0701.GBX"),
    ("SweetCorn", "SW", "Milho-verde", "espigas (matéria seca)", "HWAM", "UFCI0201.SWX"),
    ("Cabbage", "CB", "Repolho", "cabeças (matéria seca)", "HWAM", "IBMC9601.CBX"),
    ("Potato", "PT", "Batata", "tubérculos (matéria seca)", "HWAM", "CPSR1302.PTX"),
    ("Chickpea", "CH", "Grão-de-bico", "grãos", "HWAM", "ITBP8502.CHX"),
]


def sections(text: str) -> dict[str, list[str]]:
    out, cur = {}, None
    for line in text.splitlines():
        if line.startswith("*"):
            cur = re.split(r"\s{2,}|:|\(", line[1:])[0].strip().upper()
            out.setdefault(cur, [])
        elif cur:
            out[cur].append(line)
    return out


def spans(header: str):
    res, prev = [], 0
    for m in re.finditer(r"\S+", header):
        name = m.group().lstrip("@").rstrip(".")
        if name:
            res.append((name, prev, m.end()))
        prev = m.end()
    return res


def table(lines: list[str], first: str) -> list[dict]:
    """Linhas de dados sob o cabeçalho '@' que começa com `first` (leitura por posição)."""
    rows, sp = [], None
    for line in lines:
        if line.startswith("@"):
            sp = spans(line) if line[1:].split()[0:1] == [first] or line[1:].lstrip().startswith(first) else None
            continue
        if sp and line.strip() and not line.startswith("!"):
            rows.append({n: line[a:b].strip() for n, a, b in sp} | {"_raw": line})
    return rows


def level_row(lines, first, level):
    for r in table(lines, first):
        if r.get(first.split()[0]) == str(level) or r["_raw"][:2].strip() == str(level):
            return r
    return None


def ydoy(s: str):
    s = s.strip()
    if not s or s == "-99":
        return None
    if len(s) == 7:
        return datetime.strptime(s, "%Y%j")
    yy = int(s[:2])
    return datetime.strptime(f"{1900 + yy if yy > 30 else 2000 + yy}{s[2:]}", "%Y%j")


def cultivars(cul: Path) -> list[dict]:
    out = []
    for line in cul.read_text(errors="replace").splitlines():
        if not line or line[0] in "!*@$ " or len(line) < 8:
            continue
        cid = line[:6].strip()
        if not re.fullmatch(r"[A-Z0-9]{6}", cid) or CHINA.search(line):
            continue
        out.append({"id": cid, "name": line[7:24].strip()})
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dssat", default="/opt/dssat")
    ap.add_argument("--data", required=True)
    a = ap.parse_args()
    dssat, data = Path(a.dssat), Path(a.data)
    models = {}
    for line in (dssat / "DSSATPRO.L48").read_text().splitlines():
        p = line.split()
        if len(p) >= 5 and p[0].startswith("M") and len(p[0]) == 3:
            models[p[0][1:]] = p[4]

    catalog, keep = [], set()
    for folder, code, name, product, var, ref in CROPS:
        fx = data / folder / ref
        sec = sections(fx.read_text(errors="replace"))
        trt = table(sec["TREATMENTS"], "N")[0]
        cu, mp, mh, sm = (int(trt.get(k) or 0) for k in ("CU", "MP", "MH", "SM"))
        cul_row = level_row(sec["CULTIVARS"], "C", cu)
        plant = level_row(sec["PLANTING DETAILS"], "P", mp)
        ctl = sec["SIMULATION CONTROLS"]
        gen = level_row(ctl, "N GENERAL", sm) or {}
        meth = [l for l in ctl if l[:2].strip() == str(sm) and " ME " in l[:6]]
        mgmt = [l for l in ctl if l[:2].strip() == str(sm) and " MA " in l[:6]]
        harvs = mgmt[0].split()[6] if mgmt and len(mgmt[0].split()) > 6 else "M"
        def after(sec_lines, tag, col, raw):
            """Resto da linha depois da coluna `col` (posição pelo cabeçalho, vale p/ datas de 5 ou 7 dígitos)."""
            hdr = next(l for l in sec_lines if l.startswith(tag))
            end = next(b for n, a, b in spans(hdr) if n == col)
            return raw[end:]

        planting_template = after(sec["PLANTING DETAILS"], "@P", "EDATE", plant["_raw"])
        harvest_offset = None
        harvest_line = None
        if mh and "HARVEST DETAILS" in sec:
            h = level_row(sec["HARVEST DETAILS"], "H", mh)
            if h and ydoy(h.get("HDATE", "")) and ydoy(plant["PDATE"]):
                harvest_offset = (ydoy(h["HDATE"]) - ydoy(plant["PDATE"])).days
                harvest_line = after(sec["HARVEST DETAILS"], "@H", "HDATE", h["_raw"])
        smodel = (gen.get("SMODEL") or "").strip()
        model = smodel if re.fullmatch(r"[A-Z]{5}\d{3}", smodel) else models.get(code)
        gfile = f"{code}{model[2:5]}048"
        cul = dssat / "Genotype" / f"{gfile}.CUL"
        # Ciclo medido no próprio experimento
        with tempfile.TemporaryDirectory() as t:
            for f in (data / folder).glob(ref[:-4] + ".*"):
                shutil.copy(f, t)
            subprocess.run([str(dssat / "dscsm048"), "A", ref], cwd=t, capture_output=True, timeout=300)
            rows = runner.parse_summary(Path(t) / "Summary.OUT")
        cyc = []
        for r in rows:
            p, h = ydoy(r.get("PDAT", "")), ydoy(r.get("HDAT", "") or r.get("MDAT", ""))
            if p and h:
                cyc.append((h - p).days)
        cv = cultivars(cul)
        default = {"id": cul_row["INGENO"], "name": cul_row.get("CNAME", "")}
        if default["id"] not in {c["id"] for c in cv}:
            print(f"  aviso {code}: cultivar padrão {default['id']} fora da lista filtrada", file=sys.stderr)
        catalog.append({
            "code": code, "name": name, "product": product, "yield_variable": var,
            "model": model, "genotype_file": gfile,
            "default_cultivar": default,
            "cultivars": sorted(cv, key=lambda c: (c["id"] != default["id"], c["name"])),
            "planting_template": planting_template,
            "harvest": {"mode": "maturity" if harvest_offset is None else "days_after_planting",
                        "days_after_planting": harvest_offset, "detail_template": harvest_line, "harvs": harvs},
            "methods_line": meth[0][2:] if meth else None,
            "cycle_days_max": max(cyc) if cyc else None,
            "reference": {"experiment": f"{folder}/{ref}", "site": " ".join(sec.get("GENERAL", [""])[1:6]).split("@")[0][:80]},
        })
        keep.update(f"{gfile}.{ext}" for ext in ("CUL", "ECO", "SPE") if (dssat / "Genotype" / f"{gfile}.{ext}").exists())
        print(f"{code} {name:18s} modelo={model} cultivares={len(cv):3d} ciclo≤{max(cyc) if cyc else '?'} d"
              f" colheita={catalog[-1]['harvest']['mode']}")

    doc = {"generated_from": {"dssat_csm_os": "25c93b9", "dssat_csm_data": "99c95b3"},
           "policy": "sem cultivares, experimentos ou dados de origem chinesa", "crops": catalog}
    doc = merge_catalog(doc)  # cultivares brasileiros: origem e fonte (cultivars_br.json)
    for dest in (HERE / "crops.json", HERE.parent / "api" / "app" / "crops.json"):
        dest.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")
    (HERE / "genotype_keep.txt").write_text("\n".join(sorted(keep)) + "\n")
    print(f"{len(catalog)} culturas; {len(keep)} arquivos de genética")


if __name__ == "__main__":
    main()
