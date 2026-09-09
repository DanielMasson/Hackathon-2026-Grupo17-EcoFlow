#!/bin/bash
echo "=== EcoFlow Frontend ==="
echo "Iniciando servidor web em http://localhost:8080"
echo "Pressione Ctrl+C para parar"
echo ""
python3 -m http.server 8080
