# Field Shift — status técnico

Atualizado: 2026-11-15 (cenários)
Agente / responsável: Claude (sessões com a Yasmin)

## No ar
- Projeto `fieldshift-harvest71-2026`, região `us-central1`. **Sem VM** (Compute Engine desabilitado).
- **API** `fieldshift-api` (Cloud Run Service): https://fieldshift-api-avshjoa6eq-uc.a.run.app — `/health`, `/version`.
  min 0 / max 2 instâncias. Deploy automático a cada push na `main` em `apps/api/**` (workflow `deploy-api`).
- **Artifact Registry** `fieldshift` (imagens `fieldshift-api`, `fieldshift-dssat`).
- **Bucket** `fieldshift-data-fieldshift-harvest71-2026`: privado, acesso uniforme, prevenção de acesso público.
- **Orçamento** "Harvest 71": R$ 30/mês, só Cloud Run, com pausa (mais restrito que o plano dos documentos).

## Identidades (todas sem chave JSON)
| Conta de serviço | Uso | Permissões |
|---|---|---|
| `fieldshift-api-sa` | execução da API | Usuário de objetos do Storage no bucket |
| `fieldshift-dssat-sa` | execução do Job DSSAT | Usuário de objetos do Storage no bucket |
| `fieldshift-deploy-sa` | CI (GitHub Actions) | AR writer no repo `fieldshift`; `run.developer`; `serviceAccountUser` só em api-sa e dssat-sa |
| `fieldshift-ingest-sa` | coleta de dados (Actions) | objectCreator + objectViewer só no bucket |

GitHub Actions entra por Workload Identity Federation (pool `github`, provedor `github-oidc`), restrito a
`yasminqjs/Harvest71-Nasa-Apps-Challenge` na branch `main`.

## Pipelines (GitHub Actions)
| Workflow | Dispara em | Faz |
|---|---|---|
| `test` | todo push/PR | pytest da API |
| `deploy-api` | `main` + `apps/api/**` | testes → imagem → Cloud Run → confere `/version` |
| `ingest-data` | `main` + `data/**` | NASA POWER e PronaSolos → `gs://…/raw/` (incremental) |
| `dssat` | `main` + `apps/dssat/**` | testes → compila DSSAT na imagem → teste de referência → Job `fieldshift-dssat` → executa na nuvem |
| `scenarios` | após `ingest-data` ou `dssat` com sucesso, ou manual | Job em modo `scenarios` → `gs://…/runs/scenarios/latest.json` → API `/scenarios` |

## DSSAT
- DSSAT-CSM **4.8.6.004**, `dssat-csm-os` commit `25c93b9` (BSD-3-Clause). Da `dssat-csm-data` (`99c95b3`) só os 5 arquivos do
  experimento BRPI0202; na imagem só a genética do milho e `BR.SOL` (build verifica ausência de dados chineses).
- Compilado com gfortran 13 (Ubuntu 24.04). Executável `dscsm048`, ~0,4 s por experimento de 8 tratamentos.
- **Experimento de referência** BRPI0202 (milho, Piracicaba-SP, 2002, sequeiro e irrigado, 4 híbridos):
  - reexecução idêntica (Summary/PlantGro/SoilWat sem diferença);
  - simulado × observado no campo: antese e maturidade dentro de ±1 dia; produtividade RMSE 519 kg/ha,
    viés +454 kg/ha (superestima), erro relativo médio 9,7 %.
  - Isso valida a **instalação**, não o uso no Nordeste: lá não há calibração local.
- Job `fieldshift-dssat`: 1 tarefa, paralelismo 1, sem retentativas, timeout 900 s, 1 vCPU / 1 GiB.
  Modo `reference` (padrão) e modo `run` (entradas de `INPUT_PREFIX`, saídas em `OUTPUT_PREFIX`).

## Dados coletados (`gs://fieldshift-data-fieldshift-harvest71-2026/raw/`)
- Pontos: Juazeiro-BA, Irecê-BA, Cruz das Almas-BA, Campina Grande-PB, Quixadá-CE (`data/points.csv`).
- NASA POWER diário 1991–2025 (JSON + ICASA); PronaSolos 90 m (8 atributos × 6 profundidades); manifestos com sha256.
- Fontes e exclusões: `docs/decisions/0002-fontes-de-dados.md` (nenhum dado de origem chinesa; SoilGrids descartado).

## Cenários com os dados essenciais (`apps/dssat/fieldshift_inputs.py`)
- **Clima** NASA POWER → `.WTH` anual (SRAD, TMAX, TMIN, RAIN, DEWP, WIND km/dia, RHUM); TAV/AMP de longo prazo.
  Validado por ida e volta: clima oficial de Piracicaba passado pelo conversor reproduz o experimento de referência exatamente.
- **Solo** PronaSolos → `.SOL` em 6 camadas até 200 cm. SLLL, SDUL, SSAT, densidade e SSKS por Saxton & Rawls 2006
  a partir de areia, argila e matéria orgânica. Sem N total e cascalho (-99). Superfície (albedo, drenagem, CN) = suposição.
- **Cenários (suposições explícitas):** milho AG9010 (IB0171), 3 janelas de plantio por local + irrigação automática na
  janela 2, 5 pl/m², N não simulado, 33 safras (1992–2024). Resultado por cenário: p10/p50/p90 de produtividade,
  fração de safras < 1000 kg/ha, ciclo, chuva, irrigação e ET. Nível de evidência: **exploratório**.
- API: `GET /scenarios` e `GET /scenarios/{site}` (somente leitura, cache de 5 min).

## Simulação sob demanda (qualquer coordenada do Brasil)
- `POST /simulations` (**acesso livre por enquanto**: 6/min e 200/dia por IP, teto global de 500/dia por instância; chave
  opcional, exigida quando `REQUIRE_API_KEY=true`) grava o pedido e dispara o Job em modo `point`;
  `GET /simulations/{id}` devolve o resultado. Contrato: `docs/API.md`.
- O Job busca NASA POWER (1991–2025) e PronaSolos na hora, com cache no bucket (`cache/`); clima é reaproveitado
  por célula da grade do POWER (0,5° × 0,625°).
- Análise de solo do agricultor (opcional) substitui a estimativa nas camadas informadas; origem marcada por camada.
  P e K são registrados, não usados pelo milho.
- Janelas de plantio: informadas ou automáticas (quadrimestre mais chuvoso do ponto) — suposição.
- **Ativação:** `infra/gcp/scripts/setup-api-access.sh` (Secret Manager com a chave; papel
  `run.jobsExecutorWithOverrides` só no Job para `fieldshift-api-sa`) — **já executado** em 2026-11-15.
- Teste real: Cruz das Almas-BA pela API, ~1 min do pedido ao resultado (10 s de cálculo); números iguais aos cenários fixos.
- Correções desta etapa: acentos quebravam os arquivos do DSSAT (agora removidos só dentro deles); data de plantio
  no dia 366 de ano bissexto invalidava as safras seguintes; leitor do `Summary.OUT` passou a ler por posição.

## Primeira execução real (2026-11-15, `runs/scenarios/20261115T112045Z/`)
Job `fieldshift-dssat` criado pelo CI; referência e cenários executados na nuvem com sucesso; API `/scenarios` no ar.
Milho, 33 safras (1992–2024), produtividade mediana (p50) em kg/ha e fração de safras < 1000 kg/ha:

| Local | Melhor janela sequeiro (p50 / safras ruins) | Irrigado janela 2 (p50) | Irrigação p50 |
|---|---|---|---|
| Campina Grande-PB | 01/04: 4319 / 9 % | 4521 | 69 mm |
| Cruz das Almas-BA | 01/05: 2481 / 18 % | 4135 | 143 mm |
| Irecê-BA | 15/12: 2027 / 15 % | 5665 | 310 mm |
| Juazeiro-BA | 15/01: 1263 / 49 % | 4367 | 339 mm |
| Quixadá-CE | 01/02: 4171 / 9 % | 4178 | 68 mm |

Nível de evidência: exploratório (sem calibração local; cultivar de SP; N não simulado). Usar só para comparação relativa.
Bucket limpo: `raw/dssat/` e `raw/soilgrids/` apagados (fontes descartadas pela política da equipe).

## Pendências e riscos
- Validar janelas de plantio com o ZARC (MAPA) e trocar a cultivar por uma adequada ao Nordeste quando houver.
- API ainda **não** dispara o Job; antes disso: autenticação e cota (o serviço é público).
- Papel para a API disparar o Job deve ficar **no recurso do Job**, não no projeto.
- P e K disponíveis não vêm de nenhuma fonte coletada.
- Auditoria de procedência do DSSAT (política editorial da equipe) pendente.
- Coleta regional (grade do Nordeste via Zarr do POWER, PronaSolos em grade, NASADEM, INMET) não iniciada.
- Repositório é público por decisão da equipe (protótipo).
