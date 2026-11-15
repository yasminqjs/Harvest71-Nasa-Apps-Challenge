"""Field Shift / RoçaViva API — Infraestrutura e Módulo Científico de Qualidade da Plantação Atual."""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.models.schemas import CropQualityRequest, CropQualityResponse
from app.services.diagnostic_engine import analyze_crop_quality, get_pilot_areas_payload

API_VERSION = "0.2.0"

app = FastAPI(
    title="Field Shift / RoçaViva API",
    version=API_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FarmSyncPayload(BaseModel):
    fazenda_id: str
    centroid: dict[str, Any] = Field(default_factory=dict)
    polygon: list[dict[str, Any]] = Field(default_factory=list)
    cultura_principal: str = "Feijão-caupi"
    raio_km: float = 5.0
    registros_pendentes: list[dict[str, Any]] = Field(default_factory=list)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/version")
def version() -> dict[str, str]:
    # GIT_COMMIT é injetado na imagem em build time; nunca colocar segredeos aqui.
    return {
        "service": "fieldshift-api",
        "version": API_VERSION,
        "commit": os.environ.get("GIT_COMMIT", "unknown"),
    }


@app.get("/api/v1/crop-quality/pilot-areas")
def list_pilot_areas() -> dict[str, Any]:
    """Return the 3 Northeast semi-arid pilot polygons (< 5 ha) and their audited NASA payloads."""
    return {"pilot_areas": get_pilot_areas_payload()}


@app.post("/api/v1/crop-quality/analyze", response_model=CropQualityResponse)
def analyze_crop_quality_endpoint(request: CropQualityRequest) -> CropQualityResponse:
    """Synchronous NASA POWER + Copernicus Sentinel-2 + Landsat C2 + NASADEM + FAO pipeline."""
    try:
        return analyze_crop_quality(request)
    except LookupError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erro no pipeline científico: {exc}") from exc


@app.post("/api/fazendas/sincronizar")
def sync_farm_records(payload: FarmSyncPayload) -> dict[str, Any]:
    """Receive queued offline field observations from the RoçaViva mobile/web client."""
    return {
        "status": "sincronizado",
        "fazenda_id": payload.fazenda_id,
        "registros_recebidos": len(payload.registros_pendentes),
        "diagnostico": None,
    }
