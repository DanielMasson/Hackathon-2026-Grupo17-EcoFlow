/**
 * IMAGE SERVICE
 * Gerencia imagens simuladas para comparação antes/depois
 */

class ImageService {
    constructor() {
        this._initialized = false;
        this.images = {};
    }

    /**
     * Inicializa o serviço
     */
    init() {
        if (this._initialized) return;
        this._generateDemoImages();
        this._initialized = true;
        console.log('[ImageService] Inicializado com ' + Object.keys(this.images).length + ' imagens');
    }

    /**
     * Gera imagens de demonstração para cada área
     * @private
     */
    _generateDemoImages() {
        // Imagens base - cada área terá um par de imagens (antes/depois)
        const areas = window.app?.areaService?.getAll() || [];
        
        areas.forEach(area => {
            const areaId = area.id;
            const status = area.analysis?.status || 'normal';
            
            // Gera imagens diferentes baseado no status
            if (status === 'alteracao') {
                // Área com alteração - imagens diferentes
                this.images[areaId] = {
                    before: this._generateImage(area, 'before', 'preserved'),
                    after: this._generateImage(area, 'after', 'degraded'),
                    hasChange: true,
                    changeType: area.analysis?.type || 'possivel_desmatamento'
                };
            } else {
                // Área normal - imagens similares
                this.images[areaId] = {
                    before: this._generateImage(area, 'before', 'preserved'),
                    after: this._generateImage(area, 'after', 'preserved'),
                    hasChange: false,
                    changeType: 'normal'
                };
            }
        });

        // Adiciona imagens para áreas que não existem ainda (fallback)
        this.images['default'] = {
            before: this._generateDefaultImage('before'),
            after: this._generateDefaultImage('after'),
            hasChange: false,
            changeType: 'normal'
        };
    }

    /**
     * Gera uma imagem simulada baseada em parâmetros
     * @param {Object} area 
     * @param {string} period 
     * @param {string} condition 
     * @returns {Object}
     * @private
     */
    _generateImage(area, period, condition) {
        const width = 400;
        const height = 400;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Fundo base
        const gradient = ctx.createRadialGradient(
            width * 0.3, height * 0.3, 0,
            width * 0.5, height * 0.5, width * 0.7
        );

        if (condition === 'preserved') {
            // Vegetação preservada - tons de verde
            gradient.addColorStop(0, '#2d5a27');
            gradient.addColorStop(0.3, '#3d7a37');
            gradient.addColorStop(0.6, '#4a8a44');
            gradient.addColorStop(0.8, '#2d5a27');
            gradient.addColorStop(1, '#1a3a17');
        } else if (condition === 'degraded') {
            // Área degradada - tons de marrom/amarelo
            gradient.addColorStop(0, '#8a6e4b');
            gradient.addColorStop(0.3, '#a08060');
            gradient.addColorStop(0.6, '#8a7a5a');
            gradient.addColorStop(0.8, '#6a5a3a');
            gradient.addColorStop(1, '#4a3a2a');
        } else {
            // Padrão
            gradient.addColorStop(0, '#3a6a3a');
            gradient.addColorStop(0.5, '#5a8a5a');
            gradient.addColorStop(1, '#2a4a2a');
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Adiciona textura de vegetação
        this._addVegetationTexture(ctx, width, height, condition);

        // Adiciona padrão de área (simula AOI)
        this._addAOIPattern(ctx, width, height, condition, area);

        // Adiciona grid de referência
        this._addGrid(ctx, width, height);

        // Adiciona informações
        const date = new Date();
        if (period === 'before') {
            date.setDate(date.getDate() - 10 - Math.floor(Math.random() * 20));
        } else {
            date.setDate(date.getDate() - Math.floor(Math.random() * 5));
        }

        return {
            dataUrl: canvas.toDataURL('image/png'),
            width: width,
            height: height,
            date: date.toISOString(),
            condition: condition,
            period: period,
            areaName: area?.nome || 'Área'
        };
    }

    /**
     * Adiciona textura de vegetação
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} width 
     * @param {number} height 
     * @param {string} condition 
     * @private
     */
    _addVegetationTexture(ctx, width, height, condition) {
        const density = condition === 'preserved' ? 0.3 : 0.1;
        const colors = condition === 'preserved' 
            ? ['#3d7a37', '#4a8a44', '#5a9a54', '#2d5a27']
            : ['#8a7a5a', '#9a8a6a', '#7a6a4a'];

        for (let i = 0; i < 2000; i++) {
            if (Math.random() > density) continue;
            
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = 2 + Math.random() * 4;
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.3 + Math.random() * 0.4;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Árvores
        for (let i = 0; i < (condition === 'preserved' ? 30 : 5); i++) {
            const x = 50 + Math.random() * (width - 100);
            const y = 50 + Math.random() * (height - 100);
            const size = 8 + Math.random() * 15;
            
            // Tronco
            ctx.fillStyle = '#4a3a2a';
            ctx.fillRect(x - 1, y + size * 0.2, 3, size * 0.5);
            
            // Copa
            ctx.fillStyle = condition === 'preserved' ? '#3d7a37' : '#7a6a4a';
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    /**
     * Adiciona padrão de AOI
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} width 
     * @param {number} height 
     * @param {string} condition 
     * @param {Object} area 
     * @private
     */
    _addAOIPattern(ctx, width, height, condition, area) {
        // Centro da área
        const cx = width * 0.5;
        const cy = height * 0.5;
        
        // Polígono irregular
        const points = [];
        const numPoints = 6 + Math.floor(Math.random() * 4);
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2 + Math.random() * 0.3;
            const radius = 80 + Math.random() * 60;
            points.push({
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius
            });
        }

        // Desenha contorno
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();

        // Preenchimento
        ctx.fillStyle = condition === 'preserved' 
            ? 'rgba(0, 230, 118, 0.15)' 
            : 'rgba(255, 59, 59, 0.2)';
        ctx.fill();
        
        // Borda
        ctx.strokeStyle = condition === 'preserved' ? '#00e676' : '#ff3b3b';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Texto no centro
        ctx.fillStyle = condition === 'preserved' ? '#00e676' : '#ff8c00';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(area?.nome || 'AOI', cx, cy);
    }

    /**
     * Adiciona grid de referência
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} width 
     * @param {number} height 
     * @private
     */
    _addGrid(ctx, width, height) {
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 0.5;
        
        for (let x = 0; x <= width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Borda
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, width, height);
    }

    /**
     * Gera imagem padrão
     * @param {string} period 
     * @returns {Object}
     * @private
     */
    _generateDefaultImage(period) {
        const width = 400;
        const height = 400;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#2a4a3a');
        gradient.addColorStop(0.5, '#3a6a4a');
        gradient.addColorStop(1, '#2a4a3a');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        this._addVegetationTexture(ctx, width, height, 'preserved');
        this._addGrid(ctx, width, height);

        const date = new Date();
        if (period === 'before') {
            date.setDate(date.getDate() - 15);
        } else {
            date.setDate(date.getDate() - 1);
        }

        return {
            dataUrl: canvas.toDataURL('image/png'),
            width: width,
            height: height,
            date: date.toISOString(),
            condition: 'preserved',
            period: period,
            areaName: 'Área'
        };
    }

    /**
     * Obtém imagens de uma área
     * @param {string} areaId 
     * @returns {Object|null}
     */
    getImages(areaId) {
        if (this.images[areaId]) {
            return this.images[areaId];
        }
        return this.images['default'] || null;
    }

    /**
     * Gera imagens para uma nova área
     * @param {Object} area 
     */
    generateForArea(area) {
        if (!area || !area.id) return;
        
        this.images[area.id] = {
            before: this._generateImage(area, 'before', 'preserved'),
            after: this._generateImage(area, 'after', 'preserved'),
            hasChange: false,
            changeType: 'normal'
        };
    }

    /**
     * Atualiza imagens após análise
     * @param {string} areaId
     * @param {Object} analysisResult
     */
    updateAfterAnalysis(areaId, analysisResult) {
        if (!this.images[areaId]) return;

        const area = window.app?.areaService?.get(areaId);
        if (!area) return;

        // Se a análise veio do pipeline real, usa as imagens NDVI
        if (!analysisResult.isDemo && analysisResult.images) {
            this.images[areaId] = {
                before: {
                    dataUrl: analysisResult.images.ndviBefore || this._generateImage(area, 'before', 'preserved').dataUrl,
                    width: 400, height: 400,
                    date: analysisResult.previousDate || new Date().toISOString(),
                    condition: 'preserved', period: 'before',
                    areaName: area.nome, isRealNDVI: !!analysisResult.images.ndviBefore
                },
                after: {
                    dataUrl: analysisResult.images.ndviAfter || this._generateImage(area, 'after', 'preserved').dataUrl,
                    width: 400, height: 400,
                    date: analysisResult.currentDate || new Date().toISOString(),
                    condition: analysisResult.status === 'alteracao' ? 'degraded' : 'preserved',
                    period: 'after', areaName: area.nome,
                    isRealNDVI: !!analysisResult.images.ndviAfter
                },
                changeOverlay: analysisResult.images.changeOverlay || null,
                hasChange: analysisResult.status === 'alteracao',
                changeType: analysisResult.type || 'normal',
                isReal: !analysisResult.isDemo
            };
            console.log(`[ImageService] Imagens NDVI reais carregadas para "${area.nome}"`);
        } else if (analysisResult.status === 'alteracao') {
            this.images[areaId].after = this._generateImage(area, 'after', 'degraded');
            this.images[areaId].hasChange = true;
            this.images[areaId].changeType = analysisResult.type;
        } else {
            this.images[areaId].after = this._generateImage(area, 'after', 'preserved');
            this.images[areaId].hasChange = false;
        }
    }
}

// Exportar para uso global
window.ImageService = ImageService;