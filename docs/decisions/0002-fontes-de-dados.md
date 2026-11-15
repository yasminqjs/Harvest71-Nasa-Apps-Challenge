# 0002 — Fontes de dados do núcleo DSSAT

Data: 2026-11-15 · Status: aceita

## Contexto
A equipe tem uma regra editorial (contexto geral do hackathon, seção 0.1): nenhuma fonte, autor,
instituição ou dado de origem chinesa, inclusive vínculos indiretos. A regra é da equipe, não da NASA.

## Decisão
| Papel | Fonte | Origem |
|---|---|---|
| Clima diário (SRAD, TMAX, TMIN, RAIN, DEWP, WIND, RHUM) | NASA POWER, comunidade AG | NASA Langley (EUA) |
| Solo por camada (areia, silte, argila, C orgânico, CTC, pH, CE) | PronaSolos, atributos a 90 m | Embrapa / Serviço Geológico do Brasil |
| Retenção de água, densidade, Ksat | Saxton & Rawls (2006), funções de pedotransferência | USDA-ARS (EUA) |
| Modelo | DSSAT-CSM 4.8.6 (`dssat-csm-os` @ 25c93b9) | DSSAT Foundation (EUA), BSD-3 |
| Genética | só `MZCER048` (milho); cultivar AG9010 (IB0171) | experimento brasileiro (ESALQ/USP) |
| Teste de referência | BRPI0202 (milho, Piracicaba-SP) + `BR.SOL` + `BRPI0201.WTH` | ESALQ/USP (Brasil) |

## Descartado
- **SoilGrids (ISRIC):** modelo global treinado com perfis de solo de vários países, incluindo a China.
- **Biblioteca completa do DSSAT (`dssat-csm-data`, demais `.CUL`/`.SOL`):** contém perfis de solo de
  Gansu, Nanjing e outros, um experimento em Lanzhou e um cultivar de amendoim chinês. A imagem baixa só os
  5 arquivos do experimento brasileiro (download parcial) e apaga toda genética exceto milho; o build
  falha se encontrar menção a China/Beijing/Nanjing/Gansu nos dados que ficam na imagem.

## Pendências
- O código-fonte do DSSAT tem muitos colaboradores internacionais; não foi auditado autor por autor.
  Nenhuma menção à China foi encontrada no código ou no NOTICE do commit fixado.
- Objetos antigos no bucket (`raw/dssat/`, `raw/soilgrids/`) vieram das fontes descartadas e não são usados.

## Revisão da planilha `DSSAT_Tabelas_Simplificadas_Por_Status` (168 itens)

As escolhas de origem da planilha se sustentam. Situação de cada grupo:

| Item da planilha | Origem escolhida | Situação |
|---|---|---|
| SRAD, TMAX, TMIN, RAIN, LAT/LONG, TAV, AMP, DEWP, WIND, RHUM | NASA POWER | **Em uso** |
| RAIN refinada | GPM IMERG | Viável depois (exige conta Earthdata). Não usar POWER × IMERG como validação independente |
| ELEV / declividade | NASADEM / SRTM | Elevação já vem do POWER (grade). Declividade só ajusta escoamento (SLRO); baixa prioridade |
| Textura, C orgânico, pH, CTC por camada; ID e camadas do perfil | PronaSolos / Embrapa | **Em uso** (90 m, 6 profundidades) |
| SLLL, SDUL, SSAT ("curva de retenção / pedotransferência") | Estimativa | **Em uso:** Saxton & Rawls 2006. Alternativa melhor a avaliar: função de pedotransferência ajustada a solos brasileiros (ex.: base hidrofísica HYBRAS, do SGB) |
| Densidade | Perfil / análise | Estimada por Saxton & Rawls; **análise do agricultor substitui** |
| P extraível, K | Laboratório / agricultor | **Recebidos pela API e registrados**; não entram no milho como configurado |
| Cultivar / genética | Biblioteca DSSAT | Só MZCER048 (milho). Outras culturas: checar origem antes, como feito aqui |
| Data de semeadura | Usuário / gerador Python | **Em uso:** informada pelo usuário ou automática pelo clima. Fonte oficial a integrar: ZARC (MAPA) |
| Validação clima | NASA × estação independente | Planejado: INMET |
| Proveniência por variável | Metadados do pipeline | **Em uso:** `provenance`, manifestos com sha256 |

Única mudança em relação à planilha: o SoilGrids, que não estava nela, chegou a ser usado e foi removido.
