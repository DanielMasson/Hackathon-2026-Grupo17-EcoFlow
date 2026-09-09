#!/bin/bash
echo "=== EcoFlow API ==="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Instalando dependencias..."
pip install --break-system-packages -q fastapi uvicorn python-multipart httpx pydantic numpy scipy scikit-image matplotlib rasterio 2>/dev/null

echo ""
echo "Iniciando API FastAPI em http://localhost:8000"
echo "Documentacao: http://localhost:8000/docs"
echo "Pressione Ctrl+C para parar"
echo ""
cd "$PROJECT_DIR"
python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
