#!/usr/bin/env bash
# Habilita o GitHub Actions a gravar dados brutos no bucket, SEM chave JSON.
# Rode UMA vez, no Cloud Shell, por um administrador do projeto. É idempotente.
# Reaproveita o pool/provedor OIDC criado por setup-wif.sh (restrito a este repo e à main).
#
# Cria:
#   - conta de serviço fieldshift-ingest-sa (só coleta de dados; separada do deploy e da API)
# Concede (menor privilégio):
#   - storage.objectCreator + storage.objectViewer, só no bucket de dados
#   - workloadIdentityUser na conta de coleta, só para este repositório
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-fieldshift-harvest71-2026}"
BUCKET="${BUCKET:-fieldshift-data-${PROJECT_ID}}"
GITHUB_REPO="${GITHUB_REPO:-yasminqjs/Harvest71-Nasa-Apps-Challenge}"
POOL="${POOL:-github}"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
INGEST_SA="fieldshift-ingest-sa@${PROJECT_ID}.iam.gserviceaccount.com"

echo "== Conta de serviço de coleta"
gcloud iam service-accounts describe "$INGEST_SA" --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud iam service-accounts create fieldshift-ingest-sa \
    --project="$PROJECT_ID" --display-name="Field Shift coleta de dados (GitHub Actions)"

echo "== Permissões no bucket gs://$BUCKET (só nele)"
for role in roles/storage.objectCreator roles/storage.objectViewer; do
  gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
    --member="serviceAccount:${INGEST_SA}" --role="$role" >/dev/null
done

echo "== GitHub Actions pode assumir a conta de coleta"
gcloud iam service-accounts add-iam-policy-binding "$INGEST_SA" \
  --project="$PROJECT_ID" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${GITHUB_REPO}" \
  --role="roles/iam.workloadIdentityUser" >/dev/null

echo
echo "Pronto. Conta de coleta: $INGEST_SA"
