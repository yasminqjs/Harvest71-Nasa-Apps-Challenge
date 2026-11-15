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
| Teste de referência | BRPI0202 (milho, Piracicaba-SP) + `BR.SOL` + `BRPI0201.WTH` | ESALQ/USP (Brasil) |

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
