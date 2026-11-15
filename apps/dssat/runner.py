"""Executa o DSSAT-CSM de forma isolada e reprodutível (Cloud Run Job ou local).

Modos:
  reference  (padrão)  Roda o experimento oficial BRPI0202 (milho, Piracicaba-SP) embutido
                       na imagem e confere o resultado com os valores esperados. Serve como
                       teste de fumaça do contêiner e do acesso ao bucket.
  run                  Baixa as entradas de gs://<INPUT_PREFIX>, roda o arquivo FILEX
                       e grava saídas, log e metadados em gs://<OUTPUT_PREFIX>.

Variáveis de ambiente:
  MODE            reference | run                     (padrão: reference)
  OUTPUT_PREFIX   gs://bucket/caminho/  (opcional em reference; obrigatório em run)
  INPUT_PREFIX    gs://bucket/caminho/  (run)  .WTH, .SOL, FileX, .CUL etc.
  FILEX           nome do arquivo de experimento, ex.: FSHT0001.MZX (run)
  DSSAT_HOME      instalação do DSSAT (padrão /opt/dssat)
  RUN_TIMEOUT     segundos (padrão 600)

Nenhum valor é inventado: se o DSSAT falhar, o job falha e o log é gravado.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

DSSAT_HOME = Path(os.environ.get("DSSAT_HOME", "/opt/dssat"))
EXE = DSSAT_HOME / "dscsm048"
RUN_TIMEOUT = int(os.environ.get("RUN_TIMEOUT", "600"))

# Resultado esperado do experimento de referência com os commits fixados no Dockerfile.
# Datas: dias após o plantio (antese ADAP, maturidade MDAP); HWAM: produtividade de grãos (kg/ha).
# Obtido compilando o DSSAT-CSM 4.8.6.004 (commit 25c93b9) e rodando BRPI0202.MZX no modo A.
REFERENCE_EXPECTED = {
    1: {"ADAP": 53, "MDAP": 118, "HWAM": 4329},
    2: {"ADAP": 62, "MDAP": 140, "HWAM": 4358},
    3: {"ADAP": 60, "MDAP": 129, "HWAM": 4559},
    4: {"ADAP": 57, "MDAP": 128, "HWAM": 4878},
    5: {"ADAP": 53, "MDAP": 118, "HWAM": 5215},
    6: {"ADAP": 62, "MDAP": 140, "HWAM": 5859},
    7: {"ADAP": 60, "MDAP": 129, "HWAM": 5596},
    8: {"ADAP": 57, "MDAP": 128, "HWAM": 6149},
}
YIELD_TOLERANCE = 0.01  # 1 %: margem para diferenças de compilador/arquitetura


def log(msg: str) -> None:
    print(f"[dssat-runner] {msg}", flush=True)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------- Cloud Storage (importado só quando necessário) ----------
def _split(uri: str) -> tuple[str, str]:
    if not uri.startswith("gs://"):
        raise ValueError(f"URI inválida: {uri}")
    bucket, _, prefix = uri[5:].partition("/")
    return bucket, prefix.rstrip("/") + "/" if prefix else ""


def gcs_download(prefix_uri: str, dest: Path) -> list[str]:
    from google.cloud import storage

    bucket_name, prefix = _split(prefix_uri)
    client = storage.Client()
    names = []
    for blob in client.list_blobs(bucket_name, prefix=prefix):
        rel = blob.name[len(prefix):]
        if not rel or rel.endswith("/") or "/" in rel:
            continue  # só arquivos do nível do prefixo
        blob.download_to_filename(dest / rel)
        names.append(rel)
    return names


def gcs_upload(src: Path, prefix_uri: str) -> int:
    from google.cloud import storage

    bucket_name, prefix = _split(prefix_uri)
    bucket = storage.Client().bucket(bucket_name)
    n = 0
    for f in sorted(src.iterdir()):
        if f.is_file():
            bucket.blob(prefix + f.name).upload_from_filename(f)
            n += 1
    return n


# ---------- DSSAT ----------
def run_dssat(workdir: Path, filex: str) -> subprocess.CompletedProcess:
    if not EXE.exists():
        raise FileNotFoundError(f"executável não encontrado: {EXE}")
    t0 = time.monotonic()
    proc = subprocess.run(
        [str(EXE), "A", filex], cwd=workdir, capture_output=True, text=True, timeout=RUN_TIMEOUT
    )
    (workdir / "dssat_stdout.log").write_text(proc.stdout + "\n--- stderr ---\n" + proc.stderr)
    log(f"DSSAT terminou com código {proc.returncode} em {time.monotonic() - t0:.2f} s")
    return proc


def parse_summary(path: Path) -> list[dict]:
    """Lê Summary.OUT (largura fixa alinhada ao cabeçalho '@')."""
    rows, header = [], None
    for line in path.read_text(errors="replace").splitlines():
        if line.startswith("@"):
            header = [h.rstrip(".") for h in line[1:].split()]
            continue
        if header and line.strip() and line[0] == " ":
            vals = line.split()
            # TNAM (nome do tratamento) contém espaços; alinhar pelas colunas do fim
            n_tail = len(header) - header.index("FNAM")
            tail = dict(zip(header[-n_tail:], vals[-n_tail:]))
            head = dict(zip(header[:8], vals[:8]))  # até EXNAME
            rows.append({**head, **tail})
    return rows


def as_int(v: str) -> int | None:
    try:
        x = int(float(v))
        return None if x == -99 else x
    except (TypeError, ValueError):
        return None


def summarize(rows: list[dict]) -> list[dict]:
    out = []
    for r in rows:
        pdat, adat, mdat = (as_int(r.get(k)) for k in ("PDAT", "ADAT", "MDAT"))
        out.append({
            "treatment": as_int(r.get("TRNO")),
            "crop": r.get("CR"),
            "model": r.get("MODEL"),
            "planting_yyyyddd": pdat,
            "anthesis_yyyyddd": adat,
            "maturity_yyyyddd": mdat,
            "anthesis_dap": doy_diff(pdat, adat),
            "maturity_dap": doy_diff(pdat, mdat),
            "yield_kg_ha": as_int(r.get("HWAM")),
            "biomass_kg_ha": as_int(r.get("CWAM")),
            "rain_mm": as_int(r.get("PRCM")),
            "irrigation_mm": as_int(r.get("IRCM")),
            "et_mm": as_int(r.get("ETCM")),
        })
    return out


def doy_diff(a: int | None, b: int | None) -> int | None:
    if a is None or b is None:
        return None
    da = datetime.strptime(str(a), "%Y%j")
    db = datetime.strptime(str(b), "%Y%j")
    return (db - da).days


def check_reference(summary: list[dict]) -> list[str]:
    errors = []
    by_trt = {s["treatment"]: s for s in summary}
    for trt, exp in REFERENCE_EXPECTED.items():
        got = by_trt.get(trt)
        if not got:
            errors.append(f"tratamento {trt} ausente")
            continue
        if got["anthesis_dap"] != exp["ADAP"]:
            errors.append(f"trt {trt}: antese {got['anthesis_dap']} != {exp['ADAP']} DAP")
        if got["maturity_dap"] != exp["MDAP"]:
            errors.append(f"trt {trt}: maturidade {got['maturity_dap']} != {exp['MDAP']} DAP")
        y = got["yield_kg_ha"] or 0
        if abs(y - exp["HWAM"]) > YIELD_TOLERANCE * exp["HWAM"]:
            errors.append(f"trt {trt}: produtividade {y} fora de ±1% de {exp['HWAM']}")
    return errors


def metadata(workdir: Path, mode: str, filex: str, inputs: list[str], rc: int, summary: list[dict]) -> dict:
    build = {}
    info = DSSAT_HOME / "BUILD_INFO.json"
    if info.exists():
        build = json.loads(info.read_text())
    return {
        "finished_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mode": mode,
        "filex": filex,
        "return_code": rc,
        "image_git_commit": os.environ.get("GIT_COMMIT", "unknown"),
        "dssat_build": build,
        "inputs_sha256": {n: sha256(workdir / n) for n in inputs if (workdir / n).exists()},
        "summary": summary,
        "evidence": {
            "is_actual_forecast": False,
            "note": "Simulação DSSAT: válida apenas sob as entradas e hipóteses usadas; "
                    "sem calibração local não é previsão de produtividade da propriedade.",
        },
    }


def main() -> int:
    mode = os.environ.get("MODE", "reference")
    output_prefix = os.environ.get("OUTPUT_PREFIX", "").strip()
    with tempfile.TemporaryDirectory(prefix="dssat-") as tmp:
        work = Path(tmp)
        if mode == "reference":
            filex = "BRPI0202.MZX"
            inputs = []
            for f in (DSSAT_HOME / "reference").iterdir():
                shutil.copy(f, work / f.name)
                inputs.append(f.name)
        elif mode == "run":
            input_prefix = os.environ["INPUT_PREFIX"]
            filex = os.environ["FILEX"]
            if not output_prefix:
                raise SystemExit("OUTPUT_PREFIX é obrigatório no modo run")
            inputs = gcs_download(input_prefix, work)
            log(f"{len(inputs)} entradas baixadas de {input_prefix}")
            if filex not in inputs:
                raise SystemExit(f"FILEX {filex} não está em {input_prefix}")
        else:
            raise SystemExit(f"MODE desconhecido: {mode}")

        proc = run_dssat(work, filex)
        summary_file = work / "Summary.OUT"
        summary = summarize(parse_summary(summary_file)) if summary_file.exists() else []
        meta = metadata(work, mode, filex, inputs, proc.returncode, summary)

        errors = []
        if proc.returncode != 0 or not summary:
            errors.append("DSSAT não produziu Summary.OUT válido")
        if mode == "reference":
            errors += check_reference(summary)
        meta["checks"] = {"passed": not errors, "errors": errors}
        (work / "run_metadata.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
        print(json.dumps({"summary": summary, "checks": meta["checks"]}, ensure_ascii=False))

        if output_prefix:
            n = gcs_upload(work, output_prefix)
            log(f"{n} arquivos gravados em {output_prefix}")

        if errors:
            for e in errors:
                log(f"ERRO: {e}")
            return 1
        log("OK")
        return 0


if __name__ == "__main__":
    sys.exit(main())
