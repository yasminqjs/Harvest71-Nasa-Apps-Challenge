#!/usr/bin/env bash
# Baixa os dados essenciais do DSSAT para o bucket privado do Field Shift.
# Roda no GitHub Actions (workflow ingest-data) ou no Cloud Shell:  bash data/scripts/fetch_essentials.sh
#
# Otimizado:
#   - INCREMENTAL: caminhos estaveis no bucket; o que ja existe nao e baixado de novo.
#   - PARALELO: NASA POWER dos pontos em paralelo; SoilGrids em paralelo.
#   - SoilGrids lido direto dos mapas (GDAL /vsicurl nos VRT do ISRIC), sem a API REST
#     (lenta e limitada a ~5 consultas/min). A API REST so e usada se o GDAL falhar.
#
# Layout no bucket (gs://$BUCKET/raw/...):
#   dssat/<commit>/...                     codigo, cultivares, experimentos (por commit)
#   nasa-power/<START>_<END>/<ID>.json     + <ID>.icasa.txt
#   soilgrids/v2/<ID>.csv                  propriedade,profundidade,estatistica,valor
#   manifests/<data-hora>.json             proveniencia + sha256 do que esta execucao gravou
#
# Variaveis opcionais: BUCKET, START, END, POINTS, JOBS (paralelismo), FORCE=1 (rebaixar tudo).
set -euo pipefail

PROJECT="fieldshift-harvest71-2026"
BUCKET="${BUCKET:-fieldshift-data-${PROJECT}}"
START="${START:-19910101}"
END="${END:-20251231}"
POINTS="${POINTS:-data/points.csv}"
JOBS="${JOBS:-16}"
FORCE="${FORCE:-0}"
DSSAT_OS_COMMIT="25c93b9a2f73f8ec45bf441b198dac5fb7b22849"
DSSAT_DATA_COMMIT="99c95b340acb9515c2d0a8ab582f5fbbf076f345"
POWER_PARAMS="ALLSKY_SFC_SW_DWN,T2M_MAX,T2M_MIN,PRECTOTCORR,T2M,T2MDEW,RH2M,WS2M"
SOIL_PROPS="clay sand silt soc bdod phh2o cec nitrogen wv0010 wv0033 wv1500"
SOIL_DEPTHS="0-5cm 5-15cm 15-30cm 30-60cm 60-100cm 100-200cm"
SOIL_STATS="mean Q0.05 Q0.95"
SG_URL="https://files.isric.org/soilgrids/latest/data"

RAW="gs://$BUCKET/raw"
WORK="$(mktemp -d)"
OUT="$WORK/out"            # espelha raw/ ; so contem o que e novo nesta execucao
mkdir -p "$OUT"
ACCESSED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
T0=$SECONDS
echo "Bucket: $RAW | periodo $START-$END | paralelismo $JOBS"

# Inventario do que ja existe (uma listagem so) -> decide o que pular
gcloud storage ls -r "$RAW/**" 2>/dev/null | sed "s#^$RAW/##" > "$WORK/existing.txt" || true
have() { [ "$FORCE" != 1 ] && grep -qxF "$1" "$WORK/existing.txt"; }

fetch() {  # fetch URL DESTINO
  mkdir -p "$(dirname "$2")"
  curl -fsS --retry 4 --retry-delay 5 --retry-all-errors -m 300 -o "$2" "$1"
}
export -f fetch

# ---------- 1. DSSAT (pula se o commit ja esta no bucket) ----------
OS7="${DSSAT_OS_COMMIT:0:7}"; DATA7="${DSSAT_DATA_COMMIT:0:7}"
if have "dssat/$OS7/dssat-csm-os.tar.gz" && have "dssat/$DATA7/dssat-csm-data.tar.gz"; then
  echo "[1/3] DSSAT: ja no bucket ($OS7, $DATA7)"
else
  echo "[1/3] DSSAT: baixando"
  clone_at() { git init -q "$3"; git -C "$3" fetch -q --depth 1 "https://github.com/DSSAT/$1" "$2"; git -C "$3" checkout -q FETCH_HEAD; }
  clone_at dssat-csm-os   "$DSSAT_OS_COMMIT"   "$WORK/dssat-csm-os" &
  clone_at dssat-csm-data "$DSSAT_DATA_COMMIT" "$WORK/dssat-csm-data" &
  wait
  mkdir -p "$OUT/dssat/$OS7/genotype" "$OUT/dssat/$DATA7/soil"
  tar -czf "$OUT/dssat/$OS7/dssat-csm-os.tar.gz"     -C "$WORK" --exclude=.git dssat-csm-os
  tar -czf "$OUT/dssat/$DATA7/dssat-csm-data.tar.gz" -C "$WORK" --exclude=.git dssat-csm-data
  cp "$WORK"/dssat-csm-os/Data/Genotype/* "$OUT/dssat/$OS7/genotype/"
  cp "$WORK"/dssat-csm-data/Soil/*        "$OUT/dssat/$DATA7/soil/" 2>/dev/null || true
  cp "$WORK"/dssat-csm-os/license.txt     "$OUT/dssat/$OS7/LICENSE.txt"
fi

# ---------- 2. NASA POWER (pontos em paralelo) ----------
echo "[2/3] NASA POWER"
tail -n +2 "$POINTS" | { while IFS=, read -r id name lat lon note; do
  [ -z "$id" ] && continue
  rel="nasa-power/${START}_${END}/$id"
  if have "$rel.json" && have "$rel.icasa.txt"; then echo "  $id: ja no bucket"; continue; fi
  base="https://power.larc.nasa.gov/api/temporal/daily/point?parameters=$POWER_PARAMS&community=AG&latitude=$lat&longitude=$lon&start=$START&end=$END&time-standard=LST"
  ( fetch "$base&format=JSON"  "$OUT/$rel.json" && fetch "$base&format=ICASA" "$OUT/$rel.icasa.txt" \
      && echo "  $id: ok" ) || echo "  aviso: NASA POWER falhou para $id" &
done; wait; }   # espera todos os downloads dentro do mesmo subshell do pipe

# ---------- 3. SoilGrids (GDAL direto nos mapas, em paralelo) ----------
echo "[3/3] SoilGrids"
command -v gdallocationinfo >/dev/null || { echo "  instalando GDAL"; (sudo apt-get -qq update && sudo apt-get -qq install -y gdal-bin) >/dev/null; }
export GDAL_HTTP_MAX_RETRY=4 GDAL_HTTP_RETRY_DELAY=2 GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR \
       CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".vrt,.tif,.ovr" VSI_CACHE=TRUE GDAL_HTTP_TIMEOUT=60

# Cada mapa (propriedade x profundidade x estatistica) e aberto UMA vez e lido para
# todos os pontos de uma vez (coordenadas pela entrada padrao do gdallocationinfo).
sg_layer() {  # sg_layer PROP DEPTH STAT  -> linhas "ID,PROP,DEPTH,STAT,VALOR"
  local p=$1 d=$2 s=$3 name vals=""
  # o nome do quantil varia entre "Q0.05" e "Q05" nos arquivos do ISRIC: tenta os dois
  for name in "${p}_${d}_${s}" "${p}_${d}_${s/0./}"; do
    vals="$(timeout 300 gdallocationinfo -valonly -wgs84 "/vsicurl/$SG_URL/$p/$name.vrt" < "$SG_LL" 2>/dev/null || true)"
    [ -n "$(echo "$vals" | tr -d '[:space:]')" ] && break
  done
  paste -d, "$SG_IDS" <(printf '%s\n' "$vals" | head -n "$(wc -l < "$SG_IDS")") \
    | awk -F, -v p="$p" -v d="$d" -v s="$s" 'NF>=1 && $1!="" {print $1","p","d","s","$2}'
}
export -f sg_layer; export SG_URL

# Pontos que ainda nao tem solo no bucket
: > "$WORK/sg_ids.txt"; : > "$WORK/sg_ll.txt"
tail -n +2 "$POINTS" | while IFS=, read -r id name lat lon note; do
  [ -z "$id" ] && continue
  if have "soilgrids/v2/$id.csv"; then echo "  $id: ja no bucket" >&2; continue; fi
  echo "$id" >> "$WORK/sg_ids.txt"; echo "$lon $lat" >> "$WORK/sg_ll.txt"
done
export SG_IDS="$WORK/sg_ids.txt" SG_LL="$WORK/sg_ll.txt"

: > "$WORK/sg_tasks.txt"
if [ -s "$SG_IDS" ]; then
  for p in $SOIL_PROPS; do for d in $SOIL_DEPTHS; do for s in $SOIL_STATS; do
    echo "$p $d $s"
  done; done; done > "$WORK/sg_tasks.txt"
fi

if [ -s "$WORK/sg_tasks.txt" ]; then
  echo "  $(wc -l < "$SG_IDS") pontos x $(wc -l < "$WORK/sg_tasks.txt") mapas"
  xargs -P "$JOBS" -L 1 bash -c 'sg_layer "$@"' _ < "$WORK/sg_tasks.txt" > "$WORK/sg_values.csv"
  mkdir -p "$OUT/soilgrids/v2"
  for id in $(cut -d, -f1 "$WORK/sg_values.csv" | sort -u); do
    f="$OUT/soilgrids/v2/$id.csv"
    echo "propriedade,profundidade,estatistica,valor" > "$f"
    grep "^$id," "$WORK/sg_values.csv" | cut -d, -f2- | sort >> "$f"
    total=$(($(wc -l < "$f") - 1)); vazios=$(grep -c ',$' "$f" || true)
    echo "  $id: $((total - vazios))/$total valores"
    # Reserva: propriedades que o GDAL nao leu vao pela API REST (uma consulta por propriedade)
    if [ "$vazios" -gt 0 ]; then
      read -r lat lon < <(awk -F, -v k="$id" '$1==k{print $3, $4}' "$POINTS")
      for p in $(grep ',$' "$f" | cut -d, -f1 | sort -u); do
        q="https://rest.isric.org/soilgrids/v2.0/properties/query?lon=$lon&lat=$lat&property=$p&value=mean&value=Q0.05&value=Q0.95"
        for d in $SOIL_DEPTHS; do q="$q&depth=$d"; done
        curl -fsS --retry 2 --retry-delay 15 --retry-all-errors -m 90 -o "$OUT/soilgrids/v2/${id}_rest_$p.json" "$q" \
          && echo "    $p: via API REST" || { rm -f "$OUT/soilgrids/v2/${id}_rest_$p.json"; echo "    aviso: $p sem dados"; }
      done
    fi
  done
fi

# ---------- Manifesto + envio (so o que e novo) ----------
if [ -z "$(find "$OUT" -type f | head -1)" ]; then
  echo; echo "Nada novo: tudo ja estava no bucket. ($((SECONDS - T0)) s)"; exit 0
fi

python3 - "$OUT" "$POINTS" "$ACCESSED" "$START" "$END" "$DSSAT_OS_COMMIT" "$DSSAT_DATA_COMMIT" "$POWER_PARAMS" "$STAMP" <<'PY'
import csv, hashlib, json, os, sys
out, points, accessed, start, end, os_c, data_c, params, stamp = sys.argv[1:]
files = []
for root, _, names in os.walk(out):
    for n in sorted(names):
        p = os.path.join(root, n)
        h = hashlib.sha256()
        with open(p, "rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""):
                h.update(chunk)
        files.append({"path": os.path.relpath(p, out), "bytes": os.path.getsize(p), "sha256": h.hexdigest()})
manifest = {
    "accessed_utc": accessed,
    "points": list(csv.DictReader(open(points))),
    "sources": {
        "nasa_power": {"provider": "NASA LaRC POWER", "api": "temporal/daily/point", "community": "AG",
                       "parameters": params.split(","), "start": start, "end": end, "time_standard": "LST",
                       "docs": "https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
                       "nature": "dado em grade/modelado, nao medicao na propriedade"},
        "soilgrids": {"provider": "ISRIC - World Soil Information", "version": "v2.0", "license": "CC BY 4.0",
                      "access": "GDAL /vsicurl em https://files.isric.org/soilgrids/latest/data/ (reserva: API REST)",
                      "units": "unidades mapeadas do SoilGrids (inteiros escalonados; converter conforme a documentacao do ISRIC)",
                      "docs": "https://docs.isric.org/globaldata/soilgrids/",
                      "nature": "estimativa ~250 m; nao substitui analise local; nao fornece P/K disponiveis"},
        "dssat": {"repos": {"dssat-csm-os": os_c, "dssat-csm-data": data_c},
                  "license": "BSD-3-Clause (DSSAT Foundation)", "provenance_audit": "pendente"},
    },
    "files_written_this_run": files,
}
os.makedirs(os.path.join(out, "manifests"), exist_ok=True)
json.dump(manifest, open(os.path.join(out, "manifests", f"{stamp}.json"), "w"), indent=2, ensure_ascii=False)
print(f"manifest: {len(files)} arquivos novos")
PY

gcloud storage cp -r "$OUT"/* "$RAW/"
echo
echo "Pronto em $((SECONDS - T0)) s: $RAW"
gcloud storage du -s "$RAW"
