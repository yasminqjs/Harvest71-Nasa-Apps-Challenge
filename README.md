# Harvest71 — Field Shift

Plataforma de apoio à decisão agrícola do desafio NASA Space Apps. Combina dados ambientais da NASA, dados de solo/cultura e informações de agricultores; o **DSSAT** roda na nuvem para comparar estratégias de manejo. O app mantém dados e resultados sincronizados para uso offline.

> **Status:** API e DSSAT no ar. Simulação de qualquer coordenada do Brasil (clima NASA POWER + solo
> PronaSolos automáticos, análise de solo opcional). Detalhes em [`docs/operations/STATUS.md`](docs/operations/STATUS.md).

**Vai integrar o app ou mexer no código? Comece por [`AGENTS.md`](AGENTS.md) e [`docs/API.md`](docs/API.md).**
Ninguém precisa de conta no Google Cloud: tudo passa pela API.

## Arquitetura

- **API:** FastAPI em Cloud Run Service (`fieldshift-api`) — única porta de entrada
- **Simulador:** DSSAT-CSM 4.8.6 em Cloud Run Job (`fieldshift-dssat`), só milho por enquanto
- **Dados:** NASA POWER (clima) + PronaSolos/Embrapa (solo), em Cloud Storage privado
- **CI/CD:** GitHub Actions com federação de identidade (sem chaves); só a `main` publica
- **Sem VM.** Região `us-central1`. Nenhuma fonte de origem chinesa (`docs/decisions/0002-fontes-de-dados.md`).

## Estrutura

```
apps/api/            FastAPI (+ testes, Dockerfile)
apps/dssat/          imagem do DSSAT, runner do Job, conversores de dados (+ testes)
data/                pontos fixos e script de coleta
infra/gcp/scripts/   configuração única do Google Cloud (só a dona do projeto roda)
docs/                API.md, decisions/, operations/
.github/             workflows (test, deploy-api, dssat, ingest-data, scenarios)
```

## Rodar a API localmente

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q
uvicorn app.main:app --reload --port 8080
```

## Implantar

Automático: merge na `main` (ver tabela de workflows em `AGENTS.md`). Plano B manual no Cloud Shell:
`infra/gcp/scripts/deploy-api.sh`. Auditoria somente leitura: `infra/gcp/scripts/audit.sh`.

## Regras

Veja [`CONTRIBUTING.md`](CONTRIBUTING.md). Em resumo: PRs com revisão, sem segredos no Git, sem chaves JSON, sem recursos pagos sem aprovação.

## Ciência

O DSSAT serve para **comparar estratégias de manejo**; valores absolutos exigem calibração e validação locais. Nada aqui afirma previsão de produtividade, NPK/pH local por satélite ou previsão de pragas.
