/**
 * STORAGE SERVICE
 * Gerencia persistencia local (LocalStorage)
 */

class StorageService {
    constructor() {
        this.prefix = APP_CONFIG.STORAGE.PREFIX;
        this.areasKey = this.prefix + APP_CONFIG.STORAGE.AREAS_KEY;
        this.alertsKey = this.prefix + APP_CONFIG.STORAGE.ALERTS_KEY;
        this.historyKey = this.prefix + APP_CONFIG.STORAGE.HISTORY_KEY;
        this.settingsKey = this.prefix + APP_CONFIG.STORAGE.SETTINGS_KEY;
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;
        const areas = this.getAreas();
        if (areas.length === 0) {
            this._loadDemoData();
        }
        this._initialized = true;
        console.log('[StorageService] Inicializado com sucesso');
    }

    _loadDemoData() {
        if (typeof DEMO_DATA !== 'undefined') {
            this.saveAreas(DEMO_DATA.areas || []);
            this.saveAlerts(DEMO_DATA.alerts || []);
            this.saveHistory(DEMO_DATA.history || []);
            console.log('[StorageService] Dados de demonstracao carregados');
        }
    }

    // ==================== AREAS ====================

    getAreas() {
        try {
            const data = localStorage.getItem(this.areasKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('[StorageService] Erro ao ler areas:', e);
            return [];
        }
    }

    saveAreas(areas) {
        try {
            localStorage.setItem(this.areasKey, JSON.stringify(areas));
        } catch (e) {
            console.error('[StorageService] Erro ao salvar areas:', e);
        }
    }

    getArea(id) {
        const areas = this.getAreas();
        return areas.find(a => a.id === id) || null;
    }

    saveArea(area) {
        const areas = this.getAreas();
        if (!area.id) {
            area.id = this._generateId();
            area.createdAt = new Date().toISOString();
            areas.push(area);
        } else {
            const index = areas.findIndex(a => a.id === area.id);
            if (index !== -1) {
                area.updatedAt = new Date().toISOString();
                areas[index] = { ...areas[index], ...area };
            } else {
                areas.push(area);
            }
        }
        this.saveAreas(areas);
        return area;
    }

    updateArea(id, updates) {
        const areas = this.getAreas();
        const index = areas.findIndex(a => a.id === id);
        if (index === -1) return null;
        areas[index] = { ...areas[index], ...updates, updatedAt: new Date().toISOString() };
        this.saveAreas(areas);
        return areas[index];
    }

    deleteArea(id) {
        const areas = this.getAreas();
        const filtered = areas.filter(a => a.id !== id);
        if (filtered.length === areas.length) return false;
        this.saveAreas(filtered);
        return true;
    }

    // ==================== ALERTS ====================

    getAlerts() {
        try {
            const data = localStorage.getItem(this.alertsKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('[StorageService] Erro ao ler alertas:', e);
            return [];
        }
    }

    saveAlerts(alerts) {
        try {
            localStorage.setItem(this.alertsKey, JSON.stringify(alerts));
        } catch (e) {
            console.error('[StorageService] Erro ao salvar alertas:', e);
        }
    }

    saveAlert(alert) {
        const alerts = this.getAlerts();
        if (!alert.id) {
            alert.id = this._generateId('ALT');
            alert.createdAt = new Date().toISOString();
            alerts.unshift(alert);
        } else {
            const index = alerts.findIndex(a => a.id === alert.id);
            if (index !== -1) {
                alert.updatedAt = new Date().toISOString();
                alerts[index] = { ...alerts[index], ...alert };
            }
        }
        this.saveAlerts(alerts);
        return alert;
    }

    updateAlert(id, updates) {
        const alerts = this.getAlerts();
        const index = alerts.findIndex(a => a.id === id);
        if (index === -1) return null;
        alerts[index] = { ...alerts[index], ...updates, updatedAt: new Date().toISOString() };
        this.saveAlerts(alerts);
        return alerts[index];
    }

    // ==================== HISTORY ====================

    getHistory() {
        try {
            const data = localStorage.getItem(this.historyKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('[StorageService] Erro ao ler historico:', e);
            return [];
        }
    }

    saveHistory(history) {
        try {
            localStorage.setItem(this.historyKey, JSON.stringify(history));
        } catch (e) {
            console.error('[StorageService] Erro ao salvar historico:', e);
        }
    }

    addHistory(entry) {
        const history = this.getHistory();
        entry.id = this._generateId('HIST');
        entry.timestamp = entry.timestamp || new Date().toISOString();
        history.unshift(entry);
        this.saveHistory(history);
        return entry;
    }

    getHistoryByArea(areaId) {
        return this.getHistory().filter(h => h.areaId === areaId);
    }

    // ==================== HELPERS ====================

    _generateId(prefix = '') {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
    }

    clearAll() {
        localStorage.removeItem(this.areasKey);
        localStorage.removeItem(this.alertsKey);
        localStorage.removeItem(this.historyKey);
        this._initialized = false;
    }

    exportGeoJSON() {
        const areas = this.getAreas();
        return {
            type: 'FeatureCollection',
            features: areas.map(area => ({
                type: 'Feature',
                properties: {
                    id: area.id, nome: area.nome, categoria: area.categoria,
                    prioridade: area.prioridade, status: area.status,
                    areaHa: area.areaHa || 0, createdAt: area.createdAt
                },
                geometry: area.geojson ? area.geojson.geometry : null
            })).filter(f => f.geometry)
        };
    }

    importGeoJSON(geojson) {
        if (!geojson || geojson.type !== 'FeatureCollection') throw new Error('GeoJSON invalido');
        const areas = geojson.features.map(feature => ({
            id: this._generateId(), nome: feature.properties.nome || 'Area Importada',
            categoria: feature.properties.categoria || 'preservacao',
            prioridade: feature.properties.prioridade || 'media',
            status: feature.properties.status || 'ativo', frequency: 'manual',
            geojson: feature, areaHa: feature.properties.areaHa || 0,
            createdAt: new Date().toISOString()
        }));
        const existing = this.getAreas();
        this.saveAreas([...existing, ...areas]);
        return areas;
    }
}

const storageService = new StorageService();
window.storageService = storageService;
