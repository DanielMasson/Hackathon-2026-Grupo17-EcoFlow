import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "script_python"))

import numpy as np
from datetime import datetime

from ndvi import calcular_ndvi
from detect_changes import detectar_mudancas
from real_data import carregar_par_red_nir, carregar_ndvi_direto, pixel_para_coordenada_real


class AnalysisService:
    def __init__(self):
        self.dados_dir = Path(__file__).resolve().parent.parent.parent / "script_python" / "dados"

    async def analyze(self, area_id: str, **options) -> dict:
        limiar = options.get("limiar", 0.15)
        area_minima = options.get("area_minima_pixels", 20)
        modo = options.get("modo", "bandas")

        if modo == "ndvi":
            return self._analyze_from_ndvi(limiar, area_minima)
        return self._analyze_from_bands(limiar, area_minima)

    def _analyze_from_bands(self, limiar: float, area_minima: int) -> dict:
        red_antes, nir_antes, transform, _ = carregar_par_red_nir(
            str(self.dados_dir / "antes_B04.tiff"),
            str(self.dados_dir / "antes_B08.tiff"),
        )
        red_depois, nir_depois, _, _ = carregar_par_red_nir(
            str(self.dados_dir / "depois_B04.tiff"),
            str(self.dados_dir / "depois_B08.tiff"),
        )

        ndvi_antes = calcular_ndvi(red_antes, nir_antes)
        ndvi_depois = calcular_ndvi(red_depois, nir_depois)

        mascara, ocorrencias = detectar_mudancas(
            ndvi_antes, ndvi_depois,
            limiar=limiar,
            area_minima_pixels=area_minima,
        )

        return self._build_result(ndvi_antes, ndvi_depois, mascara, ocorrencias, transform)

    def _analyze_from_ndvi(self, limiar: float, area_minima: int) -> dict:
        ndvi_files = sorted(self.dados_dir.glob("*NDVI*.tiff"))
        if len(ndvi_files) < 2:
            ndvi_files = sorted(self.dados_dir.glob("*ndvi*.tiff"))
        if len(ndvi_files) < 2:
            return {
                "status": "normal",
                "type": "normal",
                "type_label": "Normal",
                "severity": "normal",
                "confidence": 0,
                "affectedAreaHa": 0,
                "affectedPercentage": 0,
                "previousDate": datetime.now().isoformat(),
                "currentDate": datetime.now().isoformat(),
                "indices": {
                    "ndviBefore": 0, "ndviAfter": 0, "ndviChange": 0,
                    "nbrBefore": 0, "nbrAfter": 0, "nbrChange": 0,
                },
                "isDemo": False,
                "occurances": [],
            }

        ndvi_antes, transform, _ = carregar_ndvi_direto(str(ndvi_files[0]))
        ndvi_depois, _, _ = carregar_ndvi_direto(str(ndvi_files[1]))

        mascara, ocorrencias = detectar_mudancas(
            ndvi_antes, ndvi_depois,
            limiar=limiar,
            area_minima_pixels=area_minima,
        )

        return self._build_result(ndvi_antes, ndvi_depois, mascara, ocorrencias, transform)

    def _build_result(self, ndvi_antes, ndvi_depois, mascara, ocorrencias, transform) -> dict:
        ndvi_change = float(np.mean(ndvi_antes) - np.mean(ndvi_depois))
        affected_pixels = int(np.sum(mascara))
        total_pixels = mascara.size
        affected_percentage = (affected_pixels / total_pixels) * 100 if total_pixels > 0 else 0

        change_type, severity = self._classify_change(abs(ndvi_change))

        occurances = []
        for occ in ocorrencias:
            lat, lon = pixel_para_coordenada_real(
                occ.centroide_linha, occ.centroide_coluna, transform
            )
            occurances.append({
                "id": occ.id,
                "area_pixels": occ.area_pixels,
                "area_m2": occ.area_pixels * 100,
                "queda_media_ndvi": round(occ.queda_media_ndvi, 4),
                "centroide": {"lat": round(lat, 6), "lon": round(lon, 6)},
                "bbox": list(occ.bbox),
                "status": "aguardando_verificacao",
            })

        pixel_size_m2 = 100
        affected_area_ha = (affected_pixels * pixel_size_m2) / 10000

        now = datetime.now().isoformat()
        return {
            "status": "alteracao" if len(ocorrencias) > 0 else "normal",
            "type": change_type,
            "type_label": self._get_type_label(change_type),
            "severity": severity,
            "confidence": round(min(0.98, 0.75 + abs(ndvi_change)), 4),
            "affectedAreaHa": round(affected_area_ha, 2),
            "affectedPercentage": round(affected_percentage, 2),
            "previousDate": now,
            "currentDate": now,
            "indices": {
                "ndviBefore": round(float(np.mean(ndvi_antes)), 4),
                "ndviAfter": round(float(np.mean(ndvi_depois)), 4),
                "ndviChange": round(ndvi_change, 4),
                "nbrBefore": 0,
                "nbrAfter": 0,
                "nbrChange": 0,
            },
            "isDemo": False,
            "occurances": occurances,
        }

    def _classify_change(self, ndvi_drop: float):
        if ndvi_drop < 0.15:
            return "normal", "normal"
        elif ndvi_drop > 0.225:
            return "possivel_desmatamento", "alta"
        elif ndvi_drop > 0.15:
            return "alteracao_vegetacao", "media"
        return "inconclusivo", "normal"

    def _get_type_label(self, change_type: str) -> str:
        labels = {
            "normal": "Normal",
            "possivel_desmatamento": "Possivel Desmatamento",
            "possivel_queimada": "Possivel Queimada",
            "alteracao_vegetacao": "Alteracao de Vegetacao",
            "solo_exposto": "Solo Exposto",
            "inconclusivo": "Inconclusivo",
        }
        return labels.get(change_type, change_type)
