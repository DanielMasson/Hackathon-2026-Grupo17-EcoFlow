/**
 * ALERT SERVICE
 * Gerencia alertas ambientais
 */

class AlertService {
    constructor() {
        this.alerts = [];
        this.storage = storageService;
        this._initialized = false;
    }

    /**
     * Inicializa o serviço
     */
    init() {
        if (this._initialized) return;
        this.alerts = this.storage.getAlerts();
        this._initialized = true;
        console.log('[AlertService] Inicializado com ' + this.alerts.length + ' alertas');
    }

    /**
     * Define a lista de alertas
     * @param {Array} alerts 
     */
    setAlerts(alerts) {
        this.alerts = alerts || [];
    }

    /**
     * Obtém todos os alertas
     * @param {Object} filters 
     * @returns {Array}
     */
    getAll(filters = {}) {
        let result = [...this.alerts];

        if (filters.severity) {
            result = result.filter(a => a.severity === filters.severity);
        }
        if (filters.status) {
            result = result.filter(a => a.status === filters.status);
        }
        if (filters.areaId) {
            result = result.filter(a => a.areaId === filters.areaId);
        }
        if (filters.type) {
            result = result.filter(a => a.type === filters.type);
        }

        return result;
    }

    /**
     * Obtém alerta por ID
     * @param {string|number} id 
     * @returns {Object|null}
     */
    get(id) {
        return this.alerts.find(a => a.id === id) || null;
    }

    /**
     * Obtém alertas ativos (não resolvidos)
     * @returns {Array}
     */
    getActive() {
        return this.alerts.filter(a => 
            a.status === 'Detectado' || a.status === 'Em análise'
        );
    }

    /**
     * Obtém alertas críticos ativos
     * @returns {Array}
     */
    getCritical() {
        return this.alerts.filter(a => 
            a.severity === 'critica' && 
            (a.status === 'Detectado' || a.status === 'Em análise')
        );
    }

    /**
     * Cria um novo alerta a partir de uma análise
     * @param {Object} area 
     * @param {Object} analysis 
     * @returns {Object}
     */
    createFromAnalysis(area, analysis) {
        const severityMap = {
            'critica': 'critica',
            'alta': 'alta',
            'media': 'media',
            'normal': 'normal'
        };

        const alert = {
            id: this._generateId(),
            areaId: area.id,
            areaName: area.nome,
            type: analysis.type,
            severity: severityMap[analysis.severity] || 'media',
            status: 'Detectado',
            confidence: analysis.confidence,
            affectedAreaHa: analysis.affectedAreaHa || 0,
            description: this._generateDescription(analysis),
            date: analysis.currentDate || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            resolvedAt: null,
            history: [
                {
                    status: 'Detectado',
                    timestamp: new Date().toISOString(),
                    user: 'Sistema'
                }
            ]
        };

        this.alerts.unshift(alert);
        this._save();

        // Notifica
        this._notify(alert);

        return alert;
    }

    /**
     * Cria alerta manual
     * @param {Object} data 
     * @returns {Object}
     */
    create(data) {
        const alert = {
            id: this._generateId(),
            areaId: data.areaId || null,
            areaName: data.areaName || 'Área não especificada',
            type: data.type || 'inconclusivo',
            severity: data.severity || 'media',
            status: data.status || 'Detectado',
            confidence: data.confidence || 0.5,
            affectedAreaHa: data.affectedAreaHa || 0,
            description: data.description || 'Alerta manual',
            date: data.date || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            resolvedAt: null,
            history: [
                {
                    status: data.status || 'Detectado',
                    timestamp: new Date().toISOString(),
                    user: data.user || 'Sistema'
                }
            ]
        };

        this.alerts.unshift(alert);
        this._save();

        this._notify(alert);
        return alert;
    }

    /**
     * Atualiza o status de um alerta
     * @param {string|number} id 
     * @param {string} status 
     * @param {string} user 
     * @returns {Object|null}
     */
    updateStatus(id, status, user = 'Operador') {
        const alert = this.get(id);
        if (!alert) return null;

        const validStatuses = ['Detectado', 'Em análise', 'Confirmado', 'Falso positivo', 'Encerrado'];
        if (!validStatuses.includes(status)) {
            throw new Error('Status inválido');
        }

        alert.status = status;
        alert.updatedAt = new Date().toISOString();

        if (status === 'Encerrado' || status === 'Confirmado' || status === 'Falso positivo') {
            alert.resolvedAt = new Date().toISOString();
        }

        alert.history.push({
            status: status,
            timestamp: new Date().toISOString(),
            user: user
        });

        this._save();
        return alert;
    }

    /**
     * Remove um alerta
     * @param {string|number} id 
     * @returns {boolean}
     */
    delete(id) {
        const index = this.alerts.findIndex(a => a.id === id);
        if (index === -1) return false;

        this.alerts.splice(index, 1);
        this._save();
        return true;
    }

    /**
     * Gera descrição baseada no tipo de análise
     * @param {Object} analysis 
     * @returns {string}
     * @private
     */
    _generateDescription(analysis) {
        const descriptions = {
            'possivel_desmatamento': 'Detectada redução significativa no NDVI, indicando possível desmatamento na região.',
            'possivel_queimada': 'Alteração espectral compatível com área queimada recente.',
            'alteracao_vegetacao': 'Possível alteração na vegetação, necessita de verificação adicional.',
            'solo_exposto': 'Indícios de exposição do solo, possivelmente por desmatamento ou degradação.',
            'alteracao_urbana': 'Possível expansão urbana detectada na área.',
            'inconclusivo': 'Dados insuficientes para classificação conclusiva.'
        };

        return descriptions[analysis.type] || 'Alteração detectada na área monitorada.';
    }

    /**
     * Notifica sobre novo alerta
     * @param {Object} alert 
     * @private
     */
    _notify(alert) {
        const severityEmojis = {
            'critica': '🔴',
            'alta': '🟠',
            'media': '🟡',
            'normal': '🟢'
        };

        const title = `${severityEmojis[alert.severity] || '⚠️'} Novo Alerta: ${alert.areaName}`;
        const body = `${alert.description} (Confiança: ${(alert.confidence * 100).toFixed(0)}%)`;

        // Mostra notificação na UI
        if (window.app?._showNotification) {
            window.app._showNotification(title, body, alert.severity);
        }

        // Atualiza badge
        const badge = document.getElementById('alertCount');
        if (badge) {
            const active = this.getActive();
            badge.textContent = active.length;
        }
    }

    /**
     * Obtém estatísticas dos alertas
     * @returns {Object}
     */
    getStats() {
        const total = this.alerts.length;
        const active = this.getActive();
        const critical = this.getCritical();
        
        const byStatus = {
            detected: this.alerts.filter(a => a.status === 'Detectado').length,
            analyzing: this.alerts.filter(a => a.status === 'Em análise').length,
            confirmed: this.alerts.filter(a => a.status === 'Confirmado').length,
            falsePositive: this.alerts.filter(a => a.status === 'Falso positivo').length,
            closed: this.alerts.filter(a => a.status === 'Encerrado').length
        };

        const bySeverity = {
            critica: this.alerts.filter(a => a.severity === 'critica').length,
            alta: this.alerts.filter(a => a.severity === 'alta').length,
            media: this.alerts.filter(a => a.severity === 'media').length,
            normal: this.alerts.filter(a => a.severity === 'normal').length
        };

        return { total, active: active.length, critical: critical.length, byStatus, bySeverity };
    }

    /**
     * Salva no storage
     * @private
     */
    _save() {
        this.storage.saveAlerts(this.alerts);
    }

    /**
     * Gera ID único
     * @param {string} prefix 
     * @returns {string}
     * @private
     */
    _generateId(prefix = 'ALT') {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}_${timestamp}_${random}`;
    }
}

// Exportar para uso global
window.AlertService = AlertService;