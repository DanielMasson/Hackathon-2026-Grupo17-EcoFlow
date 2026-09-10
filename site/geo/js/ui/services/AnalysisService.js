/**
 * ANALYSIS SERVICE
 * Motor de análise de alterações ambientais
 *
 * CORREÇÕES APLICADAS:
 * 1. Os serviços (areaService, alertService, auditService, copernicusService,
 *    rasterProcessor) deixaram de ser capturados uma única vez em init()
 *    (quando window.app podia ainda não existir/estar completo) e passaram
 *    a ser resolvidos sob demanda via getters que leem window.app no
 *    momento do uso. Isso corrige o bug em que o pipeline REAL nunca era
 *    executado porque copernicusService/rasterProcessor ficavam null.
 * 2. Removida a duplicação de _demoAnalysis()/_generateRandomChange()
 *    (a classe tinha duas definições — a segunda sobrescrevia a primeira
 *    silenciosamente, deixando código morto).
 * 3. Quando as bandas antes/depois têm dimensões diferentes, agora são
 *    de fato recortadas (via RasterProcessor.cropBandTopLeft), em vez de
 *    só reescrever os metadados width/height (o que desalinhava a
 *    indexação pixel a pixel).
 * 4. A AOI (bbox da área) é propagada para loadPairFromSTAC(), permitindo
 *    o recorte por janela de pixels em vez de baixar a cena inteira.
 */

class AnalysisService {
    constructor() {
        this._initialized = false;
        this.analysisInProgress = false;
    }

    /**
     * Inicializa o serviço. Não captura mais referências de window.app aqui
     * — elas são resolvidas sob demanda pelos getters abaixo, porque no
     * momento em que init() roda (dentro de App.init()) nem todos os
     * serviços podem já ter sido criados/expostos.
     */
    init() {
        if (this._initialized) return;
        this._initialized = true;
        console.log('[AnalysisService] Inicializado');
    }

    // ------------------------------------------------------------------
    // Getters de acesso tardio (lazy) aos serviços globais
    // ------------------------------------------------------------------
    get areaService() { return window.app?.areaService || null; }
    get alertService() { return window.app?.alertService || null; }
    get auditService() { return window.app?.auditService || null; }
    get copernicusService() { return window.app?.copernicusService || null; }
    get rasterProcessor() { return window.app?.rasterProcessor || null; }

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
            } else {
                console.warn('[AnalysisService] areaService indisponível — resultado não persistido diretamente (a UI ainda deve refletir via _updateUI()).');
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

            // Atualiza imagens após análise
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
        // Se for modo DEMO, usa dados simulados baseados no status da área
        if (APP_CONFIG.MODE === 'DEMO') {
            return this._demoAnalysis(area);
        }

        // Modo REAL - pipeline Copernicus + RasterProcessor
        return this._realAnalysis(area, options);
    }

    /**
     * Análise real usando bandas Sentinel-2 via Copernicus.
     * @param {Object} area
     * @param {Object} options - { files: File[], threshold, maxDateRange }
     * @returns {Promise<Object>}
     * @private
     */
    async _realAnalysis(area, options = {}) {
        const copernicusService = this.copernicusService;
        const rasterProcessor = this.rasterProcessor;

        if (!copernicusService || !rasterProcessor) {
            console.warn('[AnalysisService] CopernicusService/RasterProcessor não inicializados. Usando demo.');
            return this._demoAnalysis(area);
        }

        // Determina fonte de dados: upload local ou busca STAC
        const files = options.files || window.app?._pendingBandFiles || null;
        let before, after;

        if (files && files.length >= 2) {
            // Modo upload local
            console.log('[AnalysisService] Usando bandas locais (' + files.length + ' arquivos)');
            const pair = await copernicusService.loadPairFromFiles(files);
            before = pair.before;
            after = pair.after || pair.before; // Se só tem 1 cena, compara consigo mesma
        } else if (area.geojson) {
            // Modo STAC: busca imagens pela AOI
            console.log('[AnalysisService] Buscando imagens no Copernicus...');
            const bbox = copernicusService.geojsonToBBox(area.geojson);
            const now = new Date();
            const startDate = options.startDate || new Date(now - 60 * 86400000).toISOString().slice(0, 10);
            const endDate = options.endDate || now.toISOString().slice(0, 10);

            const searchResult = await copernicusService.search({
                bbox,
                startDate,
                endDate,
                maxCloud: options.maxCloud || 20
            });

            if (searchResult.items.length < 2) {
                console.warn('[AnalysisService] Menos de 2 cenas encontradas, usando modo demo.');
                return this._demoAnalysis(area);
            }

            // Seleciona antes (menor data) e depois (maior data)
            const sorted = searchResult.items.sort((a, b) => new Date(a.date) - new Date(b.date));
            const stacBefore = sorted[0];
            const stacAfter = sorted[sorted.length - 1];

            console.log(`[AnalysisService] Antes: ${stacBefore.date} | Depois: ${stacAfter.date}`);

            // Carrega bandas em paralelo, recortando pela AOI (bbox) para não
            // baixar a cena Sentinel-2 inteira.
            const [beforeBands, afterBands] = await Promise.all([
                copernicusService.loadPairFromSTAC(stacBefore, bbox),
                copernicusService.loadPairFromSTAC(stacAfter, bbox)
            ]);

            before = beforeBands;
            after = afterBands;
        } else {
            console.warn('[AnalysisService] Área sem GeoJSON e sem arquivos. Usando demo.');
            return this._demoAnalysis(area);
        }

        // Valida dimensões — CORREÇÃO: agora recorta de fato os arrays de
        // dados (respeitando o stride original), em vez de só reescrever
        // width/height, o que antes desalinhava a indexação pixel a pixel
        // e comparava pixels de lugares diferentes da cena.
        if (before.width !== after.width || before.height !== after.height) {
            console.warn('[AnalysisService] Dimensões diferentes antes/depois. Recortando para a menor área comum.');
            const minW = Math.min(before.width, after.width);
            const minH = Math.min(before.height, after.height);

            before = {
                ...before,
                red: rasterProcessor.cropBandTopLeft(before.red, before.width, before.height, minW, minH),
                nir: rasterProcessor.cropBandTopLeft(before.nir, before.width, before.height, minW, minH),
                width: minW,
                height: minH
            };
            after = {
                ...after,
                red: rasterProcessor.cropBandTopLeft(after.red, after.width, after.height, minW, minH),
                nir: rasterProcessor.cropBandTopLeft(after.nir, after.width, after.height, minW, minH),
                width: minW,
                height: minH
            };
        }

        // Processa pipeline NDVI + detecção
        const threshold = options.threshold || APP_CONFIG.ANALYSIS.DETECTION.THRESHOLD;
        const minArea = options.minArea || APP_CONFIG.ANALYSIS.DETECTION.MIN_AREA_PIXELS;

        const pipelineResult = rasterProcessor.processBands({
            redBefore: before.red,
            nirBefore: before.nir,
            redAfter: after.red,
            nirAfter: after.nir,
            width: before.width,
            height: before.height,
            geoKeys: before.geoKeys,
            options: { threshold, minArea }
        });

        // Renderiza NDVI como canvas para UI
        let ndviBeforeImage = null, ndviAfterImage = null, changeOverlayImage = null;
        try {
            ndviBeforeImage = rasterProcessor.renderNDVICanvas(
                pipelineResult.ndviBefore, before.width, before.height
            ).toDataURL('image/png');
            ndviAfterImage = rasterProcessor.renderNDVICanvas(
                pipelineResult.ndviAfter, before.width, before.height
            ).toDataURL('image/png');
            changeOverlayImage = rasterProcessor.renderChangeOverlay(
                pipelineResult.ndviAfter, pipelineResult.detection.mask, before.width, before.height
            ).toDataURL('image/png');
        } catch (e) {
            console.warn('[AnalysisService] Erro ao renderizar NDVI:', e);
        }

        // Monta resultado no formato esperado pelo sistema
        const classif = pipelineResult.classification;
        const detection = pipelineResult.detection;

        // Pega a maior região detectada. CORREÇÃO: detection.regions agora
        // já vem ordenada por área decrescente (ver RasterProcessor.detectChanges),
        // então regions[0] é de fato a maior alteração, não a primeira
        // encontrada na varredura raster.
        const mainRegion = detection.regions.length > 0 ? detection.regions[0] : null;

        const result = {
            status: classif.type === 'normal' ? 'normal' : 'alteracao',
            type: classif.type,
            type_label: classif.typeLabel,
            severity: classif.severity,
            confidence: classif.confidence,
            affectedAreaHa: mainRegion ? mainRegion.areaHa : 0,
            affectedPercentage: detection.stats.changedPercentage,
            previousDate: before.date || options.startDate || null,
            currentDate: after.date || options.endDate || null,
            indices: {
                ndviBefore: pipelineResult.ndviBeforeStats.mean,
                ndviAfter: pipelineResult.ndviAfterStats.mean,
                ndviChange: pipelineResult.ndviAfterStats.mean - pipelineResult.ndviBeforeStats.mean,
                nbrBefore: null,
                nbrAfter: null,
                nbrChange: null
            },
            // Dados extras do pipeline real
            pipeline: {
                stats: detection.stats,
                regions: detection.regions,
                ndviBeforeStats: pipelineResult.ndviBeforeStats,
                ndviAfterStats: pipelineResult.ndviAfterStats
            },
            images: {
                ndviBefore: ndviBeforeImage,
                ndviAfter: ndviAfterImage,
                changeOverlay: changeOverlayImage
            },
            isDemo: false
        };

        return result;
    }

    /**
     * Análise de demonstração (dados simulados).
     * @param {Object} area
     * @returns {Object}
     * @private
     */
    _demoAnalysis(area) {
        const currentStatus = area.analysis?.status || 'normal';
        const shouldChange = Math.random() > 0.6;

        let result;

        if (currentStatus === 'normal' && shouldChange) {
            result = this._generateRandomChange();
        } else if (currentStatus === 'alteracao' && shouldChange) {
            result = this._generateRandomChange();
        } else {
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

                ${result.images ? `
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
                    <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;">
                        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">NDVI Antes</div>
                        <img src="${result.images.ndviBefore}" style="width:100%;border-radius:6px;" alt="NDVI Antes">
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;text-align:center;">
                            Média: ${result.pipeline?.ndviBeforeStats?.mean?.toFixed(3) || '--'}
                        </div>
                    </div>
                    <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;">
                        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">NDVI Depois</div>
                        <img src="${result.images.ndviAfter}" style="width:100%;border-radius:6px;" alt="NDVI Depois">
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;text-align:center;">
                            Média: ${result.pipeline?.ndviAfterStats?.mean?.toFixed(3) || '--'}
                        </div>
                    </div>
                    <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;">
                        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Áreas Detectadas</div>
                        <img src="${result.images.changeOverlay}" style="width:100%;border-radius:6px;" alt="Mudanças">
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;text-align:center;">
                            ${result.pipeline?.stats?.numRegions || 0} região(ões)
                        </div>
                    </div>
                </div>
                ` : ''}

                ${result.pipeline && !result.isDemo ? `
                <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;">
                    <div style="font-size:12px;font-weight:600;margin-bottom:8px;">Estatísticas do Pipeline</div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;font-size:12px;">
                        <div>Dimensão: ${result.pipeline.stats.width}x${result.pipeline.stats.height}</div>
                        <div>Total pixels: ${result.pipeline.stats.totalPixels.toLocaleString()}</div>
                        <div>Alterados: ${result.pipeline.stats.totalChangedPixels.toLocaleString()}</div>
                        <div>% Alterado: ${result.pipeline.stats.changedPercentage.toFixed(3)}%</div>
                        <div>Regiões: ${result.pipeline.stats.numRegions}</div>
                        <div>Threshold: ${result.pipeline.stats.threshold}</div>
                    </div>
                </div>
                ` : ''}

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
            severity,
            label,
            confidence: Math.round(confidence * 100) / 100
        };
    }
}

// Exportar para uso global
window.AnalysisService = AnalysisService;
