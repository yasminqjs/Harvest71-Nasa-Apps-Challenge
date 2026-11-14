# Field Shift — status técnico

Data: 2026-11-14
Agente / responsável: Claude (sessão com Chrome da Yasmin)
Issue / PR / commit: —

## Recursos GCP verificados (via Console, leitura)
- Projeto: `fieldshift-harvest71-2026`, região `us-central1`
- APIs habilitadas: Cloud Run Admin, Artifact Registry, Cloud Build, Cloud Storage (e outras padrão)
- Artifact Registry: repositório Docker `fieldshift`, `us-central1`, varredura paga de vulnerabilidades **desativada**
- Bucket: `fieldshift-data-fieldshift-harvest71-2026` — privado, Standard, acesso uniforme, prevenção de acesso público ativa
- Contas de serviço: `fieldshift-api-sa`, `fieldshift-dssat-sa` — **sem chaves**
- IAM do bucket: `Usuário de objetos do Storage` para as duas contas, só no bucket (tela confirmou "Política atualizada"; não reconferido por CLI)
- Cloud Run Service `fieldshift-api`: **não existe**
- Cloud Run Job `fieldshift-dssat`: **não existe**
- Orçamento: existe "Harvest 71", mensal, **R$ 30**, aplicável **somente ao serviço Cloud Run** do projeto, configurado como limite de gastos com pausa. Não cobre Storage/Artifact Registry. Alertas 25/50/80/100% não conferidos.
- Compute Engine: nenhuma VM foi criada por este trabalho (não listado por CLI)

## Alterações nesta sessão
- Criados: Artifact Registry `fieldshift`, bucket, duas contas de serviço, papéis no bucket
- Arquivos do repositório: README, CONTRIBUTING, API FastAPI mínima, Dockerfile, scripts `infra/gcp/scripts`, CI de testes

## Testes executados e evidência
- `pytest` da API: ver resultado na entrega (rodado em ambiente local de desenvolvimento)
- Deploy no Cloud Run: **não realizado**

## Pendências e riscos
- Repositório GitHub é **público**: decidir se torna privado antes de publicar documentação de infraestrutura
- `gcloud` não alcançável no ambiente do agente; auditoria por CLI e deploy devem ser feitos no Cloud Shell
- Decidir escopo do orçamento (Cloud Run apenas vs. projeto inteiro) e se o limite com pausa é desejado
- DSSAT: fixar versão, reproduzir experimento oficial localmente antes de criar o Job
- Próximo agente: rodar `infra/gcp/scripts/audit.sh`, depois `deploy-api.sh`, e registrar URL/revisão/commit aqui
