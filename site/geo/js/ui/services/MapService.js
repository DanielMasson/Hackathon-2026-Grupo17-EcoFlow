/**
 * MAP SERVICE
 * Gerencia o mapa Leaflet, camadas e interações
 */

class MapService {
    constructor(containerId) {
        this.containerId = containerId;
        this.map = null;
        this.areasLayer = null;
        this.alertsLayer = null;
        this.changesLayer = null;
        this.areaMarkers = [];
        this.alertMarkers = [];
        this._initialized = false;
    }

    /**
     * Inicializa o mapa
     */
    init() {
        if (this._initialized) return;

        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error('[MapService] Container não encontrado:', this.containerId);
            return;
        }

        // Cria mapa
        this.map = L.map(container, {
            center: APP_CONFIG.MAP.DEFAULT_CENTER,
            zoom: APP_CONFIG.MAP.DEFAULT_ZOOM,
            zoomControl: true,
            attributionControl: true,
            fadeAnimation: true,
            zoomAnimation: true
        });

        // Adiciona tile layer base
        this.baseLayer = L.tileLayer(APP_CONFIG.MAP.TILE_LAYER, {
            attribution: APP_CONFIG.MAP.TILE_ATTRIBUTION,
            maxZoom: APP_CONFIG.MAP.MAX_ZOOM,
            minZoom: APP_CONFIG.MAP.MIN_ZOOM
        }).addTo(this.map);

        // Camada de satélite (ESRI World Imagery - gratuito)
        this.satelliteLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            {
                maxZoom: 19,
                attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
            }
        );

        // Inicializa camadas de features
        this.areasLayer = L.layerGroup().addTo(this.map);
        this.alertsLayer = L.layerGroup().addTo(this.map);
        this.changesLayer = L.layerGroup().addTo(this.map);

        // Controles
        this._addControls();

        // Eventos
        this._bindEvents();

        this._initialized = true;
        console.log('[MapService] Mapa inicializado');
    }

    /**
     * Adiciona controles ao mapa
     * @private
     */
    _addControls() {
        // Scale control
        L.control.scale({
            position: 'bottomright',
            metric: true,
            imperial: false
        }).addTo(this.map);

        // Zoom control customizado
        this.map.zoomControl.setPosition('topright');
    }

    /**
     * Vincula eventos do mapa
     * @private
     */
    _bindEvents() {
        // Mouse move - coordenadas
        this.map.on('mousemove', (e) => {
            const display = document.getElementById('coordinatesDisplay');
            if (display) {
                display.textContent = `Lat: ${e.latlng.lat.toFixed(6)}, Lng: ${e.latlng.lng.toFixed(6)}`;
            }
        });

        // Controle de camadas via checkbox
        document.querySelectorAll('[data-layer]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const layer = e.target.dataset.layer;
                const visible = e.target.checked;
                this.toggleLayer(layer, visible);
            });
        });
    }

    /**
     * Alterna visibilidade de camada
     * @param {string} layer 
     * @param {boolean} visible 
     */
    toggleLayer(layer, visible) {
        switch(layer) {
            case 'base':
                if (visible) {
                    this.map.addLayer(this.baseLayer);
                } else {
                    this.map.removeLayer(this.baseLayer);
                }
                break;
            case 'satellite':
                if (visible) {
                    this.map.addLayer(this.satelliteLayer);
                } else {
                    this.map.removeLayer(this.satelliteLayer);
                }
                break;
            case 'areas':
                if (visible) {
                    this.map.addLayer(this.areasLayer);
                } else {
                    this.map.removeLayer(this.areasLayer);
                }
                break;
            case 'alerts':
                if (visible) {
                    this.map.addLayer(this.alertsLayer);
                } else {
                    this.map.removeLayer(this.alertsLayer);
                }
                break;
            case 'changes':
                if (visible) {
                    this.map.addLayer(this.changesLayer);
                } else {
                    this.map.removeLayer(this.changesLayer);
                }
                break;
        }
    }

    /**
     * Atualiza áreas no mapa
     * @param {Array} areas 
     */
    updateAreas(areas) {
        if (!this._initialized) return;
        this.areasLayer.clearLayers();
        this.areaMarkers = [];

        if (!areas || areas.length === 0) return;

        areas.forEach(area => {
            if (!area.geojson || !area.geojson.geometry) return;

            try {
                const style = this._getAreaStyle(area);
                const layer = L.geoJSON(area.geojson, {
                    style: style,
                    onEachFeature: (feature, layer) => {
                        // Popup
                        const popupContent = this._createAreaPopup(area);
                        layer.bindPopup(popupContent, {
                            className: 'area-popup',
                            maxWidth: 280
                        });

                        // Eventos
                        layer.on('click', () => {
                            this._onAreaClick(area);
                        });
                    }
                });

                this.areasLayer.addLayer(layer);
                this.areaMarkers.push({ area, layer });
            } catch (e) {
                console.warn('[MapService] Erro ao renderizar área:', area.nome, e);
            }
        });
    }

    /**
     * Retorna estilo da área baseado no status
     * @param {Object} area 
     * @returns {Object}
     * @private
     */
    _getAreaStyle(area) {
        const baseStyle = {
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.2
        };

        const status = area.analysis?.status || 'normal';
        const severity = area.analysis?.severity || 'normal';

        switch(status) {
            case 'normal':
                return { ...baseStyle, color: '#00ff88', fillColor: '#00ff88' };
            case 'alteracao':
                switch(severity) {
                    case 'critica': return { ...baseStyle, color: '#ff0040', fillColor: '#ff0040', fillOpacity: 0.3 };
                    case 'alta': return { ...baseStyle, color: '#ff8c00', fillColor: '#ff8c00', fillOpacity: 0.3 };
                    case 'media': return { ...baseStyle, color: '#ffd700', fillColor: '#ffd700', fillOpacity: 0.3 };
                    default: return { ...baseStyle, color: '#ffd700', fillColor: '#ffd700' };
                }
            default:
                return { ...baseStyle, color: '#00d4ff', fillColor: '#00d4ff' };
        }
    }

    /**
     * Cria popup da área
     * @param {Object} area 
     * @returns {string}
     * @private
     */
    _createAreaPopup(area) {
        const status = area.analysis?.status || 'normal';
        const statusLabel = status === 'normal' ? '✅ Normal' : 
                           status === 'alteracao' ? '⚠️ Alteração' : '❓ Desconhecido';
        
        return `
            <div style="min-width:180px;">
                <h4 style="margin:0 0 4px;color:#00d4ff;">${area.nome}</h4>
                <div style="font-size:12px;color:#8a9bb5;">
                    <div>📍 ${area.areaHa?.toFixed(1) || 0} ha</div>
                    <div>📂 ${APP_CONFIG.CATEGORIES.find(c => c.value === area.categoria)?.label || area.categoria}</div>
                    <div style="margin-top:4px;">${statusLabel}</div>
                    ${area.analysis?.confidence ? `<div>🎯 Confiança: ${(area.analysis.confidence * 100).toFixed(0)}%</div>` : ''}
                </div>
                <button onclick="window.app?.switchView('areas')" 
                        style="margin-top:8px;padding:4px 12px;background:#00d4ff;color:#0a0e17;border:none;border-radius:4px;cursor:pointer;font-size:12px;">
                    Ver detalhes
                </button>
            </div>
        `;
    }

    /**
     * Atualiza alertas no mapa
     * @param {Array} alerts 
     */
    updateAlerts(alerts) {
        if (!this._initialized) return;
        this.alertsLayer.clearLayers();
        this.alertMarkers = [];

        if (!alerts || alerts.length === 0) return;

        const activeAlerts = alerts.filter(a => 
            a.status === 'Detectado' || a.status === 'Em análise'
        );

        activeAlerts.forEach(alert => {
            // Busca a área para obter a geometria
            const area = window.app?.areaService?.get(alert.areaId);
            if (!area || !area.geojson) return;

            try {
                const centroid = turf.centroid(area.geojson);
                const coords = centroid.geometry.coordinates;
                
                const icon = this._getAlertIcon(alert.severity);
                const marker = L.marker([coords[1], coords[0]], { icon })
                    .bindPopup(this._createAlertPopup(alert, area))
                    .addTo(this.alertsLayer);

                this.alertMarkers.push({ alert, marker });
            } catch (e) {
                console.warn('[MapService] Erro ao renderizar alerta:', alert.id, e);
            }
        });
    }

    /**
     * Retorna ícone do alerta
     * @param {string} severity 
     * @returns {L.Icon}
     * @private
     */
    _getAlertIcon(severity) {
        const colors = {
            'critica': '#ff0040',
            'alta': '#ff8c00',
            'media': '#ffd700',
            'normal': '#00ff88'
        };
        const color = colors[severity] || '#00d4ff';

        return L.divIcon({
            className: 'alert-marker',
            html: `<div style="
                width: 24px;
                height: 24px;
                background: ${color};
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 0 20px ${color}40;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                color: white;
                font-weight: bold;
            ">!</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
    }

    /**
     * Cria popup do alerta
     * @param {Object} alert 
     * @param {Object} area 
     * @returns {string}
     * @private
     */
    _createAlertPopup(alert, area) {
        const severityLabels = {
            'critica': '🔴 Crítico',
            'alta': '🟠 Alto',
            'media': '🟡 Médio',
            'normal': '🟢 Normal'
        };

        return `
            <div style="min-width:200px;">
                <h4 style="margin:0 0 4px;color:${alert.severity === 'critica' ? '#ff0040' : '#ffd700'};">
                    ⚠️ ${severityLabels[alert.severity] || 'Alerta'}
                </h4>
                <div style="font-size:13px;font-weight:500;">${alert.areaName || area.nome}</div>
                <div style="font-size:12px;color:#8a9bb5;margin-top:4px;">
                    <div>📏 ${alert.affectedAreaHa?.toFixed(1) || 0} ha afetados</div>
                    <div>🎯 Confiança: ${(alert.confidence * 100).toFixed(0)}%</div>
                    <div>📅 ${new Date(alert.date).toLocaleDateString()}</div>
                </div>
                <button onclick="window.app?.switchView('alerts')" 
                        style="margin-top:8px;padding:4px 12px;background:#ff8c00;color:#0a0e17;border:none;border-radius:4px;cursor:pointer;font-size:12px;">
                    Ver alerta
                </button>
            </div>
        `;
    }

    /**
     * Evento de clique na área
     * @param {Object} area 
     * @private
     */
    _onAreaClick(area) {
        // Centraliza no mapa
        if (area.geojson) {
            try {
                const center = turf.center(area.geojson);
                this.map.setView([center.geometry.coordinates[1], center.geometry.coordinates[0]], 12, {
                    animate: true,
                    duration: 1
                });
            } catch (e) {}
        }

        // Mostra notificação
        window.app?._showNotification(
            `📍 ${area.nome}`,
            `Clique em "Analisar" para realizar análise detalhada.`,
            'info'
        );
    }

    /**
     * Atualiza camada de alterações
     * @param {Array} changes 
     */
    updateChanges(changes) {
        if (!this._initialized) return;
        this.changesLayer.clearLayers();

        if (!changes || changes.length === 0) return;

        changes.forEach(change => {
            if (!change.geojson) return;

            try {
                L.geoJSON(change.geojson, {
                    style: {
                        color: '#ff0040',
                        weight: 3,
                        opacity: 0.8,
                        fillColor: '#ff0040',
                        fillOpacity: 0.15,
                        dashArray: '5,5'
                    }
                }).addTo(this.changesLayer);
            } catch (e) {
                console.warn('[MapService] Erro ao renderizar alteração:', e);
            }
        });
    }

    /**
     * Centraliza o mapa em uma área
     * @param {Object} area 
     */
    focusArea(area) {
        if (!area || !area.geojson) return;

        try {
            const center = turf.center(area.geojson);
            this.map.setView([center.geometry.coordinates[1], center.geometry.coordinates[0]], 13, {
                animate: true,
                duration: 0.8
            });
        } catch (e) {
            console.warn('[MapService] Erro ao focar área:', e);
        }
    }

    /**
     * Centraliza o mapa em coordenadas
     * @param {number} lat 
     * @param {number} lng 
     * @param {number} zoom 
     */
    setView(lat, lng, zoom = 10) {
        this.map.setView([lat, lng], zoom, {
            animate: true,
            duration: 0.8
        });
    }

    /**
     * Invalida tamanho do mapa (útil após redimensionamento)
     */
    invalidateSize() {
        if (this.map) {
            this.map.invalidateSize();
        }
    }

    /**
     * Limpa todas as camadas
     */
    clearAll() {
        if (!this._initialized) return;
        this.areasLayer.clearLayers();
        this.alertsLayer.clearLayers();
        this.changesLayer.clearLayers();
        this.areaMarkers = [];
        this.alertMarkers = [];
    }

    /**
     * Destroi o mapa
     */
    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
            this._initialized = false;
        }
    }
}

// Exportar para uso global
window.MapService = MapService;