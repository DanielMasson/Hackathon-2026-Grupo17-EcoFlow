/**
 * AREA SERVICE
 * Gerencia operações com áreas monitoradas
 */

class AreaService {
    constructor() {
        this.areas = [];
        this.storage = storageService;
        this._initialized = false;
    }

    /**
     * Inicializa o serviço
     */
    init() {
        if (this._initialized) return;
        this.areas = this.storage.getAreas();
        this._initialized = true;
        console.log('[AreaService] Inicializado com ' + this.areas.length + ' áreas');
    }

    /**
     * Define a lista de áreas (para recarga)
     * @param {Array} areas 
     */
    setAreas(areas) {
        this.areas = areas || [];
    }

    /**
     * Obtém todas as áreas
     * @returns {Array}
     */
    getAll() {
        return this.areas;
    }

    /**
     * Obtém área por ID
     * @param {string|number} id 
     * @returns {Object|null}
     */
    get(id) {
        return this.areas.find(a => a.id === id) || null;
    }

    /**
     * Obtém áreas por status
     * @param {string} status 
     * @returns {Array}
     */
    getByStatus(status) {
        return this.areas.filter(a => a.status === status);
    }

    /**
     * Obtém áreas por prioridade
     * @param {string} priority 
     * @returns {Array}
     */
    getByPriority(priority) {
        return this.areas.filter(a => a.prioridade === priority);
    }

    /**
     * Obtém áreas por categoria
     * @param {string} category 
     * @returns {Array}
     */
    getByCategory(category) {
        return this.areas.filter(a => a.categoria === category);
    }

    /**
     * Obtém áreas com alertas ativos
     * @returns {Array}
     */
    getWithActiveAlerts() {
        return this.areas.filter(a => 
            a.analysis && 
            a.analysis.status !== 'normal' &&
            a.status === 'ativo'
        );
    }

    /**
     * Cria uma nova área
     * @param {Object} data 
     * @returns {Object}
     */
    create(data) {
        // Validação
        if (!data.nome || !data.geojson) {
            throw new Error('Nome e GeoJSON são obrigatórios');
        }

        const newArea = {
            id: this._generateId(),
            nome: data.nome,
            descricao: data.descricao || '',
            categoria: data.categoria || 'preservacao',
            prioridade: data.prioridade || 'media',
            status: data.status || 'ativo',
            responsavel: data.responsavel || 'Operador',
            frequency: data.frequency || 'manual',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            areaHa: data.areaHa || 0,
            perimeterKm: data.perimeterKm || 0,
            municipality: data.municipality || '--',
            state: data.state || '--',
            lastAnalysis: null,
            geojson: data.geojson,
            analysis: data.analysis || {
                status: 'normal',
                type: 'normal',
                severity: 'normal',
                confidence: 0,
                affectedAreaHa: 0,
                affectedPercentage: 0,
                previousDate: null,
                currentDate: null
            },
            history: data.history || []
        };

        this.areas.push(newArea);
        this._save();
        return newArea;
    }

    /**
     * Atualiza uma área existente
     * @param {string|number} id 
     * @param {Object} updates 
     * @returns {Object|null}
     */
    update(id, updates) {
        const index = this.areas.findIndex(a => a.id === id);
        if (index === -1) return null;

        const area = this.areas[index];
        const updated = {
            ...area,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        this.areas[index] = updated;
        this._save();
        return updated;
    }

    /**
     * Remove uma área
     * @param {string|number} id 
     * @returns {boolean}
     */
    delete(id) {
        const index = this.areas.findIndex(a => a.id === id);
        if (index === -1) return false;

        this.areas.splice(index, 1);
        this._save();
        return true;
    }

    /**
     * Atualiza a análise de uma área
     * @param {string|number} id 
     * @param {Object} analysisResult 
     * @returns {Object|null}
     */
    updateAnalysis(id, analysisResult) {
        const area = this.get(id);
        if (!area) return null;

        area.analysis = {
            ...area.analysis,
            ...analysisResult,
            analyzedAt: new Date().toISOString()
        };
        area.lastAnalysis = new Date().toISOString();

        this._save();
        return area;
    }

    /**
     * Adiciona evento ao histórico da área
     * @param {string|number} id 
     * @param {Object} event 
     * @returns {Object|null}
     */
    addHistoryEvent(id, event) {
        const area = this.get(id);
        if (!area) return null;

        if (!area.history) area.history = [];
        area.history.push({
            id: this._generateId('HIST'),
            timestamp: new Date().toISOString(),
            ...event
        });

        this._save();
        return area;
    }

    /**
     * Calcula estatísticas das áreas
     * @returns {Object}
     */
    getStats() {
        const total = this.areas.length;
        const normal = this.areas.filter(a => 
            a.analysis && a.analysis.status === 'normal'
        ).length;
        const altered = this.areas.filter(a => 
            a.analysis && a.analysis.status === 'alteracao'
        ).length;
        const critical = this.areas.filter(a => 
            a.analysis && a.analysis.severity === 'critica'
        ).length;

        return { total, normal, altered, critical };
    }

    /**
     * Busca áreas por texto
     * @param {string} query 
     * @returns {Array}
     */
    search(query) {
        if (!query || query.length < 2) return [];
        const q = query.toLowerCase();
        return this.areas.filter(a =>
            a.nome.toLowerCase().includes(q) ||
            (a.descricao && a.descricao.toLowerCase().includes(q)) ||
            (a.municipality && a.municipality.toLowerCase().includes(q)) ||
            (a.responsavel && a.responsavel.toLowerCase().includes(q))
        );
    }

    /**
     * Salva no storage
     * @private
     */
    _save() {
        this.storage.saveAreas(this.areas);
    }

    /**
     * Gera ID único
     * @param {string} prefix 
     * @returns {string}
     * @private
     */
    _generateId(prefix = 'AREA') {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}_${timestamp}_${random}`;
    }

    /**
     * Exporta áreas como GeoJSON
     * @returns {Object}
     */
    exportGeoJSON() {
        return {
            type: 'FeatureCollection',
            features: this.areas.map(area => ({
                type: 'Feature',
                properties: {
                    id: area.id,
                    nome: area.nome,
                    categoria: area.categoria,
                    prioridade: area.prioridade,
                    status: area.status,
                    descricao: area.descricao || '',
                    areaHa: area.areaHa || 0,
                    createdAt: area.createdAt,
                    lastAnalysis: area.lastAnalysis,
                    analysis_status: area.analysis?.status || 'normal'
                },
                geometry: area.geojson?.geometry || null
            })).filter(f => f.geometry)
        };
    }
}

// Exportar para uso global
window.AreaService = AreaService;