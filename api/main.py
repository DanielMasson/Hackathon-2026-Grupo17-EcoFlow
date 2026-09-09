import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    AnalysisOptions, AlertUpdate, AreaCreate,
    SatelliteSearchParams,
)
from .services.analysis_service import AnalysisService
from .services.satellite_service import SatelliteService
from .services.storage_service import StorageService

app = FastAPI(title="EcoFlow API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

analysis_svc = AnalysisService()
satellite_svc = SatelliteService()
storage_svc = StorageService()


# ──────────────────────────────────────────────
#  AREAS
# ──────────────────────────────────────────────

@app.get("/api/areas")
def get_areas():
    return storage_svc.get_areas()


@app.get("/api/areas/{area_id}")
def get_area(area_id: str):
    area = storage_svc.get_area(area_id)
    if not area:
        raise HTTPException(404, "Area not found")
    return area


@app.post("/api/areas")
def create_area(body: AreaCreate):
    area = body.model_dump()
    return storage_svc.save_area(area)


@app.put("/api/areas/{area_id}")
def update_area(area_id: str, updates: dict):
    result = storage_svc.update_area(area_id, updates)
    if not result:
        raise HTTPException(404, "Area not found")
    return result


@app.delete("/api/areas/{area_id}")
def delete_area(area_id: str):
    ok = storage_svc.delete_area(area_id)
    if not ok:
        raise HTTPException(404, "Area not found")
    return {"ok": True}


# ──────────────────────────────────────────────
#  ANALYSIS
# ──────────────────────────────────────────────

@app.post("/api/analysis/{area_id}")
async def run_analysis(area_id: str, options: AnalysisOptions = None):
    if options is None:
        options = AnalysisOptions()

    result = await analysis_svc.analyze(
        area_id,
        limiar=options.limiar,
        area_minima_pixels=options.area_minima_pixels,
        modo=options.modo,
    )

    storage_svc.update_area(area_id, {"analysis": result, "lastAnalysis": result["currentDate"]})

    if result["status"] != "normal":
        area = storage_svc.get_area(area_id)
        alert = {
            "areaId": area_id,
            "areaName": area.get("nome", "") if area else "",
            "type": result["type"],
            "severity": result["severity"],
            "status": "Detectado",
            "confidence": result["confidence"],
            "affectedAreaHa": result["affectedAreaHa"],
            "description": f"{result['type_label']} detectado com confianca de {result['confidence']*100:.0f}%",
            "date": result["currentDate"],
            "history": [{"status": "Detectado", "timestamp": result["currentDate"], "user": "Sistema"}],
        }
        saved_alert = storage_svc.save_alert(alert)
        result["alertId"] = saved_alert.get("id")

        storage_svc.add_history({
            "areaId": area_id,
            "action": "Analise detectada",
            "type": result["type"],
            "severity": result["severity"],
            "confidence": result["confidence"],
            "user": "Sistema",
        })

    return result


@app.post("/api/analysis/upload")
async def analyze_upload(
    limiar: float = 0.15,
    area_minima_pixels: int = 20,
    modo: str = "bandas",
):
    result = await analysis_svc.analyze(
        "upload",
        limiar=limiar,
        area_minima_pixels=area_minima_pixels,
        modo=modo,
    )
    return result


# ──────────────────────────────────────────────
#  ALERTS
# ──────────────────────────────────────────────

@app.get("/api/alerts")
def get_alerts():
    return storage_svc.get_alerts()


@app.put("/api/alerts/{alert_id}/status")
def update_alert_status(alert_id: str, body: AlertUpdate):
    updates = {"status": body.status}
    if body.status in ("Encerrado", "Falso positivo"):
        updates["resolvedAt"] = __import__("datetime").datetime.now().isoformat()

    history_entry = {
        "status": body.status,
        "timestamp": __import__("datetime").datetime.now().isoformat(),
        "user": body.user,
    }

    alert = storage_svc.update_alert(alert_id, updates)
    if not alert:
        raise HTTPException(404, "Alert not found")

    hist = alert.get("history", [])
    hist.append(history_entry)
    storage_svc.update_alert(alert_id, {"history": hist})

    return alert


# ──────────────────────────────────────────────
#  SATELLITE
# ──────────────────────────────────────────────

@app.post("/api/satellite/search")
async def search_satellite(body: SatelliteSearchParams):
    return await satellite_svc.search(body.model_dump())


@app.post("/api/satellite/download")
async def download_satellite(body: dict):
    try:
        result = await satellite_svc.download(body)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/satellite/search-and-download")
async def search_and_download(body: SatelliteSearchParams):
    try:
        result = await satellite_svc.search_and_download(body.model_dump())
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


# ──────────────────────────────────────────────
#  HISTORY
# ──────────────────────────────────────────────

@app.get("/api/history")
def get_history(area_id: str = None):
    return storage_svc.get_history(area_id)


@app.post("/api/history")
def add_history(entry: dict):
    return storage_svc.add_history(entry)


# ──────────────────────────────────────────────
#  EXPORT / IMPORT
# ──────────────────────────────────────────────

@app.get("/api/export/geojson")
def export_geojson():
    areas = storage_svc.get_areas()
    features = []
    for area in areas:
        geojson = area.get("geojson")
        if not geojson or not geojson.get("geometry"):
            continue
        features.append({
            "type": "Feature",
            "properties": {
                "id": area.get("id"),
                "nome": area.get("nome"),
                "categoria": area.get("categoria"),
                "prioridade": area.get("prioridade"),
                "status": area.get("status"),
                "areaHa": area.get("areaHa", 0),
            },
            "geometry": geojson["geometry"],
        })
    return {"type": "FeatureCollection", "features": features}


if __name__ == "__main__":
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
