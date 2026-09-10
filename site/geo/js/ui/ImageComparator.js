/**
 * IMAGE COMPARATOR UI
 * Comparador antes/depois com slider interativo
 *
 * NOVO NESTA VERSÃO:
 * - open() agora é assíncrono e busca o snapshot real salvo no
 *   ResultImageStore (IndexedDB), permitindo alternar entre Satélite Real,
 *   NDVI e a Simulação Visual (fallback demo).
 * - Botão para marcar o alerta ativo da área como falso positivo direto
 *   pelo comparador, delegando para App._markFalsePositive().
 */

class ImageComparator {
    constructor() {
        this._initialized = false;
        this.currentAreaId = null;
        this.isComparing = false;
        this._modes = {};
    }

    /**
     * Inicializa o comparador
     */
    init() {
        if (this._initialized) return;
        this._initialized = true;
        console.log('[ImageComparator] Inicializado');
    }

    /**
     * Abre o comparador para uma área. Busca o snapshot real salvo (se
     * houver) e permite alternar entre Satélite Real, NDVI e a imagem de
     * simulação (fallback quando não há resultado real salvo).
     * @param {string} areaId
     * @param {string|null} preferredMode - 'satellite' | 'ndvi' | 'demo' (opcional)
     */
    async open(areaId, preferredMode = null) {
        this.currentAreaId = areaId;

        // Verifica se app está disponível
        if (!window.app) {
            console.error('[ImageComparator] App não disponível');
            return;
        }

        const area = window.app.areaService?.get(areaId);
        if (!area) {
            window.app._showNotification('⚠️ Erro', 'Área não encontrada.', 'critical');
            return;
        }

        const snapshot = window.resultImageStore
            ? await window.resultImageStore.getLatestForArea(areaId)
            : null;

        const demoImages = window.app.imageService ? window.app.imageService.getImages(areaId) : null;

        const modes = {};

        if (snapshot?.images?.trueColorBefore && snapshot?.images?.trueColorAfter) {
            modes.satellite = {
                label: '🛰️ Satélite Real',
                before: { dataUrl: snapshot.images.trueColorBefore, date: snapshot.previousDate },
                after: { dataUrl: snapshot.images.trueColorAfter, date: snapshot.currentDate },
                hasChange: snapshot.status === 'alteracao',
                changeType: snapshot.type
            };
        }

        if (snapshot?.images?.ndviBefore && snapshot?.images?.ndviAfter) {
            modes.ndvi = {
                label: '📊 NDVI',
                before: { dataUrl: snapshot.images.ndviBefore, date: snapshot.previousDate },
                after: { dataUrl: snapshot.images.ndviAfter, date: snapshot.currentDate },
                hasChange: snapshot.status === 'alteracao',
                changeType: snapshot.type
            };
        }

        if (demoImages) {
            modes.demo = {
                label: '🖼️ Simulação Visual',
                before: demoImages.before,
                after: demoImages.after,
                hasChange: demoImages.hasChange,
                changeType: demoImages.changeType
            };
        }

        if (Object.keys(modes).length === 0) {
            window.app._showNotification('⚠️ Erro', 'Nenhuma imagem disponível para esta área.', 'critical');
            return;
        }

        const activeMode = (preferredMode && modes[preferredMode])
            ? preferredMode
            : (modes.satellite ? 'satellite' : (modes.ndvi ? 'ndvi' : 'demo'));

        this._modes = modes;
        this._showComparatorModal(area, modes[activeMode], activeMode);
    }

    /**
     * Mostra modal do comparador
     * @param {Object} area 
     * @param {Object} images 
     * @param {string} activeMode 
     * @private
     */
    _showComparatorModal(area, images, activeMode = 'demo') {
        // Remove modal existente se houver
        const existing = document.getElementById('comparatorModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'modal open';
        modal.style.display = 'flex';
        modal.id = 'comparatorModal';

        const hasChange = images.hasChange || false;
        const changeType = images.changeType || 'normal';
        const changeLabel = this._getChangeLabel(changeType);

        // Verifica se as imagens têm dataUrl
        const beforeDataUrl = images.before?.dataUrl || this._getPlaceholderImage();
        const afterDataUrl = images.after?.dataUrl || this._getPlaceholderImage();
        
        const beforeDate = images.before?.date ? new Date(images.before.date).toLocaleDateString('pt-BR') : '--';
        const afterDate = images.after?.date ? new Date(images.after.date).toLocaleDateString('pt-BR') : '--';

        const modeSwitcher = Object.keys(this._modes).length > 1 ? `
            <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
                ${Object.entries(this._modes).map(([key, m]) => `
                    <button onclick="window.app?.imageComparator?.open('${area.id}','${key}')"
                            class="${key === activeMode ? 'btn-primary' : 'btn-secondary'}" style="font-size:12px;">
                        ${m.label}
                    </button>
                `).join('')}
            </div>
        ` : '';

        modal.innerHTML = `
            <div class="modal-content" style="max-width:900px;">
                <div class="modal-header">
                    <h2>📸 Comparador Antes × Depois</h2>
                    <button class="modal-close" onclick="document.getElementById('comparatorModal')?.remove();">&times;</button>
                </div>
                <div class="modal-body" style="padding:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
                        <div>
                            <h3 style="margin:0;">${area.nome || 'Área'}</h3>
                            <div style="color:var(--text-secondary);font-size:13px;">
                                ${area.areaHa?.toFixed(1) || 0} ha • ${area.categoria || '--'}
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:13px;color:${hasChange ? 'var(--status-high)' : 'var(--status-normal)'};">
                                ${hasChange ? '⚠️ ' + changeLabel : '✅ Normal'}
                            </div>
                            ${hasChange && area.analysis?.confidence ? `
                            <div style="font-size:12px;color:var(--text-muted);">
                                Confiança: ${(area.analysis.confidence * 100).toFixed(0)}%
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    ${modeSwitcher}

                    <!-- Container do comparador -->
                    <div class="comparator-container" style="position:relative;width:100%;max-width:800px;margin:0 auto;border-radius:8px;overflow:hidden;border:1px solid var(--border-color);">
                        <div style="position:relative;width:100%;padding-bottom:75%;background:var(--bg-tertiary);">
                            <!-- Imagem "Depois" (fundo) -->
                            <img id="comparatorAfter" 
                                 src="${afterDataUrl}" 
                                 alt="Imagem atual" 
                                 style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;">

                            <!-- Imagem "Antes" (recortada pelo slider) -->
                            <div id="comparatorBeforeContainer" 
                                 style="position:absolute;top:0;left:0;width:50%;height:100%;overflow:hidden;border-right:3px solid #00e676;transition:width 0.05s linear;">
                                <img id="comparatorBefore" 
                                     src="${beforeDataUrl}" 
                                     alt="Imagem anterior" 
                                     style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;">
                            </div>

                            <!-- Linha do slider -->
                            <div id="comparatorHandle" 
                                 style="position:absolute;top:0;left:50%;width:3px;height:100%;background:#00e676;cursor:ew-resize;transform:translateX(-50%);z-index:10;">
                                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:32px;height:32px;background:#00e676;border-radius:50%;border:3px solid var(--bg-primary);display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--bg-primary);font-weight:bold;box-shadow:0 0 20px rgba(0,230,118,0.3);">
                                    ⟷
                                </div>
                            </div>

                            <!-- Labels -->
                            <div style="position:absolute;bottom:12px;left:12px;background:rgba(0,0,0,0.7);padding:4px 12px;border-radius:4px;font-size:12px;color:#00e676;z-index:5;">
                                📅 ANTES: ${beforeDate}
                            </div>
                            <div style="position:absolute;bottom:12px;right:12px;background:rgba(0,0,0,0.7);padding:4px 12px;border-radius:4px;font-size:12px;color:#00e676;z-index:5;">
                                📅 DEPOIS: ${afterDate}
                            </div>
                            
                            ${APP_CONFIG.MODE === 'DEMO' ? `
                            <div style="position:absolute;top:12px;right:12px;background:rgba(255,215,0,0.2);padding:4px 10px;border-radius:4px;font-size:10px;color:var(--accent-yellow);z-index:5;border:1px solid rgba(255,215,0,0.2);">
                                🔬 DEMONSTRAÇÃO
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Controles do slider -->
                    <div style="display:flex;align-items:center;gap:16px;margin-top:16px;padding:0 20px;">
                        <span style="font-size:13px;color:var(--text-secondary);">ANTES</span>
                        <input type="range" id="comparatorSlider" 
                               min="0" max="100" value="50" 
                               style="flex:1;accent-color:#00e676;height:4px;cursor:pointer;">
                        <span style="font-size:13px;color:var(--text-secondary);">DEPOIS</span>
                    </div>

                    <!-- Informações adicionais -->
                    ${hasChange ? `
                    <div style="margin-top:16px;padding:12px;background:rgba(255,140,0,0.1);border:1px solid rgba(255,140,0,0.2);border-radius:8px;">
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center;">
                            <div>
                                <div style="font-size:11px;color:var(--text-muted);">Área Afetada</div>
                                <div style="font-weight:600;font-size:16px;color:var(--status-high);">
                                    ${area.analysis?.affectedAreaHa?.toFixed(1) || 0} ha
                                </div>
                            </div>
                            <div>
                                <div style="font-size:11px;color:var(--text-muted);">Percentual</div>
                                <div style="font-weight:600;font-size:16px;color:var(--status-high);">
                                    ${area.analysis?.affectedPercentage?.toFixed(2) || 0}%
                                </div>
                            </div>
                            <div>
                                <div style="font-size:11px;color:var(--text-muted);">Tipo</div>
                                <div style="font-weight:600;font-size:14px;color:var(--status-medium);">
                                    ${changeLabel}
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : `
                    <div style="margin-top:16px;padding:12px;background:rgba(0,255,136,0.05);border:1px solid rgba(0,255,136,0.2);border-radius:8px;text-align:center;color:var(--status-normal);">
                        ✅ Nenhuma alteração significativa detectada neste período.
                    </div>
                    `}

                    <!-- Botões de ação -->
                    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;justify-content:center;">
                        <button onclick="window.app?.switchView('analysis');document.getElementById('analysisAreaSelect').value='${area.id}';document.getElementById('runAnalysisBtn')?.click();document.getElementById('comparatorModal')?.remove();" 
                                class="btn-primary" style="font-size:13px;">
                            🔍 Nova Análise
                        </button>
                        <button onclick="window.app?.mapService?.focusArea(window.app?.areaService?.get('${area.id}'));window.app?.switchView('map');document.getElementById('comparatorModal')?.remove();" 
                                class="btn-secondary" style="font-size:13px;">
                            🗺️ Ver no Mapa
                        </button>
                        ${hasChange ? `
                        <button onclick="window.app?._generateReport();document.getElementById('comparatorModal')?.remove();" 
                                class="btn-secondary" style="font-size:13px;">
                            📄 Gerar Relatório
                        </button>
                        <button onclick="window.app?._markFalsePositive('${area.id}');document.getElementById('comparatorModal')?.remove();" 
                                class="btn-secondary" style="font-size:13px;color:var(--text-muted);">
                            ❌ Marcar como Falso Positivo
                        </button>
                        ` : ''}
                        <button onclick="document.getElementById('comparatorModal')?.remove();" 
                                class="btn-secondary" style="font-size:13px;">
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Inicializa o slider
        setTimeout(() => {
            this._initSlider(modal);
        }, 100);

        // Fecha ao clicar fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    /**
     * Inicializa o slider interativo
     * @param {HTMLElement} modal 
     * @private
     */
    _initSlider(modal) {
        const slider = modal.querySelector('#comparatorSlider');
        const beforeContainer = modal.querySelector('#comparatorBeforeContainer');
        const handle = modal.querySelector('#comparatorHandle');

        if (!slider || !beforeContainer || !handle) return;

        // Atualiza posição
        const updatePosition = (value) => {
            const percent = parseFloat(value);
            beforeContainer.style.width = percent + '%';
            handle.style.left = percent + '%';
        };

        // Evento do slider
        slider.addEventListener('input', (e) => {
            updatePosition(e.target.value);
        });

        // Drag no handle
        let isDragging = false;

        const startDrag = (e) => {
            isDragging = true;
            e.preventDefault();
        };

        const onDrag = (e) => {
            if (!isDragging) return;
            const rect = beforeContainer.parentElement.getBoundingClientRect();
            const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
            const x = clientX - rect.left;
            const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
            slider.value = percent;
            updatePosition(percent);
        };

        const endDrag = () => {
            isDragging = false;
        };

        handle.addEventListener('mousedown', startDrag);
        handle.addEventListener('touchstart', startDrag);

        document.addEventListener('mousemove', onDrag);
        document.addEventListener('touchmove', onDrag);
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);

        // Click no container para mover
        const container = modal.querySelector('.comparator-container');
        if (container) {
            container.addEventListener('click', (e) => {
                const rect = container.getBoundingClientRect();
                const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
                const x = clientX - rect.left;
                const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
                slider.value = percent;
                updatePosition(percent);
            });
        }

        // Limpeza ao fechar
        modal.addEventListener('remove', () => {
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('touchmove', onDrag);
            document.removeEventListener('mouseup', endDrag);
            document.removeEventListener('touchend', endDrag);
        });
    }

    /**
     * Retorna label do tipo de alteração
     * @param {string} type 
     * @returns {string}
     * @private
     */
    _getChangeLabel(type) {
        const labels = {
            'possivel_desmatamento': 'Possível Desmatamento',
            'possivel_queimada': 'Possível Queimada',
            'alteracao_vegetacao': 'Alteração de Vegetação',
            'solo_exposto': 'Solo Exposto',
            'agua': 'Água',
            'alteracao_urbana': 'Alteração Urbana',
            'inconclusivo': 'Inconclusivo',
            'normal': 'Normal'
        };
        return labels[type] || type;
    }

    /**
     * Retorna imagem placeholder
     * @returns {string}
     * @private
     */
    _getPlaceholderImage() {
        // Cria um canvas com gradiente simples
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createLinearGradient(0, 0, 400, 300);
        gradient.addColorStop(0, '#1a2332');
        gradient.addColorStop(0.5, '#2a3a4a');
        gradient.addColorStop(1, '#1a2332');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 400, 300);
        
        ctx.fillStyle = 'rgba(0, 212, 255, 0.1)';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📸 Sem Imagem', 200, 150);
        
        return canvas.toDataURL('image/png');
    }
}

// Exportar para uso global
window.ImageComparator = ImageComparator;
