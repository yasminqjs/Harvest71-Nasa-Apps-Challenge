#!/usr/bin/env bash
# Auditoria SOMENTE LEITURA dos recursos GCP do Field Shift.
# Rode no Cloud Shell ou numa máquina com `gcloud auth login` feito (login individual).
# Não cria, altera nem apaga nada. Não imprima nem cole IDs de faturamento em issues públicas.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-fieldshift-harvest71-2026}"
REGION="${REGION:-us-central1}"
BUCKET="${BUCKET:-fieldshift-data-fieldshift-harvest71-2026}"

gcloud config set project "$PROJECT_ID" >/dev/null
echo "== Projeto ativo: $(gcloud config get-value project 2>/dev/null)"

echo; echo "== APIs habilitadas"
gcloud services list --enabled --format='value(config.name)' | sort

echo; echo "== Artifact Registry ($REGION)"
gcloud artifacts repositories list --location="$REGION"

echo; echo "== Bucket"
gcloud storage buckets describe "gs://$BUCKET" \
  --format='yaml(name,location,storageClass,iamConfiguration)'

echo; echo "== IAM do bucket"
gcloud storage buckets get-iam-policy "gs://$BUCKET" --format='yaml(bindings)'

echo; echo "== Contas de serviço"
gcloud iam service-accounts list --format='table(displayName,email,disabled)'

echo; echo "== Chaves das contas de serviço (esperado: nenhuma de usuário)"
for sa in $(gcloud iam service-accounts list --format='value(email)' | grep '^fieldshift-'); do
  echo "-- $sa"
  gcloud iam service-accounts keys list --iam-account="$sa" --managed-by=user
done

echo; echo "== Cloud Run services"
gcloud run services list --region="$REGION"

echo; echo "== Cloud Run jobs"
gcloud run jobs list --region="$REGION"

echo; echo "== Compute Engine (esperado: API desabilitada = nenhuma VM)"
# Não use `gcloud compute instances list` aqui: com a API desligada ele pergunta se quer ativá-la.
if gcloud services list --enabled --filter='config.name=compute.googleapis.com' --format='value(config.name)' | grep -q compute; then
  gcloud compute instances list --quiet
else
  echo "compute.googleapis.com desabilitada — nenhuma VM possível"
fi
