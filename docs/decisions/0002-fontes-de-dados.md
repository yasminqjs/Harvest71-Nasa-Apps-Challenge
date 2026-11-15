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
| Genética | 23 culturas (`apps/dssat/genotype_keep.txt`) da biblioteca DSSAT | DSSAT Foundation; cultivares com menção à China removidos |
| Plantio/colheita por cultura | experimento de referência de cada cultura (`crops.json`) | ver tabela em `docs/API.md` |
| Clima futuro (opcional) | NASA NEX-GDDP-CMIP6 v2.0, mudança mensal aplicada ao NASA POWER | NASA Earth Exchange / Ames (EUA), servido pelo NCCS; só modelos sem vínculo chinês |
| Teste de referência | BRPI0202 (milho, Piracicaba-SP) + `BR.SOL` + `BRPI0201.WTH` | ESALQ/USP (Brasil) |

## Clima futuro: NASA NEX-GDDP-CMIP6 (2026-11-15, branch `dados-previsao`)
- **Fonte:** NEX-GDDP-CMIP6 v2.0 (NASA Earth Exchange, NASA Ames), diário, 0,25°, 1950–2100, cenários SSP1-2.6
  a SSP5-8.5, licença CC0. Acesso pelo THREDDS do NCCS (`https://ds.nccs.nasa.gov/thredds/catalog/AMES/NEX/GDDP-CMIP6/`).
  Citação: Thrasher, B. et al. (2022). NASA Global Daily Downscaled Projections, CMIP6. *Scientific Data* 9, 262.
  https://doi.org/10.1038/s41597-022-01393-4
- **É produto da NASA**, mas cada série vem de um modelo climático do CMIP6 de uma instituição. Pela regra da
  equipe, ficam de fora BCC-CSM2-MR, FGOALS-g3, NESM3, CAS-ESM2-0, CIESM (China) e TaiESM1 (Taiwan, por
  precaução). Padrão: GISS-E2-1-G (NASA GISS), GFDL-ESM4 (NOAA) e MPI-ESM1-2-HR (Alemanha).
- **Método (delta mensal):** média mensal de 20 anos do modelo no futuro comparada com 1995–2014 do mesmo
  modelo; temperatura soma, chuva e radiação multiplicam (limites 0,25–4 e 0,7–1,3). A mudança é aplicada
  dia a dia ao NASA POWER 1991–2025 do ponto; ponto de orvalho sobe com a temperatura média. Mesmas janelas,
  solo, cultura e cultivar do resultado atual, então a comparação é direta e o viés do modelo se cancela.
- **Variáveis usadas:** tasmax, tasmin, pr, rsds (o DSSAT aqui calcula a evapotranspiração por Priestley-Taylor,
  que não usa vento nem umidade).
- **Limites:** a sequência de anos e a variabilidade diária continuam as observadas (secas mais longas ou
  chuvas mais concentradas não aparecem); o CO₂ fica no nível observado (sem efeito de fertilização, conservador);
  resolução de 25 km.
- **Velocidade:** o servidor da NASA leva de 5 a 40 s por arquivo anual, então o app nunca baixa durante um
  pedido. O workflow `nex-gddp` pré-processa em segundo plano um recorte por arquivo (Nordeste, ~6 MB, e depois
  o Brasil inteiro, ~43 MB) e grava as médias mensais por célula no bucket (`nex-gddp-cmip6/v2/<recorte>/`).
  A simulação com clima futuro só lê esses arquivos (segundos). Ponto ou cenário ainda não pré-processado:
  `climate_projection.status = "unavailable"`, sem atrasar o resultado atual. A API só aceita os cenários,
  períodos e modelos de `data/nex_gddp.json` (teste garante).
- **Verificado com dado real (GISS-E2-1-G, SSP2-4.5, 2041–2060, célula de Cruz das Almas-BA):** TMAX +1,4 °C,
  TMIN +1,5 °C, chuva −7 %, radiação +0,6 % em relação a 1995–2014.
- **Não usado (por ora):** previsão sazonal GEOS-S2S (NASA GMAO). Dá anomalias e probabilidades para os
  próximos meses, não séries diárias prontas para o DSSAT, e a NASA ainda está facilitando o acesso aos dados
  da versão 3.

## Descartado
- **SoilGrids (ISRIC):** modelo global treinado com perfis de solo de vários países, incluindo a China.
- **Biblioteca completa do DSSAT (`dssat-csm-data`, demais `.CUL`/`.SOL`):** contém perfis de solo de
  Gansu, Nanjing e outros, um experimento em Lanzhou e um cultivar de amendoim chinês. A imagem baixa só os
  5 arquivos do experimento brasileiro (download parcial) e apaga toda genética exceto milho; o build
  falha se encontrar menção a China/Beijing/Nanjing/Gansu nos dados que ficam na imagem.

## Culturas (2026-11-15)
- Catálogo gerado de experimentos de referência da `dssat-csm-data`, escolhidos sem vínculo chinês
  (Brasil quando havia: milho ESALQ, soja Teresina/Piracicaba, cana ESALQ).
- **Amendoim:** a única variedade com origem chinesa (`GH0001 CHINESE TMV2`, ensaios em Gana) é removida do
  `.CUL` no build; experimentos de Gana que a usam não entram.
- Fora por ora: braquiária e capim-colonião (modelo de pastagem exige configuração de cortes), mucuna
  (só biomassa), trigo/fava/quinoa (pouca relevância no Nordeste).
- Triagem por texto (nomes, locais, instituições); não é auditoria autor a autor dos coeficientes.

## Cultivares brasileiros de artigos (2026-11-15)
- Fonte única: `apps/dssat/cultivars_br.json` (valores, artigo, instituição, local, versão do modelo e
  quais campos foram herdados de um cultivar base). O build da imagem acrescenta as linhas aos `.CUL`/`.ECO`
  (`tools/br_cultivars.py`), e o catálogo marca origem e fonte.
- Entraram 11: mandioca BRS Novo Horizonte e Eucalipto (Embrapa Mandioca e Fruticultura, Cruz das Almas-BA,
  DSSAT 4.8.2); feijão Pérola, Ouro Negro e Ouro Vermelho (UFV); soja M-SOY 6101 e MG/BR 46 Conquista (UFV) e
  CD 202, CD 204, CD 206, CD 210 (UNEMAT/UEM/IAPAR, Palotina-PR). Todos rodam as 33 safras × 4 cenários nos testes.
- Ficaram de fora:
  - CTC4, CTC7, CTC20, RB867515, RB835486 (SC): calibrados no DSSAT 4.5 (Canegro antigo); a escala de parâmetros mudou no 4.8 (ex.: MaxPARCE 9.9 no artigo x 5.7 no 4.8). RB867515 já existe na biblioteca do 4.8 como RB7515.
  - Carioca (BN): tabela ilegível no PDF e modelo CROPGRO v2.02; a biblioteca do 4.8 já tem IB0010 Carioca.
  - BRS Tumucumaque (CP): o artigo publica a linha completa do cultivar, mas a calibração usou um arquivo de espécie próprio, não publicado. Com o arquivo de espécie oficial do DSSAT 4.8 a produtividade simulada fica cerca de 4 vezes menor que a do VERDE BRASIL (CP0006) nas mesmas condições (WTPSD 0,6 g e XFRT 0,6 não são compatíveis com a espécie oficial). Fica fora até haver o arquivo de espécie dos autores.
  - BRS Guariba (CP): o artigo publica só parte dos coeficientes, sem os códigos do modelo; não dá para montar a linha do cultivar sem inventar valores.
  - BRS 310 (SG): tabela de coeficientes não disponível nos textos abertos acessados (dissertação bloqueada para leitura automática; artigo em periódico pago).
  - BRS 1010, BRS 1030, BRS 1040, AL Bandeirantes (MZ): o texto aberto não publica os valores dos coeficientes.
- Limite: CUL calibrados em versões antigas do CROPGRO foram usados com a espécie do 4.8; a fenologia segue
  o artigo, mas a produtividade absoluta pode diferir da do artigo.

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
