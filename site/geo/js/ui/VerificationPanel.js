/**
 * VERIFICATION PANEL UI
 * Aba dedicada a revisar alertas ativos comparando NDVI x satélite real,
 * usando os snapshots salvos localmente (ResultImageStore) — sem precisar
 * reprocessar nada.
 */

class VerificationPanel {
    constructor() {
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;
        this._initialized = true;
        console.log('[VerificationPanel] Inicializado');
    }

    /**
     * Renderiza a lista de alertas ativos com opção de verificação visual.
     * @param {Array} alerts
     */
    async render(alerts) {
        const container = document.getElementById('verificationGrid');
        if (!container) return;

        const active = (alerts || []).filter(a => a.status === 'Detectado' || a.status === 'Em análise');

        if (active.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-secondary);">
                    <div style="font-size:48px;margin-bottom:16px;">✅</div>
                    <h3 style="color:var(--text-primary);margin-bottom:8px;">Nada para verificar</h3>
                    <p style="font-size:14px;">Não há alertas ativos pendentes de verificação visual.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:20px;">Carregando snapshots salvos...</div>`;

        const cards = await Promise.all(active.map(alert => this._buildCard(alert)));
        container.innerHTML = cards.join('');
        this._bindEvents();
    }

    /**
     * @param {Object} alert
     * @returns {Promise<string>}
     * @private
     */
    async _buildCard(alert) {
        const snapshot = window.resultImageStore
            ? await window.resultImageStore.getLatestForArea(alert.areaId)
            : null;

        const thumb = snapshot?.images?.trueColorAfter || snapshot?.images?.ndviAfter || null;

        const severityColors = {
            'critica': 'var(--status-critical)', 'alta': 'var(--status-high)',
            'media': 'var(--status-medium)', 'normal': 'var(--status-normal)'
        };
        const color = severityColors[alert.severity] || 'var(--text-secondary)';

        return `
            <div class="area-card" data-alert-id="${alert.id}" data-area-id="${alert.areaId}" style="border-left:4px solid ${color};">
                <div style="display:flex;gap:12px;">
                    <div style="width:100px;height:75px;flex-shrink:0;border-radius:6px;overflow:hidden;background:var(--bg-tertiary);">
                        ${thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover;" alt="Prévia">`
                                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted);">Sem imagem</div>`}
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div class="area-name" style="font-size:14px;">${alert.areaName}</div>
                        <div style="font-size:12px;color:${color};font-weight:600;text-transform:uppercase;margin-top:2px;">${alert.severity}</div>
                        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${alert.description || ''}</div>
                    </div>
                </div>
                <div class="area-actions" style="margin-top:12px;">
                    <button data-action="verify" data-area="${alert.areaId}">🔍 Comparar</button>
                    <button data-action="confirm" data-alert="${alert.id}" style="color:var(--status-normal);">✅ Confirmar</button>
                    <button data-action="false-positive" data-alert="${alert.id}" style="color:var(--text-muted);">❌ Falso Positivo</button>
                </div>
            </div>
        `;
    }

    _bindEvents() {
        document.querySelectorAll('#verificationGrid [data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'verify') {
                    window.app?.imageComparator?.open(btn.dataset.area);
                } else if (action === 'confirm') {
                    window.app?.alertService?.updateStatus(btn.dataset.alert, 'Confirmado');
                    window.app?._updateUI();
                } else if (action === 'false-positive') {
                    window.app?.alertService?.updateStatus(btn.dataset.alert, 'Falso positivo');
                    window.app?._updateUI();
                }
            });
        });
    }
}

// Exportar para uso global
window.VerificationPanel = VerificationPanel;
