#!/usr/bin/env bash
# Baixa os dados essenciais para o bucket privado do Field Shift.
# Roda no GitHub Actions (workflow ingest-data) ou no Cloud Shell:  bash data/scripts/fetch_essentials.sh
#
# Fontes (política da equipe: nenhum dado de origem chinesa):
#   - CLIMA: NASA POWER (NASA Langley), diário, comunidade AG.
#   - SOLO:  PronaSolos (Embrapa / Serviço Geológico do Brasil), atributos a 90 m, 6 profundidades.
#   O DSSAT NÃO é copiado para o bucket: a imagem do Job é compilada de commits fixos e só leva
#   os arquivos de milho e o experimento de referência brasileiro.
#
# Incremental: o que já existe no bucket não é baixado de novo. Paralelo por ponto.
#
# Layout (gs://$BUCKET/raw/...):
#   nasa-power/<START>_<END>/<ID>.json  + <ID>.icasa.txt
#   pronasolos/v1/<ID>.csv              propriedade,profundidade,valor (unidades do PronaSolos)
#   pronasolos/v1/<ID>.json             resposta bruta do serviço
#   manifests/<data-hora>.json          proveniência + sha256 do que esta execução gravou
#
# Variáveis opcionais: BUCKET, START, END, POINTS, FORCE=1 (rebaixar tudo).
set -euo pipefail

PROJECT="fieldshift-harvest71-2026"
BUCKET="${BUCKET:-fieldshift-data-${PROJECT}}"
START="${START:-19910101}"
END="${END:-20251231}"
POINTS="${POINTS:-data/points.csv}"
FORCE="${FORCE:-0}"
POWER_PARAMS="ALLSKY_SFC_SW_DWN,T2M_MAX,T2M_MIN,PRECTOTCORR,T2M,T2MDEW,RH2M,WS2M"
PS_URL="https://geoportal.sgb.gov.br/server/rest/services/pronasolos/atributos_solo_90m/MapServer"

RAW="gs://$BUCKET/raw"
WORK="$(mktemp -d)"
OUT="$WORK/out"            # espelha raw/ ; só contém o que é novo nesta execução
mkdir -p "$OUT"
ACCESSED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
T0=$SECONDS
echo "Bucket: $RAW | período $START-$END"

gcloud storage ls -r "$RAW/**" 2>/dev/null | sed "s#^$RAW/##" > "$WORK/existing.txt" || true
have() { [ "$FORCE" != 1 ] && grep -qxF "$1" "$WORK/existing.txt"; }

fetch() {  # fetch URL DESTINO
  mkdir -p "$(dirname "$2")"
  curl -fsS --retry 4 --retry-delay 5 --retry-all-errors -m 300 -o "$2" "$1"
}

# ---------- 1. NASA POWER ----------
echo "[1/2] NASA POWER"
tail -n +2 "$POINTS" | { while IFS=, read -r id name lat lon note; do
  [ -z "$id" ] && continue
  rel="nasa-power/${START}_${END}/$id"
  if have "$rel.json" && have "$rel.icasa.txt"; then echo "  $id: já no bucket"; continue; fi
  base="https://power.larc.nasa.gov/api/temporal/daily/point?parameters=$POWER_PARAMS&community=AG&latitude=$lat&longitude=$lon&start=$START&end=$END&time-standard=LST"
  ( fetch "$base&format=JSON"  "$OUT/$rel.json" && fetch "$base&format=ICASA" "$OUT/$rel.icasa.txt" \
      && echo "  $id: ok" ) || echo "  aviso: NASA POWER falhou para $id" &
done; wait; }

# ---------- 2. PronaSolos (uma consulta por ponto devolve todas as camadas) ----------
echo "[2/2] PronaSolos"
tail -n +2 "$POINTS" | { while IFS=, read -r id name lat lon note; do
  [ -z "$id" ] && continue
  rel="pronasolos/v1/$id"
  if have "$rel.csv"; then echo "  $id: já no bucket"; continue; fi
  (
    ext="$(python3 -c "print(f'{$lon-0.5},{$lat-0.5},{$lon+0.5},{$lat+0.5}')")"
    q="identify?geometry=$lon,$lat&geometryType=esriGeometryPoint&sr=4326&layers=all&tolerance=0"
    q="$q&mapExtent=$ext&imageDisplay=400,400,96&returnGeometry=false&f=json"
    fetch "$PS_URL/$q" "$OUT/$rel.json" \
      && python3 - "$OUT/$rel.json" "$OUT/$rel.csv" <<'PY' && echo "  $id: ok" || echo "  aviso: PronaSolos falhou para $id"
import json, sys
# Camadas do serviço atributos_solo_90m (grupo -> propriedade); subcamadas na ordem das profundidades
GROUPS = {1: "estoque_c_mg_ha", 8: "carbono_organico_g_kg", 15: "areia_g_kg", 22: "argila_g_kg",
          29: "silte_g_kg", 36: "ctc_cmolc_kg", 43: "ph_agua", 50: "ce_ds_m"}
DEPTHS = ["0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm", "100-200cm"]
LAYER = {g + 1 + i: (p, d) for g, p in GROUPS.items() for i, d in enumerate(DEPTHS)}
doc = json.load(open(sys.argv[1]))
if "error" in doc:
    raise SystemExit(f"erro do serviço: {doc['error']}")
rows = []
for r in doc.get("results", []):
    key = LAYER.get(r.get("layerId"))
    if not key:
        continue
    val = next((v for k, v in r.get("attributes", {}).items() if k.endswith("Pixel Value")), None)
    try:
        x = float(val)
    except (TypeError, ValueError):
        continue  # NoData
    rows.append(f"{key[0]},{key[1]},{x:g}")
if not rows:
    raise SystemExit("sem valores (ponto fora da cobertura?)")
with open(sys.argv[2], "w") as fh:
    fh.write("propriedade,profundidade,valor\n" + "\n".join(sorted(rows)) + "\n")
PY
  ) &
done; wait; }

# ---------- Manifesto + envio (só o que é novo) ----------
if [ -z "$(find "$OUT" -type f | head -1)" ]; then
  echo; echo "Nada novo: tudo já estava no bucket. ($((SECONDS - T0)) s)"; exit 0
fi

python3 - "$OUT" "$POINTS" "$ACCESSED" "$START" "$END" "$POWER_PARAMS" "$STAMP" <<'PY'
import csv, hashlib, json, os, sys
out, points, accessed, start, end, params, stamp = sys.argv[1:]
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
        "nasa_power": {"provider": "NASA Langley Research Center - POWER", "api": "temporal/daily/point",
                       "community": "AG", "parameters": params.split(","), "start": start, "end": end,
                       "time_standard": "LST", "docs": "https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
                       "nature": "dado em grade/modelado, não medição na propriedade"},
        "pronasolos": {"provider": "PronaSolos - Embrapa / Serviço Geológico do Brasil (SGB)",
                       "service": "https://geoportal.sgb.gov.br/server/rest/services/pronasolos/atributos_solo_90m/MapServer",
                       "resolution": "90 m", "depths": "0-5, 5-15, 15-30, 30-60, 60-100, 100-200 cm",
                       "nature": "mapa estimado (mapeamento digital); não substitui análise local; sem P/K disponíveis"},
    },
    "excluded_by_team_policy": "fontes, autores ou dados de origem chinesa (ver Contexto_Field_Shift_Desafio_Geral, seção 0.1)",
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
