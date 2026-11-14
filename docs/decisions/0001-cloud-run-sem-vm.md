# ADR 0001 — Cloud Run (Service + Jobs) em vez de VM Compute Engine

Data: 2026-11-14 · Status: aceita

## Contexto
Precisamos de uma API HTTP e de execuções DSSAT sob demanda, com custo zero quando ocioso e créditos limitados.

## Decisão
- API em **Cloud Run Service** (FastAPI), min 0 / max 2 instâncias, cobrança por solicitação.
- DSSAT-CSM em **Cloud Run Jobs**, após validar localmente um experimento oficial em Docker.
- Dados em Cloud Storage privado; imagens no Artifact Registry.
- **Sem VM 24/7**, Cloud SQL, GPU, NAT ou balanceador no MVP.

## Consequências
- Custo ocioso ≈ zero; jobs pagos pelo tempo de execução.
- Exige empacotar o DSSAT em Docker e tornar execuções idempotentes.
- Iniciar jobs pela API exige `run.jobs.run` (ou `run.jobs.runWithOverrides` se houver overrides) **no recurso Job**; `roles/run.invoker` sozinho não autoriza overrides.
- Revisitar se um requisito concreto exigir VM (apresentar justificativa e custo antes).
