# MODULE_SPEC: Diagnóstico Biofísico NASA e Interface Acessível de Campo

## 1. Visão Geral e Arquitetura de Dupla Camada
Este módulo analisa a qualidade e os estresses atuais de pequenas propriedades rurais (< 5 hectares) no Nordeste do Brasil dentro do desafio NASA Space Apps (FIELD SHIFT).
O sistema opera em **Dupla Camada de Apresentação** sobre os mesmos dados científicos:
1. **Camada Científica e de Integração (`scientific_telemetry` + `dssat_state_vector`):** Rigorosamente fundamentada em satélites da NASA/ESA, equações biofísicas publicadas e bancos de culturas da FAO (EcoCrop + GAEZ v4), alimentando o motor DSSAT e o painel de auditoria para jurados/agrônomos.
2. **Camada de Acessibilidade Rural (`farmer_accessible_view`):** Traduz automaticamente os diagnósticos físicos em **Semiótica Visual (Semáforo de 3 cores + Ícones universais)**, **Síntese de Voz Nativa (TTS `pt-BR`)** para agricultores com baixa escolaridade e **Cartões Visuais de Ação Prática**.

## 2. Regra de Inspeção do Repositório Atual
O código está sendo executado em uma branch que **já contém o Front-end**. Antes de gerar código:
1. Inspecione a estrutura atual do projeto (`package.json`, componentes de mapa, gerenciador de estado, rotas e estilização).
2. Inspecione as demais branches (`git branch -a`, `git ls-tree`) apenas para verificar contratos do módulo **DSSAT** (incluindo arquivos `.SPE`/`.CUL`) ou serviços de backend já existentes.
3. Integre a visualização de qualidade da plantação diretamente no Front-end existente sem quebrar fluxos atuais.

## 3. Fundamentação Científica Estrita (Zero "Números Mágicos")
Toda variável utilizada no algoritmo deve vir de um sensor espacial ou base agronômica oficial e ser processada pelas equações abaixo:

### 3.1 Índices Ópticos e Biofísicos Intra-Talhão (Sentinel-2 L2A — 10m a 20m)
Após filtragem de nuvens/sombras via banda `SCL` (excluindo classes 3, 8, 9 e 10):
- **NDVI (Vigor Fotossintético, 10m):**
  $$\text{NDVI} = \frac{B08 - B04}{B08 + B04}$$
- **EVI (Enhanced Vegetation Index — corrigido para solos claros do Semiárido, 10m):**
  $$\text{EVI} = 2.5 \times \frac{B08 - B04}{B08 + 6 \cdot B04 - 7.5 \cdot B02 + 1}$$
- **LAI Estimado (Índice de Área Foliar, $\text{m}^2/\text{m}^2$ — Boegh et al., 2002):**
  $$\text{LAI} = \max(0,\; 3.618 \times \text{EVI} - 0.118)$$
- **NDWI (Água Foliar Interna — Gao, 1996, 20m reamostrado para 10m):**
  $$\text{NDWI} = \frac{B08 - B11}{B08 + B11}$$
- **BSI (Índice de Solo Exposto — Rikimaru et al., 2002, 20m):**
  $$\text{BSI} = \frac{(B11 + B04) - (B08 + B02)}{(B11 + B04) + (B08 + B02)}$$
- **Anomalia Fenológica Padronizada (Z-Score por Pixel — Padrão OMM/NASA):**
  Comparando o índice atual ($X$) com a média ($\mu_{\text{hist}}$) e o desvio padrão ($\sigma_{\text{hist}}$) das cenas históricas do mesmo período fenológico:
  $$Z_X = \frac{X_{\text{atual}} - \mu_{\text{hist}}}{\sigma_{\text{hist}}}$$

### 3.2 Termografia e Estresse Evaporativo (Landsat 8/9 TIRS 30m / ECOSTRESS 70m + NASA POWER)
- Extração da Temperatura de Superfície do Dossel ($T_c$, °C) via banda termal `lwir11` do **Landsat Collection 2 Level-2 (30m NASA/USGS)** (ou ECOSTRESS L2 70m).
- Extração da Temperatura do Ar ($T_a$ = `T2M`) e Umidade Relativa (`RH2M`) via **NASA POWER**.
- **CWSI (Crop Water Stress Index — Idso et al., 1981; Jackson et al., 1981):**
  $$\text{CWSI} = \text{clip}\left(\frac{(T_c - T_a) - \Delta T_{\text{LL}}(VPD)}{\Delta T_{\text{UL}} - \Delta T_{\text{LL}}(VPD)},\; 0.0,\; 1.0\right)$$
  onde $\Delta T_{\text{LL}}$ é a linha de base de dossel transpirando plenamente em função do Déficit de Pressão de Vapor ($VPD$) e $\Delta T_{\text{UL}}$ é o limite superior de dossel sem transpiração.

### 3.3 Balanço Hídrico, Umidade Radicular e Graus-Dia (NASA POWER MERRA-2 + FAO EcoCrop)
- Do **NASA POWER (`community=AG`)**, extrair sincronamente:
  - `PRECTOTCORR` (Precipitação diária corrigida GPM/MERRA-2, mm/dia)
  - `GWETROOT` (Umidade volumétrica relativa na zona radicular, 0.0 a 1.0, NASA GLDAS/MERRA-2)
  - `GWETTOP` (Umidade superficial do solo, 0.0 a 1.0)
  - `T2M_MAX`, `T2M_MIN`, `RH2M`, `ALLSKY_SFC_SW_DWN`, `WS2M`
- **Evapotranspiração de Referência ($ET_0$, mm/dia):** Equação FAO-56 Penman-Monteith.
- **Coeficiente de Estresse Hídrico ($K_s$, 0 a 1 — FAO-56):**
  $$K_s = \text{clip}\left(\frac{\text{GWETROOT} - \theta_{\text{WP}}}{(1 - p) \cdot (\theta_{\text{FC}} - \theta_{\text{WP}})},\; 0.0,\; 1.0\right)$$
  onde $p$ é a fração de depleção hídrica crítica da cultura (FAO-56) e $\theta_{\text{FC}}, \theta_{\text{WP}}$ vêm da textura do solo (**FAO GAEZ v4 / ISRIC SoilGrids**).
- **Graus-Dia Acumulados ($GDD$, °C·dia):**
  $$GDD = \sum_{t=t_{\text{plantio}}}^{t_{\text{atual}}} \max\left(0,\; \frac{T_{\max,t} + T_{\min,t}}{2} - T_{\text{base}}\right)$$
  onde $T_{\text{base}}$ (`TMIN`), temperatura ótima máxima (`TOPMX`) e ciclo (`GMIN`, `GMAX`) são lidos dinamicamente do banco **FAO EcoCrop**.

### 3.4 Risco Físico de Erosão do Solo (Equação RUSLE com Dados NASA)
Em vez de limiares arbitrários, calcular o risco de perda de solo combinando **NASADEM (30m)**, **GPM/POWER** e **Sentinel-2**:
- **Fator Topográfico $LS$ (Moore & Burch, 1986):** Calculado a partir da declividade ($\beta$) do **NASA NASADEM (30m)**.
- **Fator de Cobertura Vegetal $C$ (Van der Knijff et al., 2000):**
  $$C = \exp\left(-2.0 \times \frac{\text{NDVI}}{1.0 - \text{NDVI}}\right)$$
- **Índice de Vulnerabilidade à Erosão ($I_{\text{RUSLE}}$):** Produto normalizado $R_{\text{chuva}} \times LS_{\text{NASADEM}} \times C_{\text{Sentinel2}}$.

## 4. Regras de Diagnóstico Baseadas em Índices Físicos (Multi-Cenário)
Todas as regras são avaliadas independentemente para cada zona do talhão:
1. **`OPTIMAL_VIGOR` (Planta Forte / Sadia):** $Z_{\text{NDVI}} > -0.8$, $\text{CWSI} < 0.35$ e $K_s \ge 0.70$.
2. **`WATER_DEFICIT_STRESS` (Planta com Sede):** $K_s < 0.55$ (via NASA `GWETROOT` + FAO-56) **E** ($Z_{\text{NDWI}} \le -1.0$ **OU** $\text{CWSI} \ge 0.50$).
3. **`PHYTOSANITARY_ANOMALY` (Suspeita de Praga ou Doença):**
   - **Lógica de Exclusão Biofísica:** Água disponível adequada no solo ($\text{GWETROOT} \ge 0.50$ e chuva acumulada compatível com o mínimo do **FAO EcoCrop** `RMIN`), **MAS** queda severa e localizada de vigor ($Z_{\text{NDVI}} \le -1.5$) acompanhada de fechamento estomático/febre foliar ($\text{CWSI} \ge 0.50$ ou anomalia de $T_c > +2.0^\circ\text{C}$ sobre pixels saudáveis do mesmo talhão), agravada por gatilho térmico/úmido (`GDD` + `RH2M`) ou alerta comunitário.
4. **`THERMAL_HEAT_SHOCK` (Calor Excessivo na Florada/Ciclo):** `T2M_MAX` (NASA POWER) $>$ `TOPMX` (limite superior ótimo da espécie no **FAO EcoCrop**) **E** $\text{CWSI} \ge 0.45$.
5. **`SOIL_EROSION_EXPOSURE` (Terra Descoberta em Risco):** Fator de cobertura $C_{\text{Sentinel2}} > 0.40$ (correspondente a alto `BSI`) combinado com fator topográfico $LS_{\text{NASADEM}}$ elevado.
6. **`INSUFFICIENT_OBSERVATION` (Nuvens sobre o Terreno):** Menos de 60% de pixels limpos na banda `SCL` nos últimos 30 dias.

## 5. Contrato JSON Unificado (Científico + Acessível para o Agricultor)

```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "evaluated_at_utc": "2026-11-15T11:30:00Z",
  "farmer_accessible_view": {
    "overall_traffic_light": "RED",
    "status_badge_title": "Atenção na Roça: Possível Praga e Terra Descoberta",
    "status_icon": "bug-alert",
    "health_score_0_to_100": 58,
    "voice_tts_script_pt": "Olá, companheiro agricultor. Olhamos sua roça de Feijão-caupi pelos satélites da NASA. Choveu o suficiente nos últimos dias, mas na parte de cima do seu terreno as plantas estão perdendo força e esquentando, o que indica ataque de bicho ou doença na folha, e não falta de água. Também vimos um pedaço de terra descoberta na descida do terreno. Toque nos desenhos abaixo para ver o que fazer hoje.",
    "visual_field_zones": [
      {
        "zone_id": "zona_norte",
        "location_label_pt": "Parte de cima do terreno (Norte)",
        "color_hex": "#DC2626",
        "icon_name": "bug",
        "short_label_pt": "Olhar folhas (Suspeita de Praga)",
        "polygon_geojson": { "type": "Polygon", "coordinates": [] }
      },
      {
        "zone_id": "zona_sul_baixa",
        "location_label_pt": "Parte mais baixa (Descida)",
        "color_hex": "#D97706",
        "icon_name": "layers",
        "short_label_pt": "Terra nua (Cobrir com palha)",
        "polygon_geojson": { "type": "Polygon", "coordinates": [] }
      },
      {
        "zone_id": "zona_central",
        "location_label_pt": "Meio da roça",
        "color_hex": "#16A34A",
        "icon_name": "sprout",
        "short_label_pt": "Planta forte e sadia",
        "polygon_geojson": { "type": "Polygon", "coordinates": [] }
      }
    ],
    "action_cards": [
      {
        "step_number": 1,
        "urgency_color": "RED",
        "icon_name": "search-leaf",
        "title_pt": "Olhar debaixo das folhas na parte de cima",
        "instruction_pt": "Vá até a mancha vermelha do mapa e vire as folhas. Procure por pulgão ou manchas. Não jogue veneno sem antes mostrar a um técnico da assistência rural."
      },
      {
        "step_number": 2,
        "urgency_color": "YELLOW",
        "icon_name": "shield-soil",
        "title_pt": "Proteger a terra na descida",
        "instruction_pt": "Espalhe palha seca ou restos de capim na parte amarela do mapa para a chuva forte não lavar a terra boa."
      }
    ]
  },
  "crop_agronomic_baseline": {
    "scientific_name": "Vigna unguiculata",
    "common_name_pt": "Feijão-caupi",
    "fao_ecocrop_parameters": {
      "t_base_c": 10.0,
      "t_opt_min_c": 20.0,
      "t_opt_max_c": 35.0,
      "t_max_lethal_c": 42.0,
      "cycle_days_min": 60,
      "cycle_days_max": 90,
      "r_min_mm": 300.0,
      "r_opt_min_mm": 400.0,
      "source": "FAO_ECOCROP_DATABASE"
    },
    "fao_gaez_v4_suitability": {
      "suitability_index_0_100": 74.0,
      "attainable_yield_low_input_kg_ha": 1180.0,
      "water_supply_regime": "RAINFED",
      "source": "FAO_GAEZ_V4_RES05_COG"
    }
  },
  "scientific_telemetry": {
    "data_provenance": [
      {
        "dataset": "COPERNICUS/S2_L2A_STAC",
        "scene_id": "S2B_MSIL2A_20261112T130239",
        "native_resolution_m": 10,
        "valid_pixels_in_polygon": 482
      },
      {
        "dataset": "NASA_USGS/LANDSAT_C2_L2_TIRS",
        "scene_id": "LC09_L2SP_216064_20261110",
        "native_resolution_m": 30,
        "band": "lwir11_surface_temperature"
      },
      {
        "dataset": "NASA/NASADEM_HGT_V001",
        "native_resolution_m": 30
      },
      {
        "dataset": "NASA/POWER_MERRA2_AG_DAILY",
        "variables": ["PRECTOTCORR", "GWETROOT", "GWETTOP", "T2M_MAX", "T2M_MIN", "RH2M", "ALLSKY_SFC_SW_DWN"],
        "native_resolution_km": 50.0
      }
    ],
    "biophysical_indices": {
      "ndvi_mean": 0.41,
      "ndvi_phenological_z_score": -1.64,
      "evi_mean": 0.29,
      "lai_boegh_m2_m2": 0.93,
      "ndwi_gao_mean": -0.04,
      "ndwi_z_score": -1.25,
      "bsi_rikimaru_mean": 0.14,
      "rusle_c_factor": 0.42,
      "rusle_ls_factor": 1.38,
      "canopy_temp_celsius": 36.8,
      "cwsi_jackson_index": 0.58,
      "nasa_gwetroot_0_to_1": 0.56,
      "fao56_ks_water_stress_coeff": 0.74,
      "gdd_accumulated_c_day": 912.5,
      "et0_fao56_30d_mm": 142.0,
      "precip_gpm_power_30d_mm": 48.0
    },
    "diagnostic_assessments": [
      {
        "condition_code": "PHYTOSANITARY_ANOMALY",
        "severity": "HIGH",
        "confidence": 0.84,
        "equation_triggered": "Ks >= 0.70 AND Z_NDVI <= -1.5 AND CWSI >= 0.50"
      },
      {
        "condition_code": "SOIL_EROSION_EXPOSURE",
        "severity": "MODERATE",
        "confidence": 0.79,
        "equation_triggered": "RUSLE_C > 0.40 AND RUSLE_LS > 1.20"
      }
    ]
  },
  "dssat_state_vector": {
    "observed_lai_m2_m2": 0.93,
    "water_stress_factor_swfac": 0.74,
    "rootzone_soil_wetness_fraction": 0.56,
    "soil_surface_cover_fraction": 0.715,
    "accumulated_gdd": 912.5,
    "pest_disease_damage_detected": true,
    "rotation_constraints_for_dssat": [
      "BREAK_PEST_HOST_CYCLE",
      "INCREASE_BIOMASS_COVER_HIGH_RUSLE_C"
    ]
  },
  "scale_disclaimers": [
    "O diagnóstico espacial dentro do terreno (< 5 ha) utiliza pixels reais de 10m (Sentinel-2) e 30m (Landsat TIRS e NASA NASADEM). Variáveis agroclimáticas e de umidade profunda (NASA POWER/MERRA-2 GWETROOT e FAO GAEZ v4) possuem resolução regional (9 km a 50 km) e calibram o balanço físico macro."
  ],
  "human_in_the_loop_notice": "Esta ferramenta apoia a tomada de decisão e não substitui o conhecimento do agricultor nem a vistoria presencial de um técnico da extensão rural (EMATER/BAHIATER)."
}
```