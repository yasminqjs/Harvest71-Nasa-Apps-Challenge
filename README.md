# Harvest71 — Field Shift

Plataforma de apoio à decisão agrícola do desafio NASA Space Apps. Combina dados ambientais da NASA, dados de solo/cultura e informações de agricultores; o **DSSAT** roda na nuvem para comparar estratégias de manejo. O app mantém dados e resultados sincronizados para uso offline.

> **Status:** API e DSSAT no ar. Simulação de qualquer coordenada do Brasil (clima NASA POWER + solo
> PronaSolos automáticos, análise de solo opcional). Detalhes em [`docs/operations/STATUS.md`](docs/operations/STATUS.md).

**Vai integrar o app ou mexer no código? Comece por [`AGENTS.md`](AGENTS.md) e [`docs/API.md`](docs/API.md).**
Integração do app com o DSSAT: [`docs/GUIA_FRONT_DSSAT.md`](docs/GUIA_FRONT_DSSAT.md) e [`docs/PLANO_INTEGRACAO_FRONT_MAIN_DSSAT.md`](docs/PLANO_INTEGRACAO_FRONT_MAIN_DSSAT.md).

## Início rápido

- **App (Expo, raiz):** `npm ci` e `npm run web` (ou `npx expo start`). URL da API em `EXPO_PUBLIC_DSSAT_API_URL`.
- **API (Python):** veja "Rodar a API localmente" abaixo.

Ninguém precisa de conta no Google Cloud: tudo passa pela API.

## Arquitetura

- **API:** FastAPI em Cloud Run Service (`fieldshift-api`) — única porta de entrada
- **Simulador:** DSSAT-CSM 4.8.6 em Cloud Run Job (`fieldshift-dssat`), 23 culturas, rotações e clima futuro (NASA NEX-GDDP-CMIP6)
- **App:** RoçaViva (Expo/React Native, na raiz), offline-first, consulta o DSSAT pela API
- **Dados:** NASA POWER (clima) + PronaSolos/Embrapa (solo), em Cloud Storage privado
- **CI/CD:** GitHub Actions com federação de identidade (sem chaves); só a `main` publica
- **Sem VM.** Região `us-central1`. Nenhuma fonte de origem chinesa (`docs/decisions/0002-fontes-de-dados.md`).

## Estrutura

```
App.tsx, src/, assets/  app RoçaViva (Expo)
apps/api/            FastAPI (+ testes, Dockerfile)
apps/dssat/          imagem do DSSAT, runner do Job, conversores de dados (+ testes)
data/                pontos fixos e script de coleta
infra/gcp/scripts/   configuração única do Google Cloud (só a dona do projeto roda)
docs/                API.md, decisions/, operations/
.github/             workflows (test, deploy-api, dssat, ingest-data, scenarios)
```

## Rodar a API localmente

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q
uvicorn app.main:app --reload --port 8080
```

## Implantar

Automático: merge na `main` (ver tabela de workflows em `AGENTS.md`). Plano B manual no Cloud Shell:
`infra/gcp/scripts/deploy-api.sh`. Auditoria somente leitura: `infra/gcp/scripts/audit.sh`.

## Regras

Veja [`CONTRIBUTING.md`](CONTRIBUTING.md). Em resumo: PRs com revisão, sem segredos no Git, sem chaves JSON, sem recursos pagos sem aprovação.

## Ciência

O DSSAT serve para **comparar estratégias de manejo**; valores absolutos exigem calibração e validação locais. Nada aqui afirma previsão de produtividade, NPK/pH local por satélite ou previsão de pragas.

---

## App RoçaViva (front-end mobile, na raiz)

Aplicativo móvel nativo (**React Native + Expo + TypeScript**) desenvolvido exclusivamente no front-end com arquitetura **Local-First / Offline-First** para agricultores familiares da região Nordeste do Brasil (iniciando centralizado na Bahia, lat `-12.9714`, lon `-38.5014`).

### Estrutura de Diretórios

```text
.
├── App.tsx                             # Fluxo principal (Onboarding Voz -> Mapa Nordeste -> Abas)
├── app.json                            # Configuração Expo, permissões nativas e plugins
├── src/
│   ├── components/
│   │   ├── AppHeader.tsx               # Cabeçalho (RoçaViva, status offline/sync, voz e Usuário)
│   │   ├── BottomTabBar.tsx            # Barra inferior com 4 abas (Início, Mapa, Safra, PANCs)
│   │   ├── FarmMapCanvas.native.tsx    # Mapa nativo (react-native-maps) com polígonos e Heatmap
│   │   ├── FarmMapCanvas.tsx           # Mapa vetorial interativo para testes offline/web
│   │   ├── MobileViewport.tsx          # Moldura de celular + painel de teste no notebook
│   │   └── NordesteSvgMap.tsx          # Mapa interativo do Nordeste centrado na Bahia
│   ├── context/
│   │   └── AccessibilityContext.tsx    # Estado global, voz, alto contraste e sincronização
│   ├── data/
│   │   └── seedData.ts                 # Dados iniciais (Bahia, SIAGAS, PANCs MMA/INSA, fontes)
│   ├── database/
│   │   ├── seedBuilder.ts              # Construtor de seed inicial offline
│   │   ├── sqlite.native.ts            # Banco embarcado expo-sqlite (Android/iOS)
│   │   └── sqlite.ts                   # Adaptador local para testes no navegador (notebook)
│   ├── screens/
│   │   ├── VoiceOnboardingScreen.tsx   # Onboarding inclusivo com leitura automática (expo-speech)
│   │   ├── NordesteOnboardingScreen.tsx# Seleção regional Nordeste/Bahia e perfil respeitoso
│   │   ├── HomeScreen.tsx              # Tela inicial fiel ao wireframe (Clima, Trimestre, Rotação)
│   │   ├── MapScreen.tsx               # Micro-mapeamento (<5-15 ha), GPS, raio e Heatmap de poços
│   │   ├── DecisionScreen.tsx          # Decisão da safra, Pronaf/WhatsApp, NDVI + Câmera foliar e 2050
│   │   ├── FoodSecurityScreen.tsx      # Voz bidirecional regionalizada e catálogo offline de PANCs
│   │   └── SettingsModal.tsx           # Troca de agricultor, acessibilidade, alertas, sync e fontes
│   ├── services/
│   │   ├── leafAnalyzer.ts             # Análise foliar offline por câmera (clorofila/amarelamento)
│   │   ├── localAgronomicEngine.ts     # Balanço hídrico, cascata de seca, veranico, erosão e 2050
│   │   ├── notificationService.ts      # Alertas preventivos locais (expo-notifications)
│   │   ├── syncService.ts              # Cliente HTTP pronto para sincronização via NetInfo
│   │   └── voiceAssistant.ts           # Assistente de voz pt-BR e respostas regionalizadas
│   ├── theme/
│   │   └── tokens.ts                   # Tema claro rural e modo alto contraste
│   ├── types/
│   │   └── domain.ts                   # Tipagem TypeScript completa
│   └── utils/
│       ├── geoprocessing.ts            # Cálculo de hectares, tarefas e raio via @turf/turf
│       └── regionalize.ts              # Função regionalizarTexto() para linguagem do campo
```

### Como Instalar e Testar

### 1. Instalar dependências
```bash
npm install
```

### 2. Testar no Notebook (Modo Celular em Tela do Computador)
```bash
npm run web
```
No navegador do notebook, o app abre em uma moldura de celular com painel lateral de simulação (**Modo Roça Offline**, **Níveis de Seca** que alteram o emoji da previsão e **Reiniciar Onboarding**).

### 3. Testar no Celular via Expo Go
```bash
npx expo start
```
Escaneie o QR Code com o aplicativo **Expo Go** (Android ou iOS).

### 4. Testar no Emulador Android
```bash
npm run android
```

### 5. Gerar Instalador APK Android (EAS Build)
```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```
