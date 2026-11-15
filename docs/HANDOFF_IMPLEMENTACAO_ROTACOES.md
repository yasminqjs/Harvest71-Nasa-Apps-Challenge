# Handoff para a IA de implementação

Data: 2026-11-15. Branch: `feat/rotacoes-eventos-replanejamento`. Base do plano: `7432144`.

## O que foi autorizado e entregue

O usuário pediu preparar um backend DSSAT flexível para o futuro front, ampliar plantas para o Nordeste, comparar rotações/manejos, representar seca/pragas e recalcular mantendo ou encerrando a cultura atual. Nesta etapa pediu **planejamento extenso salvo no projeto e branch nova**; a implementação será conduzida em seguida com outro modelo. O merge na main é posterior à implementação/revisão. Não interpretar este documento como autorização para publicar uma implementação incompleta.

Leia [o plano completo](PLANO_ROTACOES_EVENTOS_REPLANEJAMENTO.md) e `AGENTS.md` antes de editar código. Ele contém diagnóstico, contratos propostos, fontes, fases, critérios de aceitação e riscos. Rotas e schemas do plano ainda não existem. Não iniciar tudo de uma vez.

## Começo recomendado

1. Conferir `git status`, branch e `git fetch origin`; há outra pessoa trabalhando em outro PC. Preservar mudanças e integrar remoto com cuidado.
2. Ler `apps/dssat/runner.py`, `fieldshift_inputs.py`, Dockerfile, testes, `apps/api/app/main.py` e guia de cultivares.
3. Executar **P0: prova de sequência**, em ambiente que realmente tenha o DSSAT fixado. Encontrar formato e semântica do modo Sequence no código/exemplos. Criar caso mínimo de duas culturas e pousio, comparando continuidade com reinicialização.
4. Registrar resultados e capacidades. Se houver bloqueio, documentar causa e continuar contratos/clima independentes; não fingir rotação com execuções sazonais somadas.
5. Seguir P1–P8 em entregas pequenas. Delegar frentes independentes conforme AGENTS; principal implementa/decide, tester testa e reviewer revisa depois.

## Regras que não podem se perder

- Manter `/simulations` compatível; front não será integrado agora.
- `known_crops` restringe alternativas. Cultivar padrão tem que aparecer nas hipóteses.
- Catálogo atual de 23 culturas não significa 23 culturas validadas em sequência/replanejamento.
- Solo contínuo entre ciclos. Encerrar cultura não reseta água, nutrientes ou resíduos.
- N/simbiose/resíduos/pragas estão desativados na configuração atual. Não alegar benefícios que não foram simulados.
- NASA POWER = histórico, não previsão futura. Cenário hipotético não ganha probabilidade inventada.
- Replanejamento usa candidato pai, histórico realizado, corte temporal e replay; não restaurar estado de Summary.OUT.
- Comparar `keep_route`, `keep_crop_adapt_future`, `terminate_and_restart` somente quando suportados. Baseline também recebe clima atualizado.
- Pragas sem adaptador validado devem ser declaradas não suportadas. Não aceitar e ignorar.
- Mesmos membros climáticos e horizonte para todos; não somar rendimentos de produtos incompatíveis.
- Limitar trabalho interno, retries e concorrência; quota por request é insuficiente.
- SoilGrids permanece removido. GCS somente por contas de serviço, sem pedir acesso pessoal.
- Não inventar coeficientes. Não importar genética/artigos sem verificar dependências e política de origem.
- Não push/merge antes de revisão adequada; main pode disparar deploy.

## Primeiro checkpoint a entregar

- Evidência do experimento de sequência, inclusive outputs de continuidade e limitações.
- Testes realmente executados versus pulados por falta do motor.
- Contrato/capacidades ajustados ao que o motor demonstrou.
- Benchmark para definir um orçamento inicial de busca.
- Lista curta do próximo incremento, sem prometer pragas/N/forrageiras antes da validação.

## Validação e saída

Rodar testes da API e DSSAT nos respectivos diretórios; testes do motor precisam da imagem. Conferir Docker COPY e filtros CI ao criar módulos. Revisão final deve procurar regressão no legado, continuidade falsa, vazamento de futuro, comparação desigual, custos sem limite e dados privados expostos. Atualizar STATUS/API apenas com o que funciona. Relatar com precisão o que está implementado, testado localmente, testado na imagem e ainda não publicado.

## Texto curto para iniciar a próxima sessão

> Implemente incrementalmente o plano em docs/PLANO_ROTACOES_EVENTOS_REPLANEJAMENTO.md, na branch feat/rotacoes-eventos-replanejamento. Leia este handoff e AGENTS.md. Comece pela prova técnica de sequência P0, preserve a API atual e o trabalho do outro PC. Não simule rotação somando safras independentes, não invente coeficientes ou suporte a pragas. Entregue mudanças pequenas com testes, revisão e limitações explícitas. O front fica fora desta etapa; merge/deploy somente depois da implementação validada.
