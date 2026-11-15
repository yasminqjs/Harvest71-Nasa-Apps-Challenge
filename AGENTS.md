# Instruções para IAs e devs que trabalham neste repositório

Field Shift / Harvest71 — NASA Space Apps 2026, desafio *Field Shift: Adapting Farms with NASA Data*.
Leia este arquivo inteiro antes de mudar qualquer coisa. Ele vale para Claude, Copilot, Gemini, Cursor e pessoas.

## 1. Como o sistema é montado

```
App (web/mobile) ──HTTPS──► API fieldshift-api (Cloud Run)
                               │  /scenarios ............ lê resultados prontos
                               │  /simulations (chave) .. dispara ▼
                               ▼
                      Cloud Run Job fieldshift-dssat (DSSAT-CSM 4.8.6)
                               │ busca clima NASA POWER + solo PronaSolos para a coordenada
                               ▼
                      Bucket privado (só as contas de serviço acessam)
```

- **Você não precisa de conta no Google Cloud.** A API é a única porta de entrada. Ninguém além das
  contas de serviço lê o bucket; não peça acesso a ele.
- **Não existe VM** e não deve existir (`docs/decisions/0001-cloud-run-sem-vm.md`).
- Estado atual verificado: `docs/operations/STATUS.md`.

## 2. Usar a API (o que o app e os outros devs fazem)

Base: `https://fieldshift-api-avshjoa6eq-uc.a.run.app` · contrato completo: `docs/API.md`

| Rota | Chave? | Para quê |
|---|---|---|
| `GET /health`, `GET /version` | não | saúde e commit no ar |
| `GET /scenarios`, `GET /scenarios/{site}` | não | cenários prontos de 5 locais do Nordeste |
| `POST /simulations` | **sim** | simular uma coordenada (com análise de solo opcional) |
| `GET /simulations/{id}` | **sim** | buscar o resultado (consultar a cada 5 s) |

- A chave vai no cabeçalho `X-API-Key`. **Peça à dona do projeto (Yasmin)** por canal privado.
- **Nunca** coloque a chave no código, em issue, PR, commit, print ou log. O repositório é público.
  No app, leia de variável de ambiente ou de configuração fora do repositório.
- Limites: 6 simulações/minuto e 200/dia por chave. Respeite `429` e tente depois.
- Simulação leva ~15–60 s. Fluxo: `POST` → recebe `id` → `GET /simulations/{id}` até `status` ser
  `done` ou `failed`.

## 3. Mudar o backend

1. Crie uma branch, faça a mudança, rode os testes:
   ```bash
   cd apps/api   && pip install -r requirements-dev.txt && pytest -q
   cd apps/dssat && pip install pytest && pytest -q        # testes que precisam do DSSAT são pulados fora da imagem
   ```
2. Abra um Pull Request. Só a `main` publica; o merge dispara tudo sozinho:

| Workflow | Quando roda | Faz |
|---|---|---|
| `test` | todo push/PR | testes da API |
| `deploy-api` | `main` + `apps/api/**` | publica a API e confere `/version` |
| `dssat` | `main` + `apps/dssat/**` | compila o DSSAT, teste de referência, atualiza e executa o Job |
| `ingest-data` | `main` + `data/**` | coleta NASA POWER + PronaSolos dos pontos de `data/points.csv` |
| `scenarios` | após `ingest-data`/`dssat` | recalcula `/scenarios` |

O GitHub Actions entra no Google Cloud por federação de identidade (sem chave JSON), só a partir
da `main` deste repositório. Forks e outras branches não conseguem publicar.

## 4. Regras que não podem ser quebradas

- **Fontes de dados:** nenhuma fonte, autor, instituição ou dado de origem chinesa, nem indireto
  (regra da equipe, mais rígida que a da NASA). Antes de adicionar fonte, biblioteca de cultivares ou
  arquivo do DSSAT, verifique a origem. Detalhes e itens já descartados: `docs/decisions/0002-fontes-de-dados.md`.
- **Nada de segredos no repositório:** chaves JSON de conta de serviço, chaves de API, tokens. Não crie
  chave JSON de conta de serviço.
- **Honestidade científica:** os resultados são comparações relativas (nível "exploratório"), não
  previsão de safra. Não remova `evidence`, `assumptions` nem `provenance` das respostas, e não
  apresente número como medição.
- **Sem rota que dispare simulação sem chave e limite.**
- **Não use `--allow-unauthenticated` nem altere IAM pelo CI.** Mudanças de permissão são feitas
  pela dona do projeto com os scripts de `infra/gcp/scripts/`.

## 5. Onde está cada coisa

| Caminho | Conteúdo |
|---|---|
| `apps/api/` | FastAPI (rotas acima) |
| `apps/dssat/runner.py` | modos do Job: `reference`, `scenarios`, `point`, `run` |
| `apps/dssat/fieldshift_inputs.py` | NASA POWER → `.WTH`; PronaSolos (+ análise) → `.SOL`; cenários → `.MZX` |
| `data/points.csv`, `data/scripts/` | pontos fixos e coleta |
| `infra/gcp/scripts/` | configuração única do Google Cloud (só a dona roda) |
| `docs/` | decisões, status, API |

## 6. Pendências conhecidas

- Só **milho** (cultivar AG9010, calibrado em SP). Outras culturas exigem checar a origem dos arquivos de genética.
- Janelas de plantio automáticas = suposição pelo clima; validar com o ZARC (MAPA).
- Sem calibração local; N, P e K não entram no cálculo do milho como está configurado.
- Autenticação por chave é de protótipo; para produção, trocar por login de usuário.
