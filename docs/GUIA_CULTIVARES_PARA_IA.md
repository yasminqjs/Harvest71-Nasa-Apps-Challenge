# Guia para adicionar culturas e cultivares ao Field Shift (para outra IA ou dev)

Leia este arquivo inteiro antes de mexer em genética do DSSAT. Ele resume como o catálogo funciona,
as regras da equipe, o formato dos arquivos e o que já foi pesquisado. Contexto geral do projeto:
`AGENTS.md`. Contrato da API: `docs/API.md`. Fontes e decisões: `docs/decisions/0002-fontes-de-dados.md`.

---

## 1. Regras que não mudam

1. **Nada de origem chinesa.** Nenhuma fonte, autor, instituição, experimento ou dado da China, nem
   vínculo indireto. É regra da equipe. O build quebra se aparecer `china|chinese|beijing|nanjing|gansu`
   nos arquivos de genética (`apps/dssat/Dockerfile`) e os testes checam o catálogo.
   Na dúvida sobre um autor ou instituição, **não use** e registre em `not_imported`.
2. **Não invente coeficientes.** Só entra valor publicado. O que o artigo não traz é herdado de um
   cultivar base da biblioteca oficial e **registrado** em `inherited`.
3. **Teste de bom senso obrigatório.** Simule o cultivar novo e compare com o cultivar padrão da mesma
   cultura nas mesmas condições (seção 6). Se der muito fora (ex.: 4 vezes menos), não entra.
   Foi o que tirou o caupi BRS Tumucumaque.
4. **Repositório público.** Nunca commite chave, segredo ou credencial.
5. **Os outros devs só usam a API.** Ninguém além da dona acessa o bucket nem o Google Cloud.
   Toda mudança chega à nuvem pelo push na `main` (o GitHub Actions constrói e publica).
6. **Fonte sempre registrada.** Cada cultivar novo leva citação, instituição, local e versão do modelo.

---

## 2. Como o catálogo funciona

```
dssat-csm-os (commit fixo) ── build ──> /opt/dssat (binário dscsm048 + Genotype/)
                                          │
genotype_keep.txt ──── poda: só os arquivos de genética das culturas do catálogo ficam
cultivars_br.json ──── tools/br_cultivars.py genotype ──> acrescenta linhas .CUL/.ECO
                                          │
crops.json (apps/dssat e apps/api/app, idênticos)
   ├─ gerado por tools/build_crop_catalog.py (a partir dos experimentos de referência da dssat-csm-data)
   └─ marcado por tools/br_cultivars.py catalog (origin "Brasil" + fonte)
                                          │
API: GET /crops, GET /crops/{code}; POST /simulations {"crop": "...", "cultivar": "<id>"}
Job: runner.py (modo point) -> fieldshift_inputs.build_site(..., crop_code, cultivar_id) -> FileX -> DSSAT
```

| Arquivo | Papel |
|---|---|
| `apps/dssat/cultivars_br.json` | **fonte única** dos cultivares brasileiros de artigos: valores, fonte, herdados, exclusões |
| `apps/dssat/tools/br_cultivars.py` | grava as linhas nos `.CUL`/`.ECO` (idempotente) e marca o catálogo |
| `apps/dssat/tools/build_crop_catalog.py` | lista `CROPS` (culturas); gera `crops.json` e `genotype_keep.txt` |
| `apps/dssat/crops.json` = `apps/api/app/crops.json` | catálogo usado pelo Job e pela API (têm de ser idênticos; há teste) |
| `apps/dssat/genotype_keep.txt` | arquivos de genética que ficam na imagem |
| `apps/dssat/fieldshift_inputs.py` | `catalog()`, `get_crop()`, `pick_cultivar()`, `write_filex()`, `build_site()` |
| `apps/dssat/Dockerfile` | build do DSSAT 4.8.6, poda, cultivares brasileiros, trava anti-China |
| `apps/dssat/tests/test_br_cultivars.py` | registro limpo, catálogo com fonte, colunas certas, cada cultivar roda |
| `apps/dssat/tests/test_crops.py` | todas as culturas rodam todas as safras e cenários |
| `apps/api/app/main.py` | `find_crop()` (nomes e apelidos: macaxeira, aipim, caupi…), validação do `cultivar` |
| `.github/workflows/dssat.yml` | constrói a imagem e roda o pytest **dentro** dela (DSSAT de verdade) |

---

## 3. Adicionar um cultivar brasileiro (cultura que já está no catálogo)

### 3.1 Passo a passo
1. Ache um artigo com a **tabela completa** de coeficientes do cultivar (seção 7 tem pistas).
2. Confirme: modelo (CERES, CROPGRO, MANIHOT…), versão do DSSAT e se os autores usaram um arquivo de
   espécie (`.SPE`) ou ecótipo próprio. Se usaram um `.SPE` próprio e não publicado, provavelmente não
   funciona com o oficial: teste e, se der fora, registre em `not_imported`.
3. Acrescente uma entrada em `cultivars` e, se a fonte for nova, em `sources` (formato abaixo).
4. Rode a marcação do catálogo e os testes (seção 5).
5. Faça o teste de bom senso (seção 6).
6. Atualize a tabela "Cultivares brasileiros" em `docs/API.md` e a seção correspondente em
   `docs/decisions/0002-fontes-de-dados.md`.

### 3.2 Formato da entrada
```json
{"id": "FSSB07", "crop": "SB", "genotype_file": "SBGRO048", "name": "BRS 8980", "source": "chave_da_fonte",
 "base": "990248",
 "eco_override": "SB0801",
 "cul": {"CSDL": 12.1, "PPSEN": 0.3, "EM-FL": 22.0},
 "inherited": {"ECO#, THRSH, SDPRO, SDLIP": "990248 BRS 399 (SB0601)"}}
```
- `id`: `FS` + código da cultura + 2 dígitos (`FSSB07`). Não pode repetir nem colidir com a biblioteca.
- `genotype_file`: o mesmo de `crops.json` (`genotype_file` da cultura).
- `base`: linha de onde vêm todas as colunas que não estão em `cul`. Escolha um cultivar parecido
  (de preferência brasileiro e do mesmo tipo ou grupo de maturação). Sem `base`, usa `DFAULT`, se existir.
- `cul`: **só os valores do artigo**, com os nomes exatos das colunas do cabeçalho `@` do `.CUL`.
  Coluna inexistente gera erro (proteção contra erro de digitação).
- `eco_override`: troca o ecótipo herdado (ex.: grupo de maturação diferente).
- Ecótipo próprio (como na mandioca): `"eco_id": "FSCS03", "eco_base": "DFAULT", "eco": {"PARUE": 2.1}`.
  O `eco_id` vira o `ECO#` da linha do cultivar e ganha uma linha nova no `.ECO`.
- `inherited`: texto dizendo **o que** foi herdado e **de quem**. Vai para a API.
- `source`: chave em `sources`, com `citation`, `institution`, `location`, `model` e `url`. Não invente
  DOI nem título: use o que está no PDF.

### 3.3 Formato de largura fixa (como o script escreve)
- O DSSAT lê por posição. Cada coluna termina no fim do nome dela no cabeçalho `@`.
- O script alinha o valor à direita dentro da coluna, com pelo menos 1 espaço antes, até 3 casas
  decimais. Mantém inteiro onde o original é inteiro.
- Nome do cultivar: truncado ao tamanho da coluna de nome (16 caracteres). O nome completo fica no catálogo.
- Valores que excedem MINIMA/MAXIMA do arquivo (ex.: LAXS 950 na mandioca) passam; essas linhas
  só servem para a calibração automática (GLUE).

---

## 4. Adicionar uma cultura nova (ainda fora do catálogo)

1. Confira se o DSSAT 4.8 tem modelo para ela (`DSSATPRO.L48`, linhas `M??`) e um experimento de
   referência na `dssat-csm-data` **sem vínculo chinês** (de preferência do Brasil ou das Américas).
2. Inclua uma tupla na lista `CROPS` de `apps/dssat/tools/build_crop_catalog.py`:
   `("PastaNaDssatCsmData", "XX", "Nome em português", "produto medido", "HWAM" ou "CWAM", "EXPERIMENTO.XXX")`.
   - `HWAM` = produção colhida; `CWAM` = biomassa (usado na cana).
3. Regere o catálogo numa instalação **completa** (todos os arquivos de genética) e com a `dssat-csm-data`
   no commit fixo `99c95b340acb9515c2d0a8ab582f5fbbf076f345`:
   ```
   git clone https://github.com/DSSAT/dssat-csm-data ext/dssat-csm-data
   git -C ext/dssat-csm-data checkout 99c95b340acb9515c2d0a8ab582f5fbbf076f345
   cd apps/dssat
   python3 tools/build_crop_catalog.py --dssat /opt/dssat --data ../../ext/dssat-csm-data
   ```
   Isso reescreve os dois `crops.json` e o `genotype_keep.txt`, e já aplica a marcação de `cultivars_br.json`.
4. Se a cultura tiver cultivar de origem chinesa no `.CUL`, o gerador já filtra pelo nome. Se ele também
   precisar sair do arquivo, acrescente o `sed` no `Dockerfile` (como no amendoim).
5. Adicione apelidos em português em `find_crop()` (`apps/api/app/main.py`), se houver.
6. Rode os testes: `test_every_crop_runs_all_seasons` exige 33 safras × 4 cenários e pelo menos
   metade das safras com produção.
7. Atualize a tabela "Culturas disponíveis" em `docs/API.md`.

**Já avaliadas e fora do catálogo:** braquiária e capim-colonião (o modelo de pastagem exige configurar
cortes), mucuna (só biomassa), trigo, fava e quinoa (pouca relevância no Nordeste).

---

## 5. Como rodar e testar

### Jeito mais simples (igual ao CI): dentro da imagem
```
docker build -t fieldshift-dssat apps/dssat
docker run --rm --user root -v "$PWD/apps:/apps" -w /apps/dssat --entrypoint sh fieldshift-dssat -c \
  "pip install -q --break-system-packages pytest && python3 -m pytest -q -p no:cacheprovider"
```
A imagem já tem o DSSAT compilado, podado e com os cultivares brasileiros.

### Sem Docker (Linux, gfortran 13)
```
git clone https://github.com/DSSAT/dssat-csm-os os && git -C os checkout 25c93b9a2f73f8ec45bf441b198dac5fb7b22849
cmake -S os -B build -DCMAKE_BUILD_TYPE=RELEASE -DCMAKE_INSTALL_PREFIX=/opt/dssat
cmake --build build -j && cmake --install build
python3 apps/dssat/tools/br_cultivars.py genotype /opt/dssat/Genotype
cd apps/dssat && DSSAT_HOME=/opt/dssat python3 -m pytest -q -p no:cacheprovider
```

### Depois de mexer em `cultivars_br.json`
```
cd apps/dssat
python3 tools/br_cultivars.py catalog                      # atualiza os dois crops.json
python3 tools/br_cultivars.py genotype "$DSSAT_HOME/Genotype"   # só na sua instalação local
DSSAT_HOME=/opt/dssat python3 -m pytest -q -p no:cacheprovider tests/test_br_cultivars.py tests/test_crops.py
cd ../api && python3 -m pytest -q
```
O teste `test_every_article_cultivar_runs` é pulado se a instalação local não tiver as linhas novas.
No CI elas sempre existem.

---

## 6. Teste de bom senso (antes de aceitar um cultivar)

Rode o novo e o padrão da cultura com o mesmo clima e solo sintéticos dos testes:

```python
import json, subprocess, tempfile, pathlib, sys
sys.path.insert(0, ".")                      # dentro de apps/dssat
import fieldshift_inputs as fi, runner
from tests.test_point import synthetic_power, ps_identify_doc

def p50(crop, cid, dssat="/opt/dssat"):
    t = pathlib.Path(tempfile.mkdtemp())
    (t/"p.json").write_text(json.dumps(synthetic_power()))
    (t/"s.csv").write_text(fi.pronasolos_identify_to_csv(ps_identify_doc()))
    m = fi.build_site("FSPT", "T", t/"p.json", t/"s.csv", t/"run", auto_window=True, crop_code=crop, cultivar_id=cid)
    subprocess.run([f"{dssat}/dscsm048", "A", m["filex"]], cwd=t/"run", capture_output=True)
    return [a["yield_kg_ha"]["p50"] for a in runner.aggregate(m, runner.summarize(runner.parse_summary(t/"run"/"Summary.OUT")))]

print(p50("SB", "990248"), p50("SB", "FSSB07"))
```
Referências medidas assim (kg/ha, mediana por cenário):

| Cultivar | Mediana |
|---|---|
| CP0006 VERDE BRASIL | cerca de 1.400 |
| BRS Tumucumaque (rejeitado) | cerca de 350 |
| IB0010 Carioca | cerca de 3.200 |
| Feijões novos | 1.800 a 2.200 |
| 990248 BRS 399 | cerca de 2.200 a 2.500 |
| Sojas novas | 2.100 a 3.400 |
| Mandioca BRS Novo Horizonte | cerca de 8.800 |
| Mandioca Eucalipto | cerca de 1.900 |

Diferença de até uns 2 vezes pode ser real. Ordem de grandeza fora não é.

---

## 7. O que já foi pesquisado (para não repetir)

### Entraram (11)
Estão em `cultivars_br.json`:
- Mandioca: BRS Novo Horizonte e Eucalipto (Melo et al. 2025, RBEAA 29(10), Embrapa Mandioca e Fruticultura).
- Feijão: Pérola, Ouro Negro e Ouro Vermelho (Oliveira et al. 2012, Acta Sci. Agron. 34(3), UFV).
- Soja: M-SOY 6101 e MG/BR 46 Conquista (Rodrigues et al. 2012, Bragantia 71(2), UFV).
- Soja: CD 202, CD 204, CD 206 e CD 210 (Dallacort et al. 2006, Acta Sci. Agron. 28(4), Palotina-PR).

### Brasileiros que já estavam na biblioteca oficial (marcados no catálogo)
- Feijão: IB0010 Carioca, IB0037.
- Caupi: CP0006 VERDE BRASIL.
- Milho: IB0171 AG9010, IB0172 DAS CO32, IB0173 DKB 333B, EBSL06 BRS1030.
- Soja: 990248 BRS 399, BR7063, BR7062, BR7901, BR6565, BR0858.
- Cana: RB7515 (RB867515).
- Atenção: os "BR…" do arroz são variedades de **Bangladesh**, não do Brasil.

### Ficaram de fora (motivo em `not_imported`)
- Cana CTC4/7/20 e RB835486 (Nassif 2012): calibrados no Canegro do DSSAT 4.5, com escala de parâmetros diferente da do 4.8.
- Feijão Carioca (Meireles 2002): tabela ilegível no PDF e CROPGRO v2.02.
- Caupi BRS Tumucumaque (Bastos et al. 2023, Embrapa Meio-Norte, BPD 149): linha completa, mas a calibração
  usou um arquivo de espécie próprio; com o oficial dá cerca de 4 vezes menos.
- Caupi BRS Guariba (Lima Filho 2013, RBEAA 17(12)): coeficientes incompletos.
- Sorgo BRS 310 (Grossi, UFV/Embrapa Milho e Sorgo): tabela só na dissertação; o repositório da UFV bloqueia
  leitura automática. Abrir no navegador pode funcionar.
- Milho BRS 1010/1030/1040 (Santana et al., Embrapa Milho e Sorgo): o texto aberto não traz os valores.

### Pistas ainda não extraídas (verifique cada uma; nada aqui foi confirmado)
| Cultura | Pista | Por que interessa |
|---|---|---|
| Caupi | Andrade Júnior, Cardoso, Rodrigues (2000). *Modelagem em feijão caupi*. Embrapa Meio-Norte, Documentos 48. infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/62297/1/Doc48.pdf | descreve a criação dos arquivos .SPE/.ECO/.CUL do CROPGRO-cowpea no Piauí; pode trazer o arquivo de espécie que faltou para o Tumucumaque |
| Caupi | Bastos et al. (2001). Simulação do caupi no Baixo Parnaíba-PI. V RENAC, Embrapa Meio-Norte Documentos 56. alice.cnptia.embrapa.br/alice/bitstream/doc/64671/1/Renac3842.pdf e .../doc/64670/1/Renac3337.pdf | calibrações em Teresina e Parnaíba (1997) |
| Soja (PI) | João Irene Filho (2024). Dissertação UFPI/Embrapa Meio-Norte, Bom Jesus-PI. alice.cnptia.embrapa.br/alice/bitstream/doc/1163137/1/ModelagemCrescimentoProdutividadeGraosSojaSudoestePiauienseJoaoIreneFilho2024.pdf | cultivares calibrados no cerrado do Piauí (cita BRS 8980 e Bônus) |
| Soja (PI) | Revista Caatinga (2024). CSM-CROPGRO-soybean no sudoeste piauiense. doi.org/10.1590/1983-21252024v3711959rc | mesma linha, artigo publicado |
| Amendoim | Cazuza Neto (2022/2023). Dissertação UNESP Jaboticabal, CSM-CROPGRO-Peanut sob irrigação | coeficientes de cultivar brasileiro (verificar qual, ex.: IAC 503) |
| Amendoim | Artigo RBEAA com IAC 503 e CROPGRO-Peanut: scielo.br/j/rbeaa/a/s6VJvLbzQRXKvqqWTCytRNf | conferir se publica a tabela |
| Milho | Silva, S. D. (2015). Dissertação UFSM: crioulos Cinquentinha e Bico de Ouro, BRS Missões, AS 1573PRO (DSSAT 4.5) | milho crioulo e variedade aberta, relevantes para a agricultura familiar |
| Milho | Faria Junior et al. (2018). Rev. Ciências Agrárias 41(2): milho-pipoca, Tangará da Serra (DSSAT 4.6) | outro cultivar brasileiro |
| Milho | Andrade et al. (2016). DKB390PRO, Embrapa Milho e Sorgo, alice doc/1055494 | híbrido muito plantado |
| Sorgo/Milho | Vieira et al. (2024). J. Agric. Sci. 11(18): ADV 123 e DKB 330 Pro, Juranda-PR | coeficientes publicados |

Sugestões de busca: `"coeficientes genéticos" DSSAT <cultura> <BRS|IAC|Embrapa>`, nos repositórios
`alice.cnptia.embrapa.br` e `infoteca.cnptia.embrapa.br` (acesso aberto). Também SciELO (RBEAA,
Revista Caatinga, Bragantia, PAB, Acta Sci. Agron.) e os repositórios da UFV, ESALQ, UNESP e UFPI.
Prioridades para o Nordeste: caupi (BRS), milho de variedade aberta, sorgo BRS, amendoim BR 1 e BRS,
algodão BRS (Embrapa Algodão), mandioca, milheto BRS 1501 e cana (calibrações recentes no Canegro 4.8).

---

## 8. Limites conhecidos

- Coeficientes de versões antigas do CROPGRO rodam com a espécie do 4.8: a fenologia segue o artigo,
  mas a produtividade absoluta pode diferir. A API deixa isso claro no campo `inherited` e no texto
  dos docs. Compare cultivares e cenários, não toneladas entre culturas.
- Nada foi calibrado em clima e solo do Nordeste pelo projeto. As janelas de plantio são automáticas
  (o bloco de 4 meses mais chuvoso) e devem ser validadas com o ZARC (MAPA).
- Triagem anti-China é por texto (nomes, locais, instituições). Não é auditoria autor por autor do
  código do DSSAT.

## 9. Checklist do pull request
- [ ] Valores conferidos contra a tabela do artigo (número por número).
- [ ] `source` com citação, instituição, local e modelo; nada de DOI ou título inventado.
- [ ] `inherited` diz o que veio de qual cultivar base.
- [ ] Nenhum vínculo chinês.
- [ ] `python3 tools/br_cultivars.py catalog` rodado (os dois `crops.json` iguais).
- [ ] Testes passando dentro da imagem.
- [ ] Teste de bom senso feito e resultado anotado no PR.
- [ ] `docs/API.md` e `docs/decisions/0002-fontes-de-dados.md` atualizados.
