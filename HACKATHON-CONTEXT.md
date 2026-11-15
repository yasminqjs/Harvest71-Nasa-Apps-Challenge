# HACKATHON_CONTEXT: Endpoints Síncronos NASA, Bootstrap FAO e Diretrizes de UX Acessível

## 1. Fontes de Dados Reais e Síncronas (Sem Filas Assíncronas Lentas)

### A. NASA POWER API (Clima, Precipitação GPM e Umidade Radicular MERRA-2 — Sem Chave)
- **Endpoint Síncrono (< 1.5s):** `[https://power.larc.nasa.gov/api/temporal/daily/point](https://power.larc.nasa.gov/api/temporal/daily/point)`
- **Parâmetros Obrigatórios:**
  `?parameters=T2M_MAX,T2M_MIN,T2M,RH2M,ALLSKY_SFC_SW_DWN,WS2M,PRECTOTCORR,GWETROOT,GWETTOP,EVPTRNS&community=AG&longitude={lon}&latitude={lat}&start={YYYYMMDD}&end={YYYYMMDD}&format=JSON`
- **Uso Científico:**
  - `PRECTOTCORR`: Precipitação diária mesclada GPM/MERRA-2 (mm/dia).
  - `GWETROOT`: Umidade na zona das raízes (0.0 a 1.0) gerada pelo modelo de superfície terrestre da NASA — alimenta diretamente o cálculo de $K_s$ (FAO-56) sem depender da fila assíncrona do AppEEARS.
  - `EVPTRNS`: Fluxo de transpiração/evaporação da superfície.

### B. Microsoft Planetary Computer STAC (Sentinel-2 10m, Landsat TIRS 30m e NASA NASADEM 30m — Sem Chave)
- **Endpoint STAC:** `[https://planetarycomputer.microsoft.com/api/stac/v1](https://planetarycomputer.microsoft.com/api/stac/v1)`
- **Coleções Síncronas via `pystac-client` + `planetary-computer` + `rasterio`:**
  1. `sentinel-2-l2a`: Bandas `B02`, `B04`, `B08`, `B11` e `SCL` (10m–20m) para cálculo de NDVI, EVI, LAI, NDWI, BSI e fator $C$ da RUSLE.
  2. `landsat-c2-l2`: Banda termal `lwir11` (30m NASA/USGS) para obter a Temperatura da Superfície do Dossel ($T_c$) e calcular o índice **CWSI** dentro de propriedades < 5 ha.
  3. `nasadem`: Modelo Digital de Elevação da NASA (30m) para cálculo da declividade e do fator $LS$ da equação **RUSLE**.

### C. Bootstrap Automático do Banco de Plantas (FAO EcoCrop + FAO GAEZ v4)
- O agente deve criar um script `scripts/bootstrap_scientific_data.py` que baixa automaticamente a base oficial **FAO EcoCrop** (`EcoCrop_DB.csv`, contendo `SCIENTNAME`, `TMIN`, `TOPMN`, `TOPMX`, `TMAX`, `RMIN`, `ROPMN`, `GMIN`, `GMAX`) a partir de espelhos públicos da comunidade científica (ex: repositório `cropmodels/ecocrop` ou `Recocrop`) e armazena em `data/reference/fao_ecocrop.csv`.
- Para o **FAO GAEZ v4**, consultar via `/vsicurl/` os Cloud Optimized GeoTIFFs (COGs) públicos do bucket S3 `fao-gismgr-gaez-v4-data` (Tema 4 `RES05`, cenário `rainfed` + `low_input`) e cruzar com propriedades físicas do solo via API REST do **ISRIC SoilGrids v2.0** (`[https://rest.isric.org/soilgrids/v2.0/properties/query](https://rest.isric.org/soilgrids/v2.0/properties/query)` para extrair areia, argila e matéria orgânica e calcular $\theta_{\text{FC}}$ e $\theta_{\text{WP}}$ pelas funções de pedotransferência de *Saxton & Rawls, 2006*).

## 2. Requisitos Obrigatórios de Interface para Agricultores de Baixa Escolaridade
Como a branch atual já possui o Front-end, a tela de diagnóstico de qualidade da lavoura deve seguir estas regras de UX/UI:
1. **Botão Principal de Voz ("🔊 Ouvir Diagnóstico da Roça"):**
   - Implementar no Front-end um player de voz usando `window.speechSynthesis` (`lang = 'pt-BR'`, voz natural, `rate = 0.95`) que lê o campo `voice_tts_script_pt` com destaque visual enquanto fala.
2. **Semáforo e Zonas Visuais Simples no Mapa:**
   - No mapa do terreno, renderizar os polígonos de `visual_field_zones` nas cores Verde (`#16A34A`), Amarelo (`#D97706`) e Vermelho (`#DC2626`) com ícones grandes no centro de cada mancha (🌱 Planta Forte, 💧 Sede, 🐛 Suspeita de Bicho/Doença, 🔥 Terra Descoberta).
3. **Cartões de Ação Passo-a-Passo (Sem Jargão):**
   - Exibir os `action_cards` com ícones grandes, frases curtas e diretas sobre manejo agroecológico (cobertura morta, inspeção do verso da folha, retenção de água).
4. **Modo Duplo ("Visão Agricultor" vs. "Visão Científica NASA / Técnico"):**
   - Por padrão, a tela exibe **apenas** a Visão Agricultor (ícones, cores, áudio e cartões simples).
   - Incluir um botão alternador (*toggle* ou gaveta inferior) **"🛰️ Ver Dados Científicos NASA & Equações"** que exibe os cartões técnicos (`NDVI`, `EVI`, `LAI`, `CWSI`, `GWETROOT`, fatores `RUSLE`, aptidão `FAO GAEZ v4`, gráficos de anomalia e metadados das cenas de satélite) para avaliação dos jurados do Space Apps e técnicos agrícolas.

## 3. Áreas-Piloto Reais do Nordeste (< 5 ha) para Cache Auditado
O script de cache deve rodar o pipeline científico real sobre estas 3 coordenadas agrícolas do Nordeste para garantir funcionamento instantâneo mesmo se o STAC externo oscilar durante a apresentação:
1. **Irecê - BA (4.2 ha — Sequeiro / Feijão-caupi e Milho):**
   `[[-41.8562, -11.3045], [-41.8542, -11.3045], [-41.8542, -11.3064], [-41.8562, -11.3064], [-41.8562, -11.3045]]`
2. **Quixeramobim - CE (3.6 ha — Semiárido Central / Sorgo e Palma):**
   `[[-39.2915, -5.1982], [-39.2897, -5.1982], [-39.2897, -5.1999], [-39.2915, -5.1999], [-39.2915, -5.1982]]`
3. **Juazeiro - BA / Vale do São Francisco (4.8 ha — Polígono Irrigado):**
   `[[-40.4820, -9.4310], [-40.4798, -9.4310], [-40.4798, -9.4330], [-40.4820, -9.4330], [-40.4820, -9.4310]]`