from .copernicus_service import CopernicusService


class SatelliteService:
    def __init__(self):
        self._copernicus = CopernicusService()

    async def search(self, params: dict) -> dict:
        aoi = params.get("aoi")
        start = params.get("startDate")
        end = params.get("endDate")
        cloud_max = params.get("cloudCoverage", 30)

        bbox = self._geojson_to_bbox(aoi) if aoi else [-60, -20, -40, 0]

        try:
            imagens = await self._copernicus.buscar_imagems(
                bbox=bbox,
                data_inicio=start,
                data_fim=end,
                max_nuvens=cloud_max,
            )
            return {
                "images": imagens,
                "count": len(imagens),
                "totalAvailable": len(imagens),
                "isDemo": False,
            }
        except Exception as e:
            print(f"[SatelliteService] Erro na busca Copernicus: {e}")
            return {
                "images": [],
                "count": 0,
                "totalAvailable": 0,
                "isDemo": False,
                "error": str(e),
            }

    async def download(self, params: dict) -> dict:
        image_antes = params.get("imageAntes")
        image_depois = params.get("imageDepois")
        output_dir = params.get("outputDir")

        resultados = {}

        if image_antes:
            s3_paths = image_antes.get("s3Path", {})
            if s3_paths:
                arquivos = await self._copernicus.baixar_bandas(
                    image_antes["id"], s3_paths, output_dir
                )
                for k, v in arquivos.items():
                    resultados[f"antes_{k}"] = v

        if image_depois:
            s3_paths = image_depois.get("s3Path", {})
            if s3_paths:
                arquivos = await self._copernicus.baixar_bandas(
                    image_depois["id"], s3_paths, output_dir
                )
                for k, v in arquivos.items():
                    resultados[f"depois_{k}"] = v

        return {"downloaded": resultados}

    async def search_and_download(self, params: dict) -> dict:
        aoi = params.get("aoi")
        start = params.get("startDate")
        end = params.get("endDate")
        cloud_max = params.get("cloudCoverage", 20)
        output_dir = params.get("outputDir")

        bbox = self._geojson_to_bbox(aoi) if aoi else [-60, -20, -40, 0]

        resultado = await self._copernicus.buscar_e_baixar(
            bbox=bbox,
            data_inicio=start,
            data_fim=end,
            max_nuvens=cloud_max,
            output_dir=output_dir,
        )

        return {
            "image": resultado["image"],
            "downloaded": resultado["downloaded"],
        }

    def _geojson_to_bbox(self, geojson: dict) -> list:
        try:
            geom = geojson.get("geometry", geojson)
            coords = geom.get("coordinates", [[]])[0]
            if not coords:
                return [-60, -20, -40, 0]
            lons = [c[0] for c in coords]
            lats = [c[1] for c in coords]
            return [min(lons), min(lats), max(lons), max(lats)]
        except Exception:
            return [-60, -20, -40, 0]
