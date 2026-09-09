import os
import json
import httpx
import tempfile
from pathlib import Path

try:
    import boto3
    from botocore import Config as BotoConfig
    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False

from ..config import COPERNICUS, DADOS_DIR, SENTINEL2_COLLECTION


class CopernicusService:
    def __init__(self):
        self._token = None
        self._token_expires = 0

    @property
    def _has_credentials(self) -> bool:
        return bool(COPERNICUS["username"] and COPERNICUS["password"])

    @property
    def _has_s3_keys(self) -> bool:
        return bool(COPERNICUS["s3_access_key"] and COPERNICUS["s3_secret_key"])

    async def _get_token(self) -> str:
        import time
        if self._token and time.time() < self._token_expires:
            return self._token

        if not self._has_credentials:
            raise ValueError("Credenciais Copernicus nao configuradas. Defina COPERNICUS_EMAIL e COPERNICUS_PASSWORD.")

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                COPERNICUS["auth_url"],
                data={
                    "client_id": COPERNICUS["client_id"],
                    "grant_type": "password",
                    "username": COPERNICUS["username"],
                    "password": COPERNICUS["password"],
                },
            )
            resp.raise_for_status()
            data = resp.json()

        self._token = data["access_token"]
        self._token_expires = time.time() + data.get("expires_in", 600) - 60
        return self._token

    async def buscar_imagems(
        self,
        bbox: list,
        data_inicio: str,
        data_fim: str,
        max_nuvens: float = 30,
        limite: int = 20,
    ) -> list:
        stac_url = COPERNICUS["stac_url"]

        search_body = {
            "collections": [SENTINEL2_COLLECTION],
            "bbox": bbox,
            "limit": limite,
        }
        if data_inicio and data_fim:
            dt_start = f"{data_inicio}T00:00:00Z" if "T" not in data_inicio else data_inicio
            dt_end = f"{data_fim}T23:59:59Z" if "T" not in data_fim else data_fim
            search_body["datetime"] = f"{dt_start}/{dt_end}"

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{stac_url}/search",
                json=search_body,
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()

        items = data.get("features", [])
        resultados = []

        for item in items:
            props = item.get("properties", {})
            clouds = props.get("eo:cloud_cover", 0)
            if clouds > max_nuvens:
                continue

            assets = item.get("assets", {})

            bandas = []
            for key in assets:
                if key.startswith("B") and ("10m" in key or "_10m" in key):
                    bandas.append(key)

            thumbnail = None
            for key in ["thumbnail", "visual", "overview"]:
                if key in assets:
                    thumbnail = assets[key].get("href")
                    break

            download_b04 = assets.get("B04_10m", assets.get("B04", {})).get("href")
            download_b08 = assets.get("B08_10m", assets.get("B08", {})).get("href")

            resultados.append({
                "id": item.get("id", ""),
                "date": props.get("datetime", ""),
                "cloudCoverage": round(props.get("eo:cloud_cover", 0), 1),
                "resolution": 10,
                "thumbnail": thumbnail,
                "bands": bandas,
                "downloadUrl": download_b04,
                "s3Path": self._extrair_s3_path(item),
            })

        return resultados

    def _extrair_s3_path(self, item: dict) -> dict:
        assets = item.get("assets", {})
        paths = {}
        for band_name in ["B04_10m", "B08_10m", "B04", "B08"]:
            if band_name in assets:
                href = assets[band_name].get("href", "")
                if href.startswith("s3://eodata/"):
                    paths[band_name] = href.replace("s3://eodata/", "")
                elif "eodata" in href:
                    parts = href.split("/", 3)
                    if len(parts) >= 4:
                        paths[band_name] = "/".join(parts[3:])
        return paths

    async def baixar_bandas(
        self,
        item_id: str,
        s3_paths: dict,
        output_dir: str = None,
    ) -> dict:
        if output_dir is None:
            output_dir = str(Path(DADOS_DIR).resolve())

        os.makedirs(output_dir, exist_ok=True)

        if self._has_s3_keys and HAS_BOTO3:
            return await self._baixar_s3(s3_paths, output_dir)
        elif self._has_credentials:
            return await self._baixar_http(item_id, s3_paths, output_dir)
        else:
            raise ValueError("Nenhuma credencial configurada para download.")

    async def _baixar_s3(self, s3_paths: dict, output_dir: str) -> dict:
        s3 = boto3.client(
            "s3",
            endpoint_url=COPERNICUS["s3_endpoint"],
            aws_access_key_id=COPERNICUS["s3_access_key"],
            aws_secret_access_key=COPERNICUS["s3_secret_key"],
            config=BotoConfig(signature_version="s3v4"),
            region_name="default",
        )

        resultados = {}
        mapeamento = {
            "B04_10m": "depois_B04.tiff",
            "B08_10m": "depois_B08.tiff",
            "B04": "depois_B04.tiff",
            "B08": "depois_B08.tiff",
        }

        for band_key, s3_path in s3_paths.items():
            if band_key in mapeamento:
                output_file = os.path.join(output_dir, mapeamento[band_key])
                print(f"[Copernicus] Baixando {band_key} via S3...")
                s3.download_file("eodata", s3_path, output_file)
                resultados[band_key] = output_file
                print(f"[Copernicus] Salvo: {output_file}")

        return resultados

    async def _baixar_http(self, item_id: str, s3_paths: dict, output_dir: str) -> dict:
        token = await self._get_token()
        resultados = {}

        mapeamento = {
            "B04_10m": "depois_B04.tiff",
            "B08_10m": "depois_B08.tiff",
        }

        async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
            for band_key, s3_path in s3_paths.items():
                if band_key in mapeamento:
                    output_file = os.path.join(output_dir, mapeamento[band_key])
                    download_url = f"{COPERNICUS['s3_endpoint']}/{s3_path}"

                    print(f"[Copernicus] Baixando {band_key} via HTTP...")
                    resp = await client.get(
                        download_url,
                        headers={"Authorization": f"Bearer {token}"},
                    )
                    resp.raise_for_status()

                    with open(output_file, "wb") as f:
                        f.write(resp.content)

                    resultados[band_key] = output_file
                    print(f"[Copernicus] Salvo: {output_file}")

        return resultados

    async def buscar_e_baixar(
        self,
        bbox: list,
        data_inicio: str,
        data_fim: str,
        max_nuvens: float = 20,
        output_dir: str = None,
    ) -> dict:
        imagens = await self.buscar_imagems(bbox, data_inicio, data_fim, max_nuvens, limite=5)

        if not imagens:
            raise ValueError("Nenhuma imagem Sentinel-2 encontrada para os parametros informados.")

        imagem = imagens[0]
        s3_paths = imagem.get("s3Path", {})

        if not s3_paths:
            raise ValueError("Nao foi possivel obter caminhos de download para a imagem selecionada.")

        arquivos = await self.baixar_bandas(imagem["id"], s3_paths, output_dir)

        return {
            "image": imagem,
            "downloaded": arquivos,
        }
