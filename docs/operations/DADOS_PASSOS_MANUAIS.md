# Dados: o que precisa ser feito à mão

O resto é baixado direto na nuvem, para o bucket privado `gs://fieldshift-data-fieldshift-harvest71-2026/raw/`, por scripts em `data/scripts/`.

## Resumo

| # | Item | Obrigatório? | Quem faz | Tempo |
|---|---|---|---|---|
| 1 | Push + liberar a coleta no GitHub Actions | **Sim** | Você | 3 min |
| 2 | Conta Earthdata + token no Secret Manager | Só para chuva GPM IMERG | Você | 10 min |
| 3 | Downloads manuais de reserva (INMET, PronaSolos) | Só se a nuvem for bloqueada | Você | Variável |

Nada aqui exige baixar arquivos grandes para o seu computador.

---

## 1. Liberar a coleta pelo GitHub Actions (obrigatório, uma vez)

Quem baixa os dados é o **GitHub Actions** (workflow `ingest-data`), que tem internet aberta e entra no Google Cloud sem chave, pela mesma federação do deploy.

**1a.** No PowerShell, mova o workflow para o lugar certo e faça o push:

```powershell
cd D:\Harvest71-Nasa-Apps-Challenge
Move-Item _github\workflows\ingest-data.yml .github\workflows\ingest-data.yml
Remove-Item _github -Recurse
git add data docs infra .github
git commit -m "Coleta de dados via GitHub Actions"
git push
```

**1b.** No **Cloud Shell**, rode uma vez (cria a conta `fieldshift-ingest-sa` com permissão só de gravar no bucket):

```bash
cd ~/Harvest71-Nasa-Apps-Challenge 2>/dev/null || git clone https://github.com/yasminqjs/Harvest71-Nasa-Apps-Challenge.git ~/Harvest71-Nasa-Apps-Challenge && cd ~/Harvest71-Nasa-Apps-Challenge
git pull
bash infra/gcp/scripts/setup-ingest.sh
```

**1c.** No GitHub, **Actions > ingest-data > Run workflow**. (O push de 1a já dispara uma execução, mas ela falha se 1b ainda não tiver sido feito; é só rodar de novo.)

Nada disso dispara deploy da API.

---

## 2. Conta Earthdata (opcional: só para GPM IMERG)

**Para quê:** chuva diária GPM IMERG, mais detalhada (~10 km) que a do NASA POWER. A NASA exige login para esse produto. O resto (POWER, SoilGrids, relevo NASADEM pelo Planetary Computer, DSSAT, INMET) **não precisa de conta**.

**Pode pular** se o tempo estiver curto: o NASA POWER já tem chuva diária suficiente para o DSSAT.

Passos:

1. Crie a conta em https://urs.earthdata.nasa.gov/users/new (e-mail e senha seus; eu não preencho senha).
2. Logado, vá em **Applications > Authorized Apps > Approve More Applications** e aprove **NASA GESDISC DATA ARCHIVE**.
3. Vá em **Generate Token** e gere um token. Copie.
4. No **Cloud Shell**, rode o comando abaixo e cole o token quando ele esperar entrada (o token não aparece na tela nem fica no histórico):

   ```bash
   gcloud services enable secretmanager.googleapis.com
   read -rs EDT && printf '%s' "$EDT" | gcloud secrets create earthdata-token --data-file=- && unset EDT
   ```

5. Me avise "token criado". Eu nunca vejo o valor; o script lê direto do Secret Manager.

O token vence (em geral em 60 dias). Para trocar: `read -rs EDT && printf '%s' "$EDT" | gcloud secrets versions add earthdata-token --data-file=- && unset EDT`.

---

## 3. Reserva: só se a nuvem for bloqueada

Se algum servidor recusar o download vindo do Google Cloud, eu aviso qual. Aí baixe no navegador e suba no bucket pelo Console (**Cloud Storage > Buckets > fieldshift-data-... > raw/manual/ > Upload**).

| Fonte | Link | O que baixar |
|---|---|---|
| INMET (estações, validação independente) | https://portal.inmet.gov.br/dadoshistoricos | Zips anuais de 2001 a 2025 |
| PronaSolos (solo 90 m) | https://geoportal.sgb.gov.br/server/rest/services/pronasolos/atributos_solo_90m/MapServer | Recorte do Nordeste dos atributos disponíveis |

---

## O que vai direto para a nuvem (sem ação sua)

| Fonte | Conteúdo | Recorte |
|---|---|---|
| DSSAT-CSM + dssat-csm-data | Código, cultivares (.CUL/.ECO/.SPE), experimentos de referência, solos genéricos | Commits fixos |
| NASA POWER (pontos) | Clima diário 1991–2025, JSON e ICASA | 5 pontos de `data/points.csv` |
| NASA POWER (Zarr na AWS) | Clima diário 1981–2025 em grade | Caixa do Nordeste |
| SoilGrids (ISRIC, CC BY 4.0) | Textura, carbono, densidade, pH, CTC, N, água retida; 6 profundidades | Pontos + recorte do Nordeste |
| NASADEM (Planetary Computer) | Relevo 30 m (declividade) | Nordeste |
| INMET | Estações automáticas, para validação | Nordeste |

Tudo com `manifest.json` (origem, data de acesso, sha256).

**Limites a lembrar:** nenhuma dessas fontes dá P e K disponíveis por propriedade; POWER e SoilGrids são estimativas em grade, não medição local.
