from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class AnalysisOptions(BaseModel):
    limiar: float = 0.15
    area_minima_pixels: int = 20
    modo: str = "bandas"


class SpectralIndices(BaseModel):
    ndviBefore: float = 0
    ndviAfter: float = 0
    ndviChange: float = 0
    nbrBefore: float = 0
    nbrAfter: float = 0
    nbrChange: float = 0


class Occurrence(BaseModel):
    id: int
    area_pixels: int
    area_m2: float
    queda_media_ndvi: float
    centroide: dict
    bbox: Optional[list] = None
    status: str = "aguardando_verificacao"


class AnalysisResult(BaseModel):
    status: str
    type: str
    type_label: str
    severity: str
    confidence: float
    affectedAreaHa: float
    affectedPercentage: float
    previousDate: str
    currentDate: str
    indices: SpectralIndices
    isDemo: bool = False
    occurances: List[Occurrence] = []


class SatelliteSearchParams(BaseModel):
    aoi: Optional[dict] = None
    startDate: str = ""
    endDate: str = ""
    cloudCoverage: float = 30
    satellite: str = "SENTINEL-2"


class SatelliteImage(BaseModel):
    id: str
    date: str
    cloudCoverage: float
    resolution: int = 10
    thumbnail: Optional[str] = None
    bands: List[str] = []
    downloadUrl: Optional[str] = None


class SatelliteSearchResult(BaseModel):
    images: List[SatelliteImage]
    count: int
    totalAvailable: int
    isDemo: bool = False


class AlertUpdate(BaseModel):
    status: str
    user: str = "Operador"


class AreaCreate(BaseModel):
    nome: str
    descricao: str = ""
    categoria: str = "preservacao"
    prioridade: str = "media"
    status: str = "ativo"
    responsavel: str = "Operador"
    frequency: str = "manual"
    geojson: Optional[dict] = None
    areaHa: float = 0
    perimeterKm: float = 0
    municipality: str = ""
    state: str = ""
