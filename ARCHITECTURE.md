# Arquitetura do RoçaViva — Modelagem de Dados e Features por Cor

Este documento descreve a arquitetura do aplicativo e os pontos de integração da aba Plantação.

---

## 1. Modelagem da Fazenda (Nível de Dados)

Definida em [`src/types/domain.ts`](src/types/domain.ts) (`FarmArchitectureModel`) e construída reativamente em [`src/models/farmArchitecture.ts`](src/models/farmArchitecture.ts) (`buildFarmArchitectureModel`), sendo exposta via `useAccessibility().farmArchitecture` em [`src/context/AccessibilityContext.tsx`](src/context/AccessibilityContext.tsx):

```text
fazenda (FarmArchitectureModel)
├── acontecimentosDaRegiao
│   └── fonte: feedback_da_comunidade (CommunityPost[] em AccessibilityContext)
├── variaveisDaFazenda
│   └── fonte: usuario (região, município, polígono/área, acesso à água, reserva, trabalho, perfil financeiro, objetivo)
└── plantacoes[] (PlantationArchitectureModel — por lote/talhão demarcado)
    ├── historicoDaTerra
    │   ├── variaveisClimaticas  → fonte: NASA POWER (+ precipitação IMERG)
    │   └── variaveisDoSolo      → fonte: SRTM + Landsat Collection 2 Level-2 TIRS (NASA / USGS — 30 m)
    ├── culturaAtual
    │   ├── selecaoDaCultura     → fonte: usuário
    │   └── especificacoesCultura→ fonte: NASA / FAO GAEZ EcoCrop
    └── culturasFuturas (rotação planejada)
        ├── selecaoDaCultura     → fonte: usuário ou algoritmo de otimização
        └── previsaoResultado    → fonte: Software DSSAT [PLACEHOLDER]
```

---

## 2. Mapeamento das Funcionalidades por Cor

| Cor | Feature (Arquitetura) | Onde o usuário vê (Aba / Tela) | O que faz na prática | Status | Arquivo(s) principal(is) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Verde** | Pegador de informações da fazenda | **Onboarding** + **Aba Plantação** | Coleta e atualiza região, demarcação da fazenda/lotes, variáveis da fazenda, cultura atual e histórico da terra | Implementado | [`src/screens/NordesteOnboardingScreen.tsx`](src/screens/NordesteOnboardingScreen.tsx), [`src/screens/DecisionScreen.tsx`](src/screens/DecisionScreen.tsx), [`src/components/subscreens/FarmVariablesEditorSubscreen.tsx`](src/components/subscreens/FarmVariablesEditorSubscreen.tsx), [`src/components/subscreens/RotacaoAtualSubscreen.tsx`](src/components/subscreens/RotacaoAtualSubscreen.tsx), [`src/components/subscreens/HistoricoPlantioSubscreen.tsx`](src/components/subscreens/HistoricoPlantioSubscreen.tsx), [`src/screens/MapScreen.tsx`](src/screens/MapScreen.tsx) |
| **Amarelo** | Visualizador de informações locais (temperatura, etc.) | **Aba Resumo** | Mostra informações básicas locais: clima do dia (NASA POWER), previsão do trimestre, resumo das plantações e dados gerais da fazenda | Implementado | [`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx), [`src/components/subscreens/ClimaDiaSubscreen.tsx`](src/components/subscreens/ClimaDiaSubscreen.tsx), [`src/components/subscreens/PrevisaoTrimestreSubscreen.tsx`](src/components/subscreens/PrevisaoTrimestreSubscreen.tsx) |
| **Azul** | Pegador de feedback de acontecimentos do usuário | **Aba Comunidade** | Permite ao agricultor **relatar acontecimentos** (`pragas`, `mudança de preço`, `desastres naturais`, dúvidas) alimentando `fazenda.acontecimentosDaRegiao` | Implementado | [`src/screens/CommunityScreen.tsx`](src/screens/CommunityScreen.tsx), [`src/context/AccessibilityContext.tsx`](src/context/AccessibilityContext.tsx) |
| **Salmão** | Notificador de acontecimentos locais | **Aba Comunidade** | Permite **ver usuários próximos** no grafo regional e **receber relatos de outros usuários** com filtros e leitura em voz | Implementado | [`src/screens/CommunityScreen.tsx`](src/screens/CommunityScreen.tsx), [`src/components/CommunityReportGraph.tsx`](src/components/CommunityReportGraph.tsx), [`src/data/communityMockData.ts`](src/data/communityMockData.ts) |
| **Cinza** | Planejamento e DSSAT | **Aba Plantação** | Calendário de rotação, comparação histórica e simulação individual | Implementado | [Tela Plantação](src/screens/DecisionScreen.tsx), [Contrato da API](docs/API.md) |
| **Roxo** | Visualizador de qualidade da plantação atual | **Aba Plantação** | **Ver qualidade da plantação atual** (saúde/vigor por talhão, dados Landsat 30 m e inspeção foliar) | **PLACEHOLDER** | [`src/components/placeholders/PlantationQualityPlaceholder.tsx`](src/components/placeholders/PlantationQualityPlaceholder.tsx) |

O registro programático dessa tabela também está tipado em `FEATURE_COLOR_ARCHITECTURE` e `FEATURE_COLOR_STYLES` em [`src/models/farmArchitecture.ts`](src/models/farmArchitecture.ts).

---

## 3. Guia Rápido para Futuros Merges (Substituição dos Placeholders)

### Planejamento e DSSAT

O modo padrão de **Planejar rotações** usa `POST /planning/calendar` com datas futuras e a duração de referência das culturas. O resultado estima a ordem e a duração dos ciclos. Os outros modos usam séries históricas do DSSAT para buscar rotações ou comparar ordens escolhidas. **Meu Talhão no DSSAT** oferece simulação individual e a opção de clima futuro quando disponível.

### Feature Roxa — Visualizador de Qualidade da Plantação Atual
1. Substituir a implementação dentro de [`src/components/placeholders/PlantationQualityPlaceholder.tsx`](src/components/placeholders/PlantationQualityPlaceholder.tsx).
2. O componente já recebe `farmArchitecture: FarmArchitectureModel` e `selectedPlantation?: PlantationArchitectureModel`.
3. O ponto de renderização na UI fica na **Aba Plantação** ([`src/screens/DecisionScreen.tsx`](src/screens/DecisionScreen.tsx), caso `activeBlock === 'qualidade_atual'`).
