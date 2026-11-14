# Como contribuir

1. **Uma branch por tarefa**, a partir da `main` (`feat/...`, `fix/...`, `docs/...`).
2. **Abra uma Issue antes** de mudar contratos de API ou arquitetura; decisões relevantes viram um ADR em `docs/decisions/`.
3. **PR pequeno + revisão.** Nada de `git push --force` na `main`.
4. **Rode os testes localmente:**
   ```bash
   cd apps/api
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements-dev.txt
   pytest -q
   ```
5. **Atualize `docs/operations/STATUS.md`** ao terminar algo que mexa em infraestrutura.

## Regras de segurança (valem para pessoas e para IAs)

- Nunca commitar chaves JSON, tokens, `.env` com segredo real, nem laudos/coordenadas de agricultores.
- Não colar IDs de conta de faturamento, dados de pagamento nem dumps de IAM em issues/PRs.
- Não criar chaves de conta de serviço. Deploy automático futuro usa Workload Identity Federation (OIDC).
- Não criar VM, Cloud SQL, GPU, NAT ou balanceador sem Issue aprovada.
- Cada pessoa usa **sua conta Google e GitHub individuais**; não compartilhar senhas.
