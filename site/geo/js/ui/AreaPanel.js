/**
 * AREA PANEL UI
 * Gerencia a visualização e interação com áreas monitoradas
 */

class AreaPanel {
    constructor() {
        this._initialized = false;
        this.currentFilter = 'all';
    }

    /**
     * Inicializa o painel
     */
    init() {
        if (this._initialized) return;
        this._initialized = true;
        this._bindEvents();
        console.log('[AreaPanel] Inicializado');
    }

    /**
     * Renderiza lista de áreas
     * @param {Array} areas 
     */
    render(areas) {
        const container = document.getElementById('areasGrid');
        if (!container) return;

        if (!areas || areas.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-secondary);">
                    <div style="font-size:48px;margin-bottom:16px;">📍</div>
                    <h3 style="color:var(--text-primary);margin-bottom:8px;">Nenhuma Área Monitorada</h3>
                    <p style="font-size:14px;margin-bottom:16px;">Crie sua primeira área de interesse para iniciar o monitoramento.</p>
                    <button class="btn-primary" onclick="document.getElementById('newAreaBtn')?.click()">
                        + Nova Área
                    </button>
                </div>
            `;
            return;
        }

        let html = '';
        areas.forEach(area => {
            html += this._createAreaCard(area);
        });

        container.innerHTML = html;
        this._bindCardEvents();
    }

    /**
     * Cria card de área
     * @param {Object} area 
     * @returns {string}
     * @private
     */
    _createAreaCard(area) {
        const status = area.analysis?.status || 'normal';
        const severity = area.analysis?.severity || 'normal';
        
        const statusLabels = {
            'normal': 'NORMAL',
            'alteracao': 'ALTERAÇÃO'
        };

        const statusClasses = {
            'normal': 'normal',
            'alteracao': severity === 'critica' ? 'critical' : severity === 'alta' ? 'alert' : 'attention'
        };

        const priorityLabels = {
            'baixa': 'Baixa',
            'media': 'Média',
            'alta': 'Alta',
            'critica': 'Crítica'
        };

        const category = APP_CONFIG.CATEGORIES.find(c => c.value === area.categoria);
        const categoryLabel = category ? category.label : area.categoria;

        const areaHa = area.areaHa || 0;
        const lastAnalysis = area.lastAnalysis ? new Date(area.lastAnalysis).toLocaleDateString('pt-BR') : 'Nunca';

        return `
            <div class="area-card" data-area-id="${area.id}">
                <div class="area-header">
                    <div>
                        <div class="area-name">${area.nome}</div>
                        <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">
                            <span class="area-priority ${area.prioridade}">${priorityLabels[area.prioridade] || area.prioridade}</span>
                            <span style="font-size:11px;color:var(--text-muted);">${categoryLabel}</span>
                        </div>
                    </div>
                    <div>
                        <span class="area-status ${statusClasses[status] || 'normal'}">
                            ${statusLabels[status] || status.toUpperCase()}
                        </span>
                    </div>
                </div>
                
                <div class="area-details">
                    <span>📏 ${areaHa.toFixed(1)} ha</span>
                    <span>📅 ${lastAnalysis}</span>
                    <span>👤 ${area.responsavel || '--'}</span>
                    ${area.analysis?.confidence ? `<span>🎯 ${(area.analysis.confidence * 100).toFixed(0)}%</span>` : ''}
                </div>
                
                ${area.descricao ? `
                <div class="area-description" style="font-size:12px;color:var(--text-secondary);margin-top:8px;padding:8px 0;border-top:1px solid var(--border-color);">
                    ${area.descricao}
                </div>
                ` : ''}
                
                <div class="area-actions">
                    <button class="analyze-btn" data-action="analyze" data-id="${area.id}">
                        🔍 Analisar
                    </button>
                <button data-action="compare" data-id="${area.id}" style="border-color:var(--accent-blue);color:var(--accent-blue);">
                    📸 Comparar
                </button>
                    <button data-action="view" data-id="${area.id}">
                        👁️ Ver
                    </button>
                    <button data-action="edit" data-id="${area.id}">
                        ✏️ Editar
                    </button>
                    <button data-action="delete" data-id="${area.id}" style="color:var(--status-critical);">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Vincula eventos dos cards
     * @private
     */
    _bindCardEvents() {
        document.querySelectorAll('.area-card .area-actions button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                this._handleAction(action, id);
            });
        });

        // Clique no card para visualizar
        document.querySelectorAll('.area-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.areaId;
                this._handleAction('view', id);
            });
        });
    }

    /**
     * Manipula ações dos cards
     * @param {string} action 
     * @param {string} id 
     * @private
     */
    _handleAction(action, id) {
        const area = window.app?.areaService?.get(id);
        if (!area) {
            window.app?._showNotification('⚠️ Erro', 'Área não encontrada.', 'critical');
            return;
        }

        switch(action) {
            case 'analyze':
                // Vai para análise e seleciona a área
                window.app?.switchView('analysis');
                const select = document.getElementById('analysisAreaSelect');
                if (select) {
                    select.value = id;
                    document.getElementById('runAnalysisBtn')?.click();
                }
                break;

             case 'compare':
                // NOVO: Abre comparador
                window.app?.imageComparator?.open(id);
                break;

            case 'view':
                // Mostra detalhes da área
                this._showAreaDetails(area);
                break;

            case 'edit':
                // Abre edição da área
                window.app?._showNotification(
                    '✏️ Editar Área',
                    `Editando "${area.nome}". (Funcionalidade em desenvolvimento)`,
                    'info'
                );
                break;

            case 'delete':
                this._deleteArea(id);
                break;

            default:
                break;
        }
    }

    /**
     * Mostra detalhes da área
     * @param {Object} area 
     * @private
     */
    _showAreaDetails(area) {
        const status = area.analysis?.status || 'normal';
        const severity = area.analysis?.severity || 'normal';
        const severityColor = {
            'critica': 'var(--status-critical)',
            'alta': 'var(--status-high)',
            'media': 'var(--status-medium)',
            'normal': 'var(--status-normal)'
        }[severity] || 'var(--text-secondary)';

        const category = APP_CONFIG.CATEGORIES.find(c => c.value === area.categoria);
        const categoryLabel = category ? category.label : area.categoria;

        const html = `
            <div style="display:flex;flex-direction:column;gap:16px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                        <h3 style="margin:0;font-size:20px;">${area.nome}</h3>
                        <div style="color:var(--text-secondary);font-size:14px;margin-top:4px;">
                            ${categoryLabel} • ${area.areaHa?.toFixed(1) || 0} ha
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:12px;font-weight:600;color:${severityColor};text-transform:uppercase;">
                            ${status === 'normal' ? '✅ NORMAL' : '⚠️ ALTERAÇÃO'}
                        </div>
                        <div style="font-size:11px;color:var(--text-muted);">
                            Prioridade: ${area.prioridade.toUpperCase()}
                        </div>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--bg-tertiary);border-radius:8px;padding:16px;">
                    <div>
                        <div style="font-size:11px;color:var(--text-muted);">Responsável</div>
                        <div style="font-weight:500;">${area.responsavel || '--'}</div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:var(--text-muted);">Status</div>
                        <div style="font-weight:500;">${area.status.toUpperCase()}</div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:var(--text-muted);">Frequência</div>
                        <div style="font-weight:500;">${APP_CONFIG.FREQUENCIES.find(f => f.value === area.frequency)?.label || area.frequency || 'Manual'}</div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:var(--text-muted);">Última Análise</div>
                        <div style="font-weight:500;">${area.lastAnalysis ? new Date(area.lastAnalysis).toLocaleString('pt-BR') : 'Nunca'}</div>
                    </div>
                </div>

                ${area.descricao ? `
                <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;">
                    <div style="font-size:12px;color:var(--text-muted);">Descrição</div>
                    <div style="margin-top:4px;">${area.descricao}</div>
                </div>
                ` : ''}

                ${area.analysis?.confidence ? `
                <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;">
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;">
                        <div>
                            <div style="font-size:11px;color:var(--text-muted);">Confiança</div>
                            <div style="font-weight:600;color:${severityColor};">${(area.analysis.confidence * 100).toFixed(0)}%</div>
                        </div>
                        ${area.analysis?.affectedAreaHa ? `
                        <div>
                            <div style="font-size:11px;color:var(--text-muted);">Área Afetada</div>
                            <div style="font-weight:600;">${area.analysis.affectedAreaHa.toFixed(1)} ha</div>
                        </div>
                        <div>
                            <div style="font-size:11px;color:var(--text-muted);">Percentual</div>
                            <div style="font-weight:600;">${area.analysis.affectedPercentage?.toFixed(2) || 0}%</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}

                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="window.app?.switchView('analysis');document.getElementById('analysisAreaSelect').value='${area.id}';document.getElementById('runAnalysisBtn')?.click();" 
                            class="btn-primary" style="font-size:13px;">
                        🔍 Analisar
                    </button>
                    <button onclick="window.app?.mapService?.focusArea(window.app?.areaService?.get('${area.id}'));window.app?.switchView('map');" 
                            class="btn-secondary" style="font-size:13px;">
                        🗺️ Ver no Mapa
                    </button>
                    <button onclick="window.app?._generateReport()" 
                            class="btn-secondary" style="font-size:13px;">
                        📄 Relatório
                    </button>
                </div>
            </div>
        `;

        // Mostra em um modal simples
        const modal = document.createElement('div');
        modal.className = 'modal open';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:600px;">
                <div class="modal-header">
                    <h2>📋 Detalhes da Área</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove();">&times;</button>
                </div>
                <div class="modal-body">
                    ${html}
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove();">Fechar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Fecha ao clicar fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    /**
     * Remove uma área
     * @param {string} id 
     * @private
     */
    _deleteArea(id) {
        const area = window.app?.areaService?.get(id);
        if (!area) return;

        if (!confirm(`Deseja realmente excluir a área "${area.nome}"? Esta ação não pode ser desfeita.`)) return;

        const deleted = window.app?.areaService?.delete(id);
        if (deleted) {
            window.app?._updateUI();
            window.app?._showNotification(
                '🗑️ Área excluída',
                `"${area.nome}" foi removida com sucesso.`,
                'info'
            );
        }
    }

    /**
     * Filtra áreas por texto
     * @param {string} query 
     */
    filter(query) {
        const cards = document.querySelectorAll('.area-card');
        if (!query || query.length < 2) {
            cards.forEach(c => c.style.display = '');
            return;
        }

        const q = query.toLowerCase();
        cards.forEach(card => {
            const name = card.querySelector('.area-name')?.textContent?.toLowerCase() || '';
            const desc = card.querySelector('[style*="border-top"]')?.textContent?.toLowerCase() || '';
            const match = name.includes(q) || desc.includes(q);
            card.style.display = match ? '' : 'none';
        });
    }

    /**
     * Vincula eventos globais
     * @private
     */
    _bindEvents() {
        // Busca de áreas na view
        const searchInput = document.querySelector('#view-areas .search-box input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filter(e.target.value);
            });
        }
    }
}

// Exportar para uso global
window.AreaPanel = AreaPanel;