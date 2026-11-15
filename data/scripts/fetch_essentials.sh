#!/usr/bin/env bash
# Baixa os dados essenciais do DSSAT para o bucket privado do Field Shift.
# Rodar no Cloud Shell, na raiz do repositorio:  bash data/scripts/fetch_essentials.sh
#
# O que baixa:
#   1. DSSAT-CSM (codigo + biblioteca de cultivares .CUL/.ECO/.SPE) e dssat-csm-data
#      (experimentos de referencia, solos genericos), em commits fixos.
#   2. NASA POWER diario (comunidade AG) para cada ponto de data/points.csv,
#      em JSON (bruto) e ICASA (formato proximo do .WTH).
#   3. SoilGrids v2 (ISRIC) por ponto: textura, carbono, densidade, pH, CTC e agua retida.
#   4. manifest.json com origem, URL, data de acesso e sha256 de cada arquivo.
#
# Variaveis opcionais: BUCKET, START (AAAAMMDD), END (AAAAMMDD), POINTS (csv).
set -euo pipefail

PROJECT="fieldshift-harvest71-2026"
BUCKET="${BUCKET:-fieldshift-data-${PROJECT}}"
START="${START:-19910101}"
END="${END:-20251231}"
POINTS="${POINTS:-data/points.csv}"
DSSAT_OS_COMMIT="25c93b9a2f73f8ec45bf441b198dac5fb7b22849"
DSSAT_DATA_COMMIT="99c95b340acb9515c2d0a8ab582f5fbbf076f345"
POWER_PARAMS="ALLSKY_SFC_SW_DWN,T2M_MAX,T2M_MIN,PRECTOTCORR,T2M,T2MDEW,RH2M,WS2M"
SOIL_PROPS="clay sand silt soc bdod phh2o cec nitrogen wv0010 wv0033 wv1500"

WORK="$(mktemp -d)"
OUT="$WORK/out"
mkdir -p "$OUT"/{dssat,nasa-power,soilgrids}
ACCESSED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Bucket: gs://$BUCKET | periodo $START-$END | trabalho em $WORK"

gcloud storage buckets describe "gs://$BUCKET" --format='value(name)' >/dev/null

fetch() {  # fetch URL DESTINO
  curl -fsS --retry 5 --retry-delay 10 --retry-all-errors -m 300 -o "$2" "$1"
}

# ---------- 1. DSSAT ----------
clone_at() {  # clone_at REPO COMMIT DIR
  git init -q "$3"
  git -C "$3" fetch -q --depth 1 "https://github.com/DSSAT/$1" "$2"
  git -C "$3" checkout -q FETCH_HEAD
}
echo "[1/3] DSSAT"
clone_at dssat-csm-os   "$DSSAT_OS_COMMIT"   "$WORK/dssat-csm-os"
clone_at dssat-csm-data "$DSSAT_DATA_COMMIT" "$WORK/dssat-csm-data"
tar -czf "$OUT/dssat/dssat-csm-os-${DSSAT_OS_COMMIT:0:7}.tar.gz"     -C "$WORK" --exclude=.git dssat-csm-os
tar -czf "$OUT/dssat/dssat-csm-data-${DSSAT_DATA_COMMIT:0:7}.tar.gz" -C "$WORK" --exclude=.git dssat-csm-data
mkdir -p "$OUT/dssat/genotype" "$OUT/dssat/soil"
cp "$WORK"/dssat-csm-os/Data/Genotype/* "$OUT/dssat/genotype/"
cp "$WORK"/dssat-csm-data/Soil/*        "$OUT/dssat/soil/" 2>/dev/null || true
cp "$WORK"/dssat-csm-os/license.txt     "$OUT/dssat/LICENSE-dssat-csm-os.txt"

# ---------- 2 e 3. NASA POWER + SoilGrids por ponto ----------
tail -n +2 "$POINTS" | while IFS=, read -r id name lat lon note; do
  [ -z "$id" ] && continue
  echo "[2/3] NASA POWER  $id ($name)"
  base="https://power.larc.nasa.gov/api/temporal/daily/point?parameters=$POWER_PARAMS&community=AG&latitude=$lat&longitude=$lon&start=$START&end=$END&time-standard=LST"
  fetch "$base&format=JSON"  "$OUT/nasa-power/${id}_${START}_${END}.json"
  fetch "$base&format=ICASA" "$OUT/nasa-power/${id}_${START}_${END}.icasa.txt"
  sleep ${SLEEP_PW:-2}

  echo "[3/3] SoilGrids   $id ($name)"
  q="https://rest.isric.org/soilgrids/v2.0/properties/query?lon=$lon&lat=$lat"
  for p in $SOIL_PROPS; do q="$q&property=$p"; done
  for d in 0-5cm 5-15cm 15-30cm 30-60cm 60-100cm 100-200cm; do q="$q&depth=$d"; done
  q="$q&value=mean&value=Q0.05&value=Q0.95&value=uncertainty"
  fetch "$q" "$OUT/soilgrids/${id}.json" || echo "  aviso: SoilGrids falhou para $id (rode de novo depois)"
  sleep ${SLEEP_SG:-13}   # limite publico do SoilGrids: ~5 consultas/min
done

# ---------- 4. Manifesto de proveniencia ----------
python3 - "$OUT" "$POINTS" "$ACCESSED" "$START" "$END" "$DSSAT_OS_COMMIT" "$DSSAT_DATA_COMMIT" "$POWER_PARAMS" <<'PY'
import csv, hashlib, json, os, sys
out, points, accessed, start, end, os_c, data_c, params = sys.argv[1:]
files = []
for root, _, names in os.walk(out):
    for n in sorted(names):
        p = os.path.join(root, n)
        files.append({"path": os.path.relpath(p, out), "bytes": os.path.getsize(p),
                      "sha256": hashlib.sha256(open(p, "rb").read()).hexdigest()})
manifest = {
    "accessed_utc": accessed,
    "points": list(csv.DictReader(open(points))),
    "sources": {
        "nasa_power": {"provider": "NASA LaRC POWER", "api": "temporal/daily/point",
                       "community": "AG", "parameters": params.split(","), "start": start, "end": end,
                       "time_standard": "LST", "docs": "https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
                       "nature": "dado em grade/modelado (~0.5 x 0.625 graus), nao medicao na propriedade"},
        "soilgrids": {"provider": "ISRIC - World Soil Information", "version": "v2.0",
                      "docs": "https://www.isric.org/explore/soilgrids", "resolution": "~250 m",
                      "nature": "estimativa global por aprendizado de maquina; nao substitui analise local; nao fornece P/K disponiveis"},
        "dssat": {"repos": {"dssat-csm-os": os_c, "dssat-csm-data": data_c},
                  "license": "BSD-3-Clause (DSSAT Foundation)",
                  "provenance_audit": "pendente (ver docs de contexto, secao 10.3)"},
    },
    "files": files,
}
json.dump(manifest, open(os.path.join(out, "manifest.json"), "w"), indent=2, ensure_ascii=False)
print(f"manifest: {len(files)} arquivos")
PY

DEST="gs://$BUCKET/raw/$(date -u +%Y%m%d)"
gcloud storage cp -r "$OUT"/* "$DEST/"
echo
echo "Pronto: $DEST"
gcloud storage du -s "$DEST"
