# DSSAT-CSM em contêiner para Cloud Run Jobs.
# Versões fixas por commit (reprodutível). Licença do DSSAT-CSM: BSD-3-Clause (DSSAT Foundation).

# ---------- Compilação ----------
# Ubuntu 24.04 (gfortran 13), o mesmo compilador usado para obter os valores de referência
FROM ubuntu:24.04 AS build
ARG DSSAT_OS_COMMIT=25c93b9a2f73f8ec45bf441b198dac5fb7b22849
ARG DSSAT_DATA_COMMIT=99c95b340acb9515c2d0a8ab582f5fbbf076f345
RUN apt-get update && apt-get install -y --no-install-recommends \
      gfortran cmake make git ca-certificates python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /src
# Código: commit fixo. Dados: só os 5 arquivos do experimento de referência brasileiro
# (download parcial), sem o restante da biblioteca de exemplos.
RUN git init -q os && git -C os fetch -q --depth 1 https://github.com/DSSAT/dssat-csm-os "$DSSAT_OS_COMMIT" \
 && git -C os checkout -q FETCH_HEAD \
 && git init -q data && cd data && git remote add o https://github.com/DSSAT/dssat-csm-data \
 && git sparse-checkout set --no-cone 'Maize/BRPI0202.*' 'Weather/BRPI0201.WTH' 'Soil/BR.SOL' \
 && git fetch -q --depth 1 --filter=blob:none o "$DSSAT_DATA_COMMIT" && git checkout -q FETCH_HEAD
RUN cmake -S os -B build -DCMAKE_BUILD_TYPE=RELEASE -DCMAKE_INSTALL_PREFIX=/opt/dssat \
 && cmake --build build -j"$(nproc)" && cmake --install build
# Política da equipe (nenhum dado de origem chinesa) + mínimo necessário:
# só a genética das culturas do catálogo (genotype_keep.txt) e o solo do Brasil (BR.SOL) ficam na imagem.
# No amendoim, a única variedade de origem chinesa ("CHINESE TMV2") é removida.
COPY genotype_keep.txt cultivars_br.json /src/
COPY tools/br_cultivars.py /src/tools/br_cultivars.py
RUN cd /opt/dssat/Genotype && for f in *; do grep -qxF "$f" /src/genotype_keep.txt || rm -f "$f"; done \
 && sed -i -E '/[Cc][Hh][Ii][Nn][Aa]|[Cc][Hh][Ii][Nn][Ee][Ss][Ee]/d' PNGRO048.CUL \
 && python3 /src/tools/br_cultivars.py genotype /opt/dssat/Genotype \
 && mkdir -p /opt/dssat/Soil /opt/dssat/Weather /opt/dssat/reference \
 && cp /src/data/Soil/BR.SOL /opt/dssat/Soil/ \
 && cp /src/data/Weather/BRPI0201.WTH /opt/dssat/Weather/ \
 && cp /src/data/Maize/BRPI0202.MZX /src/data/Maize/BRPI0202.MZA /src/data/Maize/BRPI0202.MZT /opt/dssat/reference/ \
 && cp /src/os/license.txt /opt/dssat/LICENSE-dssat-csm-os.txt \
 && ! grep -rqiE 'china|chinese|beijing|nanjing|gansu' /opt/dssat/Genotype /opt/dssat/Soil /opt/dssat/Weather /opt/dssat/reference \
 && printf '{"dssat_csm_os":"%s","dssat_csm_data":"%s","genotype":"catalogo (genotype_keep.txt)"}\n' "$DSSAT_OS_COMMIT" "$DSSAT_DATA_COMMIT" > /opt/dssat/BUILD_INFO.json

# ---------- Execução ----------
FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends libgfortran5 python3 python3-pip ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && pip install --no-cache-dir --break-system-packages "google-cloud-storage>=2.16,<3"
COPY --from=build /opt/dssat /opt/dssat
COPY runner.py fieldshift_inputs.py weather_events.py rotation_compare.py rotation_search.py crops.json /app/
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT DSSAT_HOME=/opt/dssat PYTHONUNBUFFERED=1 PYTHONPATH=/app
RUN useradd --uid 10001 --create-home dssat
USER dssat
WORKDIR /home/dssat
ENTRYPOINT ["python3", "/app/runner.py"]
