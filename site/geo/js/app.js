/**
 * APPLICATION - ORQUESTRADOR PRINCIPAL
 * Environmental Intelligence Center - App
 */

class App {
    constructor() {
        this.isInitialized = false;
        this.currentView = 'dashboard';
        this.isDrawing = false;
        this.drawnPolygon = null;
        
        // Serviços
        this.storage = null;
        this.areaService = null;
        this.mapService = null;
        this.analysisService = null;
        this.alertService = null;
        this.satelliteService = null;
        this.reportService = null;
        this.auditService = null;
        this.imageService = null;
        this.imageComparator = null;
        
        // UI
        this.dashboard = null;
        this.areaPanel = null;
        this.alertPanel = null;
        this.timeline = null;
        
        this._bindEvents();
    }

    /**
     * Inicializa a aplicação
     */
    init() {
        if (this.isInitialized) return;
        
        console.log('🚀 Environmental Intelligence Center - Inicializando...');
        console.log(`📌 Modo: ${APP_CONFIG.MODE}`);
        
        // Verifica se Leaflet está carregado
        if (typeof L === 'undefined') {
            console.error('❌ Leaflet não carregado! Verifique a conexão com a internet.');
            this._showNotification('⚠️ Erro', 'Leaflet não carregado. Verifique sua conexão com a internet.', 'critical');
            return;
        }
        
        // Inicializa storage com dados demo
        this.storage = storageService;
        this.storage.init();
        
        // Inicializa serviços
        this.areaService = new AreaService();
        this.areaService.init();
        
        this.analysisService = new AnalysisService();
        this.analysisService.init();
        
        this.alertService = new AlertService();
        this.alertService.init();
        
        this.satelliteService = new SatelliteService();
        this.satelliteService.init();
        
        this.reportService = new ReportService();
        this.reportService.init();
        
        this.auditService = new AuditService();
        this.auditService.init();
        
        // NOVO: Inicializa Image Service
        this.imageService = new ImageService();
        this.imageService.init();
        
        // NOVO: Inicializa Image Comparator
        this.imageComparator = new ImageComparator();
        this.imageComparator.init();
        
        // Inicializa UI
        this.dashboard = new Dashboard();
        this.dashboard.init();
        
        this.areaPanel = new AreaPanel();
        this.areaPanel.init();
        
        this.alertPanel = new AlertPanel();
        this.alertPanel.init();
        
        this.timeline = new Timeline();
        this.timeline.init();
        
        // Carrega dados
        this._loadData();
        
        // Atualiza UI
        this._updateUI();
        
        // Mostra notificação de boas-vindas
        setTimeout(() => {
            this._showWelcomeNotification();
        }, 500);
        
        this.isInitialized = true;
        console.log('✅ Sistema inicializado com sucesso!');
        
        // Verifica se ImageService tem imagens
        if (this.imageService) {
            console.log('📸 ImageService inicializado com imagens para', 
                Object.keys(this.imageService.images || {}).length, 'áreas');
        }
    }

    /**
     * Carrega dados do storage
     * @private
     */
    _loadData() {
         const areas = this.storage.getAreas();
        const alerts = this.storage.getAlerts();
        const history = this.storage.getHistory();
        
        console.log(`📊 ${areas.length} áreas carregadas`);
        console.log(`⚠️ ${alerts.length} alertas carregados`);
        console.log(`📜 ${history.length} registros de histórico`);
        
        // Atualiza serviços
        if (this.areaService) this.areaService.setAreas(areas);
        if (this.alertService) this.alertService.setAlerts(alerts);
        
        // Gera imagens para as áreas
        if (this.imageService) {
            areas.forEach(area => {
                this.imageService.generateForArea(area);
            });
        }
    }

    /**
     * Atualiza dados no mapa
     * @private
     */
    _updateMapData() {
        if (!this.mapService || !this.mapService._initialized) return;
        
        const areas = this.areaService ? this.areaService.getAll() : [];
        const alerts = this.alertService ? this.alertService.getAll() : [];
        
        try {
            this.mapService.updateAreas(areas);
            this.mapService.updateAlerts(alerts);
        } catch (e) {
            console.warn('Erro ao atualizar dados do mapa:', e);
        }
    }

    /**
     * Atualiza toda a UI
     * @private
     */
    _updateUI() {
        const areas = this.areaService ? this.areaService.getAll() : [];
        const alerts = this.alertService ? this.alertService.getAll() : [];
        const history = this.storage.getHistory();
        
        // Atualiza badges
        const areaCountEl = document.getElementById('areaCount');
        const alertCountEl = document.getElementById('alertCount');
        if (areaCountEl) areaCountEl.textContent = areas.length;
        if (alertCountEl) {
            const active = alerts.filter(a => a.status === 'Detectado' || a.status === 'Em análise').length;
            alertCountEl.textContent = active;
        }
        
        // Atualiza badge de notificações
        const notifBadge = document.querySelector('#notificationsBtn .badge');
        if (notifBadge) {
            const critical = alerts.filter(a => a.severity === 'critica' && (a.status === 'Detectado' || a.status === 'Em análise')).length;
            notifBadge.textContent = critical;
            notifBadge.style.display = critical > 0 ? 'block' : 'none';
        }
        
        // Dashboard
        if (this.dashboard) this.dashboard.update(areas, alerts);
        
        // Lista de áreas
        if (this.areaPanel) this.areaPanel.render(areas);
        
        // Alertas
        if (this.alertPanel) this.alertPanel.render(alerts);
        
        // Análise - dropdown
        this._updateAnalysisDropdown(areas);
        
        // Histórico
        if (this.timeline) {
            this.timeline.render(history);
            this.timeline.updateFilterOptions(areas);
        }
        
        // Mapa
        if (this.mapService && this.mapService._initialized) {
            try {
                this.mapService.updateAreas(areas);
                this.mapService.updateAlerts(alerts);
            } catch (e) {
                console.warn('Erro ao atualizar mapa:', e);
            }
        }
    }

    /**
     * Atualiza dropdown de análise
     * @private
     */
    _updateAnalysisDropdown(areas) {
        const select = document.getElementById('analysisAreaSelect');
        if (!select) return;
        
        const currentValue = select.value;
        select.innerHTML = '<option value="">-- Selecione --</option>';
        areas.forEach(area => {
            const option = document.createElement('option');
            option.value = area.id;
            option.textContent = `${area.nome} (${area.areaHa?.toFixed(1) || 0} ha)`;
            select.appendChild(option);
        });
        if (currentValue && areas.some(a => a.id === currentValue)) {
            select.value = currentValue;
        }
    }

    /**
     * Mostra notificação de boas-vindas
     * @private
     */
    _showWelcomeNotification() {
        const areas = this.areaService ? this.areaService.getAll() : [];
        this._showNotification(
            '🌿 Environmental Intelligence Center',
            `Sistema iniciado em modo ${APP_CONFIG.MODE}. ${areas.length} áreas carregadas. Explore o mapa, crie áreas e realize análises.`,
            'success'
        );
    }

    /**
     * Mostra notificação
     * @param {string} title 
     * @param {string} body 
     * @param {string} type 
     * @private
     */
    _showNotification(title, body, type = 'info') {
        const container = document.getElementById('notificationsContainer');
        if (!container) return;
        
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.innerHTML = `
            <div class="notif-title">${title}</div>
            <div class="notif-body">${body}</div>
            <div class="notif-time">${new Date().toLocaleTimeString()}</div>
        `;
        container.appendChild(notif);
        
        setTimeout(() => {
            notif.style.opacity = '0';
            notif.style.transform = 'translateX(100%)';
            notif.style.transition = 'all 0.3s ease';
            setTimeout(() => notif.remove(), 300);
        }, 5000);
    }

    /**
     * Vincula eventos da UI
     * @private
     */
    _bindEvents() {
        // Menu toggle (mobile)
        document.getElementById('menuToggle')?.addEventListener('click', () => {
            document.getElementById('sidebar')?.classList.toggle('open');
        });

        // Navegação
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                this.switchView(view);
                // Fecha sidebar mobile
                document.getElementById('sidebar')?.classList.remove('open');
            });
        });

        // Nova área
        document.getElementById('newAreaBtn')?.addEventListener('click', () => {
            this.openAreaModal();
        });
        document.getElementById('newAreaFromPanel')?.addEventListener('click', () => {
            this.openAreaModal();
        });

        // Busca global
        document.getElementById('globalSearch')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this._handleSearch(e.target.value);
            }
        });

        // Notificações
        document.getElementById('notificationsBtn')?.addEventListener('click', () => {
            this.switchView('alerts');
        });

        // Análise
        document.getElementById('runAnalysisBtn')?.addEventListener('click', () => {
            this._runAnalysis();
        });

        // Configurações
        document.getElementById('resetDataBtn')?.addEventListener('click', () => {
            this._resetData();
        });
        document.getElementById('exportDataBtn')?.addEventListener('click', () => {
            this._exportData();
        });

        // Modal de área
        document.getElementById('modalClose')?.addEventListener('click', () => {
            this.closeAreaModal();
        });
        document.getElementById('cancelAreaBtn')?.addEventListener('click', () => {
            this.closeAreaModal();
        });
        document.getElementById('saveAreaBtn')?.addEventListener('click', () => {
            this._saveArea();
        });

        // Modal de alerta
        document.getElementById('alertModalClose')?.addEventListener('click', () => {
            document.getElementById('alertModal').classList.remove('open');
        });

        // Modal de relatório
        document.getElementById('reportModalClose')?.addEventListener('click', () => {
            document.getElementById('reportModal').classList.remove('open');
        });
        document.getElementById('closeReportBtn')?.addEventListener('click', () => {
            document.getElementById('reportModal').classList.remove('open');
        });
        document.getElementById('printReportBtn')?.addEventListener('click', () => {
            window.print();
        });
        document.getElementById('exportReportBtn')?.addEventListener('click', () => {
            this._exportReport();
        });

        // Filtros de alertas
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (this.alertPanel) {
                    this.alertPanel.filter(btn.dataset.filter);
                }
            });
        });

        // Configurar Copernicus
        document.getElementById('configureCopernicusBtn')?.addEventListener('click', () => {
            this._showNotification(
                '🔧 Integração Copernicus',
                'Conecte-se ao serviço Copernicus configurando as credenciais na camada SatelliteService.',
                'info'
            );
        });

        // Gerar relatório
        document.getElementById('generateReportBtn')?.addEventListener('click', () => {
            this._generateReport();
        });

        // Fechar modais com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
            }
        });

        // Clique fora do modal para fechar
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('open');
                }
            });
        });
    }

    /**
     * Alterna a visualização atual
     * @param {string} view 
     */
    switchView(view) {
        // Atualiza navegação
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });

        // Atualiza views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
        });
        const targetView = document.getElementById(`view-${view}`);
        if (targetView) {
            targetView.classList.add('active');
            this.currentView = view;
        }

        // Se for mapa, inicializa se necessário e atualiza tamanho
        if (view === 'map') {
            this._initMapIfNeeded();
        }
    }

    /**
     * Inicializa o mapa na primeira vez que o mapa é exibido
     * @private
     */
    _initMapIfNeeded() {
        if (this.mapService && this.mapService._initialized) {
            // Mapa já inicializado, apenas invalida tamanho
            requestAnimationFrame(() => {
                this.mapService.invalidateSize();
            });
        } else {
            // Primeira vez: cria o mapa agora que o container está visível
            try {
                this.mapService = new MapService('mainMap');
                this.mapService.init();
                // Atualiza dados no mapa após criação
                this._updateMapData();
            } catch (e) {
                console.error('❌ Erro ao inicializar mapa:', e);
                this._showNotification('⚠️ Erro', 'Erro ao inicializar o mapa. Verifique o console.', 'critical');
            }
        }
    }

    /**
     * Abre o modal de criação de área
     */
    openAreaModal() {
        const modal = document.getElementById('areaModal');
        if (!modal) return;
        
        modal.classList.add('open');
        
        // Reseta o formulário
        document.getElementById('areaName').value = '';
        document.getElementById('areaDescription').value = '';
        document.getElementById('areaResponsible').value = 'Operador';
        document.getElementById('geoArea').textContent = '--';
        document.getElementById('geoPerimeter').textContent = '--';
        document.getElementById('geoCentroidLat').textContent = '--';
        document.getElementById('geoCentroidLng').textContent = '--';
        
        // Limpa desenho
        this._clearDraw();
        
        // Inicializa draw map
        setTimeout(() => {
            try {
                this._initDrawMap();
            } catch (e) {
                console.error('Erro ao inicializar mapa de desenho:', e);
                this._showNotification('⚠️ Erro', 'Erro ao inicializar o mapa de desenho.', 'critical');
            }
        }, 300);
    }

    /**
     * Fecha o modal de criação de área
     */
    closeAreaModal() {
        document.getElementById('areaModal').classList.remove('open');
        this._clearDraw();
    }

    /**
     * Inicializa mapa de desenho
     * @private
     */
    _initDrawMap() {
        const container = document.getElementById('drawMap');
        if (!container) return;
        
        // Verifica se Leaflet está disponível
        if (typeof L === 'undefined') {
            this._showNotification('⚠️ Erro', 'Leaflet não disponível para desenho.', 'critical');
            return;
        }
        
        // Verifica se já foi inicializado
        if (this.drawMap) {
            this.drawMap.invalidateSize();
            return;
        }
        
        // Cria mapa
        this.drawMap = L.map(container, {
            center: APP_CONFIG.MAP.DEFAULT_CENTER,
            zoom: APP_CONFIG.MAP.DEFAULT_ZOOM,
            zoomControl: true
        });
        
        // Adiciona tile layer
        L.tileLayer(APP_CONFIG.MAP.TILE_LAYER, {
            attribution: APP_CONFIG.MAP.TILE_ATTRIBUTION,
            maxZoom: APP_CONFIG.MAP.MAX_ZOOM
        }).addTo(this.drawMap);
        
        // Feature group para desenho
        this.drawFeatureGroup = new L.FeatureGroup();
        this.drawMap.addLayer(this.drawFeatureGroup);
        
        // Controle de desenho - verifica se L.Control.Draw existe
        if (L.Control.Draw) {
            this.drawControl = new L.Control.Draw({
                draw: {
                    polygon: {
                        allowIntersection: false,
                        showArea: true,
                        shapeOptions: {
                            color: '#00d4ff',
                            weight: 2,
                            opacity: 0.8,
                            fillColor: '#00d4ff',
                            fillOpacity: 0.2
                        }
                    },
                    rectangle: false,
                    circle: false,
                    marker: false,
                    circlemarker: false,
                    polyline: false
                },
                edit: {
                    featureGroup: this.drawFeatureGroup,
                    remove: true
                }
            });
            this.drawMap.addControl(this.drawControl);
            
            // Eventos de desenho
            this.drawMap.on(L.Draw.Event.CREATED, (event) => {
                const layer = event.layer;
                this.drawFeatureGroup.clearLayers();
                this.drawFeatureGroup.addLayer(layer);
                this.drawnPolygon = layer;
                this._updateGeoInfo(layer);
                document.getElementById('drawStatus').textContent = '✅ Polígono desenhado com sucesso!';
            });
            
            this.drawMap.on(L.Draw.Event.DELETED, () => {
                this._clearDraw();
            });
        } else {
            console.warn('Leaflet Draw não carregado. Usando modo sem desenho.');
            document.getElementById('drawStatus').textContent = '⚠️ Módulo de desenho não disponível.';
        }
        
        // Botão de desenho
        document.getElementById('startDrawBtn')?.addEventListener('click', () => {
            if (L.Control.Draw) {
                new L.Draw.Polygon(this.drawMap, {
                    allowIntersection: false,
                    showArea: true,
                    shapeOptions: {
                        color: '#00d4ff',
                        weight: 2,
                        opacity: 0.8,
                        fillColor: '#00d4ff',
                        fillOpacity: 0.2
                    }
                }).enable();
                document.getElementById('drawStatus').textContent = '✏️ Desenhe o polígono no mapa...';
            } else {
                this._showNotification('⚠️ Aviso', 'Módulo de desenho não disponível.', 'medium');
            }
        });
        
        document.getElementById('clearDrawBtn')?.addEventListener('click', () => {
            this._clearDraw();
        });
        
        // Atualiza tamanho
        setTimeout(() => {
            if (this.drawMap) this.drawMap.invalidateSize();
        }, 200);
    }

    /**
     * Limpa o desenho atual
     * @private
     */
    _clearDraw() {
        if (this.drawFeatureGroup) {
            this.drawFeatureGroup.clearLayers();
        }
        this.drawnPolygon = null;
        const statusEl = document.getElementById('drawStatus');
        if (statusEl) statusEl.textContent = 'Clique em "Desenhar Polígono" para começar';
        document.getElementById('geoArea').textContent = '--';
        document.getElementById('geoPerimeter').textContent = '--';
        document.getElementById('geoCentroidLat').textContent = '--';
        document.getElementById('geoCentroidLng').textContent = '--';
    }

    /**
     * Atualiza informações geográficas
     * @param {L.Layer} layer 
     * @private
     */
    _updateGeoInfo(layer) {
        if (!layer) return;
        
        try {
            const geojson = layer.toGeoJSON();
            if (!geojson || !geojson.geometry) return;
            
            // Área
            const area = turf.area(geojson);
            const areaHa = area / 10000;
            document.getElementById('geoArea').textContent = areaHa.toFixed(1) + ' ha';
            
            // Perímetro
            const perimeter = turf.length(geojson, { units: 'kilometers' });
            document.getElementById('geoPerimeter').textContent = perimeter.toFixed(2) + ' km';
            
            // Centroide
            const centroid = turf.centroid(geojson);
            const coords = centroid.geometry.coordinates;
            document.getElementById('geoCentroidLat').textContent = coords[1].toFixed(6);
            document.getElementById('geoCentroidLng').textContent = coords[0].toFixed(6);
        } catch (e) {
            console.error('Erro ao calcular geo-info:', e);
        }
    }

    /**
     * Salva uma nova área
     * @private
     */
    _saveArea() {
        const name = document.getElementById('areaName').value.trim();
        if (!name) {
            this._showNotification('⚠️ Erro', 'Informe o nome da área.', 'critical');
            return;
        }
        
        if (!this.drawnPolygon) {
            this._showNotification('⚠️ Erro', 'Desenhe um polígono no mapa.', 'critical');
            return;
        }
        
        try {
            const geojson = this.drawnPolygon.toGeoJSON();
            if (!geojson || !geojson.geometry) {
                this._showNotification('⚠️ Erro', 'Polígono inválido.', 'critical');
                return;
            }
            
            // Calcula área
            const area = turf.area(geojson);
            const areaHa = area / 10000;
            
            // Cria área
            const areaData = {
                nome: name,
                descricao: document.getElementById('areaDescription').value.trim(),
                categoria: document.getElementById('areaCategory').value,
                prioridade: document.getElementById('areaPriority').value,
                status: document.getElementById('areaStatus').value,
                responsavel: document.getElementById('areaResponsible').value.trim() || 'Operador',
                frequency: document.getElementById('areaFrequency').value,
                geojson: geojson,
                areaHa: areaHa,
                perimeterKm: turf.length(geojson, { units: 'kilometers' }),
                municipality: '--',
                state: '--',
                lastAnalysis: null,
                analysis: {
                    status: 'normal',
                    type: 'normal',
                    severity: 'normal',
                    confidence: 0,
                    affectedAreaHa: 0,
                    affectedPercentage: 0,
                    previousDate: null,
                    currentDate: null
                },
                history: []
            };
            
            const saved = this.areaService.create(areaData);
            
            // Fecha modal
            this.closeAreaModal();
            
            // Atualiza UI
            this._updateUI();
            
            this._showNotification(
                '✅ Área criada',
                `"${saved.nome}" foi criada com sucesso! Área: ${areaHa.toFixed(1)} ha`,
                'success'
            );
            
            // Adiciona ao histórico
            this.auditService.log({
                action: 'Área criada',
                details: `Nova área "${saved.nome}" criada com ${areaHa.toFixed(1)} ha`,
                areaId: saved.id,
                user: saved.responsavel
            });
            
        } catch (e) {
            console.error('Erro ao salvar área:', e);
            this._showNotification('⚠️ Erro', 'Falha ao salvar a área. Tente novamente.', 'critical');
        }
    }

    /**
     * Executa análise da área selecionada
     * @private
     */
    async _runAnalysis() {
        const select = document.getElementById('analysisAreaSelect');
        const areaId = select.value;
        
        if (!areaId) {
            this._showNotification('⚠️ Aviso', 'Selecione uma área para analisar.', 'medium');
            return;
        }
        
        const area = this.areaService.get(areaId);
        if (!area) {
            this._showNotification('⚠️ Erro', 'Área não encontrada.', 'critical');
            return;
        }
        
        const resultContainer = document.getElementById('analysisResult');
        if (!resultContainer) return;
        
        // Mostra loading
        resultContainer.innerHTML = `
            <div style="text-align:center;padding:40px;">
                <div style="font-size:32px;margin-bottom:16px;">⏳</div>
                <div style="font-size:18px;font-weight:500;">Analisando área "${area.nome}"...</div>
                <div style="color:var(--text-muted);margin-top:8px;">Processando dados geoespaciais</div>
            </div>
        `;
        
        // Inicia análise
        try {
            const result = await this.analysisService.analyze(area);
            
            // Mostra resultado
            this.analysisService.renderResult(resultContainer, result, area);
            
            // Atualiza UI
            this._updateUI();
            
            // Notificação
            if (result.status !== 'normal') {
                this._showNotification(
                    `⚠️ Alerta detectado em "${area.nome}"`,
                    `${result.type_label} - Confiança: ${(result.confidence * 100).toFixed(0)}%`,
                    result.severity
                );
            } else {
                this._showNotification(
                    `✅ Análise concluída: "${area.nome}"`,
                    'Nenhuma alteração significativa detectada.',
                    'success'
                );
            }
            
        } catch (e) {
            console.error('Erro na análise:', e);
            resultContainer.innerHTML = `
                <div class="analysis-placeholder" style="color: var(--status-critical);">
                    ❌ Erro ao realizar análise. Tente novamente.
                    <div style="font-size:12px;color:var(--text-muted);margin-top:8px;">${e.message}</div>
                </div>
            `;
            this._showNotification('⚠️ Erro', 'Falha ao executar análise.', 'critical');
        }
    }

    /**
     * Gerencia busca global
     * @param {string} query 
     * @private
     */
    _handleSearch(query) {
        if (!query || query.length < 2) {
            this._showNotification('ℹ️', 'Digite pelo menos 2 caracteres para buscar.', 'info');
            return;
        }
        
        const areas = this.areaService.getAll();
        const results = areas.filter(a => 
            a.nome.toLowerCase().includes(query.toLowerCase()) ||
            (a.descricao && a.descricao.toLowerCase().includes(query.toLowerCase())) ||
            (a.municipality && a.municipality.toLowerCase().includes(query.toLowerCase()))
        );
        
        if (results.length > 0) {
            this._showNotification(
                `🔍 ${results.length} resultado(s) encontrado(s)`,
                results.map(a => a.nome).join(', '),
                'info'
            );
            this.switchView('areas');
            this.areaPanel.render(results);
        } else {
            this._showNotification(
                '🔍 Nenhum resultado',
                `"${query}" não encontrado nas áreas monitoradas.`,
                'info'
            );
        }
    }

    /**
     * Reseta dados de demonstração
     * @private
     */
    _resetData() {
        if (!confirm('Deseja resetar todos os dados e carregar novamente os dados de demonstração?')) return;
        
        this.storage.clearAll();
        this.storage.init();
        this._loadData();
        this._updateUI();
        
        this._showNotification(
            '🔄 Dados resetados',
            'Dados de demonstração carregados com sucesso.',
            'success'
        );
    }

    /**
     * Exporta dados
     * @private
     */
    _exportData() {
        const geojson = this.storage.exportGeoJSON();
        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `eic_export_${new Date().toISOString().slice(0,10)}.geojson`;
        a.click();
        URL.revokeObjectURL(url);
        
        this._showNotification(
            '📥 Dados exportados',
            'GeoJSON exportado com sucesso.',
            'success'
        );
    }

    /**
     * Exporta relatório
     * @private
     */
    _exportReport() {
        const body = document.getElementById('reportBody');
        if (!body) return;
        
        const html = body.innerHTML;
        const fullHtml = this.reportService.exportHTML(html);
        this.reportService.downloadReport(fullHtml);
    }

    /**
     * Gera relatório
     * @private
     */
    _generateReport() {
        const areas = this.areaService.getAll();
        if (areas.length === 0) {
            this._showNotification('⚠️ Aviso', 'Nenhuma área disponível para gerar relatório.', 'medium');
            return;
        }
        
        const modal = document.getElementById('reportModal');
        const body = document.getElementById('reportBody');
        
        if (!modal || !body) return;
        
        // Gera relatório HTML
        const html = this.reportService.generate(areas);
        body.innerHTML = html;
        
        modal.classList.add('open');
    }
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Verifica se todas as dependências estão carregadas
    console.log('🔍 Verificando dependências...');
    console.log('✅ Leaflet:', typeof L !== 'undefined' ? 'OK' : '❌ FALTA');
    console.log('✅ Turf:', typeof turf !== 'undefined' ? 'OK' : '❌ FALTA');
    console.log('✅ Chart:', typeof Chart !== 'undefined' ? 'OK' : '❌ FALTA');
    
    const app = new App();
    app.init();
    
    // Expor globalmente para debugging
    window.app = app;
    
    console.log('✅ App exposto globalmente como window.app');
});