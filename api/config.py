import os

COPERNICUS = {
    "stac_url": "https://stac.dataspace.copernicus.eu/v1",
    "s3_endpoint": "https://eodata.dataspace.copernicus.eu",
    "auth_url": "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
    "client_id": "cdse-public",
    "username": os.environ.get("COPERNICUS_EMAIL", ""),
    "password": os.environ.get("COPERNICUS_PASSWORD", ""),
    "s3_access_key": os.environ.get("CDSE_S3_ACCESS_KEY", ""),
    "s3_secret_key": os.environ.get("CDSE_S3_SECRET_KEY", ""),
}

DADOS_DIR = os.path.join(os.path.dirname(__file__), "..", "script_python", "dados")

SENTINEL2_COLLECTION = "sentinel-2-l2a"

BANDS_10M = ["B02", "B03", "B04", "B08"]
