# Instruções para IAs e devs que trabalham neste repositório

Field Shift / Harvest71 — NASA Space Apps 2026, desafio *Field Shift: Adapting Farms with NASA Data*.
Leia este arquivo inteiro antes de mudar qualquer coisa. Ele vale para Claude, Copilot, Gemini, Cursor e pessoas.

## 1. Como o sistema é montado

```
App (web/mobile) ──HTTPS──► API fieldshift-api (Cloud Run)
                               │  /scenarios ............ lê resultados prontos
                               │  /simulations (chave) .. dispara ▼
                               ▼
                      Cloud Run Job fieldshift-dssat (DSSAT-CSM 4.8.6)
                               │ busca clima NASA POWER + solo PronaSolos para a coordenada
                               ▼
                      Bucket privado (só as contas de serviço acessam)
```

- **Você não precisa de conta no Google Cloud.** A API é a única porta de entrada. Ninguém além das
  contas de serviço lê o bucket; não peça acesso a ele.
- **Não existe VM** e não deve existir (`docs/decisions/0001-cloud-run-sem-vm.md`).
- Estado atual verificado: `docs/operations/STATUS.md`.

## 2. Usar a API (o que o app e os outros devs fazem)

Base: `https://fieldshift-api-avshjoa6eq-uc.a.run.app` · contrato completo: `docs/API.md`

| Rota | Chave? | Para quê |
|---|---|---|
| `GET /health`, `GET /version` | não | saúde e commit no ar |
| `GET /scenarios`, `GET /scenarios/{site}` | não | cenários prontos de 5 locais do Nordeste (milho) |
| `GET /crops`, `GET /crops/{code}` | não | 23 culturas e seus cultivares, para o menu do app |
| `POST /simulations` | não (por enquanto) | simular uma coordenada (com análise de solo opcional) |
| `GET /simulations/{id}` | não (por enquanto) | buscar o resultado (consultar a cada 5 s) |

- **Acesso livre por enquanto**, com limite por IP (6/min, 200/dia) e teto diário do servidor.
  Respeite `429` e tente depois.
- A exigência de chave será ligada depois (`REQUIRE_API_KEY=true`). Deixe o app pronto para enviar
  `X-API-Key` se houver chave configurada. A chave é entregue pela Yasmin por canal privado e
  **nunca** vai para código, issue, PR, commit, print ou log (o repositório é público).
- Simulação leva ~15–60 s. Fluxo: `POST` → recebe `id` → `GET /simulations/{id}` até `status` ser
  `done` ou `failed`.

## 3. Mudar o backend

1. Crie uma branch, faça a mudança, rode os testes:
   ```bash
   cd apps/api   && pip install -r requirements-dev.txt && pytest -q
   cd apps/dssat && pip install pytest && pytest -q        # testes que precisam do DSSAT são pulados fora da imagem
   ```
2. Abra um Pull Request. Só a `main` publica; o merge dispara tudo sozinho:

| Workflow | Quando roda | Faz |
|---|---|---|
| `test` | todo push/PR | testes da API |
| `deploy-api` | `main` + `apps/api/**` | publica a API e confere `/version` |
| `dssat` | `main` + `apps/dssat/**` | compila o DSSAT, teste de referência, atualiza e executa o Job |
| `ingest-data` | `main` + `data/**` | coleta NASA POWER + PronaSolos dos pontos de `data/points.csv` |
| `scenarios` | após `ingest-data`/`dssat` | recalcula `/scenarios` |

O GitHub Actions entra no Google Cloud por federação de identidade (sem chave JSON), só a partir
da `main` deste repositório. Forks e outras branches não conseguem publicar.

## 4. Regras que não podem ser quebradas

- **Fontes de dados:** nenhuma fonte, autor, instituição ou dado de origem chinesa, nem indireto
  (regra da equipe, mais rígida que a da NASA). Antes de adicionar fonte, biblioteca de cultivares ou
  arquivo do DSSAT, verifique a origem. Detalhes e itens já descartados: `docs/decisions/0002-fontes-de-dados.md`.
- **Nada de segredos no repositório:** chaves JSON de conta de serviço, chaves de API, tokens. Não crie
  chave JSON de conta de serviço.
- **Honestidade científica:** os resultados são comparações relativas (nível "exploratório"), não
  previsão de safra. Não remova `evidence`, `assumptions` nem `provenance` das respostas, e não
  apresente número como medição.
- **Sem rota que dispare simulação sem limite de uso.** O acesso livre é temporário (decisão da equipe).
- **Não use `--allow-unauthenticated` nem altere IAM pelo CI.** Mudanças de permissão são feitas
  pela dona do projeto com os scripts de `infra/gcp/scripts/`.

## 5. Onde está cada coisa

| Caminho | Conteúdo |
|---|---|
| `apps/api/` | FastAPI (rotas acima) |
| `apps/dssat/runner.py` | modos do Job: `reference`, `scenarios`, `point`, `run` |
| `apps/dssat/fieldshift_inputs.py` | NASA POWER → `.WTH`; PronaSolos (+ análise) → `.SOL`; cenários → FileX da cultura |
| `apps/dssat/crops.json` (= `apps/api/app/crops.json`) | catálogo de culturas gerado de experimentos de referência |
| `apps/dssat/nex_gddp.py` | clima futuro da NASA (NEX-GDDP-CMIP6): catálogo, download, delta mensal aplicado ao NASA POWER |
| `data/nex_gddp.json`, `data/scripts/nex_gddp_prefetch.py` | pré-processamento regional (Nordeste) das projeções; workflow `nex-gddp` |
| `apps/dssat/cultivars_br.json` | cultivares brasileiros de artigos (valores + fonte); `tools/br_cultivars.py` os grava no `.CUL`/`.ECO` no build e marca o catálogo |
| `data/points.csv`, `data/scripts/` | pontos fixos e coleta |
| `infra/gcp/scripts/` | configuração única do Google Cloud (só a dona roda) |
| `docs/` | decisões, status, API |

## 6. Pendências conhecidas

- 23 culturas do catálogo (`apps/dssat/crops.json`), sem calibração local. Para adicionar ou mudar
  culturas, edite `apps/dssat/tools/build_crop_catalog.py`, gere de novo o catálogo (instruções no topo
  do arquivo) e rode os testes; o CI testa todas as culturas dentro da imagem.
- Guia completo para adicionar culturas e cultivares (formatos, regras, pistas de artigos): `docs/GUIA_CULTIVARES_PARA_IA.md`.
- Para um cultivar brasileiro novo de artigo: acrescente em `cultivars_br.json` (com a fonte e os campos
  herdados), rode `python3 tools/br_cultivars.py catalog` e os testes. Não invente coeficientes que o
  artigo não traz; se faltar o arquivo de espécie dos autores, registre em `not_imported`.
- Janelas de plantio automáticas = suposição pelo clima; validar com o ZARC (MAPA).
- Sem calibração local; N, P e K não entram no cálculo do milho como está configurado.
- Acesso livre temporário; depois ligar a chave e, para produção, login de usuário.

## 7. App Roça Viva (Expo/React Native, na raiz do repositório)

O app mobile fica na raiz (`App.tsx`, `index.ts`, `src/`, `assets/`, `app.json`, `eas.json`), ao lado do
backend em `apps/`. Ele fala com o DSSAT **só pela API** (HTTPS + JSON), nunca pelo bucket.

**Expo mudou: não confie na memória.** Antes de mexer em API do Expo, EAS ou React Native:
1. Veja a versão de `expo` no `package.json` (hoje SDK 58).
2. Leia a documentação da versão: `https://docs.expo.dev/versions/v<major>.0.0/`.
3. Índice com correções de erros comuns de IA: https://docs.expo.dev/llms.txt.

```bash
npm ci                      # dependências (mantenha o package-lock.json)
npx expo install <pacote>   # sempre use para adicionar dependência (versão compatível com o SDK)
npx expo start              # servidor de desenvolvimento (npm run web para o navegador)
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnóstico de dependências e configuração
```
Rode lint e typecheck antes de dar uma tarefa por concluída.

**Navegação real:** `App.tsx` escolhe a aba com estado local (`safra`, mapa, comunidade etc.). Não há
Expo Router neste código; migrar para ele é um PR separado.

**Integração com o DSSAT** (aba Safra):
- `src/services/dssatApi.ts` — cliente HTTP (catálogo, capacidades, criação do Job, `poll`, erros, timeout).
  Base em `EXPO_PUBLIC_DSSAT_API_URL` (vai para o bundle: nada secreto aí).
- `src/types/dssat.ts` — contratos com campos opcionais.
- `src/hooks/useDssatJob.ts` — envio, polling a cada ~5 s, retomada, bloqueio de clique duplo e vínculo com o
  talhão (resposta atrasada de outro talhão é ignorada).
- Telas em `src/components/dssat/`. Resultado DSSAT é sempre rotulado como DSSAT; o diagnóstico local
  (`localAgronomicEngine.ts`) continua separado e rotulado como local.
- Não envie nome, histórico bruto, polígono ou análise de folha para rotas que só precisam de coordenadas.
- Plano completo: `docs/PLANO_INTEGRACAO_FRONT_MAIN_DSSAT.md`; contrato: `docs/API.md`; guia: `docs/GUIA_FRONT_DSSAT.md`.

**EAS:** `npx eas-cli@latest build|submit|update`. Pastas `ios/` e `android/` são geradas (CNG): não edite à
mão; configure em `app.json` e plugins. Biblioteca com código nativo exige development build (não roda no Expo Go).
