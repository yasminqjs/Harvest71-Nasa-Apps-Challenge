# RoçaViva — NASA Field Shift (Front-end Mobile Local-First)

Aplicativo móvel nativo (**React Native + Expo + TypeScript**) desenvolvido exclusivamente no front-end com arquitetura **Local-First / Offline-First** para agricultores familiares da região Nordeste do Brasil (iniciando centralizado na Bahia, lat `-12.9714`, lon `-38.5014`).

## Estrutura de Diretórios

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

## Como Instalar e Testar

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
