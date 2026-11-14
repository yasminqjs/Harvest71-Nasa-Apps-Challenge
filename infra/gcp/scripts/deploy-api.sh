#!/usr/bin/env bash
# Build + deploy da fieldshift-api no Cloud Run.
# Uso:   infra/gcp/scripts/deploy-api.sh            -> serviço PRIVADO (exige identidade)
#        infra/gcp/scripts/deploy-api.sh --public   -> público (apenas /health e /version existem)
# Rode a partir da raiz do repositório, no Cloud Shell ou com gcloud autenticado individualmente.
# Sem chaves JSON. Min instâncias 0, máx 2, cobrança por solicitação.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-fieldshift-harvest71-2026}"
REGION="${REGION:-us-central1}"
REPO="${REPO:-fieldshift}"
SERVICE="${SERVICE:-fieldshift-api}"
SA="fieldshift-api-sa@${PROJECT_ID}.iam.gserviceaccount.com"

AUTH_FLAG="--no-allow-unauthenticated"
if [[ "${1:-}" == "--public" ]]; then
  AUTH_FLAG="--allow-unauthenticated"
  echo "ATENÇÃO: serviço público. Só aceitável enquanto a API tiver apenas /health e /version."
fi

COMMIT="$(git rev-parse --short HEAD)"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Há alterações não commitadas; commite antes de implantar para a imagem ser rastreável." >&2
  exit 1
fi
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/fieldshift-api:${COMMIT}"

echo "== Build ${IMAGE}"
# `builds submit --tag` não aceita build-arg; usa-se config inline para injetar o commit.
CB_FILE="$(mktemp)"
trap 'rm -f "$CB_FILE"' EXIT
cat > "$CB_FILE" <<EOF
steps:
- name: gcr.io/cloud-builders/docker
  args: ['build','--build-arg','GIT_COMMIT=${COMMIT}','-t','${IMAGE}','.']
images: ['${IMAGE}']
EOF
gcloud builds submit apps/api \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --config="$CB_FILE"

echo "== Deploy ${SERVICE}"
gcloud run deploy "$SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --image="$IMAGE" \
  --service-account="$SA" \
  --cpu=1 --memory=512Mi \
  --concurrency=10 \
  --min-instances=0 --max-instances=2 \
  --cpu-throttling \
  --timeout=60 \
  --port=8080 \
  "$AUTH_FLAG"

echo "== Resultado"
gcloud run services describe "$SERVICE" --project="$PROJECT_ID" --region="$REGION" \
  --format='value(status.url,status.latestReadyRevisionName)'
echo "Registre URL, revisão e commit ${COMMIT} em docs/operations/STATUS.md"
