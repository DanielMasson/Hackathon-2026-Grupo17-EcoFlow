/**
 * SATELLITE SERVICE
 * Abstração para integração com Copernicus/Sentinel
 * Atualmente em modo DEMO
 */

class SatelliteService {
    constructor() {
        this._initialized = false;
        this.isConfigured = false;
        this.config = {
            endpoint: null,
            apiKey: null,
            collection: 'SENTINEL-2'
        };
    }

    /**
     * Inicializa o serviço
     */
    init() {
        if (this._initialized) return;
        
        // Carrega configuração do storage
        const settings = this._loadSettings();
        if (settings) {
            this.config = { ...this.config, ...settings };
            this.isConfigured = !!settings.endpoint;
        }

        this._initialized = true;
        console.log('[SatelliteService] Inicializado. Modo:', APP_CONFIG.MODE);
    }

    /**
     * Configura o serviço
     * @param {Object} config 
     */
    configure(config) {
        this.config = { ...this.config, ...config };
        this.isConfigured = true;
        this._saveSettings();
        console.log('[SatelliteService] Configuração atualizada');
    }

    /**
     * Busca imagens disponíveis
     * @param {Object} params 
     * @returns {Promise<Object>}
     */
    async searchImages(params) {
        if (APP_CONFIG.MODE === 'DEMO') {
            return this._demoSearch(params);
        }
        return this._realSearch(params);
    }

    async downloadBands(params) {
        if (APP_CONFIG.MODE === 'DEMO') {
            return { downloaded: {}, isDemo: true };
        }
        const apiBase = APP_CONFIG.API_BASE || 'http://localhost:8000';
        try {
            const response = await fetch(`${apiBase}/api/satellite/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });
            if (!response.ok) {
                const err = await response.text();
                throw new Error(`API erro: ${response.status} - ${err}`);
            }
            return await response.json();
        } catch (e) {
            console.error('[SatelliteService] Erro no download:', e.message);
            throw e;
        }
    }

    async searchAndDownload(params) {
        if (APP_CONFIG.MODE === 'DEMO') {
            return this._demoSearch(params);
        }
        const apiBase = APP_CONFIG.API_BASE || 'http://localhost:8000';
        try {
            const response = await fetch(`${apiBase}/api/satellite/search-and-download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });
            if (!response.ok) {
                const err = await response.text();
                throw new Error(`API erro: ${response.status} - ${err}`);
            }
            return await response.json();
        } catch (e) {
            console.error('[SatelliteService] Erro search-and-download:', e.message);
            throw e;
        }
    }

    /**
     * Busca imagens em modo demonstração
     * @param {Object} params 
     * @returns {Object}
     * @private
     */
    _demoSearch(params) {
        const { aoi, startDate, endDate, cloudCoverage = 20 } = params;

        // Gera datas
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date();
        start.setDate(start.getDate() - 30);

        // Gera imagens simuladas
        const images = [];
        const numImages = 3 + Math.floor(Math.random() * 4);

        for (let i = 0; i < numImages; i++) {
            const date = new Date(start);
            date.setDate(date.getDate() + Math.floor(Math.random() * 30));
            
            if (date > end) continue;

            const cloud = 5 + Math.random() * 30;
            if (cloud > cloudCoverage) continue;

            images.push({
                id: `S2_${date.toISOString().slice(0,10)}_${Math.random().toString(36).substring(2,8)}`,
                satellite: 'Sentinel-2',
                date: date.toISOString(),
                cloudCoverage: Math.round(cloud),
                resolution: 10,
                coverage: 0.85 + Math.random() * 0.14,
                quality: cloud < 15 ? 'EXCELENTE' : cloud < 30 ? 'ADEQUADA' : 'PREJUDICADA',
                bands: ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'],
                thumbnail: null,
                isDemo: true
            });
        }

        // Ordena por data
        images.sort((a, b) => new Date(a.date) - new Date(b.date));

        return {
            images,
            count: images.length,
            totalAvailable: numImages,
            isDemo: true,
            message: images.length === 0 ? 'Nenhuma imagem encontrada com os parâmetros selecionados.' : null
        };
    }

    /**
     * Busca imagens em modo real (placeholder)
     * @param {Object} params 
     * @returns {Promise<Object>}
     * @private
     */
    async _realSearch(params) {
        const apiBase = APP_CONFIG.API_BASE || 'http://localhost:8000';
        try {
            const response = await fetch(`${apiBase}/api/satellite/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                console.warn('[SatelliteService] API retornou erro, usando demo');
                return this._demoSearch(params);
            }

            const result = await response.json();
            result.isDemo = false;
            return result;
        } catch (e) {
            console.warn('[SatelliteService] Falha ao conectar com API:', e.message);
            return this._demoSearch(params);
        }
    }

    /**
     * Obtém metadados de uma imagem
     * @param {string} imageId 
     * @returns {Object}
     */
    getMetadata(imageId) {
        if (APP_CONFIG.MODE === 'DEMO') {
            return {
                id: imageId,
                satellite: 'Sentinel-2',
                resolution: 10,
                bands: ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'],
                processingLevel: 'L2A',
                isDemo: true
            };
        }
        return null;
    }

    /**
     * Calcula índices espectrais
     * @param {Object} data 
     * @param {string} index 
     * @returns {Object}
     */
    calculateIndex(data, index) {
        if (APP_CONFIG.MODE === 'DEMO') {
            return this._demoCalculateIndex(data, index);
        }
        return null;
    }

    /**
     * Calcula índices em modo demonstração
     * @param {Object} data 
     * @param {string} index 
     * @returns {Object}
     * @private
     */
    _demoCalculateIndex(data, index) {
        // Gera dados simulados para o índice
        const width = 100;
        const height = 100;
        const values = [];

        // Cria padrão aleatório com algumas estruturas
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                // Base aleatória com estrutura
                let value = 0.2 + Math.random() * 0.6;
                
                // Adiciona algumas áreas de alteração
                if (x > 60 && x < 80 && y > 40 && y < 60) {
                    value = 0.1 + Math.random() * 0.15; // Área alterada
                }
                if (x > 30 && x < 50 && y > 70 && y < 85) {
                    value = 0.05 + Math.random() * 0.1; // Área queimada
                }
                if (x > 10 && x < 25 && y > 10 && y < 25) {
                    value = 0.7 + Math.random() * 0.2; // Vegetação densa
                }
                
                row.push(Math.round(value * 1000) / 1000);
            }
            values.push(row);
        }

        return {
            index: index,
            values: values,
            width: width,
            height: height,
            min: Math.min(...values.flat()),
            max: Math.max(...values.flat()),
            mean: values.flat().reduce((a, b) => a + b, 0) / (width * height),
            isDemo: true
        };
    }

    /**
     * Carrega configuração do storage
     * @returns {Object|null}
     * @private
     */
    _loadSettings() {
        try {
            const data = localStorage.getItem(APP_CONFIG.STORAGE.PREFIX + 'satellite_config');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Salva configuração no storage
     * @private
     */
    _saveSettings() {
        try {
            localStorage.setItem(
                APP_CONFIG.STORAGE.PREFIX + 'satellite_config',
                JSON.stringify(this.config)
            );
        } catch (e) {
            console.error('[SatelliteService] Erro ao salvar configuração:', e);
        }
    }

    /**
     * Verifica status da integração
     * @returns {Object}
     */
    getStatus() {
        return {
            configured: this.isConfigured,
            mode: APP_CONFIG.MODE,
            endpoint: this.config.endpoint || 'Não configurado',
            collection: this.config.collection || 'SENTINEL-2',
            ready: this.isConfigured && APP_CONFIG.MODE === 'REAL'
        };
    }
}

// Exportar para uso global
window.SatelliteService = SatelliteService;