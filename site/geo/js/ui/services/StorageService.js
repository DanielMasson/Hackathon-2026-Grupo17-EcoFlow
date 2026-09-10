/**
 * STORAGE SERVICE
 * Gerencia persistência local (LocalStorage)
 * Preparado para futura migração para IndexedDB ou API REST
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

    /**
     * Inicializa o storage com dados padrão se vazio
     */
    init() {
        if (this._initialized) return;
        
        // Verifica se já existem dados
        const areas = this.getAreas();
        if (areas.length === 0) {
            // Inicializa com dados de demonstração
            this._loadDemoData();
        }
        
        this._initialized = true;
        console.log('[StorageService] Inicializado com sucesso');
    }

    /**
     * Carrega dados de demonstração
     * @private
     */
_loadDemoData() {
    if (typeof DEMO_DATA !== 'undefined') {
        this.saveAreas(DEMO_DATA.areas || []);
        this.saveAlerts(DEMO_DATA.alerts || []);
        this.saveHistory(DEMO_DATA.history || []);
        console.log('[StorageService] Dados de demonstração carregados');
    } else {
        console.warn('[StorageService] DEMO_DATA não encontrado');
    }
}

    // ==================== AREAS ====================

    /**
     * Obtém todas as áreas
     * @returns {Array} Lista de áreas
     */
    getAreas() {
        try {
            const data = localStorage.getItem(this.areasKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('[StorageService] Erro ao ler áreas:', e);
            return [];
        }
    }

    /**
     * Salva todas as áreas
     * @param {Array} areas - Lista de áreas
     */
    saveAreas(areas) {
        try {
            localStorage.setItem(this.areasKey, JSON.stringify(areas));
        } catch (e) {
            console.error('[StorageService] Erro ao salvar áreas:', e);
        }
    }

    /**
     * Obtém uma área por ID
     * @param {string|number} id 
     * @returns {Object|null}
     */
    getArea(id) {
        const areas = this.getAreas();
        return areas.find(a => a.id === id) || null;
    }

    /**
     * Salva uma nova área
     * @param {Object} area 
     * @returns {Object} Área salva com ID
     */
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

    /**
     * Atualiza uma área existente
     * @param {string|number} id 
     * @param {Object} updates 
     * @returns {Object|null}
     */
    updateArea(id, updates) {
        const areas = this.getAreas();
        const index = areas.findIndex(a => a.id === id);
        if (index === -1) return null;
        
        areas[index] = { 
            ...areas[index], 
            ...updates, 
            updatedAt: new Date().toISOString() 
        };
        this.saveAreas(areas);
        return areas[index];
    }

    /**
     * Remove uma área por ID
     * @param {string|number} id 
     * @returns {boolean}
     */
    deleteArea(id) {
        const areas = this.getAreas();
        const filtered = areas.filter(a => a.id !== id);
        if (filtered.length === areas.length) return false;
        this.saveAreas(filtered);
        return true;
    }

    // ==================== ALERTS ====================

    /**
     * Obtém todos os alertas
     * @returns {Array}
     */
    getAlerts() {
        try {
            const data = localStorage.getItem(this.alertsKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('[StorageService] Erro ao ler alertas:', e);
            return [];
        }
    }

    /**
     * Salva todos os alertas
     * @param {Array} alerts 
     */
    saveAlerts(alerts) {
        try {
            localStorage.setItem(this.alertsKey, JSON.stringify(alerts));
        } catch (e) {
            console.error('[StorageService] Erro ao salvar alertas:', e);
        }
    }

    /**
     * Salva um novo alerta
     * @param {Object} alert 
     * @returns {Object}
     */
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

    /**
     * Atualiza um alerta
     * @param {string|number} id 
     * @param {Object} updates 
     * @returns {Object|null}
     */
    updateAlert(id, updates) {
        const alerts = this.getAlerts();
        const index = alerts.findIndex(a => a.id === id);
        if (index === -1) return null;
        
        alerts[index] = { 
            ...alerts[index], 
            ...updates, 
            updatedAt: new Date().toISOString() 
        };
        this.saveAlerts(alerts);
        return alerts[index];
    }

    // ==================== HISTORY ====================

    /**
     * Obtém todo o histórico
     * @returns {Array}
     */
    getHistory() {
        try {
            const data = localStorage.getItem(this.historyKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('[StorageService] Erro ao ler histórico:', e);
            return [];
        }
    }

    /**
     * Salva todo o histórico
     * @param {Array} history 
     */
    saveHistory(history) {
        try {
            localStorage.setItem(this.historyKey, JSON.stringify(history));
        } catch (e) {
            console.error('[StorageService] Erro ao salvar histórico:', e);
        }
    }

    /**
     * Adiciona um registro ao histórico
     * @param {Object} entry 
     * @returns {Object}
     */
    addHistory(entry) {
        const history = this.getHistory();
        entry.id = this._generateId('HIST');
        entry.timestamp = entry.timestamp || new Date().toISOString();
        history.unshift(entry);
        this.saveHistory(history);
        return entry;
    }

    /**
     * Obtém histórico por área
     * @param {string|number} areaId 
     * @returns {Array}
     */
    getHistoryByArea(areaId) {
        const history = this.getHistory();
        return history.filter(h => h.areaId === areaId);
    }

    // ==================== HELPERS ====================

    /**
     * Gera um ID único
     * @param {string} prefix 
     * @returns {string}
     * @private
     */
    _generateId(prefix = '') {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
    }

    /**
     * Limpa todos os dados
     */
    clearAll() {
        localStorage.removeItem(this.areasKey);
        localStorage.removeItem(this.alertsKey);
        localStorage.removeItem(this.historyKey);
        this._initialized = false;
        console.log('[StorageService] Todos os dados removidos');
    }

    /**
     * Exporta todos os dados como GeoJSON
     * @returns {Object}
     */
    exportGeoJSON() {
        const areas = this.getAreas();
        return {
            type: 'FeatureCollection',
            features: areas.map(area => ({
                type: 'Feature',
                properties: {
                    id: area.id,
                    nome: area.nome,
                    categoria: area.categoria,
                    prioridade: area.prioridade,
                    status: area.status,
                    descricao: area.descricao || '',
                    areaHa: area.areaHa || 0,
                    createdAt: area.createdAt
                },
                geometry: area.geojson ? area.geojson.geometry : null
            })).filter(f => f.geometry)
        };
    }

    /**
     * Importa dados de um GeoJSON
     * @param {Object} geojson 
     */
    importGeoJSON(geojson) {
        if (!geojson || geojson.type !== 'FeatureCollection') {
            throw new Error('GeoJSON inválido');
        }
        
        const areas = geojson.features.map(feature => ({
            id: this._generateId(),
            nome: feature.properties.nome || 'Área Importada',
            descricao: feature.properties.descricao || '',
            categoria: feature.properties.categoria || 'preservacao',
            prioridade: feature.properties.prioridade || 'media',
            status: feature.properties.status || 'ativo',
            responsavel: feature.properties.responsavel || '',
            frequency: 'manual',
            geojson: feature,
            areaHa: feature.properties.areaHa || 0,
            createdAt: new Date().toISOString()
        }));
        
        const existing = this.getAreas();
        this.saveAreas([...existing, ...areas]);
        return areas;
    }
}

// Instância global
const storageService = new StorageService();
window.storageService = storageService;