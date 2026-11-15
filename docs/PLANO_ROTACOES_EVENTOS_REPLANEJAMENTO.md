# Plano de evolução do backend DSSAT

Data: 2026-11-15. Base inspecionada: `7432144`. Branch: `feat/rotacoes-eventos-replanejamento`.

**Estado: planejamento, sem implementação das funcionalidades abaixo.** Este documento registra a intenção do usuário e decisões propostas para a próxima IA. Não é uma descrição da API já disponível. A integração com o frontend fica para outra etapa. O merge na `main` ocorrerá depois da implementação, revisão e testes; ele pode disparar deploy.

## 1. Resultado que queremos

O agricultor informa as culturas que sabe manejar, condições do talhão, limitações e objetivos. O backend constrói alternativas viáveis de sucessão de culturas e manejo, executa comparações sob condições climáticas equivalentes e devolve opções explicáveis. O agricultor também pode introduzir eventos hipotéticos e recalcular um plano em andamento.

No recálculo, comparar explicitamente:

1. **Manter cultura e rota:** reavaliar o plano anterior sob a informação climática nova.
2. **Manter cultura, adaptar o restante:** preservar o que já aconteceu, permitir apenas manejos futuros compatíveis e alterar culturas seguintes.
3. **Encerrar a cultura e recomeçar:** representar encerramento/colheita/resíduos e um novo calendário a partir da decisão, preservando o estado físico do solo.

Um cenário hipotético com solo reinicializado pode existir separadamente para pesquisa, mas nunca ser confundido com a terceira opção operacional. Quando não houver dados suficientes para reconstruir a lavoura atual, oferecer planejamento prospectivo com estado estimado e limitações explícitas; não afirmar que a planta real foi reproduzida.

### Requisitos e limites de escopo

| Pedido | Entrega planejada | Limite necessário |
|---|---|---|
| Máximo de plantas | Catálogo com capacidades por cultura/cultivar e expansão documentada | Estar no catálogo não comprova calibração regional ou suporte a rotação |
| Culturas conhecidas | Restrição obrigatória na geração das alternativas | Culturas novas apenas por adesão explícita |
| Variações de rotação e técnicas | Sequências, pousio, datas e manejos suportados | Consórcio simultâneo não é equivalente a sucessão; fica fora do primeiro escopo |
| Seca hipotética | Transformação de chuva em janela definida e comparação controlada | Não atribuir probabilidade meteorológica à hipótese |
| Mudança climática repentina | Atualização dos dados e nova versão do plano | NASA POWER não é um serviço de previsão futura |
| Praga | Evento reconhecido e capacidade consultável; simulação somente com acoplamento validado | Nome da praga não determina dano quantitativo |
| Recalcular caminhos | Histórico imutável, corte temporal e três políticas acima | Não restaurar uma planta a partir de produtividade final |
| Front ainda em planejamento | Contratos versionados, exemplos e erros previsíveis | Não construir telas nem acoplar regras aos componentes do front |

## 2. Diagnóstico do código atual

Referências: `apps/api/app/main.py`, `apps/dssat/runner.py`, `apps/dssat/fieldshift_inputs.py`, `apps/dssat/Dockerfile`, `docs/GUIA_CULTIVARES_PARA_IA.md`.

- `/simulations` recebe uma cultura, cultivar opcional, até três janelas e análise de solo opcional. Não recebe sequência, histórico ou eventos.
- `run_dssat()` executa o modo `A`; `write_filex()` configura análise sazonal. Não há motor de sequência integrado.
- Água inicial deriva de uma fração fixa (`init_frac=0.25`) entre SLLL e SDUL. Reinicializar essa fração em cada safra destruiria a continuidade de uma rotação.
- NITRO, SYMBI, PHOSP, POTAS, DISES, CHEM e TILL estão desativados; fertilização e resíduos também. Não se pode vender benefício de fixação de nitrogênio, adubação ou controle de pragas a partir dessa configuração.
- A irrigação automática de referência não representa, por si só, um reservatório limitado do agricultor.
- A agregação usa um limiar geral de 1.000 kg/ha e uma referência irrigada. Isso não é apropriado para comparar produtos diferentes. Alguns produtos usam biomassa; conservar variável, unidade e base de massa.
- O catálogo tem 23 culturas e 11 cultivares brasileiros adicionados por artigos. Testes de execução não demonstram validade agronômica regional.
- Clima e solo vêm de NASA POWER e PronaSolos. SoilGrids não deve voltar. O bucket é privado, acessado pelas contas de serviço; não pedir credenciais ou acesso pessoal.
- DSSAT e dados são fixados por commit no Dockerfile. Documentação de outra versão é pista, não prova de compatibilidade.

### Riscos que determinam a arquitetura

1. **Rotação falsa:** somar execuções independentes não simula água, nutrientes e resíduos entre culturas.
2. **Explosão combinatória:** culturas × cultivares × datas × manejos × eventos × anos pode exceder facilmente o custo do job atual.
3. **Comparação enviesada:** alternativas avaliadas com anos, horizontes ou informações diferentes parecem melhores sem serem comparáveis.
4. **Falsa precisão:** estimativas de solo e cultivar genérico não sustentam recomendação exata para uma propriedade.
5. **Replanejamento com conhecimento do futuro:** usar dados posteriores ao corte nas decisões passadas favorece artificialmente o plano.
6. **Praga decorativa:** aceitar o evento e ignorá-lo, ou descontar produtividade sem alterar a fisiologia, produz uma interpretação causal falsa.
7. **Concorrência/custo:** o limite por pedido não limita o número de execuções internas; retries podem cobrar e publicar duas vezes.
8. **Compatibilidade:** outro computador altera `main`; evitar refatoração geral e atualizar a branch antes de cada entrega.

## 3. Decisões propostas

- Preservar `/simulations` e seus resultados existentes. Introduzir recursos novos para planejamento e replanejamento; não transformar silenciosamente o endpoint legado em outro serviço.
- Começar com um talhão por pedido, sem competição de recursos entre propriedades ou talhões. Área é metadado e conversão de volume; simulação continua por hectare quando aplicável.
- Motor determinístico de geração/restrições/ranking. Uma IA de linguagem pode explicar resultados depois, mas não criar coeficientes, selecionar números nem corrigir arquivos DSSAT por tentativa livre.
- Separar funções pequenas para normalizar entrada, gerar alternativas, preparar clima, executar sequência, agregar resultados e apresentar explicações. Não criar framework de plugins ou novo microsserviço antecipadamente.
- Registrar capacidades e proveniência de maneira estruturada. Capacidades desconhecidas permanecem indisponíveis para aquele uso.
- Primeira sequência demonstrativa: duas culturas anuais relevantes, escolhidas após o experimento técnico (candidatas: milho e caupi). Começar por continuidade hídrica; benefício de N exige etapa própria.
- Manter resultados exploratórios e comparativos. Não prometer previsão de safra, benefício econômico ou redução de pragas sem os dados/modelos correspondentes.

## 4. Catálogo, cultivares e fontes

### 4.1 Capacidades separadas

Estender o gerador de catálogo, nunca editar manualmente apenas uma das duas cópias JSON. Campos propostos:

| Campo | Exemplos / significado |
|---|---|
| `single_crop_status` | `tested`, `unverified`, `blocked` |
| `sequence_status` | `tested`, `unverified`, `unsupported` |
| `replan_status` | idem; suporte depende também da política solicitada |
| `supported_management` | lista explícita, ligada ao modelo e configuração |
| `supported_events` | tipo e versão do adaptador testado |
| `product_basis` | grão, matéria seca, raiz fresca etc.; unidade e variável DSSAT |
| `cultivar_evidence` | biblioteca genérica, calibrado em artigo, avaliado localmente |
| `region_evidence` | local, ambiente e condições da avaliação; não um booleano Brasil |
| `provenance_review` | `pending`, `accepted`, `rejected`, com justificativa e artefatos |
| `limitations` | motivos compreensíveis para o front |

Não esconder as 23 culturas porque a sequência só foi testada em duas: expor o que cada uma permite. Uma cultura pode funcionar em simulação individual e continuar bloqueada em rotação. Distinguir espécie, cultivar e nome popular; “inhame” regional não identifica automaticamente taro, e a fava nordestina não deve ser substituída por faba bean.

### 4.2 Prioridade regional

1. Consolidar milho, feijão-caupi, sorgo, mandioca, amendoim, milheto e guandu. Feijão-comum conforme ambiente/localidade.
2. Ampliar cultivares com parâmetros completos e condições regionais documentadas.
3. Forrageiras e adubos verdes: só depois de representar cortes, destino de biomassa e resíduos. Mandioca, cana e outras culturas longas precisam de horizontes e colheitas próprios.
4. Gergelim, palma e espécies sem módulo confirmado: investigar suporte no commit fixado. Sem modelo compatível, informar indisponibilidade; não mapear para uma espécie “parecida”. Desenvolver modelo novo é projeto científico separado.

### 4.3 O que cada banco realmente fornece

| Fonte | Uso | Não fornece automaticamente |
|---|---|---|
| NASA POWER | Série meteorológica histórica | Genética de cultivares ou previsão futura |
| PronaSolos / Embrapa / SGB | Atributos de solo por camada | Medição do talhão ou todos os estados iniciais necessários ao N |
| Artigos Embrapa (Alice/Infoteca), universidades e Redape | Coeficientes publicados e possíveis ensaios de calibração | Pacote universal de cultivares pronto para DSSAT 4.8.6 |
| MAPA ZARC/SISZARC | Restrições de janela por município, cultura, ciclo e condições publicadas | Parametrização genética nem garantia de produtividade |
| MAPA RNC | Identificação e registro de cultivares | Coeficientes DSSAT |
| IBGE PAM / Censo Agropecuário | Priorizar culturas e contexto regional/familiar | Calibração fisiológica de cultivar |
| INMET, futuramente | Comparação meteorológica com estações e dados recentes disponíveis | Cobertura perfeita da propriedade ou previsão garantida |

**Conclusão:** combinar fontes, não procurar um banco único que substitua experimentos de calibração. Aplicar a política de origem do repositório por artefato, incluindo autores, instituições, dados e parâmetros herdados. Busca por palavras não prova ausência de vínculo indireto; registrar incerteza e manter pendência quando a política não puder ser comprovada.

### 4.4 Fila concreta de investigação de cultivares

- **Soja no sudoeste piauiense:** publicação Embrapa 2024, Tabela 8, BRS 8980/Domínio/Extrema/Bônus. Conferir visualmente tabela, módulo, unidades, campos herdados e avaliação antes de importar. Prioridade agronômica abaixo de culturas centrais da agricultura familiar, apesar da disponibilidade dos parâmetros.
- **BRS Tumucumaque:** publicação BPD149/2023 traz calibração, mas o guia registra dependência de arquivo de espécie próprio ausente. Manter bloqueio até obter material compatível. Diferença de rendimento sintético entre dois cultivares, isoladamente, não prova qual parâmetro é inválido.
- **BRS Guariba:** completar coeficientes com fonte verificável; não preencher lacunas inventadas.
- **Sorgo BRS 310:** rastrear Tabela 3 do artigo Grossi et al. 2013/dissertação e compatibilidade com versão antiga. Não contornar acesso restrito nem presumir que tabela está disponível.
- **Mandioca e feijão já importados:** revisar limites de transferência regional e entre versões antes de adicionar novas entradas.

Para cada candidato: fonte/permissão → autoria e origem → arquivo/módulo/versão → extração dupla de tabela → parâmetros completos e heranças → build → execução → comparação com observações independentes quando disponíveis → classificação da evidência. Conservar candidatos bloqueados com motivo e próximo passo.

### 4.5 Downloads e armazenamento

Não iniciar download nacional volumoso só para “adiantar”. Fazer inventário com URL, versão, cobertura, licença, estimativa de tamanho, checksum e finalidade. Buscar primeiro PDFs e dados mínimos de dois locais piloto; clima por ponto/período e solo por coordenada. Downloads grandes somente quando um marco depender deles.

Usar cache existente no GCS pelas contas de serviço e ingestão controlada. Guardar fonte bruta imutável, derivado e manifesto separados. Retries limitados, timeout, validação de conteúdo e checksum; respostas de erro não podem virar cache válido. Versionar cache por fonte e período, com política de atualização para dados recentes. Não salvar PDFs/datasets pesados nem coordenadas reais no Git. Não remover objetos legados do bucket nesta tarefa.

## 5. Contrato do domínio e API proposta

Todos os nomes abaixo são **propostos**, a fixar em P1 com fixtures. Datas civis ISO `YYYY-MM-DD`; instantes de job em UTC; unidades explícitas; números finitos; enums versionados. Nenhum campo desconhecido deve ser descartado silenciosamente no contrato novo.

### Recursos

- `GET /planning/capabilities`: versão, culturas/manejos/eventos/políticas habilitados e limites.
- `POST /plans`: validar e enfileirar planejamento (`202`).
- `GET /plans/{id}`: estado, progresso e resultado, sem URLs privadas do bucket.
- `POST /plans/{id}/replans`: criar filho imutável, com versão esperada e data de decisão.
- `GET /plans/{id}/replans/{replan_id}`: consulta do filho; pode reutilizar internamente o mesmo armazenamento de planos.

Separar identificador de plano, candidato e job/tentativa. Um plano guarda pedido, candidatos e resultados; um replanejamento aponta ao **candidato escolhido**, não apenas ao pedido que tinha várias opções. Aceitar plano atual externo estruturado quando não houver plano anterior, após validação equivalente.

### Entrada de planejamento

| Bloco | Conteúdo obrigatório / comportamento |
|---|---|
| `schema_version` | versão explícita |
| `field` | coordenadas, área positiva se volumes forem usados, solo informado opcional |
| `horizon` | início/fim e teto do servidor; duração compatível com culturas |
| `known_crops` | IDs do catálogo, não vazio; alias apenas na normalização |
| `cultivar_preferences` | escolha por cultura; fallback genérico explícito e reportado |
| `constraints` | irrigação disponível, limites de água, operações permitidas, exclusões; distinguir desconhecido de zero |
| `objectives` | prioridades e metas por produto; defaults publicados e simples |
| `baseline` | rota informada ou regra explícita para construir referência |
| `weather` | modo histórico/hipotético; conjunto selecionado pelo servidor e identificado |
| `events` | eventos tipados e identificados; lista vazia é válida |

Defaults conservadores: sem irrigação presumida; sem introduzir culturas desconhecidas; sem benefício nutricional presumido; cultivar padrão somente se política permitir. Não deduzir disponibilidade de sementes a partir de RNC.

### Entrada de replanejamento

`parent_plan_id`, `parent_candidate_id`, `expected_revision`, `decision_date`, políticas solicitadas, observações novas, clima atualizado e **histórico realizado**. O histórico contém plantio/cultivar, irrigação/adubação/cortes/colheitas realmente executados, datas, quantidades e fonte. Ações passadas planejadas não equivalem a executadas. Campos ausentes devem gerar solicitação de dados ou estado estimado explicitamente aceito.

Políticas estáveis propostas: `keep_route`, `keep_crop_adapt_future`, `terminate_and_restart`. “Manter” significa conservar ações planejadas ainda viáveis; se se tornarem impossíveis, retornar baseline inviável com motivo, não alterar a rota silenciosamente.

### Evento meteorológico mínimo (exemplo sintético)

```json
{
  "id": "seca-hipotetica-1",
  "type": "rainfall_multiplier",
  "source_kind": "hypothetical",
  "start_date": "2027-03-01",
  "end_date": "2027-03-20",
  "parameters": {"factor": 0.2}
}
```

Datas inclusivas. Fator 0.2 conserva 20% da chuva original naquele intervalo; não significa “20% de chance de seca”. Para esta operação de seca, fator entre 0 e 1. Operações de aumento de chuva e temperatura precisam de tipos/ranges próprios. Conflitos sobre a mesma variável/dia são rejeitados no primeiro release, evitando composição ambígua.

### Saída comum

- `schema_version`, IDs e linhagem; estado `queued`, `running`, `done`, `partial` ou `failed`.
- Progresso por unidades reais concluídas/previstas; não inventar percentual linear por tempo.
- Pedido normalizado, hipóteses, baseline, candidatos descartados e motivos resumidos.
- Por candidato: sequência datada, cultivar, manejo, eventos aplicados, métricas por cultura/ciclo, comparação pareada com baseline, elegibilidade e limitações.
- Por métrica: unidade, base do produto, agregação, número de membros válidos e faltantes. `null` significa indisponível, nunca zero implícito.
- `evidence`, `assumptions`, `provenance`, versões do modelo/catálogo/dados/transformações, IDs dos membros climáticos e hash das entradas efetivas.
- `partial` não participa do ranking principal se tiver cobertura diferente. Mostrar incompletude; opcionalmente recalcular comparação sobre interseção comum claramente identificada.

Erros novos estruturados: `code`, `message`, `field`, `retryable`, `details` seguros. Exemplos: `UNSUPPORTED_CROP_SEQUENCE`, `UNSUPPORTED_EVENT_MODEL`, `MISSING_REALIZED_HISTORY`, `WEATHER_COVERAGE_GAP`, `INVALID_EVENT_OVERLAP`, `BUDGET_EXCEEDED`, `REVISION_CONFLICT`, `NO_FEASIBLE_PLAN`. `422` para entrada sem suporte/ inválida, `409` conflito/idempotência divergente, `429` quota, `503` dependência indisponível. Inviabilidade agronômica identificada após execução é resultado explicado, não erro genérico de servidor.

## 6. Sequência, manejo e busca de alternativas

### 6.1 Experimento técnico obrigatório antes do otimizador

Documentação oficial distingue análise sazonal de sequência e lista modo `Q`. Isso não basta para trocar uma letra no subprocesso. Inspecionar código e exemplos do commit fixado, formato de controle, tratamentos, duração, repetição climática e outputs necessários. Preparar um exemplo mínimo reproduzível com duas culturas e intervalo de pousio.

Verificar continuidade de água e das variáveis efetivamente habilitadas entre colheita e plantio. Comparar com controle de safras reinicializadas; inspecionar outputs diários e balanços, não apenas Summary.OUT. Registrar como resíduos, colheita antecipada e mudança de espécie funcionam. Se houver incompatibilidade, limitar capacidades e manter o recurso experimental; não simular continuidade por soma.

### 6.2 Manejos por etapas

| Etapa | Permitido após testes | Exigência adicional |
|---|---|---|
| Hídrica | datas, sequeiro, irrigação explícita e limitada, pousio | agenda, água consumida e unidades consistentes |
| Solo/N | resíduos, fertilização N, simbiose quando suportada | estados iniciais de N/SOM, módulos compatíveis e balanços |
| Técnicas específicas | cortes, preparo, cobertura | comprovar efeito representado no modelo |
| Pragas | dano/acoplamento por cultura | adaptador e evidência próprios |

“Plantio direto”, “adubação verde” e “rotação que reduz pragas” não podem ser rótulos sem operações/efeitos implementados. P/K recebidos pelo contrato não significam P/K simulados. Informar por candidato os processos ativos.

### 6.3 Geração e limites

Gerar candidatos deterministicamente a partir de culturas permitidas, duração, janelas, exclusões, irrigação, operações e horizonte. Primeiro filtrar inviáveis; depois simular. Cultivar e disponibilidade de sementes são restrições distintas. Calendário deve acomodar culturas que atravessam ano e safra; falha de maturação não vira colheita normal.

Começar com enumeração limitada, sem algoritmo evolutivo. Definir em configuração teto de candidatos, ciclos, membros climáticos, eventos, execuções e tempo total. Valores devem vir de benchmark, não de desejo de interface. Estimar trabalho antes de enfileirar e rejeitar pedidos excessivos com alternativas de redução.

Se a busca precisar de triagem, usar subconjunto fixo/reproduzível de clima para todos e executar finalistas no conjunto completo comum. Publicar o método e não chamar o melhor encontrado de ótimo global. Não permitir que o baseline seja eliminado pela triagem.

### 6.4 Comparação útil

Usar mesmos membros climáticos, datas de decisão, horizonte e estado inicial para baseline e alternativas. Rotação plurianual usa blocos cronológicos contíguos, não sorteio independente de safras. Não repetir automaticamente o primeiro ano sem registrar a hipótese.

Retornar produção por produto, frequência empírica de não atingir meta por cultura, água irrigada, dias sem cobertura quando disponíveis e estabilidade entre membros. Calcular diferenças pareadas por membro antes de resumir; diferença de medianas não substitui mediana das diferenças. Denominadores zero geram diferença absoluta e percentual indisponível.

Não somar kg de mandioca com kg de feijão nem ranquear culturas distintas por rendimento bruto. Oferecer alternativas não dominadas e prioridades explícitas; se precisar de escore, publicar normalização e pesos. Receita/margem exigem preços, custos e bases temporais fornecidos, distinguindo custos já realizados de custos futuros. Sem esses dados, não mostrar “mais lucrativo”. Benefícios de solo só entram se medidos por outputs suportados.

## 7. Clima e eventos

Separar três produtos: distribuição de resultados em histórico; sensibilidade hipotética; previsão fornecida por provedor específico. Frequência no histórico não é probabilidade calibrada do próximo ano.

Guardar série bruta e derivada, transformações versionadas e hashes. Não alterar cache compartilhado ao aplicar eventos. Recalcular metadados climáticos quando necessário. Validar RAIN >= 0, radiação não negativa, TMIN <= TMAX, cobertura diária e calendário bissexto; não preencher lacuna silenciosamente.

Em replanejamento, usar observações disponíveis até a data de corte. Depois dela, usar previsão com emissão/conjunto documentados se houver adaptador aprovado, ou cenários históricos/hipotéticos. Se previsão só cobre parte do horizonte, declarar a transição. Dados históricos podem chegar com atraso; o intervalo faltante exige política explícita e rótulo de estimativa.

Mapear datas do cenário para cada membro climático de maneira determinística, inclusive 29/02 e ciclos plurianuais. Preservar correlações meteorológicas ao usar blocos históricos; perturbação isolada de chuva é sensibilidade controlada, não reconstrução completa de uma seca real.

Não duplicar evento que já está incorporado no clima observado. Eventos passados novos podem corrigir a reconstrução do estado, mas não autorizar a mudança de operações passadas. Hipóteses alternativas sobre o passado devem ser um experimento contrafactual separado.

## 8. Pragas: contrato agora, promessa condicionada

Registrar identidade, cultura afetada, intervalo, estágio quando conhecido, origem (observada/hipotética), dano/medida e unidade. Sem identificação quantitativa suficiente, a avaliação do impacto permanece indisponível.

Antes de habilitar um adaptador: verificar acoplamento no módulo e versão fixados, órgão afetado, dano acumulado versus taxa diária, limites físicos, persistência, interações com fenologia e dados de calibração. Ativar DISES ou outro flag sem esses passos não implementa um modelo de praga.

MVP: expor que o evento é reconhecido mas não suportado para simulação; rejeitar pedido que exige seu efeito com erro claro. Pode ser preservado como observação fora do cálculo, com consentimento explícito do contrato e indicação destacada. Nunca responder sucesso como se o dano tivesse entrado.

Se futuramente houver uma análise de sensibilidade externa (ex.: desconto hipotético de produção), manter métrica separada, identificada como pós-processamento. Ela não altera fisiologia, balanço do solo nem permite afirmar benefício da rotação no controle da praga. Preferir adiar esse recurso a introduzir ambiguidade no MVP.

## 9. Replanejamento e estado

Estratégia inicial: **reexecução determinística desde uma condição inicial conhecida**, com histórico realizado até o corte e ramificações futuras. Evita depender de um checkpoint genérico cuja existência/compatibilidade não foi demonstrada. Summary.OUT não contém o estado completo para restaurar planta e solo.

1. Resolver plano/candidato pai e versões exatas de dados/modelo.
2. Validar histórico, observações, corte e políticas; identificar lacunas.
3. Reconstruir prefixo comum com clima realizado e operações realizadas.
4. Criar baseline e alternativas que compartilham esse prefixo.
5. Simular futuros sob conjunto climático comum.
6. Publicar novo resultado imutável com explicação do que mudou.

Correção de observações não equivale a assimilação automática. Biomassa/estágio/umidade medidos podem ajudar a avaliar reconstrução; ajustar estado interno exige método testado. Registrar divergência entre observação e simulação sem “forçar” a planta a bater.

`terminate_and_restart` precisa de suporte a operação de encerramento, destino da biomassa, prazo para replantio, janela e custos quando disponíveis. Não retroagir novo plantio à data original. Se o módulo não suporta encerramento fiel, declarar política indisponível para aquela cultura.

Persistir hash do prefixo, entradas realizadas e lineage. Mesma entrada deve produzir resultado determinístico dentro da tolerância do ambiente fixado. Mudança de versão do DSSAT ou cultivar exige migração/reexecução explicitada; não continuar uma planta em modelo diferente silenciosamente.

## 10. Execução, limites e segurança

Reutilizar API + Cloud Run Job + GCS. Não introduzir VM, banco ou fila adicional antes de demonstrar necessidade. Separar funções de domínio dos adaptadores de I/O para teste.

- Objetos imutáveis de pedido normalizado, manifestos e resultados; status pequeno separado. Escritas condicionais por geração do GCS para exclusão/idempotência, com testes de conflito.
- Chave de idempotência vinculada ao contexto de acesso e hash do pedido. Reuso com corpo diferente retorna conflito. Hash inclui modelo, genética, solo, clima, opções e transformações.
- Tratar separadamente gravar pedido, disparar job e receber resultado: falha entre etapas não pode deixar `queued` eterno nem duplicar cálculo sem controle. Tentativas têm ID e lease/expiração recuperável; só uma publica resultado final válido.
- Limitar trabalho total por pedido e quota compartilhada entre instâncias, além de limite por IP/chave. Inspecionar limiter atual: memória de processo não garante teto global em Cloud Run.
- Workdir isolado por tentativa; caminhos/IDs gerados pelo servidor; nada de nome de arquivo ou argumento de shell vindo do usuário. Chamada de subprocesso por lista, com timeout e limite de logs.
- Retries apenas transitórios; erros de entrada/modelo não devem repetir indefinidamente. Estado terminal com código seguro e logs internos sem tokens/dados pessoais.
- Cache de execução só com todas as entradas efetivas e versões. Não usar arredondamento de coordenada do clima para representar solo de alta resolução.
- Planos podem conter histórico privado. IDs imprevisíveis não substituem autorização. Antes de uso com agricultores reais, exigir identidade/ownership nas novas rotas. Demo pública só com dados sintéticos e limites; não publicar coordenadas/históricos em exemplos ou logs.
- Cancelamento remoto e paralelismo dentro do job são posteriores, salvo necessidade comprovada. Primeiro limitar duração e publicar falha/resultado parcial corretamente.

## 11. Plano de implementação em entregas pequenas

| Fase | Trabalho e arquivos prováveis | Critério de saída |
|---|---|---|
| P0 — prova do motor | Experimento mínimo em `apps/dssat/tests/`, registro em docs; inspecionar fonte fixada | Duas culturas sequenciais com continuidade demonstrada; matriz de suporte e limitações; benchmark |
| P1 — contrato e capacidades | Schemas em `apps/api/app/`, gerador de catálogo, fixtures, `docs/API.md` | Validação cobre suporte/erros; catálogo único gerado; endpoints legados intactos; recursos não prontos desabilitados |
| P2 — clima hipotético | Funções puras em módulo pequeno de `apps/dssat/`, testes de clima | Seca datada, imutabilidade da fonte, conflitos rejeitados, metadados completos |
| P3 — sequência hídrica | Preparação FileX/controle e runner de sequência separados do caminho legado | Resultado por ciclo e continuidade; culturas habilitadas individualmente; sem alegações sobre N |
| P4 — alternativas e comparação | Geração limitada, baseline, métricas e ranking explicável | Respeita culturas/restrições, comparação pareada e orçamento de execução |
| P5 — jobs e persistência | API, runner dispatch, Dockerfile, storage/status e quota | Idempotência/concorrência/falhas testadas; endpoint async com limites reais |
| P6 — replanejamento | Histórico realizado, replay e políticas habilitadas por capacidade | Prefixo preservado; baseline atualizado; encerramento não reseta solo; linhagem reproduzível |
| P7 — expansão científica | Cultivares, ZARC, N/resíduos e adaptadores específicos | Cada capacidade só publicada com dados, evidência e testes próprios |
| P8 — integração e entrega | Contrato final, exemplos, revisão de compatibilidade e PR | Consumível pelo front sem código de UI; CI verde e merge revisado |

Dependências: P0 antes de prometer P3/P6; P1 e pesquisa de cultivares podem avançar enquanto P0 é investigado; P2 independente do motor de sequência; P4 depende de P3; P5 pode ter infraestrutura testada em paralelo, mas endpoint público só após limites e execução prontos. P6 depende de P3/P5. P7 é incremental, não bloqueia uma primeira entrega honesta.

MVP utilizável: duas culturas anuais em sequência hídrica, escolhas restritas ao conhecimento do agricultor, baseline, seca hipotética, busca limitada, resposta assíncrona e comparação relativa. Replanejamento entra depois de demonstrar replay. Pragas quantitativas, forrageiras, N e dezenas de sequências não são requisitos para fingir que esse MVP está completo; permanecem itens explícitos de evolução.

### Alterações por área

- `apps/api/app/main.py`: adicionar rotas via funções/módulos pequenos; não concentrar todo planejamento neste arquivo.
- `apps/dssat/fieldshift_inputs.py`: reaproveitar conversões e perfis; separar escrita de sequência do gerador sazonal atual.
- `apps/dssat/runner.py`: novo dispatch e chamadas; manter referência/scenarios/point funcionando.
- `apps/dssat/tools/build_crop_catalog.py` e `tools/br_cultivars.py`: capacidades e genética por fonte única.
- `apps/dssat/Dockerfile`: copiar módulos novos e manter commits fixos/triagem de dados; não esquecer testes dentro da imagem.
- `docs/API.md`, `docs/operations/STATUS.md`, guia de cultivares: atualizar somente com capacidades realmente implementadas.
- Workflows: verificar filtros de paths antes de adicionar módulos compartilhados; evitar estrutura compartilhada que não entre nos contextos Docker existentes.

## 12. Testes e evidência mínima

### Unitários e contrato

- Cultura/cultivar incompatíveis, listas vazias, datas impossíveis, NaN/inf, unidades inválidas, horizonte excessivo, evento fora do horizonte e sobreposição.
- Transformação de chuva apenas na janela, fatores 0/1, fonte intacta, bissexto, repetição determinística e cobertura insuficiente.
- Gerador nunca introduz cultura desconhecida, respeita calendário/irrigação/orçamento e mantém baseline.
- Ranking com produtos diferentes, metas ausentes, baseline zero, membros faltantes e diferenças pareadas.
- Replanejamento exige candidato pai, preserva ações realizadas, rejeita revisão obsoleta e não modifica o pai.
- API preserva contrato legado; capabilities correspondem à configuração real.

### Integração com DSSAT fixado

- Experimento de referência existente e testes atuais de culturas continuam passando.
- Sequência com duas culturas, pousio e safra que atravessa dezembro; inspecionar água e operações nas transições.
- Controle que reinicializa solo distinguível da sequência contínua em caso preparado para evidenciar esse efeito.
- Cenário sem eventos reproduz resultado-base; transformação identidade não muda saída além da tolerância documentada.
- Replay sem novas informações reproduz o plano original; políticas compartilham prefixo diário até o corte.
- Encerramento preserva solo e representa biomassa conforme suporte. Falta de suporte bloqueia política.
- Não exigir “menos chuva sempre reduz produção”: respostas biológicas podem não ser monotônicas. Validar o mecanismo e usar experimentos com interpretação científica.
- N/resíduos, quando habilitados: balanços e estados iniciais, sem assumir que toda leguminosa melhora toda cultura seguinte.

### Falhas operacionais e custo

Mockar NASA/PronaSolos/GCS/Cloud Run: indisponibilidade, timeout, payload incompleto, escrita concorrente, job iniciado sem resposta, retry duplicado, falha após resultado parcial e quota entre instâncias. Testes locais não devem consumir quota pública. Medir tempo/memória/artefatos em imagem, incluindo replay e pior pedido permitido.

Comandos existentes (executar separadamente nos diretórios):

```text
apps/api:   python -m pytest -q
apps/dssat: python -m pytest -q
```

Instalar dependências conforme AGENTS.md. Testes dependentes do executável podem ser pulados fora da imagem; **skip não é validação do motor**. Rodar suite da imagem/CI antes de habilitar capacidade. Não ajustar valores esperados só para testes passarem sem explicar mudança agronômica.

## 13. Git, revisão e merge

Branch criada a partir de `7432144`, coincidente com `origin/main` no início do planejamento. Nenhum merge/push/deploy faz parte desta entrega documental.

Na implementação: `git fetch origin`, conferir status e divergências, integrar alterações recentes com árvore limpa e resolver conflitos preservando trabalho do outro PC. Não resetar nem usar force-push para facilitar sincronização. Commits pequenos por fase; abrir PR com capacidades habilitadas, limites, testes executados/pulados e evidências científicas. Revisor independente após código; testes direcionados por agente tester quando útil.

Antes do merge: revisão de contrato com quem prepara o front, CI e execução na imagem aprovados, catálogo sincronizado, custos limitados, dados auditados e observabilidade suficiente. `main` pode publicar automaticamente: coordenar janela de merge, verificar versão/resultados depois e usar revert do commit de merge se houver regressão. Implementar fixtures locais não demonstra deploy funcional.

## 14. Questões que a implementação deve resolver com evidência

- Quais pares de culturas funcionam em sequência no commit fixado e quais estados persistem?
- É possível representar término antecipado fiel em cada módulo? Quais outputs permitem verificar?
- Quais dados mínimos de N/SOM faltam no solo atual e como estimar sem ocultar incerteza?
- Qual teto de candidatos/membros cabe no orçamento e timeout reais do Cloud Run Job?
- Qual política climática permite datas futuras sem converter histórico em falsa previsão?
- Quais janelas ZARC estão disponíveis por município/cultura e com qual versão/licença?
- Quais cultivares passam auditoria de origem e têm arquivos dependentes completos?
- Como assegurar ownership/quota distribuída mantendo a infraestrutura simples?

Registrar respostas em `docs/operations/` ou decisão arquitetural curta. Perguntar ao usuário somente quando houver decisão de produto que a evidência técnica não resolva; não bloquear trabalhos independentes enquanto isso.

## 15. Fontes e pistas para verificação

Documentação oficial consultada em 2026-11-15; confirmar comportamento no código fixado. Links de dados e artigos abaixo são pistas específicas, não atestado de que arquivos passaram auditoria ou foram importados.

- [DSSAT: execução e modo Sequence](https://dssat.net/tools/tools-for-power-users/).
- [DSSAT: uso do modelo e análises](https://dssat.net/models-overview/how-to-use-the-model/).
- [DSSAT: variáveis meteorológicas e modificações ambientais](https://dssat.net/weather-module/).
- [DSSAT: dados mínimos](https://dssat.net/data/minimum-data/) e [avaliação](https://dssat.net/model-evaluation/).
- [NASA POWER: API diária](https://power.larc.nasa.gov/docs/services/api/temporal/daily/).
- [PronaSolos: serviço de atributos](https://geoportal.sgb.gov.br/server/rest/services/pronasolos/atributos_solo_90m/MapServer).
- [MAPA: SISZARC](https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico/siszarc).
- [MAPA: cultivares registradas](https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/insumos-agricolas/sementes-e-mudas/registro-nacional-de-cultivares/cultivares-ou-especies-registradas).
- [Embrapa: acesso ao Redape](https://www.gov.br/pt-br/servicos/acessar-o-repositorio-de-dados-de-pesquisa-da-embrapa-redape).
- [IBGE: PAM](https://www.ibge.gov.br/estatisticas/economicas/agricultura-e-pecuaria/9117-producao-agricola-municipal-culturas-temporarias-e-permanentes.html).
- [Soja no sudoeste piauiense, 2024](https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1163137/1/ModelagemCrescimentoProdutividadeGraosSojaSudoestePiauienseJoaoIreneFilho2024.pdf).
- [Calibração CROPGRO-Cowpea, BPD149/2023](https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1153058/1/CalibracaoModeloCROPGROCowpeaSimulacaoCrescimentoRendimentoGraosBPD149.2023.pdf).
- [Grossi et al. 2013, sorgo](https://www.sciencedirect.com/science/article/abs/pii/S1161030113000919).

Ler em conjunto: [AGENTS](../AGENTS.md), [guia de cultivares](GUIA_CULTIVARES_PARA_IA.md), [decisão de fontes](decisions/0002-fontes-de-dados.md), [API atual](API.md) e [handoff de implementação](HANDOFF_IMPLEMENTACAO_ROTACOES.md).
