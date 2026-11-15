#!/usr/bin/env bash
# Permite que o CI (fieldshift-deploy-sa) implante o Cloud Run Job com a identidade
# fieldshift-dssat-sa. Rode UMA vez no Cloud Shell. Idempotente.
# Concede só: iam.serviceAccountUser na conta fieldshift-dssat-sa (não no projeto).
set -euo pipefail
PROJECT_ID="${PROJECT_ID:-fieldshift-harvest71-2026}"
BUCKET="${BUCKET:-fieldshift-data-${PROJECT_ID}}"
DEPLOY_SA="fieldshift-deploy-sa@${PROJECT_ID}.iam.gserviceaccount.com"
DSSAT_SA="fieldshift-dssat-sa@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts add-iam-policy-binding "$DSSAT_SA" --project="$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA}" --role="roles/iam.serviceAccountUser" >/dev/null
echo "OK: $DEPLOY_SA pode implantar jobs como $DSSAT_SA"

echo "Papéis de $DSSAT_SA no bucket:"
gcloud storage buckets get-iam-policy "gs://$BUCKET" --format=json \
  | python3 -c "import json,sys; [print(' ',b['role']) for b in json.load(sys.stdin)['bindings'] if 'serviceAccount:$DSSAT_SA' in b['members']]"
