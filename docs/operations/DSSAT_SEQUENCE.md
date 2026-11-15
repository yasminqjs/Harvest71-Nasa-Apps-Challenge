# Investigação do modo de sequência DSSAT

O código fixado pela imagem (`25c93b9a2f73f8ec45bf441b198dac5fb7b22849`) implementa sequência pelo modo `Q`. A verificação abaixo é de código-fonte. A execução com água do solo medida a cada transição continua pendente.

- [CSM.for](https://github.com/DSSAT/dssat-csm-os/blob/25c93b9a2f73f8ec45bf441b198dac5fb7b22849/CSM_Main/CSM.for#L168) recebe um arquivo de lote no modo `Q`. Cada linha de dados tem o caminho do FileX nas colunas 1–92 e três campos separados com largura de 7 caracteres a partir da coluna 93, referentes a tratamento, repetição e rotação. O nome do FileX tem 12 caracteres, incluindo a extensão.
- [CSM.for](https://github.com/DSSAT/dssat-csm-os/blob/25c93b9a2f73f8ec45bf441b198dac5fb7b22849/CSM_Main/CSM.for#L279) volta ao início do lote ao alcançar seu fim. O [critério de parada](https://github.com/DSSAT/dssat-csm-os/blob/25c93b9a2f73f8ec45bf441b198dac5fb7b22849/CSM_Main/CSM.for#L366) usa a data inicial mais `NYERS` anos menos um dia. O lote com duas linhas pode simular mais de dois ciclos. Um horizonte arbitrário exige verificar como delimitar o último ciclo ou pousio no motor.
- [WBSUBS.for](https://github.com/DSSAT/dssat-csm-os/blob/25c93b9a2f73f8ec45bf441b198dac5fb7b22849/Soil/SoilWater/WBSUBS.for#L147) evita a inicialização da água para as etapas posteriores em `Q`. A simulação de referência do projeto usa modo `A`, portanto seu sucesso não verifica esse comportamento.

Na imagem, o caso mínimo precisa usar duas culturas do catálogo, solo e clima com origem já aceita e um intervalo de pousio. Conferir a ordem das etapas, as datas efetivas e o estado hídrico por camada no ponto de transição. Comparar com um controle que reinicializa o segundo cultivo e verificar se o lote repete etapas quando sobram dias no horizonte. Antes de liberar replanejamento, reproduzir um prefixo com clima e operações realizadas até a data de decisão e comparar o estado diário entre os futuros alternativos.

## Executar a comparação de duas ordens

Com o DSSAT instalado e `DSSAT_HOME` apontando para a instalação, entre em
`apps/dssat` e execute:

```text
python -m rotation_compare power.json solo.csv saida --crops MZ CP --dates 1992-01-15 1992-07-15
```

Use uma série NASA POWER com cobertura do período e um CSV PronaSolos no
formato já usado por `fieldshift_inputs.py`. Use uma pasta de saída nova. O
comando roda as ordens MZ → CP e CP → MZ sob o mesmo clima, solo inicial e
datas. Cada ordem tem seu próprio lote `Q` e arquivos de saída. A comparação
informa as diferenças por cultura (ordem invertida menos ordem inicial) e
rejeita a saída se o motor não registrar os plantios nas datas solicitadas.

O resultado é exploratório, para um ano histórico e em sequeiro. As duas datas
trocam de cultura junto com a ordem, então a diferença inclui efeitos de
calendário. As saídas diárias ficam disponíveis para investigar a água do solo.
A execução ainda é por linha de comando e pelo teste na imagem do CI.
