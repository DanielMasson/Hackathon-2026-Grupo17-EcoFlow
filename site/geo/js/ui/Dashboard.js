/**
 * DASHBOARD UI
 * Gerencia o dashboard principal com cards e gráficos
 */

class Dashboard {
    constructor() {
        this.charts = {};
        this._initialized = false;
    }

    /**
     * Inicializa o dashboard
     */
    init() {
        if (this._initialized) return;
        this._initialized = true;
        console.log('[Dashboard] Inicializado');
    }

    /**
     * Atualiza o dashboard com dados
     * @param {Array} areas 
     * @param {Array} alerts 
     */
    update(areas, alerts) {
        this._updateStats(areas, alerts);
        this._updateCharts(areas, alerts);
        this._updateTimeline(alerts);
    }

    /**
     * Atualiza cards de estatísticas
     * @param {Array} areas 
     * @param {Array} alerts 
     * @private
     */
    _updateStats(areas, alerts) {
        const total = areas.length;
        const normal = areas.filter(a => a.analysis?.status === 'normal').length;
        const altered = areas.filter(a => a.analysis?.status === 'alteracao').length;
        const critical = alerts.filter(a => a.severity === 'critica' && (a.status === 'Detectado' || a.status === 'Em análise')).length;

        document.getElementById('totalAreas').textContent = total;
        document.getElementById('normalAreas').textContent = normal;
        document.getElementById('changedAreas').textContent = altered;
        document.getElementById('criticalAlerts').textContent = critical;
    }

    /**
     * Atualiza gráficos
     * @param {Array} areas 
     * @param {Array} alerts 
     * @private
     */
    _updateCharts(areas, alerts) {
        this._updateChangesChart(areas);
        this._updateTypeChart(alerts);
    }

    /**
     * Gráfico de alterações por período
     * @param {Array} areas 
     * @private
     */
    _updateChangesChart(areas) {
        const canvas = document.getElementById('changesChart');
        if (!canvas) return;

        // Prepara dados dos últimos 30 dias
        const days = 30;
        const labels = [];
        const normalData = [];
        const alertData = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
            
            // Conta áreas com análise neste período
            const dayAreas = areas.filter(a => {
                if (!a.lastAnalysis) return false;
                const d = new Date(a.lastAnalysis);
                return d.toDateString() === date.toDateString();
            });
            
            const normal = dayAreas.filter(a => a.analysis?.status === 'normal').length;
            const alert = dayAreas.filter(a => a.analysis?.status === 'alteracao').length;
            
            normalData.push(normal);
            alertData.push(alert);
        }

        // Cria ou atualiza gráfico
        if (this.charts.changes) {
            this.charts.changes.destroy();
        }

        const ctx = canvas.getContext('2d');
        this.charts.changes = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Áreas Normais',
                        data: normalData,
                        borderColor: '#00e676',
                        backgroundColor: 'rgba(0, 230, 118, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Alertas Detectados',
                        data: alertData,
                        borderColor: '#ff8c00',
                        backgroundColor: 'rgba(255, 140, 0, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#8fae9b',
                            font: { size: 11 }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#4a5a75', font: { size: 9 }, maxTicksLimit: 15 }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#4a5a75', font: { size: 9 }, stepSize: 1 }
                    }
                }
            }
        });
    }

    /**
     * Gráfico de distribuição por tipo
     * @param {Array} alerts 
     * @private
     */
    _updateTypeChart(alerts) {
        const canvas = document.getElementById('typeChart');
        if (!canvas) return;

        // Conta tipos de alerta
        const types = {
            'possivel_desmatamento': 0,
            'possivel_queimada': 0,
            'alteracao_vegetacao': 0,
            'solo_exposto': 0,
            'agua': 0,
            'alteracao_urbana': 0,
            'inconclusivo': 0
        };

        alerts.forEach(alert => {
            if (types.hasOwnProperty(alert.type)) {
                types[alert.type]++;
            }
        });

        const labels = {
            'possivel_desmatamento': 'Desmatamento',
            'possivel_queimada': 'Queimada',
            'alteracao_vegetacao': 'Alteração Vegetal',
            'solo_exposto': 'Solo Exposto',
            'agua': 'Água',
            'alteracao_urbana': 'Alteração Urbana',
            'inconclusivo': 'Inconclusivo'
        };

        const colors = {
            'possivel_desmatamento': '#ff3b3b',
            'possivel_queimada': '#ff8c00',
            'alteracao_vegetacao': '#c8e600',
            'solo_exposto': '#cc8844',
            'agua': '#00aaff',
            'alteracao_urbana': '#aa44ff',
            'inconclusivo': '#4a5a75'
        };

        const data = [];
        const colorList = [];
        const labelList = [];

        Object.entries(types).forEach(([key, value]) => {
            if (value > 0) {
                data.push(value);
                colorList.push(colors[key]);
                labelList.push(labels[key]);
            }
        });

        // Se não houver dados, mostra mensagem
        if (data.length === 0) {
            data.push(1);
            colorList.push('#4a5a75');
            labelList.push('Nenhum alerta');
        }

        // Cria ou atualiza gráfico
        if (this.charts.types) {
            this.charts.types.destroy();
        }

        const ctx = canvas.getContext('2d');
        this.charts.types = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labelList,
                datasets: [{
                    data: data,
                    backgroundColor: colorList,
                    borderColor: '#070c09',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#8fae9b',
                            font: { size: 11 },
                            padding: 8
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }

    /**
     * Atualiza timeline de atividades recentes
     * @param {Array} alerts 
     * @private
     */
    _updateTimeline(alerts) {
        const container = document.getElementById('recentTimeline');
        if (!container) return;

        // Pega os 5 alertas mais recentes
        const recent = alerts
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);

        if (recent.length === 0) {
            container.innerHTML = `
                <div class="timeline-empty" style="text-align:center;color:var(--text-muted);padding:20px;">
                    Nenhuma atividade recente
                </div>
            `;
            return;
        }

        let html = '';
        recent.forEach(alert => {
            const severityEmojis = {
                'critica': '🔴',
                'alta': '🟠',
                'media': '🟡',
                'normal': '🟢'
            };

            const severityColors = {
                'critica': 'var(--status-critical)',
                'alta': 'var(--status-high)',
                'media': 'var(--status-medium)',
                'normal': 'var(--status-normal)'
            };

            const emoji = severityEmojis[alert.severity] || '⚠️';
            const color = severityColors[alert.severity] || 'var(--text-secondary)';

            html += `
                <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid var(--border-color);">
                    <div style="font-size:20px;">${emoji}</div>
                    <div style="flex:1;">
                        <div style="font-weight:500;font-size:13px;">${alert.areaName}</div>
                        <div style="font-size:12px;color:var(--text-secondary);">
                            ${alert.description?.substring(0, 60) || 'Alerta detectado'}${alert.description?.length > 60 ? '...' : ''}
                        </div>
                    </div>
                    <div style="font-size:11px;color:var(--text-muted);text-align:right;">
                        ${new Date(alert.createdAt).toLocaleDateString('pt-BR')}
                        <div style="font-size:10px;color:${color};font-weight:600;text-transform:uppercase;">
                            ${alert.severity}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * Destroi gráficos
     */
    destroy() {
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
        this.charts = {};
    }
}

// Exportar para uso global
window.Dashboard = Dashboard;