#!/usr/bin/env bash
# Configura o deploy automático via GitHub Actions SEM chave JSON (Workload Identity Federation).
# Rode UMA vez, no Cloud Shell, por um administrador do projeto. É idempotente (pode repetir).
#
# Cria:
#   - conta de serviço de deploy  fieldshift-deploy-sa  (identidade só do CI, separada das de execução)
#   - pool/provedor OIDC do GitHub, restrito a ESTE repositório e à branch main
# Concede (menor privilégio possível):
#   - artifactregistry.writer   só no repositório `fieldshift`
#   - run.developer             no projeto (criar/atualizar revisões do Cloud Run; NÃO altera IAM do serviço)
#   - iam.serviceAccountUser    só em fieldshift-api-sa (para implantar o serviço com essa identidade)
#   - workloadIdentityUser      na conta de deploy, só para o repositório/branch acima
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-fieldshift-harvest71-2026}"
REGION="${REGION:-us-central1}"
REPO="${REPO:-fieldshift}"
GITHUB_REPO="${GITHUB_REPO:-yasminqjs/Harvest71-Nasa-Apps-Challenge}"
BRANCH="${BRANCH:-main}"
POOL="${POOL:-github}"
PROVIDER="${PROVIDER:-github-oidc}"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
DEPLOY_SA="fieldshift-deploy-sa@${PROJECT_ID}.iam.gserviceaccount.com"
API_SA="fieldshift-api-sa@${PROJECT_ID}.iam.gserviceaccount.com"

echo "== APIs necessárias (sem custo)"
gcloud services enable sts.googleapis.com iamcredentials.googleapis.com iam.googleapis.com \
  --project="$PROJECT_ID"

echo "== Conta de serviço de deploy"
gcloud iam service-accounts describe "$DEPLOY_SA" --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud iam service-accounts create fieldshift-deploy-sa \
    --project="$PROJECT_ID" --display-name="Field Shift CI deploy (GitHub Actions)"

echo "== Pool e provedor OIDC do GitHub"
gcloud iam workload-identity-pools describe "$POOL" --project="$PROJECT_ID" --location=global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create "$POOL" \
    --project="$PROJECT_ID" --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers describe "$PROVIDER" \
  --project="$PROJECT_ID" --location=global --workload-identity-pool="$POOL" >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --project="$PROJECT_ID" --location=global --workload-identity-pool="$POOL" \
    --display-name="GitHub OIDC" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository=='${GITHUB_REPO}' && assertion.ref=='refs/heads/${BRANCH}'"

echo "== Permissões (menor privilégio)"
gcloud artifacts repositories add-iam-policy-binding "$REPO" \
  --project="$PROJECT_ID" --location="$REGION" \
  --member="serviceAccount:${DEPLOY_SA}" --role="roles/artifactregistry.writer" >/dev/null

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA}" --role="roles/run.developer" --condition=None >/dev/null

gcloud iam service-accounts add-iam-policy-binding "$API_SA" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA}" --role="roles/iam.serviceAccountUser" >/dev/null

gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --project="$PROJECT_ID" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${GITHUB_REPO}" \
  --role="roles/iam.workloadIdentityUser" >/dev/null

echo
echo "== Pronto. Valores para o workflow (não são segredos):"
echo "workload_identity_provider: projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
echo "service_account:            ${DEPLOY_SA}"
