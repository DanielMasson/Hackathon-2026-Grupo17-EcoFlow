/**
 * REPORT SERVICE
 * Geração de relatórios ambientais
 */

class ReportService {
    constructor() {
        this._initialized = false;
    }

    /**
     * Inicializa o serviço
     */
    init() {
        if (this._initialized) return;
        this._initialized = true;
        console.log('[ReportService] Inicializado');
    }

    /**
     * Gera relatório para uma área
     * @param {Object} area 
     * @param {Object} options 
     * @returns {string}
     */
    generateReport(area, options = {}) {
        const html = this._generateHTML(area, options);
        return html;
    }

    /**
     * Gera relatório para múltiplas áreas
     * @param {Array} areas 
     * @returns {string}
     */
    generate(areas) {
        if (!areas || areas.length === 0) {
            return `
                <div class="analysis-placeholder">
                    Nenhuma área disponível para gerar relatório.
                </div>
            `;
        }

        let html = `
            <div style="font-family:var(--font-main);">
                <h2 style="color:var(--accent-blue);margin-bottom:4px;">
                    🌿 Environmental Intelligence Center
                </h2>
                <div style="color:var(--text-secondary);font-size:14px;margin-bottom:24px;">
                    Relatório de Monitoramento Ambiental
                    <span style="display:block;font-size:12px;color:var(--text-muted);margin-top:4px;">
                        Gerado em ${new Date().toLocaleString()}
                        ${APP_CONFIG.MODE === 'DEMO' ? ' • MODO DEMONSTRAÇÃO' : ''}
                    </span>
                </div>
        `;

        // Resumo
        const total = areas.length;
        const withAlerts = areas.filter(a => a.analysis?.status === 'alteracao').length;
        const critical = areas.filter(a => a.analysis?.severity === 'critica').length;

        html += `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
                <div style="background:var(--bg-tertiary);border-radius:8px;padding:16px;text-align:center;">
                    <div style="font-size:28px;font-weight:700;">${total}</div>
                    <div style="font-size:12px;color:var(--text-secondary);">Total de Áreas</div>
                </div>
                <div style="background:var(--bg-tertiary);border-radius:8px;padding:16px;text-align:center;border:1px solid var(--status-medium);">
                    <div style="font-size:28px;font-weight:700;color:var(--status-medium);">${withAlerts}</div>
                    <div style="font-size:12px;color:var(--text-secondary);">Com Alterações</div>
                </div>
                <div style="background:var(--bg-tertiary);border-radius:8px;padding:16px;text-align:center;border:1px solid var(--status-critical);">
                    <div style="font-size:28px;font-weight:700;color:var(--status-critical);">${critical}</div>
                    <div style="font-size:12px;color:var(--text-secondary);">Críticos</div>
                </div>
            </div>
        `;

        // Lista de áreas
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">`;

        areas.forEach(area => {
            const status = area.analysis?.status || 'normal';
            const severity = area.analysis?.severity || 'normal';
            const severityColor = {
                'critica': 'var(--status-critical)',
                'alta': 'var(--status-high)',
                'media': 'var(--status-medium)',
                'normal': 'var(--status-normal)'
            }[severity] || 'var(--text-secondary)';

            const statusIcon = status === 'normal' ? '✅' : '⚠️';

            html += `
                <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:16px;border-left:4px solid ${severityColor};">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                        <div>
                            <div style="font-weight:600;font-size:16px;">${area.nome}</div>
                            <div style="font-size:12px;color:var(--text-secondary);">
                                ${APP_CONFIG.CATEGORIES.find(c => c.value === area.categoria)?.label || area.categoria}
                                • ${area.areaHa?.toFixed(1) || 0} ha
                            </div>
                        </div>
                        <div style="font-size:24px;">${statusIcon}</div>
                    </div>
                    
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;font-size:13px;">
                        <div>
                            <span style="color:var(--text-muted);">Status:</span>
                            <span style="color:${severityColor};font-weight:500;text-transform:uppercase;">
                                ${status === 'normal' ? 'Normal' : status === 'alteracao' ? 'Alteração' : 'Desconhecido'}
                            </span>
                        </div>
                        <div>
                            <span style="color:var(--text-muted);">Prioridade:</span>
                            <span style="text-transform:capitalize;">${area.prioridade}</span>
                        </div>
                        ${area.analysis?.confidence ? `
                        <div>
                            <span style="color:var(--text-muted);">Confiança:</span>
                            <span>${(area.analysis.confidence * 100).toFixed(0)}%</span>
                        </div>
                        ` : ''}
                        ${area.analysis?.affectedAreaHa ? `
                        <div>
                            <span style="color:var(--text-muted);">Área Afetada:</span>
                            <span>${area.analysis.affectedAreaHa.toFixed(1)} ha</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    ${area.descricao ? `
                    <div style="font-size:12px;color:var(--text-secondary);margin-top:8px;">
                        ${area.descricao}
                    </div>
                    ` : ''}
                    
                    <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">
                        Última análise: ${area.lastAnalysis ? new Date(area.lastAnalysis).toLocaleDateString() : 'Nunca'}
                    </div>
                </div>
            `;
        });

        html += `
            </div>
            <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border-color);font-size:11px;color:var(--text-muted);text-align:center;">
                Relatório gerado automaticamente pelo Environmental Intelligence Center
                ${APP_CONFIG.MODE === 'DEMO' ? '• Dados de demonstração' : ''}
            </div>
            </div>
        `;

        return html;
    }

    /**
     * Gera HTML do relatório
     * @param {Object} area 
     * @param {Object} options 
     * @returns {string}
     * @private
     */
    _generateHTML(area, options) {
        // Implementação detalhada para relatório individual
        // (simplificada para MVP)
        return this.generate([area]);
    }

    /**
     * Exporta relatório como HTML
     * @param {string} html 
     * @returns {string}
     */
    exportHTML(html) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Relatório Ambiental</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; max-width: 1200px; margin: 0 auto; background: #070c09; color: #e6f5ec; }
        @media print { body { background: white; color: black; } }
    </style>
</head>
<body>
    ${html}
</body>
</html>
        `;
    }

    /**
     * Baixa relatório como arquivo HTML
     * @param {string} html 
     * @param {string} filename 
     */
    downloadReport(html, filename = 'relatorio_ambiental.html') {
        const fullHtml = this.exportHTML(html);
        const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Exportar para uso global
window.ReportService = ReportService;