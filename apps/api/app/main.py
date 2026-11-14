"""Field Shift API — versão mínima de infraestrutura.

Somente /health e /version. Nenhum endpoint de simulação, nenhum dado de
agricultor. Endpoints que iniciam jobs só entram depois de autenticação,
autorização e quotas (ver docs/decisions e o handoff).
"""

import os

from fastapi import FastAPI

API_VERSION = "0.1.0"

app = FastAPI(
    title="Field Shift API",
    version=API_VERSION,
    docs_url=None,  # sem Swagger público no MVP de infraestrutura
    redoc_url=None,
    openapi_url=None,
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/version")
def version() -> dict:
    # GIT_COMMIT é injetado na imagem em build time; nunca colocar segredos aqui.
    return {
        "service": "fieldshift-api",
        "version": API_VERSION,
        "commit": os.environ.get("GIT_COMMIT", "unknown"),
    }
