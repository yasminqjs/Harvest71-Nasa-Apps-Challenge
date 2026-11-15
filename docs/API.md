# API do Field Shift — contrato para o app e para os outros devs

Base: `https://fieldshift-api-avshjoa6eq-uc.a.run.app` · JSON UTF-8 · sem conta Google necessária.

Para montar as telas, formular os pedidos e acompanhar os Jobs, consulte o [guia de integração do front](GUIA_FRONT_DSSAT.md).

## Acesso
**Por enquanto o acesso é livre:** não precisa de chave. Cada IP pode fazer 6 simulações por minuto e
200 por dia, e o servidor tem um teto diário global. Quando a equipe ligar a exigência de chave
(`REQUIRE_API_KEY=true`), o app passa a enviar o cabeçalho `X-API-Key: <chave>` — já pode deixar o
código preparado para enviar a chave se ela existir. **Nunca** coloque a chave no repositório (ele é público).

| Código | Significado |
|---|---|
| 401 | chave ausente ou errada (só quando a exigência de chave estiver ligada) |
| 422 | dados inválidos (mensagem em `detail`) |
| 429 | limite atingido (por IP/chave ou teto diário do servidor) |
| 503 | exigência de chave ligada sem chaves configuradas |

## Rotas públicas
- `GET /health` → `{"status":"ok"}`
- `GET /version` → `{"service","version","commit"}`
- `GET /scenarios` → cenários prontos de 5 locais do Nordeste (milho, 33 safras)
- `GET /scenarios/{site}` → detalhe de um local (`JUAZ`, `IREC`, `CRUZ`, `CGPB`, `QUIX`), com suposições (milho)
- `GET /crops` → culturas disponíveis para o menu do app
- `GET /climate-projections` → opções de clima futuro (NASA NEX-GDDP-CMIP6): cenários, períodos e modelos
- `GET /crops/{code}` → uma cultura com **todos os cultivares** (aceita código ou nome: `MZ`, `milho`, `feijão-caupi`, `macaxeira`)

## Culturas disponíveis
| Código | Cultura | Produção medida | Cultivar padrão | Cultivares | Experimento de referência |
|---|---|---|---|---|---|
| `MZ` | Milho | grãos | AG901 (IB0171) | 168 | BRPI0202.MZX |
| `BN` | Feijão | grãos | Porri (IB0001) | 32 | CCPA8629.BNX |
| `CP` | Feijão-caupi | grãos | VERDE (CP0006) | 14 | CCPA9701.CPX |
| `SB` | Soja | grãos | M 706 (BR7062) | 61 | LQBR1905.SBX |
| `PN` | Amendoim | grãos (vagens) | FLORU (IB0002) | 39 | UFGA7601.PNX |
| `CS` | Mandioca | raízes (matéria seca) | MCol- (UC0006) | 21 | CCPA7801.CSX |
| `SG` | Sorgo | grãos | CSH-1 (IB0026) | 57 | ITHY8001.SGX |
| `ML` | Milheto | grãos | BJ104 (IB0033) | 62 | ITHY8201.MLX |
| `RI` | Arroz | grãos | IR 36 (IB0003) | 57 | IRPI8001.RIX |
| `SU` | Girassol | grãos | Hysun (IB0018) | 13 | UAFD0801.SUX |
| `CO` | Algodão | capulhos | GP 37 (TX0003) | 19 | TXTE8401.COX |
| `PP` | Feijão-guandu | grãos | 76 W (PP0001) | 5 | UFGA8401.PPX |
| `SC` | Cana-de-açúcar | biomassa (colmos + folhas, matéria seca) | RB867 (RB7515) | 8 | ESAL1401.SCX |
| `PI` | Abacaxi | frutos (matéria seca) | SC-F1 (IB0066) | 6 | UHKN8901.PIX |
| `TR` | Inhame (taro) | cormos (matéria seca) | LEHUA (IB0001) | 9 | IBHK8901.TRX |
| `TN` | Taioba (tanier) | cormos (matéria seca) | BLANC (IB0006) | 5 | MTIS8901.TNX |
| `TM` | Tomate | frutos (matéria seca) | Flori (TM0001) | 6 | UFGA0602.TMX |
| `PR` | Pimentão | frutos (matéria seca) | CAPIS (PR0001) | 7 | UFBR9601.PRX |
| `GB` | Feijão-vagem | vagens (matéria seca) | Bronc (GB0001) | 3 | UFGA0701.GBX |
| `SW` | Milho-verde | espigas (matéria seca) | GSS09 (SW0001) | 5 | UFCI0201.SWX |
| `CB` | Repolho | cabeças (matéria seca) | Tasti (CB0001) | 5 | IBMC9601.CBX |
| `PT` | Batata | tubérculos (matéria seca) | ACHIR (AR0003) | 20 | CPSR1302.PTX |
| `CH` | Grão-de-bico | grãos | ANNIG (IB0001) | 34 | ITBP8502.CHX |

Todas rodam a simulação completa nos testes (33 safras × 4 cenários). Os coeficientes vêm da biblioteca
do DSSAT e **não foram calibrados** no local. Produção em **kg/ha de matéria seca** da parte indicada
(para cana, biomassa total). Compare cenários de uma mesma cultura; entre culturas, compare risco
(`share_seasons_below_half_irrigated_p50`), não toneladas.

### Cultivares brasileiros
Em `GET /crops/{code}`, cada cultivar brasileiro tem `"origin": "Brasil"` e `"source"`. Os que vieram de
artigos têm também `source_institution`, `source_location`, `calibration_model` e `inherited` (campos que o
artigo não traz e foram copiados de um cultivar base). Use o `id` no campo `cultivar` de `POST /simulations`.

| ID | Cultura | Cultivar | Fonte (calibração) | Local |
|---|---|---|---|---|
| `FSCS01` | Mandioca | BRS Novo Horizonte | Melo et al. (2025) | Cruz das Almas, BA |
| `FSCS02` | Mandioca | Eucalipto | Melo et al. (2025) | Cruz das Almas, BA |
| `FSBN01` | Feijão | Perola | Oliveira et al. (2012) | Viçosa, MG |
| `FSBN02` | Feijão | Ouro Negro | Oliveira et al. (2012) | Viçosa, MG |
| `FSBN03` | Feijão | Ouro Vermelho | Oliveira et al. (2012) | Viçosa, MG |
| `FSSB01` | Soja | M-SOY 6101 | Rodrigues et al. (2012) | Viçosa, MG (safra 2009/10) |
| `FSSB02` | Soja | MG/BR 46 Conquista | Rodrigues et al. (2012) | Viçosa, MG (safra 2009/10) |
| `FSSB03` | Soja | CD 202 | Dallacort et al. (2006) | Palotina, PR |
| `FSSB04` | Soja | CD 204 | Dallacort et al. (2006) | Palotina, PR |
| `FSSB05` | Soja | CD 206 | Dallacort et al. (2006) | Palotina, PR |
| `FSSB06` | Soja | CD 210 | Dallacort et al. (2006) | Palotina, PR |

Também marcados como brasileiros (biblioteca oficial do DSSAT 4.8): feijão IB0010 Carioca e IB0037;
caupi CP0006 VERDE BRASIL; milho IB0171 AG9010, IB0172, IB0173, EBSL06 BRS1030; soja 990248 BRS 399,
BR7063, BR7062, BR7901, BR6565, BR0858; cana RB7515 (RB867515). Os calibrados fora do Nordeste
(Viçosa, Palotina, Cruz das Almas para mandioca) servem para comparar cultivares, não substituem
calibração local. Registro completo e o que ficou de fora: `apps/dssat/cultivars_br.json`.

## Simular uma localização

### `POST /simulations` → `202`
```json
{
  "lat": -9.41,
  "lon": -40.50,
  "label": "Roça do Zé",
  "crop": "feijão-caupi",
  "cultivar": null,
  "planting_windows": ["11-15", "12-15"],
  "soil_analysis": {
    "lab": "Laboratório X",
    "sample_date": "2026-08-10",
    "layers": [
      {"top_cm": 0,  "bottom_cm": 20, "areia_g_kg": 520, "argila_g_kg": 250, "silte_g_kg": 230,
       "materia_organica_g_kg": 18, "ph_agua": 6.1, "ctc_cmolc_kg": 6.5, "p_mg_dm3": 9, "k_mg_dm3": 80},
      {"top_cm": 20, "bottom_cm": 40, "argila_g_kg": 310, "densidade_g_cm3": 1.45}
    ]
  }
}
```

| Campo | Obrigatório | Regra |
|---|---|---|
| `lat`, `lon` | sim | graus decimais; só Brasil (cobertura do PronaSolos) |
| `label` | não | nome livre, até 60 caracteres (acentos ok) |
| `crop` | não | código ou nome de `GET /crops` (padrão `milho`) |
| `cultivar` | não | id de `GET /crops/{code}`; vazio = cultivar padrão da cultura |
| `planting_windows` | não | 1 a 3 datas `MM-DD` (sem `02-29`). **Se omitido**, o servidor escolhe pelo clima do ponto (dia 1 do mês que abre o quadrimestre mais chuvoso e dos 2 seguintes) — marcado como suposição |
| `soil_analysis` | não | **modo padrão é a estimativa** (PronaSolos). Se enviada, cada camada (`top_cm`–`bottom_cm`) substitui a estimativa nas profundidades do modelo cujo ponto médio cai nela |
| `weather_events` | não | Até 4 eventos hipotéticos de seca, com datas históricas ISO e janelas sem sobreposição |

Exemplo de item em `weather_events`:

```json
{"id":"seca-1","type":"rainfall_multiplier","start_date":"2024-02-01","end_date":"2024-02-20","factor":0.2}
```

O fator 0,2 conserva 20% da chuva em cada dia do intervalo inclusivo. A janela
precisa ter cobertura no histórico NASA POWER. Para comparar com uma simulação
sem evento, envie as mesmas janelas de plantio explicitamente nos dois pedidos.
O resultado registra a transformação em `climate.event_transform`.

Campos de cada camada da análise: `areia_g_kg`, `argila_g_kg`, `silte_g_kg`, `carbono_organico_g_kg`
**ou** `materia_organica_g_kg`, `ph_agua`, `ctc_cmolc_kg`, `densidade_g_cm3` (usados no modelo) e
`p_mg_dm3`, `k_mg_dm3`, `k_cmolc_dm3` (**só registrados**: o milho, como configurado, não usa P e K).

Resposta:
```json
{"id": "3f9c2a7b1d4e8f60", "status": "queued", "created_utc": "2026-11-15T11:38:14+00:00",
 "poll": "/simulations/3f9c2a7b1d4e8f60", "note": "a simulação leva cerca de 15 a 60 s; ..."}
```

### `GET /simulations/{id}`
Consulte a cada ~5 s. `status`: `queued` → `running` → `done` | `failed` (com `error`). Sem resultado
em 15 min vira `failed`.

Exemplo de `done` (valores **ilustrativos**, gerados com clima sintético num teste; trechos cortados):
```json
{
  "id": "3f9c2a7b1d4e8f60",
  "status": "done",
  "started_utc": "2026-11-15T11:38:15+00:00",
  "finished_utc": "2026-11-15T11:38:16+00:00",
  "request": {
    "lat": -9.41,
    "lon": -40.5,
    "label": "Roça do Zé",
    "crop": "milho",
    "planting_windows": null
  },
  "location": {
    "lat": -9.41,
    "lon": -40.5,
    "elev_m": 370.0,
    "power_cell": "161_223"
  },
  "crop": "milho (CERES-Maize)",
  "seasons": {
    "first_planting_year": 1992,
    "n_years": 33
  },
  "scenario_summary": [
    {
      "trno": 1,
      "name": "Janela 1 01/12 sequeiro",
      "planting_mm_dd": "12-01",
      "irrigated": false,
      "n_seasons": 33,
      "yield_kg_ha": {
        "p10": 5026.6,
        "p50": 5344.0,
        "p90": 5520.2
      },
      "share_seasons_below_1000_kg_ha": 0.0,
      "maturity_dap_p50": 101.0,
      "rain_mm_p50": 817.0,
      "irrigation_mm_p50": 0.0,
      "et_mm_p50": 439.0
    },
    {
      "trno": 2,
      "name": "Janela 2 01/01 sequeiro",
      "planting_mm_dd": "01-01",
      "irrigated": false,
      "n_seasons": 33,
      "yield_kg_ha": {
        "p10": 4778.0,
        "p50": 4987.0,
        "p90": 5037.4
      },
      "share_seasons_below_1000_kg_ha": 0.0,
      "maturity_dap_p50": 101.0,
      "rain_mm_p50": 888.0,
      "irrigation_mm_p50": 0.0,
      "et_mm_p50": 482.0
    }
  ],
  "climate": {
    "source": "NASA POWER diário (AG)",
    "period": [
      "1991-01-01",
      "2025-12-31"
    ],
    "tav_c": 22.69,
    "amp_c": 8.17,
    "cache_hit": false
  },
  "soil": {
    "source": "medido + estimado",
    "texture_top": "SCL",
    "layers": [
      {
        "SLB": 5,
        "SLLL": 0.161,
        "SDUL": 0.2734,
        "SSAT": 0.4301,
        "SRGF": 1.0,
        "SSKS": 0.9608,
        "SBDM": 1.5101,
        "SLOC": 1.0441,
        "SLCL": 25.0,
        "SLSI": 23.0,
        "SLCF": -99,
        "SLNI": -99,
        "SLHW": 6.1,
        "SCEC": 5.1,
        "CE_dS_m": 0.012,
        "origem": "medido (análise do agricultor), Lab X"
      },
      {
        "SLB": 15,
        "SLLL": 0.161,
        "SDUL": 0.2734,
        "SSAT": 0.4301,
        "SRGF": 1.0,
        "SSKS": 0.9608,
        "SBDM": 1.5101,
        "SLOC": 1.0441,
        "SLCL": 25.0,
        "SLSI": 23.0,
        "SLCF": -99,
        "SLNI": -99,
        "SLHW": 6.1,
        "SCEC": 5.1,
        "CE_dS_m": 0.012,
        "origem": "medido (análise do agricultor), Lab X"
      }
    ],
    "warnings": [
      "0-20 cm: C orgânico calculado da MO (÷ 1,724)"
    ],
    "cache_hit": false
  },
  "planting_windows_source": "automática: início do quadrimestre mais chuvoso (NASA POWER) — suposição",
  "evidence": {
    "quality_level": "exploratorio",
    "local_soil_analysis": true,
    "local_calibration_available": false,
    "is_actual_forecast": false,
    "note": "Comparação relativa entre janelas e manejo hídrico; não é previsão de produtividade."
  }
}
```

### Como mostrar ao agricultor
- `scenario_summary[]`: um item por cenário (3 janelas em sequeiro + a 2ª janela com irrigação automática).
  - `yield_kg_ha.p10/p50/p90`: produtividade simulada num ano ruim / típico / bom (33 safras históricas).
  - `share_seasons_below_half_irrigated_p50`: fração de anos com quebra forte (abaixo de metade do potencial
    irrigado no mesmo local) — **use este para comparar risco entre culturas**.
  - `share_seasons_below_1000_kg_ha`: fração de anos abaixo de 1000 kg/ha (útil só para grãos).
  - `irrigation_mm_p50`: água que a irrigação automática usou (1 mm em 1 ha = 10 000 litros).
- `soil.layers[].origem`: "medido (análise do agricultor)" ou "estimado (PronaSolos 90 m)".
- `evidence`: **sempre** mostrar que é comparação exploratória, não previsão de safra.

## Clima futuro (NASA NEX-GDDP-CMIP6)

Acrescente `climate_projection` ao `POST /simulations` para também simular o clima de meados do século.
Opções: `GET /climate-projections`.

```json
{"lat": -12.67, "lon": -39.10, "crop": "feijao-caupi",
 "climate_projection": {"scenario": "ssp245", "period": "2041-2060"}}
```

| Campo | Valores | Padrão |
|---|---|---|
| `scenario` | `ssp245` (intermediário), `ssp585` (emissões muito altas) | `ssp245` |
| `period` | `2041-2060` | `2041-2060` |
| `models` | `GISS-E2-1-G` (NASA), `GFDL-ESM4`, `MPI-ESM1-2-HR` | os três |

- **Tempo:** cerca de 30 a 90 s, igual a uma simulação comum. O pedido nunca espera download da NASA: os dados
  são pré-processados uma vez, em segundo plano, pelo workflow `nex-gddp` (Nordeste primeiro, depois o Brasil inteiro).
- **Antes de ficar pronto** (ou fora do Brasil): o resultado atual vem normal e `climate_projection.status` vem
  `"unavailable"`. Mostre "projeção futura ainda indisponível para esta área".
- Enquanto o futuro é calculado, a resposta vem com `status: "running"` e o resultado atual já preenchido.
- **Resultado:** o mesmo JSON de sempre, mais o bloco `climate_projection`:

```json
"climate_projection": {
  "status": "done", "scenario": "ssp245", "period": "2041-2060", "historical_reference": "1995-2014",
  "nex_cell": {"lat": -12.625, "lon": -39.125, "size_deg": 0.25},
  "models": [{"model": "GISS-E2-1-G", "institution": "NASA Goddard Institute for Space Studies (EUA)",
              "climate_change": {"tmax_change_c": 1.44, "tmin_change_c": 1.48, "rain_change_pct": -7.1,
                                 "srad_change_pct": 0.6},
              "monthly_deltas": {"1": {"dTMAX": 1.72, "dTMIN": 1.51, "fRAIN": 0.76, "fSRAD": 1.02}, "...": {}},
              "scenario_summary": ["mesmo formato do resultado atual"]}],
  "ensemble": [{"trno": 1, "name": "Janela 1 01/03 sequeiro", "baseline_yield_p50": 944,
                "future_yield_p50_median": 1007, "future_yield_p50_range": [900, 1100],
                "yield_change_pct": 6.7, "baseline_share_below_1000": 0.5,
                "future_share_below_1000_median": 0.47, "models_with_loss": 1, "n_models": 3}],
  "failures": []
}
```

- **Como mostrar:** "Em 2041–2060 (cenário intermediário), a janela de 01/04 tende a render X % a menos;
  2 de 3 modelos indicam perda." Use `ensemble` para o número e `models_with_loss` para a concordância.
- Se a parte futura falhar, o resultado atual continua válido e `climate_projection.status` vem `"failed"`
  com o motivo.
- **Método e limites:** mudança mensal de cada modelo (futuro − 1995–2014) aplicada ao NASA POWER 1991–2025
  do ponto; CO₂ no nível observado; secas mais longas não aparecem. Detalhes em
  `docs/decisions/0002-fontes-de-dados.md`.

## Exemplo em JavaScript
```js
const BASE = "https://fieldshift-api-avshjoa6eq-uc.a.run.app";
const KEY = process.env.FIELDSHIFT_API_KEY;            // opcional por enquanto; nunca no código
const auth = KEY ? { "X-API-Key": KEY } : {};

async function simular(lat, lon, soil_analysis) {
  const r = await fetch(`${BASE}/simulations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({ lat, lon, soil_analysis }),
  });
  if (!r.ok) throw new Error((await r.json()).detail);
  const { id } = await r.json();
  for (let i = 0; i < 60; i++) {                        // até ~5 min
    await new Promise((ok) => setTimeout(ok, 5000));
    const s = await (await fetch(`${BASE}/simulations/${id}`, { headers: auth })).json();
    if (s.status === "done" || s.status === "failed") return s;
  }
  throw new Error("tempo esgotado");
}
```

## Exemplo com curl
```bash
curl -s -X POST "$BASE/simulations" -H "Content-Type: application/json" -d '{"lat":-12.67,"lon":-39.10}'
curl -s "$BASE/simulations/<id>"
```

## Offline
O app pode guardar a resposta inteira de `/simulations/{id}` e de `/scenarios` para uso sem internet.
Uma simulação **nova** só roda com conexão; não mostre resultado antigo como se fosse novo
(use `finished_utc`).

### Planejamento de calendário

`GET /planning/capabilities` lista as capacidades disponíveis. `POST /planning/calendar`
aceita `horizon_start`, `horizon_end`, `known_crops` e uma lista `windows` com
`crop`, `planting_date` e `cultivar` opcional. Também aceita `max_cycles`,
`max_candidates` e `min_gap_days`. Exemplo:

```json
{
  "horizon_start": "2027-01-01",
  "horizon_end": "2028-12-31",
  "known_crops": ["MZ", "CP"],
  "windows": [
    {"crop": "MZ", "planting_date": "2027-01-10"},
    {"crop": "CP", "planting_date": "2028-01-10"}
  ]
}
```

`POST /planning/calendar/replan` recebe os mesmos campos, mais `decision_date`
e `route` com os ciclos e respectivas datas de fim. O cliente informa o
histórico realizado e as janelas futuras atualizadas. A resposta verifica a
rota anterior e gera calendários alternativos que preservam os ciclos iniciados.
`known_crops` limita os novos plantios; os ciclos já iniciados permanecem no histórico.
O encerramento antecipado fica marcado como indisponível quando há cultura ativa.

Essas rotas devolvem estimativas de calendário baseadas no catálogo. O campo
`evidence.dssat_simulated` fica `false`. Produtividade, continuidade do solo,
impacto de eventos e comparação agronômica exigem execução no motor.

### Comparação de rotações com duas ou três culturas

Envie a coordenada, duas ou três culturas distintas com todos os pares publicados em `/planning/capabilities`
e uma data por cultura, em ordem em até dois anos consecutivos (1992 a 2024), para
`POST /rotations`. O DSSAT tenta todas as permutações em sequeiro.

```json
{"lat":-9.41,"lon":-40.5,"crops":["MZ","CP"],"planting_dates":["1992-01-15","1992-07-15"]}
```

Consulte a URL `poll` da resposta até `done` ou `failed`. Cada permutação troca a cultura associada a cada data.
`alternatives` contém as ordens que completaram os plantios e `failed_alternatives`
lista as demais. Quando a ordem original foi concluída, `minus_baseline` mostra
as diferenças por cultura em cada alternativa. Para duas culturas, o campo
`reversed_minus_baseline` continua disponível. O resultado inclui efeitos de
calendário e vale para o calendário histórico escolhido. Se nenhuma ordem completar
os plantios, o pedido falha. Os limites de uso são compartilhados com simulações.

### Buscar rotações a partir das culturas conhecidas

`POST /rotations/search` recebe a lista de culturas conhecidas, três posições de
plantio, dois ou três anos históricos e uma meta de produção em kg/ha para
cada cultura habilitada. Exemplo:

```json
{
  "lat": -9.41,
  "lon": -40.5,
  "known_crops": ["milho", "caupi", "sorgo", "abacaxi"],
  "planting_dates": ["1992-01-15", "1992-06-15", "1993-01-15"],
  "historical_start_years": [1992, 1993],
  "yield_targets_kg_ha": {"MZ": 1500, "CP": 500, "SG": 1500},
  "max_candidates": 8
}
```

A busca transfere os dias e meses para cada ano histórico solicitado. As
rotações de duas culturas usam as duas primeiras datas. O filtro descarta
ordens cujo intervalo é insuficiente segundo a duração de referência do
catálogo e ignora transições entre pares sem evidência de execução. São selecionadas até oito ordens, dando espaço a pares e trios
e diversificando culturas por posição. A resposta `poll` acompanha o Job.

O resultado lista até três `recommendations` e inclui as demais ordens simuladas
em `ranked_alternatives`. A classificação usa primeiro o número de anos em
que todas as metas foram atingidas, depois a proporção média de cumprimento
das metas, limitada a 100% por ciclo. As ordens que falharam em algum ano
aparecem em `incomplete_alternatives` e ficam fora da classificação. O resultado
informa as culturas excluídas, ordens descartadas e ordens omitidas pelo
orçamento. Os números descrevem os anos testados e o manejo de sequeiro.

Consulte `rotation_target_metric` em `/planning/capabilities` para saber qual
variável cada cultura usa. Para uma cultura cuja meta usa biomassa seca
(por exemplo cana, `SC`), envie seu código em `biomass_target_crops` e a meta
em kg/ha de biomassa seca no mapa `yield_targets_kg_ha`.
