/**
 * AUDIT SERVICE
 * Registro de auditoria e rastreabilidade
 */

class AuditService {
    constructor() {
        this.storage = storageService;
        this._initialized = false;
        this.logs = [];
    }

    /**
     * Inicializa o serviço
     */
    init() {
        if (this._initialized) return;
        this.logs = this._loadLogs();
        this._initialized = true;
        console.log('[AuditService] Inicializado com ' + this.logs.length + ' registros');
    }

    /**
     * Registra uma ação
     * @param {Object} entry 
     * @returns {Object}
     */
    log(entry) {
        const logEntry = {
            id: this._generateId(),
            timestamp: new Date().toISOString(),
            user: entry.user || 'Sistema',
            action: entry.action || 'Ação não especificada',
            details: entry.details || '',
            areaId: entry.areaId || null,
            category: entry.category || 'geral',
            metadata: entry.metadata || {},
            analysisResult: entry.analysisResult || null
        };

        this.logs.unshift(logEntry);
        this._saveLogs();

        // Também adiciona ao histórico da área se houver áreaId
        if (logEntry.areaId && window.app?.areaService) {
            const area = window.app.areaService.get(logEntry.areaId);
            if (area) {
                if (!area.history) area.history = [];
                area.history.push({
                    action: logEntry.action,
                    details: logEntry.details,
                    timestamp: logEntry.timestamp,
                    user: logEntry.user
                });
                window.app.areaService.update(logEntry.areaId, { history: area.history });
            }
        }

        return logEntry;
    }

    /**
     * Obtém todos os logs
     * @param {Object} filters 
     * @returns {Array}
     */
    getLogs(filters = {}) {
        let result = [...this.logs];

        if (filters.areaId) {
            result = result.filter(l => l.areaId === filters.areaId);
        }
        if (filters.user) {
            result = result.filter(l => l.user === filters.user);
        }
        if (filters.action) {
            result = result.filter(l => l.action.includes(filters.action));
        }
        if (filters.category) {
            result = result.filter(l => l.category === filters.category);
        }
        if (filters.startDate) {
            result = result.filter(l => l.timestamp >= filters.startDate);
        }
        if (filters.endDate) {
            result = result.filter(l => l.timestamp <= filters.endDate);
        }

        return result;
    }

    /**
     * Obtém logs de uma área específica
     * @param {string|number} areaId 
     * @returns {Array}
     */
    getLogsByArea(areaId) {
        return this.getLogs({ areaId });
    }

    /**
     * Obtém logs recentes
     * @param {number} limit 
     * @returns {Array}
     */
    getRecent(limit = 20) {
        return this.logs.slice(0, limit);
    }

    /**
     * Obtém estatísticas de auditoria
     * @returns {Object}
     */
    getStats() {
        const total = this.logs.length;
        const byAction = {};
        const byUser = {};

        this.logs.forEach(log => {
            byAction[log.action] = (byAction[log.action] || 0) + 1;
            byUser[log.user] = (byUser[log.user] || 0) + 1;
        });

        return {
            total,
            byAction,
            byUser,
            lastLog: this.logs.length > 0 ? this.logs[0] : null
        };
    }

    /**
     * Carrega logs do storage
     * @returns {Array}
     * @private
     */
    _loadLogs() {
        try {
            const data = localStorage.getItem(APP_CONFIG.STORAGE.PREFIX + 'audit_logs');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('[AuditService] Erro ao carregar logs:', e);
            return [];
        }
    }

    /**
     * Salva logs no storage
     * @private
     */
    _saveLogs() {
        try {
            localStorage.setItem(
                APP_CONFIG.STORAGE.PREFIX + 'audit_logs',
                JSON.stringify(this.logs.slice(0, 1000)) // Limita a 1000 registros
            );
        } catch (e) {
            console.error('[AuditService] Erro ao salvar logs:', e);
        }
    }

    /**
     * Gera ID único
     * @param {string} prefix 
     * @returns {string}
     * @private
     */
    _generateId(prefix = 'AUDIT') {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}_${timestamp}_${random}`;
    }

    /**
     * Limpa logs antigos
     * @param {number} daysToKeep 
     */
    cleanup(daysToKeep = 90) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysToKeep);
        
        this.logs = this.logs.filter(l => new Date(l.timestamp) > cutoff);
        this._saveLogs();
        
        console.log(`[AuditService] Logs limpos. Mantidos ${this.logs.length} registros.`);
    }
}

// Exportar para uso global
window.AuditService = AuditService;