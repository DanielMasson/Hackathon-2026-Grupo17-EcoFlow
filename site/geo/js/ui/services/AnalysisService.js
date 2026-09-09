/**
 * ANALYSIS SERVICE
 * Motor de análise de alterações ambientais
 */

class AnalysisService {
    constructor() {
        this.areaService = null;
        this.alertService = null;
        this.auditService = null;
        this._initialized = false;
        this.analysisInProgress = false;
    }

    /**
     * Inicializa o serviço
     */
    init() {
        if (this._initialized) return;
        this.areaService = window.app?.areaService;
        this.alertService = window.app?.alertService;
        this.auditService = window.app?.auditService;
        this._initialized = true;
        console.log('[AnalysisService] Inicializado');
    }

    /**
     * Analisa uma área
     * @param {Object} area 
     * @param {Object} options 
     * @returns {Promise<Object>}
     */
    async analyze(area, options = {}) {
        if (this.analysisInProgress) {
            throw new Error('Uma análise já está em andamento');
        }

        if (!area) {
            throw new Error('Área não fornecida');
        }

        this.analysisInProgress = true;

        try {
            // Simula processo de análise com etapas
            const steps = this._getAnalysisSteps();
            
            for (const step of steps) {
                await this._simulateStep(step);
            }

            // Executa análise real
            const result = await this._performAnalysis(area, options);

            // Atualiza área
            if (this.areaService) {
                this.areaService.updateAnalysis(area.id, result);
            }

            // Gera alerta se necessário
            if (result.status !== 'normal') {
                if (this.alertService) {
                    const alert = await this.alertService.createFromAnalysis(area, result);
                    result.alertId = alert.id;
                }
            }

            // Registra no histórico
            if (this.auditService) {
                this.auditService.log({
                    action: 'Análise concluída',
                    details: `Área "${area.nome}" - ${result.type_label}`,
                    areaId: area.id,
                    analysisResult: result
                });
            }
            // NOVO: Atualiza imagens após análise
        if (window.app?.imageService) {
            window.app.imageService.updateAfterAnalysis(area.id, result);
        }

            return result;

        } catch (error) {
            console.error('[AnalysisService] Erro na análise:', error);
            throw error;
        } finally {
            this.analysisInProgress = false;
        }
    }

    /**
     * Retorna etapas da análise
     * @returns {Array}
     * @private
     */
    _getAnalysisSteps() {
        return [
            { id: 1, label: 'LOCALIZANDO AOI', icon: '🔍' },
            { id: 2, label: 'CONSULTANDO IMAGENS', icon: '🛰️' },
            { id: 3, label: 'VALIDANDO QUALIDADE', icon: '✅' },
            { id: 4, label: 'SELECIONANDO IMAGEM ANTERIOR', icon: '📅' },
            { id: 5, label: 'SELECIONANDO IMAGEM ATUAL', icon: '📅' },
            { id: 6, label: 'PROCESSANDO AOI', icon: '⚙️' },
            { id: 7, label: 'CALCULANDO ÍNDICES', icon: '📊' },
            { id: 8, label: 'COMPARANDO PERÍODOS', icon: '🔄' },
            { id: 9, label: 'DETECTANDO ALTERAÇÕES', icon: '⚠️' },
            { id: 10, label: 'CLASSIFICANDO RESULTADO', icon: '🏷️' },
            { id: 11, label: 'GERANDO ALERTA', icon: '🔔' }
        ];
    }

    /**
     * Simula uma etapa da análise
     * @param {Object} step 
     * @returns {Promise}
     * @private
     */
    _simulateStep(step) {
        return new Promise(resolve => {
            const delay = 300 + Math.random() * 600;
            setTimeout(resolve, delay);
        });
    }

    /**
     * Executa a análise propriamente dita
     * @param {Object} area 
     * @param {Object} options 
     * @returns {Object}
     * @private
     */
    _performAnalysis(area, options) {
        if (APP_CONFIG.MODE === 'DEMO') {
            return this._demoAnalysis(area);
        }
        return this._realAnalysis(area, options);
    }

    /**
     * Análise de demonstração
     * @param {Object} area 
     * @returns {Object}
     * @private
     */
    _demoAnalysis(area) {
        // Usa o status atual da área ou gera aleatório
        const currentStatus = area.analysis?.status || 'normal';
        
        // Se já tem análise, pode manter ou forçar nova
        const shouldChange = Math.random() > 0.6;
        
        let result;
        
        if (currentStatus === 'normal' && shouldChange) {
            // Pode gerar alteração
            result = this._generateRandomChange();
        } else if (currentStatus === 'alteracao' && shouldChange) {
            // Pode manter ou mudar
            result = this._generateRandomChange();
        } else {
            // Mantém normal ou usa o existente
            result = {
                status: currentStatus,
                type: area.analysis?.type || 'normal',
                type_label: this._getTypeLabel(area.analysis?.type || 'normal'),
                severity: area.analysis?.severity || 'normal',
                confidence: area.analysis?.confidence || 0.95,
                affectedAreaHa: area.analysis?.affectedAreaHa || 0,
                affectedPercentage: area.analysis?.affectedPercentage || 0,
                previousDate: area.analysis?.previousDate || this._getDateDaysAgo(10),
                currentDate: area.analysis?.currentDate || this._getDateDaysAgo(1),
                indices: {
                    ndviBefore: 0.75,
                    ndviAfter: 0.74,
                    ndviChange: -0.01,
                    nbrBefore: 0.65,
                    nbrAfter: 0.64,
                    nbrChange: -0.01
                },
                isDemo: true
            };
        }

        return result;
    }

    /**
     * Gera uma alteração aleatória para demonstração
     * @returns {Object}
     * @private
     */
    _generateRandomChange() {
        const types = [
            { type: 'possivel_desmatamento', severity: 'alta', minArea: 5, maxArea: 30 },
            { type: 'possivel_queimada', severity: 'alta', minArea: 8, maxArea: 40 },
            { type: 'alteracao_vegetacao', severity: 'media', minArea: 2, maxArea: 15 },
            { type: 'solo_exposto', severity: 'media', minArea: 1, maxArea: 10 },
            { type: 'normal', severity: 'normal', minArea: 0, maxArea: 0 }
        ];

        const selected = types[Math.floor(Math.random() * types.length)];
        const areaHa = selected.minArea + Math.random() * (selected.maxArea - selected.minArea);
        
        const confidence = 0.75 + Math.random() * 0.2;
        const ndviChange = -(0.1 + Math.random() * 0.3);

        return {
            status: selected.type === 'normal' ? 'normal' : 'alteracao',
            type: selected.type,
            type_label: this._getTypeLabel(selected.type),
            severity: selected.severity,
            confidence: Math.min(confidence, 0.98),
            affectedAreaHa: areaHa,
            affectedPercentage: areaHa / (1000 + Math.random() * 2000) * 100,
            previousDate: this._getDateDaysAgo(10 + Math.floor(Math.random() * 10)),
            currentDate: this._getDateDaysAgo(1 + Math.floor(Math.random() * 5)),
            indices: {
                ndviBefore: 0.6 + Math.random() * 0.3,
                ndviAfter: Math.max(0.1, 0.6 + Math.random() * 0.3 + ndviChange),
                ndviChange: ndviChange,
                nbrBefore: 0.5 + Math.random() * 0.3,
                nbrAfter: Math.max(0.05, 0.5 + Math.random() * 0.3 + ndviChange * 0.8),
                nbrChange: ndviChange * 0.8
            },
            isDemo: true
        };
    }

    /**
     * Análise real (preparada para integração futura)
     * @param {Object} area 
     * @param {Object} options 
     * @returns {Object}
     * @private
     */
    async _realAnalysis(area, options) {
        const apiBase = APP_CONFIG.API_BASE || 'http://localhost:8000';
        const response = await fetch(`${apiBase}/api/analysis/${area.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                limiar: options.limiar || APP_CONFIG.ANALYSIS.NDVI_THRESHOLD || 0.15,
                area_minima_pixels: options.area_minima_pixels || 20,
                modo: options.modo || 'bandas'
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Erro na API: ${response.status} - ${err}`);
        }

        const result = await response.json();
        result.isDemo = false;
        return result;
    }

    /**
     * Retorna label do tipo
     * @param {string} type 
     * @returns {string}
     * @private
     */
    _getTypeLabel(type) {
        const labels = {
            'normal': 'Normal',
            'possivel_desmatamento': 'Possível Desmatamento',
            'possivel_queimada': 'Possível Queimada',
            'alteracao_vegetacao': 'Alteração de Vegetação',
            'solo_exposto': 'Solo Exposto',
            'agua': 'Água',
            'alteracao_urbana': 'Alteração Urbana',
            'inconclusivo': 'Inconclusivo'
        };
        return labels[type] || 'Desconhecido';
    }

    /**
     * Retorna data de N dias atrás
     * @param {number} days 
     * @returns {string}
     * @private
     */
    _getDateDaysAgo(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString();
    }

    /**
     * Renderiza o resultado da análise
     * @param {HTMLElement} container 
     * @param {Object} result 
     * @param {Object} area 
     */
    renderResult(container, result, area) {
        if (!container) return;

        const isAlteration = result.status === 'alteracao';
        const severityColor = {
            'critica': 'var(--status-critical)',
            'alta': 'var(--status-high)',
            'media': 'var(--status-medium)',
            'normal': 'var(--status-normal)'
        }[result.severity] || 'var(--text-secondary)';

        let html = `
            <div style="display:flex;flex-direction:column;gap:16px;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="font-size:32px;">${isAlteration ? '⚠️' : '✅'}</div>
                    <div>
                        <h3 style="margin:0;color:${severityColor};">
                            ${isAlteration ? 'ALTERAÇÃO DETECTADA' : 'ÁREA NORMAL'}
                        </h3>
                        <div style="color:var(--text-secondary);font-size:14px;">
                            ${result.type_label}
                            ${result.isDemo ? ' <span style="font-size:11px;color:var(--accent-yellow);">(DEMONSTRAÇÃO)</span>' : ''}
                        </div>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;">
                    <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;">
                        <div style="font-size:11px;color:var(--text-muted);">Confiança</div>
                        <div style="font-size:20px;font-weight:600;color:${severityColor};">
                            ${(result.confidence * 100).toFixed(0)}%
                        </div>
                    </div>
                    ${isAlteration ? `
                    <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;">
                        <div style="font-size:11px;color:var(--text-muted);">Área Afetada</div>
                        <div style="font-size:20px;font-weight:600;">
                            ${result.affectedAreaHa.toFixed(1)} ha
                        </div>
                    </div>
                    <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;">
                        <div style="font-size:11px;color:var(--text-muted);">Percentual</div>
                        <div style="font-size:20px;font-weight:600;">
                            ${result.affectedPercentage.toFixed(2)}%
                        </div>
                    </div>
                    ` : ''}
                    <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;">
                        <div style="font-size:11px;color:var(--text-muted);">Severidade</div>
                        <div style="font-size:20px;font-weight:600;text-transform:uppercase;color:${severityColor};">
                            ${result.severity}
                        </div>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--bg-tertiary);border-radius:8px;padding:16px;">
                    <div>
                        <div style="font-size:11px;color:var(--text-muted);">Imagem Anterior</div>
                        <div style="font-weight:500;">${result.previousDate ? new Date(result.previousDate).toLocaleDateString() : '--'}</div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:var(--text-muted);">Imagem Atual</div>
                        <div style="font-weight:500;">${result.currentDate ? new Date(result.currentDate).toLocaleDateString() : '--'}</div>
                    </div>
                </div>

                ${isAlteration ? `
                <div style="background:rgba(255,215,0,0.05);border:1px solid rgba(255,215,0,0.2);border-radius:8px;padding:12px;">
                    <div style="font-size:13px;color:var(--text-secondary);">
                        <strong>⚠️ Importante:</strong> Esta é uma análise automatizada baseada em dados ${result.isDemo ? 'demonstrativos' : 'satelitais'}.
                        Recomenda-se validação humana e verificação em campo para confirmação.
                    </div>
                </div>
                ` : ''}

                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="window.app?.switchView('alerts')" 
                            class="btn-primary" style="font-size:13px;">
                        📋 Ver Alertas
                    </button>
                    <button onclick="window.app?.switchView('history')" 
                            class="btn-secondary" style="font-size:13px;">
                        📜 Ver Histórico
                    </button>
                    ${isAlteration ? `
                    <button onclick="window.app?._generateReport()" 
                            class="btn-secondary" style="font-size:13px;">
                        📄 Gerar Relatório
                    </button>
                    ` : ''}
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * Calcula NDVI (Normalized Difference Vegetation Index)
     * @param {number} nir 
     * @param {number} red 
     * @returns {number}
     */
    calculateNDVI(nir, red) {
        const denominator = nir + red;
        if (denominator === 0) return 0;
        return (nir - red) / denominator;
    }

    /**
     * Calcula NBR (Normalized Burn Ratio)
     * @param {number} nir 
     * @param {number} swir 
     * @returns {number}
     */
    calculateNBR(nir, swir) {
        const denominator = nir + swir;
        if (denominator === 0) return 0;
        return (nir - swir) / denominator;
    }

    /**
     * Calcula dNBR (delta NBR)
     * @param {number} nbrBefore 
     * @param {number} nbrAfter 
     * @returns {number}
     */
    calculateDNBR(nbrBefore, nbrAfter) {
        return nbrBefore - nbrAfter;
    }

    /**
     * Classifica a alteração baseada nos índices
     * @param {Object} indices 
     * @param {Object} thresholds 
     * @returns {Object}
     */
    classifyChange(indices, thresholds = {}) {
        const defaultThresholds = {
            ndviChange: 0.15,
            nbrChange: 0.1,
            minConfidence: 0.6
        };

        const t = { ...defaultThresholds, ...thresholds };
        const ndviChange = Math.abs(indices.ndviChange || 0);
        const nbrChange = Math.abs(indices.nbrChange || 0);

        // Se a mudança for pequena, retorna normal
        if (ndviChange < t.ndviChange && nbrChange < t.nbrChange) {
            return {
                type: 'normal',
                label: 'Normal',
                severity: 'normal',
                confidence: 0.9 + Math.random() * 0.08
            };
        }

        // Detecta tipo de alteração
        let type, label, severity, confidence;

        if (ndviChange > t.ndviChange * 1.5 && nbrChange > t.nbrChange * 1.5) {
            // Queimada - mudança em ambos os índices
            type = 'possivel_queimada';
            label = 'Possível Queimada';
            severity = 'alta';
            confidence = 0.75 + Math.random() * 0.15;
        } else if (ndviChange > t.ndviChange * 1.5) {
            // Desmatamento - principalmente NDVI
            type = 'possivel_desmatamento';
            label = 'Possível Desmatamento';
            severity = 'alta';
            confidence = 0.7 + Math.random() * 0.2;
        } else if (ndviChange > t.ndviChange) {
            // Alteração vegetal moderada
            type = 'alteracao_vegetacao';
            label = 'Alteração de Vegetação';
            severity = 'media';
            confidence = 0.65 + Math.random() * 0.2;
        } else {
            // Inconclusivo
            type = 'inconclusivo';
            label = 'Inconclusivo';
            severity = 'normal';
            confidence = 0.3 + Math.random() * 0.3;
        }

        // Ajusta confiança baseada na magnitude
        const magnitude = Math.max(ndviChange, nbrChange) / Math.max(t.ndviChange, t.nbrChange);
        confidence = Math.min(0.95, confidence * (0.7 + 0.3 * Math.min(magnitude, 1.5)));

        return {
            type,
            label,
            severity,
            confidence: Math.round(confidence * 100) / 100
        };
    }
}

// Exportar para uso global
window.AnalysisService = AnalysisService;