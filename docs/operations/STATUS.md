# Field Shift — status técnico

Atualizado: 2026-11-15
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
| `ingest-data` | `main` + `data/**` | DSSAT, NASA POWER e SoilGrids → `gs://…/raw/` (incremental) |
| `dssat` | `main` + `apps/dssat/**` | testes → compila DSSAT na imagem → teste de referência → Job `fieldshift-dssat` → executa na nuvem |

## DSSAT
- DSSAT-CSM **4.8.6.004**, `dssat-csm-os` commit `25c93b9`, `dssat-csm-data` commit `99c95b3` (BSD-3-Clause).
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
- NASA POWER diário 1991–2025 (JSON + ICASA); SoilGrids v2 (11 propriedades × 6 profundidades × média/Q05/Q95);
  DSSAT por commit; manifestos com sha256 em `raw/manifests/`.

## Pendências e riscos
- Gerar `.WTH` a partir do POWER e `.SOL` a partir do SoilGrids (conversão de unidades + parâmetros hidráulicos).
- API ainda **não** dispara o Job; antes disso: autenticação e cota (o serviço é público).
- Papel para a API disparar o Job deve ficar **no recurso do Job**, não no projeto.
- P e K disponíveis não vêm de nenhuma fonte coletada.
- Auditoria de procedência do DSSAT (política editorial da equipe) pendente.
- Coleta regional (grade do Nordeste via Zarr do POWER, recorte SoilGrids, NASADEM, INMET) não iniciada.
- Repositório é público por decisão da equipe (protótipo).
