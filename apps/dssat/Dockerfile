# DSSAT-CSM em contêiner para Cloud Run Jobs.
# Versões fixas por commit (reprodutível). Licença do DSSAT-CSM: BSD-3-Clause (DSSAT Foundation).

# ---------- Compilação ----------
# Ubuntu 24.04 (gfortran 13), o mesmo compilador usado para obter os valores de referência
FROM ubuntu:24.04 AS build
ARG DSSAT_OS_COMMIT=25c93b9a2f73f8ec45bf441b198dac5fb7b22849
ARG DSSAT_DATA_COMMIT=99c95b340acb9515c2d0a8ab582f5fbbf076f345
RUN apt-get update && apt-get install -y --no-install-recommends \
      gfortran cmake make git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git init -q os && git -C os fetch -q --depth 1 https://github.com/DSSAT/dssat-csm-os "$DSSAT_OS_COMMIT" \
 && git -C os checkout -q FETCH_HEAD \
 && git init -q data && git -C data fetch -q --depth 1 https://github.com/DSSAT/dssat-csm-data "$DSSAT_DATA_COMMIT" \
 && git -C data checkout -q FETCH_HEAD
RUN cmake -S os -B build -DCMAKE_BUILD_TYPE=RELEASE -DCMAKE_INSTALL_PREFIX=/opt/dssat \
 && cmake --build build -j"$(nproc)" && cmake --install build
# Solos genéricos + experimento de referência (milho, Piracicaba-SP, BRPI0202) para o teste de fumaça
RUN mkdir -p /opt/dssat/Soil /opt/dssat/Weather /opt/dssat/reference \
 && cp data/Soil/*.SOL /opt/dssat/Soil/ \
 && cp data/Weather/BRPI0201.WTH /opt/dssat/Weather/ \
 && cp data/Maize/BRPI0202.MZX data/Maize/BRPI0202.MZA data/Maize/BRPI0202.MZT /opt/dssat/reference/ \
 && cp os/license.txt /opt/dssat/LICENSE-dssat-csm-os.txt \
 && printf '{"dssat_csm_os":"%s","dssat_csm_data":"%s"}\n' "$DSSAT_OS_COMMIT" "$DSSAT_DATA_COMMIT" > /opt/dssat/BUILD_INFO.json

# ---------- Execução ----------
FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends libgfortran5 python3 python3-pip ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && pip install --no-cache-dir --break-system-packages "google-cloud-storage>=2.16,<3"
COPY --from=build /opt/dssat /opt/dssat
COPY runner.py /app/runner.py
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT DSSAT_HOME=/opt/dssat PYTHONUNBUFFERED=1
RUN useradd --uid 10001 --create-home dssat
USER dssat
WORKDIR /home/dssat
ENTRYPOINT ["python3", "/app/runner.py"]
