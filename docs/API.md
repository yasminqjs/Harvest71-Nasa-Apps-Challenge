# API do Field Shift — contrato para o app e para os outros devs

Base: `https://fieldshift-api-avshjoa6eq-uc.a.run.app` · JSON UTF-8 · sem conta Google necessária.

## Autenticação
Rotas de simulação exigem o cabeçalho `X-API-Key: <chave>`. A chave é entregue pela dona do projeto por
canal privado. **Nunca** a coloque no repositório (ele é público), em prints ou logs.

| Código | Significado |
|---|---|
| 401 | chave ausente ou errada |
| 422 | dados inválidos (mensagem em `detail`) |
| 429 | limite atingido (6/min, 200/dia por chave) |
| 503 | simulações ainda não habilitadas no servidor |

## Rotas públicas
- `GET /health` → `{"status":"ok"}`
- `GET /version` → `{"service","version","commit"}`
- `GET /scenarios` → cenários prontos de 5 locais do Nordeste (milho, 33 safras)
- `GET /scenarios/{site}` → detalhe de um local (`JUAZ`, `IREC`, `CRUZ`, `CGPB`, `QUIX`), com suposições

## Simular uma localização

### `POST /simulations` (com chave) → `202`
```json
{
  "lat": -9.41,
  "lon": -40.50,
  "label": "Roça do Zé",
  "crop": "milho",
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
| `crop` | não | por enquanto só `"milho"` |
| `planting_windows` | não | 1 a 3 datas `MM-DD` (sem `02-29`). **Se omitido**, o servidor escolhe pelo clima do ponto (dia 1 do mês que abre o quadrimestre mais chuvoso e dos 2 seguintes) — marcado como suposição |
| `soil_analysis` | não | **modo padrão é a estimativa** (PronaSolos). Se enviada, cada camada (`top_cm`–`bottom_cm`) substitui a estimativa nas profundidades do modelo cujo ponto médio cai nela |

Campos de cada camada da análise: `areia_g_kg`, `argila_g_kg`, `silte_g_kg`, `carbono_organico_g_kg`
**ou** `materia_organica_g_kg`, `ph_agua`, `ctc_cmolc_kg`, `densidade_g_cm3` (usados no modelo) e
`p_mg_dm3`, `k_mg_dm3`, `k_cmolc_dm3` (**só registrados**: o milho, como configurado, não usa P e K).

Resposta:
```json
{"id": "3f9c2a7b1d4e8f60", "status": "queued", "created_utc": "2026-11-15T11:38:14+00:00",
 "poll": "/simulations/3f9c2a7b1d4e8f60", "note": "a simulação leva cerca de 15 a 60 s; ..."}
```

### `GET /simulations/{id}` (com chave)
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
  - `share_seasons_below_1000_kg_ha`: fração de anos com safra muito fraca (risco).
  - `irrigation_mm_p50`: água que a irrigação automática usou (1 mm em 1 ha = 10 000 litros).
- `soil.layers[].origem`: "medido (análise do agricultor)" ou "estimado (PronaSolos 90 m)".
- `evidence`: **sempre** mostrar que é comparação exploratória, não previsão de safra.

## Exemplo em JavaScript
```js
const BASE = "https://fieldshift-api-avshjoa6eq-uc.a.run.app";
const KEY = process.env.FIELDSHIFT_API_KEY;            // nunca no código

async function simular(lat, lon, soil_analysis) {
  const r = await fetch(`${BASE}/simulations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": KEY },
    body: JSON.stringify({ lat, lon, soil_analysis }),
  });
  if (!r.ok) throw new Error((await r.json()).detail);
  const { id } = await r.json();
  for (let i = 0; i < 60; i++) {                        // até ~5 min
    await new Promise((ok) => setTimeout(ok, 5000));
    const s = await (await fetch(`${BASE}/simulations/${id}`, { headers: { "X-API-Key": KEY } })).json();
    if (s.status === "done" || s.status === "failed") return s;
  }
  throw new Error("tempo esgotado");
}
```

## Exemplo com curl
```bash
curl -s -X POST "$BASE/simulations" -H "X-API-Key: $FIELDSHIFT_API_KEY" \
     -H "Content-Type: application/json" -d '{"lat":-12.67,"lon":-39.10}'
curl -s "$BASE/simulations/<id>" -H "X-API-Key: $FIELDSHIFT_API_KEY"
```

## Offline
O app pode guardar a resposta inteira de `/simulations/{id}` e de `/scenarios` para uso sem internet.
Uma simulação **nova** só roda com conexão; não mostre resultado antigo como se fosse novo
(use `finished_utc`).
