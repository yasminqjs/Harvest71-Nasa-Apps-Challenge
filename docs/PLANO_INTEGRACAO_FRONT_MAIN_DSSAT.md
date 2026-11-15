# Plano de integração do Roça Viva com o DSSAT

Handoff para a IA que vai implementar. Base inspecionada em 2026-11-15: `origin/main` em `976b5ad` e `origin/frontend-LeitiJonso` em `463134a`. Reconfirme os commits ao começar. Este arquivo descreve o trabalho proposto.

**Entrega desejada:** levar o app Expo existente para a `main` por PR e fazer a aba **Safra** buscar e apresentar rotações calculadas pelo DSSAT para o talhão ativo. O agricultor seleciona culturas que conhece, informa datas e metas, acompanha o cálculo e recebe até três opções com justificativa e resultados por cultura.

Leitura obrigatória: [AGENTS da main](../AGENTS.md), AGENTS da branch do front, [contrato da API](API.md), [guia de integração](GUIA_FRONT_DSSAT.md) e [investigação das sequências](operations/DSSAT_SEQUENCE.md). Em caso de divergência com os exemplos, siga os modelos e as rotas do commit que está integrando.

## 1. O que existe agora

| Área | Evidência na branch atual | Implicação para a integração |
|---|---|---|
| App | `App.tsx` decide a aba com estado local. Renderiza `DecisionScreen` na aba `safra`. Expo `~58.0.25`, entrada `index.ts`. | Manter o fluxo de navegação atual. A orientação de Expo Router no AGENTS do front não descreve o código existente. Deixar migração de navegação para outro PR, se desejada. |
| Safra | `src/screens/DecisionScreen.tsx` usa `activeFarm`, `activeFarmer` e `simulateRotation` de `useAccessibility()`. Há opções fixas em `ROTATION_OPTIONS`. | Adicionar busca DSSAT nesse ponto da experiência. A origem do resultado precisa aparecer na UI. |
| Estado | `src/context/AccessibilityContext.tsx` reúne talhão, perfil, acessibilidade e diagnóstico. | Usar contexto para ler o talhão e preferências. Manter requisição, polling e resultado DSSAT num hook ou serviço separado. |
| Mapa e cadastro | `MapScreen`, `NordesteOnboardingScreen` e `VoiceOnboardingScreen` fazem parte do fluxo atual. `FarmProperty` tem `centroid`, polígono e área. | Começar com o centroide do talhão ativo. Apresentar o ponto escolhido antes de enviar. |
| Histórico | `CropHistorySection` e `CropHistoryRecord` registram cultura, quantidade, unidade opcional e safra. | Sugerir culturas conhecidas pelo histórico e pedir confirmação. Evitar transformar kg totais, sacas ou toneladas em kg/ha sem área correta e conversão confirmada. |
| Offline | `localAgronomicEngine.ts` gera diagnóstico local. `syncService.ts` tenta uma rota de sincronização própria e trabalha com `NasaDiagnosticsPackage`. | Implementar cliente DSSAT independente. Essa rota de sincronização não faz parte da API DSSAT. Conservar a função offline e identificar sua saída como diagnóstico local. |
| Backend | `apps/api` e `apps/dssat` vivem na main. Há comparação e busca de rotação, simulação individual e calendário. | A UI usa HTTPS e JSON. O Job e o bucket continuam atrás da API. |
| Clima futuro | A main recebeu `GET /climate-projections` e `climate_projection` em `POST /simulations`. | É uma função opcional de simulação individual. Resultados históricos podem chegar enquanto a projeção ainda está em execução. |

## 2. Preparação e merge do front

1. Atualize referências e verifique se existem mudanças locais. Registre o SHA dos dois lados no PR. Confirme que a branch de origem é `frontend-LeitiJonso`: também existe `cezi-qualidade-plantacao-com-front`, que tem outra versão da UI.
2. Crie uma branch de integração a partir de `origin/main` atual. Pode usar worktree separado. A revisão abaixo simula conflitos sem alterar arquivos.
3. Faça o merge do front nessa branch. O ensaio em `976b5ad` e `463134a` encontrou conflitos apenas em `.gitignore`, `AGENTS.md` e `README.md`. Refaça o ensaio se as referências mudarem.
4. Combine `.gitignore` preservando regras Python, ambientes, caches e arquivos de configuração sensíveis, além das regras Expo, builds, Node e arquivos locais do front. Revise arquivos já rastreados que deveriam ficar fora do Git.
5. Concilie `AGENTS.md` com instruções por escopo. Preserve regras do backend e acrescente as verificações front. Documente a navegação realmente existente. Concilie o README com duas seções de início rápido e links para API e este guia.
6. Preserve `App.tsx`, `src/`, `assets/` e o Expo na raiz nesta entrega. Preserve também `apps/`, `data/`, `infra/`, `docs/` e `.github/workflows/`. Uma mudança para `apps/frontend` exige ajustar resolução de assets, Metro/EAS e comandos e pode ser avaliada separadamente.
7. Commite a resolução de merge separadamente da ligação à API. Confira se o app abre, a navegação funciona e os dados locais são lidos antes de alterar as telas.

Comandos sugeridos. Confirme a versão de Expo em `package.json` e leia a documentação da versão instalada antes de alterar APIs Expo ou dependências.

```bash
git fetch origin
git status --short --branch
git merge-tree --write-tree --messages origin/main origin/frontend-LeitiJonso
git switch -c integracao/rocaviva-dssat origin/main
git merge --no-ff --no-commit origin/frontend-LeitiJonso
# Resolver os três arquivos, inspecionar as alterações e concluir o merge.
git diff --check
git diff --cached --check
npm ci
npm run lint
npx tsc --noEmit
npx expo-doctor
npm run web
```

Se o merge tiver conflitos, o `merge-tree` retorna status diferente de zero. Isso é a evidência para a resolução na branch de integração. Mantenha o lockfile do front. Se instalações ou checks já falharem no commit original da UI, registre a falha de referência e corrija o que impedir a integração, sem mudar o SDK inteiro por conveniência.

## 3. MVP de funcionalidade DSSAT na aba Safra

### Fluxo da tela

1. Manter as seções já existentes de Safra e adicionar **Rotações para meu talhão**. Nesta seção, mostrar o talhão selecionado e o ponto que será enviado.
2. Carregar `GET /crops` e `GET /planning/capabilities`. Cruzar os códigos, nomes, produtos e métricas retornados. A API é a fonte das combinações habilitadas. Na versão conhecida, 35 pares cobrem 21 culturas.
3. Permitir selecionar as culturas que o agricultor conhece. Pré-selecionar somente sugestões confirmadas pelo usuário. Destacar as que estão sem par habilitado **nessa seleção**, mesmo que apareçam no catálogo geral.
4. Solicitar três posições de plantio, dois ou três anos históricos e metas em kg/ha por cultura elegível. Oferecer um formulário guiado com rótulos, unidade e ajuda para cada campo. Manter valores no rascunho em caso de erro.
5. Enviar ao clicar em **Buscar rotações**. Mostrar recebido/em fila/processando. Renderizar o resultado terminal, erros ou ausência de recomendações. Permitir abrir o detalhe de cada opção.
6. No detalhe, mostrar ordem, datas, produção ou biomassa por cultura, anos simulados, cumprimento das metas, ordens tentadas e excluídas. Mostrar a premissa de sequeiro, clima histórico e solo estimado.
7. Deixar **Comparar ordens escolhidas** como modo secundário. Permitir duas ou três culturas quando todos os pares do conjunto estão em `sequence_pairs`. Usar `POST /rotations` e mostrar diferenças em relação à ordem enviada.

### Mapeamento de dados e limites

| Origem na UI | Destino na API | Regra de implementação |
|---|---|---|
| `activeFarm.centroid.latitude`, `.longitude` | `lat`, `lon` | Usar grau decimal, conferir limites, registrar o talhão da requisição. |
| `culturaPrincipal`, `historicoCultivo`, `historicoCultivoDetalhado` | Sugestões para `known_crops` | Mapear por código de catálogo confirmado. Palma pode aparecer no front e não estar no DSSAT. |
| Datas escolhidas | `planting_dates` | ISO civil `YYYY-MM-DD`, em ordem. Busca usa três datas em até dois anos consecutivos. Par usa as duas primeiras. Conservar datas civis sem conversão de fuso. |
| Anos escolhidos | `historical_start_years` | Dois ou três, distintos, 1992–2023. As posições são reaplicadas aos anos escolhidos. Validar dias inexistentes após a troca do ano. |
| Meta editada pelo agricultor | `yield_targets_kg_ha` | Positiva e finita. Usar `rotation_target_metric` por cultura. Para cana, incluir `SC` em `biomass_target_crops` e pedir meta de biomassa seca. |
| Perfil hídrico, objetivo, orçamento, área e polígono | Contexto local | A busca aceita sequeiro e cultivares padrão. Esses campos do perfil podem aparecer na tela, mas não alteram o Job. A área pode estimar quantidade para um ciclo homogêneo com unidade explícita; prefira kg/ha no MVP. |
| Laudo de solo | `soil_analysis` de `POST /simulations` | As rotas de rotação usam PronaSolos. Exibir entrada de laudo apenas no fluxo individual. |

Exemplo conhecido para teste, com abacaxi incluído para demonstrar exclusão. É um roteiro de integração, e as metas são valores de teste.

```json
{
  "lat": -9.41,
  "lon": -40.5,
  "known_crops": ["MZ", "CP", "SG", "BN", "PN", "ML", "PI"],
  "planting_dates": ["1992-01-15", "1992-06-15", "1993-01-15"],
  "historical_start_years": [1992, 1993],
  "yield_targets_kg_ha": {"MZ": 1000, "CP": 300, "SG": 1000, "BN": 400, "PN": 600, "ML": 500},
  "max_candidates": 8
}
```

O ranking compara opções com o conjunto completo de anos solicitados. Use `recommendations` para até três destaques e `ranked_alternatives` para as demais. Explique `years_all_targets_met` como contagem de anos simulados. `mean_target_attainment` é uma fração do cumprimento médio de metas limitada a 100% por ciclo, e pode ser mostrada em porcentagem.

Use `search.attempted_candidates` e `search.budget_omitted` para informar a cobertura. O rótulo deve dizer **melhores entre as ordens simuladas**. Uma opção em `incomplete_alternatives` pode ajudar a explicar datas apertadas, mas não entra na classificação. Mantenha o zero como valor e sinalize dados nulos. Evite somar quilos de produtos diferentes ou apresentar a classificação como margem econômica.

## 4. Arquitetura do front e estados

Arquivos sugeridos, ajustáveis à organização da branch:

- `src/services/dssatApi.ts`: URL da API, GET de catálogo/capacidades, criação do Job, leitura de `poll`, tradução de erro HTTP e timeout. Trate resposta incompleta e JSON inesperado na fronteira.
- `src/types/dssat.ts`: contratos dos pedidos e resultados com campos opcionais. Modele resultados por fluxo, inclusive `running` com dados parcialmente disponíveis e `done` sem recomendações.
- `src/hooks/useDssatRotation.ts`: estado de envio, polling, recuperação e cancelamento local. Use o ID da solicitação e vínculo com o talhão para ignorar resposta atrasada após a troca de propriedade.
- Componente na aba Safra para formulário e resultados. Reuse tema, componentes, idioma e leitura por voz existentes. Evite ampliar o contexto global com o estado de cada consulta.

Configure base pública por ambiente. Se usar `EXPO_PUBLIC_*`, lembre que é incorporada ao bundle. A chave, se exigida pelo servidor, precisa de um serviço controlado pela equipe. Verifique CORS pela origem web e mantenha o fluxo HTTP equivalente no app nativo.

Cada POST gera uma execução. Bloqueie clique duplicado. Guarde `id`, `poll`, tipo, data e ID local do talhão para retomar. Pode começar em memória e migrar para o repositório local existente quando houver retomada após fechar o app. Preserve histórico de safra e análise de folha na UI atual.

Após 202, consulte o endereço `poll` retornado a cada cerca de cinco segundos. Pare em `done` ou `failed`. Trate 422 por campo, 429 com mensagem de limite, 401 como problema de acesso e falhas de rede com ação para retomar GET. Um erro depois do POST pode deixar um Job em andamento. Confirme antes de criar outro. Abortar no app só interrompe a espera local. Se perder conexão, preserve a referência e retome o GET ao voltar.

Para offline, a tela pode exibir um resultado DSSAT salvo para aquele talhão, identificado como antigo, ou oferecer o diagnóstico local com sua própria origem. Não grave automaticamente o resultado DSSAT nas estruturas de diagnóstico do motor local. Não envie nome, histórico bruto, polígono ou dados de análise de folha em rotas que só precisam de coordenadas e parâmetros da simulação.

## 5. Incrementos depois do MVP

1. **Simulação individual.** Acrescentar `POST /simulations` com cultivar, janelas `MM-DD` e laudo opcional. Exibir faixas e cenário hídrico a partir de `scenario_summary`. Reusar cliente e polling.
2. **Seca hipotética.** Nesse fluxo individual, oferecer `rainfall_multiplier` com data inicial, final e fração de chuva mantida. Comparar com uma simulação sem evento nas mesmas janelas. Manter rótulo de hipótese.
3. **Projeção de clima futuro.** Carregar opções em `GET /climate-projections` e enviar `climate_projection` somente no fluxo individual. Mostrar o resultado histórico já disponível enquanto o bloco futuro ainda está em execução. Renderizar o conjunto de modelos e seus limites. Estados parciais ou indisponíveis deixam a comparação histórica utilizável. Conferir contratos da main e versão implantada antes de liberar na tela.
   - **Nota de UX (obrigatório deixar mais claro e amigável ao usuário):** Não exibir os códigos crus `SSP2-4.5 (emissões intermediárias)` e `SSP5-8.5 (emissões muito altas)` sozinhos para o agricultor. Traduzir na UI para rótulos simples e explicativos (ex.: *“Futuro moderado (cenário intermediário — SSP2-4.5)”* com explicação curta do que muda na chuva/calor, e *“Futuro extremo / muito quente (pior caso — SSP5-8.5)”* como teste de estresse máximo), mantendo o código técnico apenas em detalhes secundários / modo técnico.
4. **Calendário e replanejamento.** Pode usar `/planning/calendar` e `/planning/calendar/replan` para datas futuras e preservação de ciclos iniciados. Mostrar `evidence.dssat_simulated: false` como estimativa de calendário. Tratar encerramento antecipado conforme `terminate_and_restart.status`.
5. **Lacunas do backend.** Laudo nas rotações, manejo de irrigação, efeitos de praga e recálculo agronômico com estado do solo são tarefas próprias. Expor controles só quando a respectiva capacidade estiver disponível.

## 6. Testes, aceite e PR

| Verificação | Como reproduzir | Aceite |
|---|---|---|
| Merge | Inspecionar alterações por arquivo e abrir app original e integrado | Safra, mapa, onboarding, histórico e acessibilidade existentes continuam utilizáveis. Workflows do backend preservados. |
| Formulário | Selecionar seis culturas do exemplo e abacaxi. Alterar datas, unidades e metas, testar cana. | Código do catálogo correto, exclusão compreensível, metas obrigatórias claras e biomassa explícita. |
| API no fluxo principal | Enviar uma busca real pelas telas, observar POST 202 e GET até o resultado. | Recebe recomendações do Job ou explica a ausência. Mostra cada sequência e seus ciclos sem confundir resposta local com DSSAT. |
| Erros e concorrência | Simular perda de rede no meio do polling, 422, 429, 503, retorno `failed`, toque duplo, troca de talhão e sair/voltar. | Sem duplicar Jobs ou associar resultado ao talhão errado. O rascunho e a referência do Job continuam utilizáveis. |
| Conteúdo científico | Usar resultado com zero, nulo, ordens omitidas, meta não batida e anos faltantes. | Nenhum número nulo vira zero. A UI explica a amostra e o limite de busca. |
| Plataformas | Checar pelo menos web e o alvo móvel principal em dispositivo/emulador. Rodar lint, typecheck e Expo Doctor. | Layout legível, navegação acessível, zoom de texto e rede funcionais. Informar se o teste móvel depender de development build. |
| Backend | Rodar os checks previstos no AGENTS e inspecionar os filtros dos workflows caso o PR toque no backend. | API e DSSAT preservam contratos. Alterações em `apps/api` ou `apps/dssat` podem publicar ao fundir. |

Use mocks para estados de erro e polling nos testes automatizados. Rode um smoke remoto controlado para comprovar o caminho UI → API → Job → resultado, sem gastar quota com uma suíte inteira contra a produção. Anote no PR versão do backend usado, plataforma testada e ID do Job de teste. Abra PR para `main` com commits separados para merge e funcionalidade. Combine com a equipe se a publicação do front é uma etapa separada do merge Git.

### Prompt para a próxima IA

> Implemente o MVP deste plano em branch a partir da origin/main atual. Integre frontend-LeitiJonso, resolva os conflitos de raiz preservando o backend e verifique o app inicial. Na aba Safra ligue o talhão ativo ao fluxo de busca DSSAT com catálogo, formulário de metas, Job assíncrono e resultados explicáveis. Compare ordens fixas em um segundo fluxo, preserve o modo local e siga o contrato da API. Valide web, alvo móvel e um smoke real de busca. Abra PR com evidências e registre limites encontrados.
