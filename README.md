# Harvest71 — Field Shift

Plataforma de apoio à decisão agrícola do desafio NASA Space Apps. Combina dados ambientais da NASA, dados de solo/cultura e informações de agricultores; o **DSSAT** roda na nuvem para comparar estratégias de manejo. O app mantém dados e resultados sincronizados para uso offline.

> **Status:** infraestrutura base criada; API mínima (`/health`, `/version`) pronta para deploy; DSSAT ainda **não** validado nem implantado. Veja [`docs/operations/STATUS.md`](docs/operations/STATUS.md).

## Arquitetura (decidida)

- **API:** FastAPI em Cloud Run Service (`fieldshift-api`)
- **Simulador:** DSSAT-CSM em Cloud Run Jobs (`fieldshift-dssat`) — *ainda não criado*
- **Dados:** Cloud Storage privado · **Imagens:** Artifact Registry
- **Sem VM Compute Engine.** Região `us-central1`.

## Estrutura

```
apps/api/            FastAPI (+ testes, Dockerfile)
infra/gcp/scripts/   audit.sh (leitura) e deploy-api.sh
docs/                context/, decisions/ (ADRs), operations/STATUS.md
.github/             CI de testes (sem acesso ao GCP) e CODEOWNERS
```

Ainda a criar conforme as fases: `workers/dssat/`, `packages/{nasa,soils,science,contracts}/`, `apps/web/`, `tests/`.

## Rodar a API localmente

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q
uvicorn app.main:app --reload --port 8080
```

## Implantar (Cloud Shell ou gcloud com login individual)

```bash
infra/gcp/scripts/audit.sh          # somente leitura
infra/gcp/scripts/deploy-api.sh     # privado por padrão; --public só enquanto houver apenas /health e /version
```

## Regras

Veja [`CONTRIBUTING.md`](CONTRIBUTING.md). Em resumo: PRs com revisão, sem segredos no Git, sem chaves JSON, sem recursos pagos sem aprovação.

## Ciência

O DSSAT serve para **comparar estratégias de manejo**; valores absolutos exigem calibração e validação locais. Nada aqui afirma previsão de produtividade, NPK/pH local por satélite ou previsão de pragas.
