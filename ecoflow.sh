#!/bin/bash
# ============================================
#  EcoFlow - Iniciar / Reiniciar Sistema
# ============================================

PROJETO="$(cd "$(dirname "$0")" && pwd)"
API_PORT=8000
FRONT_PORT=8080

# Cores
VERDE='\033[0;32m'
VERMELHO='\033[0;31m'
AMARELO='\033[1;33m'
RESET='\033[0m'

parar() {
    echo -e "${AMARELO}Parando servicos...${RESET}"
    pkill -f "uvicorn api.main" 2>/dev/null && echo "  API parada" || echo "  API ja estava parada"
    pkill -f "http.server $FRONT_PORT" 2>/dev/null && echo "  Frontend parado" || echo "  Frontend ja estava parado"
    sleep 1
}

iniciar_api() {
    echo -e "${AMARELO}Iniciando API (porta $API_PORT)...${RESET}"
    cd "$PROJETO"
    setsid python3 -m uvicorn api.main:app --host 0.0.0.0 --port $API_PORT &>/tmp/ecoflow_api.log &
    sleep 2
    if curl -s http://localhost:$API_PORT/api/areas > /dev/null 2>&1; then
        echo -e "${VERDE}  API rodando → http://localhost:$API_PORT${RESET}"
    else
        echo -e "${VERMELHO}  ERRO ao iniciar API. Verifique: cat /tmp/ecoflow_api.log${RESET}"
        return 1
    fi
}

iniciar_frontend() {
    echo -e "${AMARELO}Iniciando Frontend (porta $FRONT_PORT)...${RESET}"
    cd "$PROJETO/site/geo"
    setsid python3 -m http.server $FRONT_PORT &>/tmp/ecoflow_frontend.log &
    sleep 1
    if curl -s http://localhost:$FRONT_PORT/ > /dev/null 2>&1; then
        echo -e "${VERDE}  Frontend rodando → http://localhost:$FRONT_PORT${RESET}"
    else
        echo -e "${VERMELHO}  ERRO ao iniciar Frontend. Verifique: cat /tmp/ecoflow_frontend.log${RESET}"
        return 1
    fi
}

status() {
    echo ""
    echo -e "${AMARELO}=== Status ===${RESET}"
    curl -s http://localhost:$API_PORT/api/areas > /dev/null 2>&1 \
        && echo -e "  API:      ${VERDE}http://localhost:$API_PORT${RESET}" \
        || echo -e "  API:      ${VERMELHO}OFFLINE${RESET}"
    curl -s http://localhost:$FRONT_PORT/ > /dev/null 2>&1 \
        && echo -e "  Frontend: ${VERDE}http://localhost:$FRONT_PORT${RESET}" \
        || echo -e "  Frontend: ${VERMELHO}OFFLINE${RESET}"
    echo -e "  Docs:     http://localhost:$API_PORT/docs"
    echo ""
}

case "${1:-}" in
    stop)
        parar
        ;;
    restart)
        parar
        iniciar_api
        iniciar_frontend
        status
        ;;
    status)
        status
        ;;
    *)
        parar
        iniciar_api
        iniciar_frontend
        status
        ;;
esac
