# Integração do front com o DSSAT no Field Shift

O front chama a API Field Shift por HTTPS e recebe JSON. A API recebe o pedido, enfileira o Job do DSSAT e fornece uma URL para acompanhar o resultado. O usuário informa a localização, as culturas e as escolhas de manejo ou calendário que a rota aceita.

- **API base:** `https://fieldshift-api-avshjoa6eq-uc.a.run.app`
- [Contrato técnico da API](API.md)
- [Capacidades do ambiente publicado](https://fieldshift-api-avshjoa6eq-uc.a.run.app/planning/capabilities)
- [Versão publicada da API](https://fieldshift-api-avshjoa6eq-uc.a.run.app/version)

## 1. Escolher o fluxo certo

| Ação do usuário | Rota | Entrega |
|---|---|---|
| Explorar exemplos prontos | `GET /scenarios`, `GET /scenarios/{site}` | Resultados históricos já calculados para locais de demonstração |
| Ver culturas e cultivares | `GET /crops`, `GET /crops/{code}` | Catálogo geral, cultivares, produto, duração de referência |
| Descobrir o que pode entrar numa rotação | `GET /planning/capabilities` | Culturas e pares habilitados, métrica de meta, recursos disponíveis |
| Simular uma cultura no talhão | `POST /simulations` | Resumo histórico por janela de plantio e cenário hídrico |
| Comparar as ordens de duas ou três culturas escolhidas | `POST /rotations` | Permutações simuladas para as datas indicadas |
| Buscar rotações entre as culturas que conhece | `POST /rotations/search` | Até três opções destacadas, alternativas simuladas e exclusões |
| Montar ou reajustar o calendário | `POST /planning/calendar`, `POST /planning/calendar/replan` | Viabilidade por datas e duração de referência, sem executar o DSSAT |

As três rotas de simulação e rotação retornam HTTP 202 e um campo `poll`. As rotas de calendário retornam o resultado diretamente, com HTTP 200.

## 2. Localização, solo e clima

1. Peça a localização do talhão no mapa ou por latitude e longitude. Envie `lat` e `lon` em graus decimais. Para o Nordeste, a latitude e a longitude costumam ser negativas. Verifique a ordem antes de enviar.
2. O backend consulta **PronaSolos** para estimar os atributos por camada e **NASA POWER** para obter a série meteorológica histórica que cobre a localização. O clima da grade é uma estimativa regional. Em uma comparação, todas as alternativas usam a mesma origem de solo e os mesmos calendários climáticos aplicáveis.
3. Na simulação individual, `soil_analysis` pode substituir valores nas camadas informadas. O formato, as unidades e as propriedades aceitas constam no [contrato da API](API.md#simular-uma-localização). As rotas de calendário e rotação não aceitam laudo de solo. As duas rotas de rotação usam a estimativa do PronaSolos.
4. A API valida os limites geográficos gerais do Brasil. Uma coordenada que passa nessa validação ainda pode falhar no Job se não houver cobertura de solo ou clima. Mostre o erro e permita corrigir o ponto.

Os resultados de simulação são comparações históricas exploratórias. Um exemplo de rótulo é **“Simulação com clima histórico e solo estimado”**. Para o calendário sem DSSAT, use **“Estimativa de datas”**.

## 3. Montar o seletor de culturas

Busque `GET /crops` para os nomes, produtos e códigos. Use o código como valor interno do seletor e o nome como texto exibido. A consulta individual `GET /crops/MZ` retorna os cultivares e o cultivar padrão da cultura.

Combine o catálogo com `GET /planning/capabilities`:

- `crops[].single_crop` permite a simulação individual.
- `crops[].calendar` indica que há duração no catálogo para estimar o calendário.
- `crops[].dssat_sequence` indica que a cultura participa de pelo menos um par habilitado.
- `sequence_pairs` é a referência para as combinações habilitadas. Trate cada par como **sem direção**. A ordem só importa ao montar a sequência.
- `sequence_max_crops` indica o tamanho máximo de uma rotação.
- `crops[].rotation_target_metric` indica se a meta deve ser de produção ou biomassa.
- `rotation_search`, `dssat_replan` e `events` indicam os recursos disponíveis no ambiente consultado.

O catálogo geral e os pares de rotação têm coberturas diferentes. Na publicação consultada durante a elaboração deste guia, eram 21 culturas em 35 pares. Derive as opções da resposta da API para acompanhar novas liberações de pares.

## 4. Enviar, acompanhar e recuperar um resultado

1. Desabilite o botão de envio enquanto o POST estiver em andamento. Um novo POST gera outro Job.
2. No HTTP 202, guarde o `id` e o `poll`. Assim a tela pode retomar a consulta depois de navegar ou recarregar.
3. Consulte `poll` a cada cinco segundos. `queued` e `running` significam que o pedido pode continuar. Evite inferir porcentagem de progresso.
4. Encerre o polling em `done` ou `failed`. Em `failed`, mostre o campo `error` se existir. A API considera a solicitação expirada depois de cerca de 15 minutos sem resultado terminal.
5. Use o fluxo que originou o pedido e o campo `kind` quando disponível. O objeto de resultado da simulação individual tem estrutura diferente do de comparação e do de busca.

| HTTP | Ação do front |
|---|---|
| 200 | Renderizar a leitura ou resultado síncrono |
| 202 | Guardar o identificador e iniciar o acompanhamento |
| 401 | Verificar configuração de acesso |
| 404 | Informar que o registro não foi encontrado |
| 422 | Mostrar os campos inválidos. `detail` pode ser texto ou uma lista de erros com `loc` e `msg` |
| 429 | Avisar que o limite foi atingido e oferecer consulta ou envio posterior |
| 502, 503 ou rede indisponível | Mostrar falha temporária. Para GET, oferecer retomar a consulta. Pedir confirmação antes de repetir um POST cujo resultado foi desconhecido |

O contrato tem limites de uso para simulação e um limite diário adicional para busca. No ambiente que exigir `X-API-Key`, configure a chave em um serviço controlado pela equipe. Evite segredos no bundle público do navegador. Se houver erro de CORS na implantação do front, confira a origem cadastrada no backend.

### Exemplo em JavaScript

```js
const API = "https://fieldshift-api-avshjoa6eq-uc.a.run.app";

async function request(path, options = {}) {
  const url = new URL(path, API);
  if (url.origin !== new URL(API).origin) {
    throw new Error("Endereço fora da API configurada.");
  }

  const response = await fetch(url, options);
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = body?.detail;
    const message = Array.isArray(detail)
      ? detail.map(({ loc, msg }) => `${loc?.slice(1).join(".")}: ${msg}`).join("; ")
      : typeof detail === "string" ? detail : `Erro HTTP ${response.status}`;
    throw Object.assign(new Error(message), { status: response.status });
  }
  if (body === null) throw new Error("Resposta JSON indisponível.");
  return body;
}

async function submit(path, payload, signal) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
}

async function follow(poll, onStatus, signal) {
  const deadline = Date.now() + 16 * 60_000;
  while (!signal?.aborted && Date.now() < deadline) {
    const result = await request(poll, { signal });
    onStatus?.(result.status);
    if (result.status === "done" || result.status === "failed") return result;
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  if (signal?.aborted) throw signal.reason;
  throw new Error("O acompanhamento expirou. Use o identificador para consultar novamente.");
}

// Em um clique de envio:
// const job = await submit("/rotations/search", payload, controller.signal);
// guardar job.id e job.poll no estado ou na sessão para retomar depois
// const result = await follow(job.poll, atualizarIndicador, controller.signal);
```

`AbortController` interrompe o acompanhamento no navegador. O Job enfileirado continua até terminar.

## 5. Simulação de uma cultura e seca hipotética

`POST /simulations`

```json
{
  "lat": -9.41,
  "lon": -40.5,
  "crop": "MZ",
  "planting_windows": ["01-15", "02-15"],
  "weather_events": [
    {
      "id": "seca-1",
      "type": "rainfall_multiplier",
      "source_kind": "hypothetical",
      "start_date": "2024-02-01",
      "end_date": "2024-02-20",
      "factor": 0.2
    }
  ]
}
```

- `cultivar` opcional recebe o ID do catálogo. Se omitido, usa o padrão.
- `planting_windows` aceita de uma a três datas `MM-DD`. Se omitido, o backend estima janelas pelo histórico. Mostre `planting_windows_source`.
- `weather_events` aceita até quatro eventos sem sobreposição. O fator 0,2 mantém 20% da chuva diária no intervalo inclusivo, dentro da cobertura histórica. Ao comparar com e sem seca, repita as mesmas janelas explicitamente.
- Para renderizar, use `scenario_summary`, `seasons`, `crop`, `climate`, `soil`, `assumptions` e `evidence`. O manifesto de seca fica em `climate.event_transform`.
- Mostre os quantis como faixas **entre as safras simuladas**. Um fator de chuva e uma frequência histórica têm significados diferentes de probabilidade meteorológica futura.

## 6. Comparar ordens escolhidas

`POST /rotations`

```json
{
  "lat": -9.41,
  "lon": -40.5,
  "crops": ["MZ", "CP", "SG"],
  "planting_dates": ["1992-01-15", "1992-05-20", "1993-01-15"]
}
```

- Envie de duas a três culturas distintas e uma data por cultura, em ordem crescente, em até dois anos consecutivos dentro de 1992–2024. Cada par do conjunto precisa estar em `sequence_pairs`, pois esta rota tenta todas as permutações.
- O índice da data é a posição de plantio. Ao trocar a ordem, a cultura atribuída à data também muda. Compare resultados como **ordem e calendário em conjunto**.
- Cada item de `alternatives` tem `id`, `order`, `cycles` e, quando disponível, `minus_baseline`. `baseline` é a ordem enviada. A rota mantém `reversed_minus_baseline` para o caso com duas culturas.
- `failed_alternatives` lista ordens que não executaram todos os plantios como solicitados. Se a referência falhar, `baseline_id` pode ser nulo e as diferenças podem estar ausentes.
- Exiba cada cultura com sua própria unidade e base. Por ciclo há produtividade, biomassa, chuva, irrigação, evapotranspiração e datas. `engine_rows` é um campo técnico do motor. Use somente os ciclos em `cycles` para a sequência exibida.

## 7. Buscar entre as culturas do agricultor

### Formulário

1. Deixe o agricultor selecionar as culturas que sabe manejar em `known_crops`. A API aceita até 23 entradas distintas do catálogo.
2. Mostre quais delas têm pelo menos um par habilitado **na seleção atual**, usando `sequence_pairs`. É preciso que ao menos duas possam participar juntas.
3. Peça três posições de plantio, com datas crescentes em até dois anos consecutivos. Pares usam as duas primeiras datas e trios usam as três.
4. Peça dois ou três anos históricos iniciais distintos entre 1992 e 2023. A API reaplica mês, dia e deslocamento de ano de cada posição a esses anos. Exemplo: calendário de janeiro e junho de 1992 e janeiro de 1993, aplicado ao ano inicial 2000, vira janeiro e junho de 2000 e janeiro de 2001.
5. Peça a meta de cada cultura elegível em kg/ha. Use `rotation_target_metric` para rotular o campo. Se o valor for biomassa seca, declare o código em `biomass_target_crops`. A cana (`SC`) é um caso desse tipo.

`POST /rotations/search`

```json
{
  "lat": -9.41,
  "lon": -40.5,
  "known_crops": ["MZ", "CP", "SG", "BN", "PN", "ML", "PI"],
  "planting_dates": ["1992-01-15", "1992-06-15", "1993-01-15"],
  "historical_start_years": [1992, 1993],
  "yield_targets_kg_ha": {
    "MZ": 1000,
    "CP": 300,
    "SG": 1000,
    "BN": 400,
    "PN": 600,
    "ML": 500
  },
  "max_candidates": 8
}
```

O exemplo contém abacaxi (`PI`) para demonstrar uma exclusão. Confira `supported_crops` e `excluded_crops` já na resposta 202. Se o catálogo mudar, recalcule quais metas são obrigatórias antes do envio.

### Resultado e classificação

- `recommendations` contém até três opções destacadas. `ranked_alternatives` contém todas as opções simuladas com cobertura completa. Um pedido `done` também pode retornar listas vazias quando nenhuma opção entrou na classificação.
- Cada opção tem `order`, `samples`, `years_all_targets_met` e `mean_target_attainment`. Em `samples`, cada ano traz os ciclos simulados e indica se todas as culturas daquela ordem bateram suas metas.
- O ranking prioriza o número de anos que atingiram todas as metas. O desempate usa o cumprimento médio das metas, limitado a 100% por ciclo. O campo é uma fração de 0 a 1. Exiba `0.47` como **47% de cumprimento médio**, e `1` em `years_all_targets_met` com a contagem de anos, por exemplo **“todas as metas em 1 de 2 anos simulados”**.
- `incomplete_alternatives` traz as alternativas fora do ranking por falha em um ou mais anos. `failed_years` indica quais faltaram.
- `search.calendar_eligible`, `calendar_filtered`, `pair_filtered`, `attempted_candidates` e `budget_omitted` ajudam a explicar o que entrou. Se 150 passarem no filtro e oito forem simuladas, o rótulo adequado é **“melhores entre 8 ordens simuladas”**.
- Use `target_metrics` quando presente para conferir a base de cada meta. Mostre o rendimento e a meta por cultura. Deixe `null` como indisponível e preserve o número zero como um resultado numérico válido.

## 8. Planejar ou recalcular datas

O calendário pode trabalhar com datas futuras. O resultado informa `evidence.dssat_simulated: false`; ele estima datas de fim usando o catálogo e pode ser apresentado antes de qualquer execução do motor.

`POST /planning/calendar`

```json
{
  "horizon_start": "2027-01-01",
  "horizon_end": "2028-12-31",
  "known_crops": ["MZ", "CP"],
  "windows": [
    {"crop": "MZ", "planting_date": "2027-01-10"},
    {"crop": "CP", "planting_date": "2028-01-10"}
  ],
  "max_cycles": 2,
  "max_candidates": 10,
  "min_gap_days": 0
}
```

Cada candidato contém `cycles`. `truncated: true` indica que existem mais candidatos que o limite solicitado. Ao usar `POST /planning/calendar/replan`, acrescente `decision_date` e `route` com a rota atual. Cada ciclo em `route` precisa de `crop`, `cultivar`, `planting_date` e `end_date`. Use datas reais quando já conhecidas. Para a cultura ativa, informe a data estimada de fim.

A resposta traz `realized_prefix`, `keep_route`, `keep_crop_adapt_future` e `terminate_and_restart`. A opção de adaptar futuros plantios preserva os ciclos iniciados. Caso `terminate_and_restart.status` seja `unsupported`, mostre que o encerramento antecipado ainda não está disponível. Este fluxo trata datas e duração, enquanto `dssat_replan` indica a disponibilidade de recálculo agronômico.

## 9. Limites para desenhar o produto

| Tema | Disponível para integração |
|---|---|
| Rotações | Sequências de até três culturas nas datas aceitas. O DSSAT precisa conseguir executar cada plantio no dia solicitado |
| Manejo na rotação | Sequeiro, cultivares padrão e solo estimado pela localização |
| Solo de laboratório | Entrada opcional na simulação individual |
| Seca hipotética | Simulação individual com redução de chuva em datas históricas |
| Nitrogênio e pragas | As rotas de rotação atuais não calculam ganho por nitrogênio nem dano de praga |
| Planejamento futuro | Calendário estimado por datas. A simulação usa cenários históricos exploratórios |
| Replanejamento da lavoura | Ajuste de calendário. O motor ainda não expõe recálculo com continuidade do estado da lavoura, encerramento antecipado ou replantio |

## 10. Checklist para integrar

- [ ] Consultar `/planning/capabilities` e cruzar códigos com o catálogo.
- [ ] Conferir coordenadas, unidades, datas e metas no formulário.
- [ ] Simular um pedido válido e verificar os estados até `done`.
- [ ] Verificar 422, 429, erro de rede, retorno `failed` e retomada de polling.
- [ ] Verificar um pedido com cultura excluída e testar a busca sem recomendações.
- [ ] Renderizar as ordens com data, cultura, métrica e unidade por ciclo.
- [ ] Mostrar solo estimado, anos simulados e quantidade de ordens realmente testadas.
- [ ] Tratar corretamente ausência de referência, zeros, dados nulos e metas de biomassa.
- [ ] Usar os campos `assumptions`, `evidence` e `provenance` nos detalhes do resultado.
