#!/usr/bin/env bash
# Habilita as simulações sob demanda da API. Rode UMA vez no Cloud Shell (conta dona do projeto).
# Idempotente. NÃO imprime a chave.
#
# Faz:
#   1. Secret Manager com a chave de API (gerada aleatoriamente se ainda não existir)
#   2. fieldshift-api-sa pode ler SÓ esse segredo
#   3. fieldshift-api-sa pode executar SÓ o Job fieldshift-dssat com variáveis próprias
#      (papel no RECURSO do Job, não no projeto)
#   4. liga o segredo ao serviço fieldshift-api como variável API_KEYS
#      (os próximos deploys do CI preservam essa ligação)
set -euo pipefail
PROJECT_ID="${PROJECT_ID:-fieldshift-harvest71-2026}"
REGION="${REGION:-us-central1}"
SECRET="${SECRET:-fieldshift-api-keys}"
API_SA="fieldshift-api-sa@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud services enable secretmanager.googleapis.com --project="$PROJECT_ID"

if ! gcloud secrets describe "$SECRET" --project="$PROJECT_ID" >/dev/null 2>&1; then
  openssl rand -hex 24 | tr -d '\n' | gcloud secrets create "$SECRET" --project="$PROJECT_ID" \
    --replication-policy=automatic --data-file=- >/dev/null
  echo "Segredo $SECRET criado com uma chave aleatória."
else
  echo "Segredo $SECRET já existe (mantido)."
fi

gcloud secrets add-iam-policy-binding "$SECRET" --project="$PROJECT_ID" \
  --member="serviceAccount:$API_SA" --role=roles/secretmanager.secretAccessor >/dev/null
gcloud run jobs add-iam-policy-binding fieldshift-dssat --project="$PROJECT_ID" --region="$REGION" \
  --member="serviceAccount:$API_SA" --role=roles/run.jobsExecutorWithOverrides >/dev/null
gcloud run services update fieldshift-api --project="$PROJECT_ID" --region="$REGION" \
  --update-secrets="API_KEYS=${SECRET}:latest" --quiet >/dev/null

echo "Pronto. API com simulações habilitadas."
echo "Para ver a chave (entregue aos devs por canal privado, nunca no GitHub):"
echo "  gcloud secrets versions access latest --secret=$SECRET --project=$PROJECT_ID"
echo "Para trocar a chave: gere outra versão e reimplante:"
echo "  openssl rand -hex 24 | tr -d '\\n' | gcloud secrets versions add $SECRET --data-file=-"
echo "  gcloud run services update fieldshift-api --region=$REGION --update-secrets=API_KEYS=${SECRET}:latest"
