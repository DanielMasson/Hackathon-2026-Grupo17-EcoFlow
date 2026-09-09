/**
 * RASTER PROCESSOR
 * Pipeline de análise NDVI + detecção de mudanças — port do Python para JS puro.
 * Funciona com TypedArrays (Float32Array, Uint16Array) vindos do geotiff.js.
 */

class RasterProcessor {
    constructor() {
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;
        this._initialized = true;
        console.log('[RasterProcessor] Inicializado');
    }

    // ========================================================================
    // 1. NORMALIZAÇÃO DE BANDAS
    // ========================================================================

    /**
     * Normaliza banda bruta do GeoTIFF para float32 [0,1].
     * Trata uint16 (reflectância x10000) e float32 com NaN.
     * Equivalente a real_data._normalizar_banda()
     * @param {TypedArray} data
     * @returns {Float32Array}
     */
    normalizeBand(data) {
        const out = new Float32Array(data.length);
        let maxVal = 0;
        for (let i = 0; i < data.length; i++) {
            const v = data[i];
            if (Number.isNaN(v) || v === undefined) {
                out[i] = 0;
            } else {
                out[i] = v;
                if (v > maxVal) maxVal = v;
            }
        }
        // Se max > 1.5, provavelmente uint16 com reflectância x10000
        if (maxVal > 1.5) {
            for (let i = 0; i < out.length; i++) {
                out[i] = out[i] / 10000.0;
            }
        }
        return out;
    }

    // ========================================================================
    // 2. CÁLCULO DE NDVI
    // ========================================================================

    /**
     * Calcula NDVI pixel a pixel.
     * NDVI = (NIR - RED) / (NIR + RED)
     * Equivalente a ndvi.calcular_ndvi()
     * @param {Float32Array} red
     * @param {Float32Array} nir
     * @returns {Float32Array}
     */
    calcNDVI(red, nir) {
        const len = Math.min(red.length, nir.length);
        const out = new Float32Array(len);
        for (let i = 0; i < len; i++) {
            const n = nir[i];
            const r = red[i];
            const denom = n + r;
            out[i] = denom === 0 ? 0 : (n - r) / denom;
        }
        return out;
    }

    /**
     * Calcula NBR pixel a pixel.
     * NBR = (NIR - SWIR) / (NIR + SWIR)
     * @param {Float32Array} nir
     * @param {Float32Array} swir
     * @returns {Float32Array}
     */
    calcNBR(nir, swir) {
        const len = Math.min(nir.length, swir.length);
        const out = new Float32Array(len);
        for (let i = 0; i < len; i++) {
            const n = nir[i];
            const s = swir[i];
            const denom = n + s;
            out[i] = denom === 0 ? 0 : (n - s) / denom;
        }
        return out;
    }

    // ========================================================================
    // 3. OPERAÇÕES MORFOLÓGICAS (puro JS)
    // ========================================================================

    /**
     * Erosão binária com elemento estruturante 3x3.
     * @param {Uint8Array} binary
     * @param {number} width
     * @param {number} height
     * @returns {Uint8Array}
     */
    erode(binary, width, height) {
        const out = new Uint8Array(width * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let ok = true;
                for (let dy = -1; dy <= 1 && ok; dy++) {
                    for (let dx = -1; dx <= 1 && ok; dx++) {
                        const ny = y + dy, nx = x + dx;
                        if (ny < 0 || ny >= height || nx < 0 || nx >= width) {
                            ok = false;
                        } else if (binary[ny * width + nx] === 0) {
                            ok = false;
                        }
                    }
                }
                out[y * width + x] = ok ? 1 : 0;
            }
        }
        return out;
    }

    /**
     * Dilatação binária com elemento estruturante 3x3.
     * @param {Uint8Array} binary
     * @param {number} width
     * @param {number} height
     * @returns {Uint8Array}
     */
    dilate(binary, width, height) {
        const out = new Uint8Array(width * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let found = false;
                for (let dy = -1; dy <= 1 && !found; dy++) {
                    for (let dx = -1; dx <= 1 && !found; dx++) {
                        const ny = y + dy, nx = x + dx;
                        if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                            if (binary[ny * width + nx] === 1) found = true;
                        }
                    }
                }
                out[y * width + x] = found ? 1 : 0;
            }
        }
        return out;
    }

    /**
     * Abertura morfológica = erosão + dilatação.
     * Remove ruído (pixels isolados) preservando regiões grandes.
     * Equivalente a scipy.ndimage.binary_opening(mask, ones((3,3)))
     * @param {Uint8Array} binary
     * @param {number} width
     * @param {number} height
     * @returns {Uint8Array}
     */
    morphoOpen(binary, width, height) {
        return this.dilate(this.erode(binary, width, height), width, height);
    }

    // ========================================================================
    // 4. COMPONENTES CONECTADOS + PROPRIEDADES DE REGIÃO
    // ========================================================================

    /**
     * Rotulagem de componentes conectados (flood-fill iterativo, 8-conectividade).
     * Equivalente a scipy.ndimage.label + skimage.measure.regionprops
     * @param {Uint8Array} binary
     * @param {number} width
     * @param {number} height
     * @param {Float32Array|null} intensity - imagem de intensidade para calcular média por região
     * @returns {{ labels: Int32Array, numComponents: number, regions: Array }}
     */
    labelRegions(binary, width, height, intensity = null) {
        const labels = new Int32Array(width * height);
        let currentLabel = 0;
        const regions = [];
        const neighbors = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (binary[idx] === 0 || labels[idx] !== 0) continue;

                currentLabel++;
                const stack = [[x, y]];
                let minX = x, maxX = x, minY = y, maxY = y;
                let sumX = 0, sumY = 0, count = 0;
                let sumIntensity = 0;

                while (stack.length > 0) {
                    const [cx, cy] = stack.pop();
                    const ci = cy * width + cx;
                    if (binary[ci] === 0 || labels[ci] !== 0) continue;

                    labels[ci] = currentLabel;
                    count++;
                    sumX += cx;
                    sumY += cy;
                    if (intensity) sumIntensity += intensity[ci];
                    if (cx < minX) minX = cx;
                    if (cx > maxX) maxX = cx;
                    if (cy < minY) minY = cy;
                    if (cy > maxY) maxY = cy;

                    for (const [dx, dy] of neighbors) {
                        const nx = cx + dx, ny = cy + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            stack.push([nx, ny]);
                        }
                    }
                }

                regions.push({
                    id: currentLabel,
                    area: count,
                    bbox: { minX, minY, maxX, maxY },
                    centroid: { x: sumX / count, y: sumY / count },
                    meanIntensity: intensity ? sumIntensity / count : null
                });
            }
        }

        return { labels, numComponents: currentLabel, regions };
    }

    // ========================================================================
    // 5. CONVERSÃO PIXEL → COORDENADA GEOGRÁFICA
    // ========================================================================

    /**
     * Converte pixel (row, col) para lat/lon usando affine transform do GeoTIFF.
     * Equivalente a real_data.pixel_para_coordenada_real()
     * @param {number} row
     * @param {number} col
     * @param {Object} geoKeys - { origin: [lon, lat], resolution: [resX, resY] }
     *        OU array [originLon, originLat, resX, resY]
     * @returns {{ lat: number, lon: number }}
     */
    pixelToGeo(row, col, geoKeys) {
        let originLon, originLat, resX, resY;
        if (Array.isArray(geoKeys)) {
            [originLon, originLat, resX, resY] = geoKeys;
        } else {
            originLon = geoKeys.originLon;
            originLat = geoKeys.originLat;
            resX = geoKeys.resX;
            resY = geoKeys.resY;
        }
        // GeoTIFF: origem é canto superior-esquerdo
        // resY é negativo (Y cresce para baixo em pixels)
        const lon = originLon + col * resX;
        const lat = originLat - row * Math.abs(resY);
        return { lat, lon };
    }

    /**
     * Converte pixel para coordenada usando formato simplificado (demo).
     * Equivalente a detect_changes.pixel_para_coordenada()
     * @param {number} row
     * @param {number} col
     * @param {Object} opts - { originLat, originLon, resolution }
     * @returns {{ lat: number, lon: number }}
     */
    pixelToGeoSimple(row, col, opts = {}) {
        const originLat = opts.originLat || -27.2423;
        const originLon = opts.originLon || -48.6356;
        const resolution = opts.resolution || 0.0001;
        return {
            lat: originLat - (row * resolution),
            lon: originLon + (col * resolution)
        };
    }

    // ========================================================================
    // 6. DETECÇÃO DE MUDANÇAS (pipeline completo)
    // ========================================================================

    /**
     * Pipeline completo de detecção de mudanças.
     * Equivalente a detect_changes.detectar_mudancas()
     * @param {Float32Array} ndviBefore
     * @param {Float32Array} ndviAfter
     * @param {number} width
     * @param {number} height
     * @param {Object} opts - { threshold, minArea, geoKeys }
     * @returns {{ mask: Uint8Array, regions: Array, stats: Object }}
     */
    detectChanges(ndviBefore, ndviAfter, width, height, opts = {}) {
        const threshold = opts.threshold || 0.15;
        const minArea = opts.minArea || 20;
        const geoKeys = opts.geoKeys || null;

        // 1. Diferença: positivo = perda de vegetação
        const diff = new Float32Array(width * height);
        for (let i = 0; i < diff.length; i++) {
            diff[i] = ndviBefore[i] - ndviAfter[i];
        }

        // 2. Limiarização
        const binary = new Uint8Array(width * height);
        for (let i = 0; i < binary.length; i++) {
            binary[i] = diff[i] > threshold ? 1 : 0;
        }

        // 3. Abertura morfológica (remove ruído)
        const cleaned = this.morphoOpen(binary, width, height);

        // 4. Componentes conectados + propriedades
        const { labels, numComponents, regions } = this.labelRegions(cleaned, width, height, diff);

        // 5. Filtra por área mínima e converte coordenadas
        const filtered = regions
            .filter(r => r.area >= minArea)
            .map((r, i) => {
                let center;
                if (geoKeys) {
                    center = this.pixelToGeo(r.centroid.y, r.centroid.x, geoKeys);
                } else {
                    center = this.pixelToGeoSimple(r.centroid.y, r.centroid.x);
                }
                return {
                    id: i + 1,
                    areaPixels: r.area,
                    areaM2: r.area * 100, // Sentinel-2: 10m x 10m = 100m²/pixel
                    areaHa: (r.area * 100) / 10000,
                    centroid: center,
                    bbox: r.bbox,
                    meanNDVIDrop: r.meanIntensity
                };
            });

        // 6. Estatísticas gerais
        const totalChangedPixels = filtered.reduce((s, r) => s + r.areaPixels, 0);
        const totalPixels = width * height;

        return {
            mask: cleaned,
            labels,
            regions: filtered,
            stats: {
                width,
                height,
                threshold,
                minArea,
                totalPixels,
                totalChangedPixels,
                changedPercentage: (totalChangedPixels / totalPixels) * 100,
                numRegions: filtered.length,
                meanNDVIDrop: filtered.length > 0
                    ? filtered.reduce((s, r) => s + r.meanNDVIDrop, 0) / filtered.length
                    : 0
            }
        };
    }

    // ========================================================================
    // 7. ORQUESTRADOR — PROCESSA PAR DE BANDAS
    // ========================================================================

    /**
     * Processa par de bandas (antes/depois) e retorna resultado completo.
     * @param {Object} params
     * @param {Float32Array} params.redBefore - banda B04 antes (normalizada)
     * @param {Float32Array} params.nirBefore - banda B08 antes (normalizada)
     * @param {Float32Array} params.redAfter  - banda B04 depois (normalizada)
     * @param {Float32Array} params.nirAfter  - banda B08 depois (normalizada)
     * @param {number} params.width
     * @param {number} params.height
     * @param {Object|null} params.geoKeys - affine transform para conversão pixel→geo
     * @param {Object} params.options - { threshold, minArea }
     * @returns {Object} resultado completo da análise
     */
    processBands(params) {
        const {
            redBefore, nirBefore,
            redAfter, nirAfter,
            width, height,
            geoKeys = null,
            options = {}
        } = params;

        const threshold = options.threshold || 0.15;
        const minArea = options.minArea || 20;

        // 1. Calcula NDVI antes/depois
        const ndviBefore = this.calcNDVI(redBefore, nirBefore);
        const ndviAfter = this.calcNDVI(redAfter, nirAfter);

        // 2. Estatísticas NDVI
        const ndviBeforeStats = this._arrayStats(ndviBefore);
        const ndviAfterStats = this._arrayStats(ndviAfter);

        // 3. Detecta mudanças
        const detection = this.detectChanges(ndviBefore, ndviAfter, width, height, {
            threshold,
            minArea,
            geoKeys
        });

        // 4. Classifica severidade
        const classification = this._classifyDetection(detection.stats);

        return {
            ndviBefore,
            ndviAfter,
            width,
            height,
            geoKeys,
            ndviBeforeStats,
            ndviAfterStats,
            detection,
            classification
        };
    }

    // ========================================================================
    // 8. CLASSIFICAÇÃO
    // ========================================================================

    /**
     * Classifica resultado da detecção em tipo/severidade.
     * @param {Object} stats - stats do detectChanges
     * @returns {Object} { type, typeLabel, severity, confidence }
     */
    _classifyDetection(stats) {
        const { changedPercentage, numRegions, meanNDVIDrop } = stats;

        if (numRegions === 0 || changedPercentage < 0.1) {
            return {
                type: 'normal',
                typeLabel: 'Normal',
                severity: 'normal',
                confidence: 0.92
            };
        }

        let type, typeLabel, severity, confidence;

        if (meanNDVIDrop > 0.35 && changedPercentage > 2) {
            type = 'possivel_desmatamento';
            typeLabel = 'Possível Desmatamento';
            severity = 'critica';
            confidence = 0.85;
        } else if (meanNDVIDrop > 0.25 && changedPercentage > 1) {
            type = 'possivel_queimada';
            typeLabel = 'Possível Queimada';
            severity = 'alta';
            confidence = 0.78;
        } else if (meanNDVIDrop > 0.15) {
            type = 'alteracao_vegetacao';
            typeLabel = 'Alteração de Vegetação';
            severity = 'media';
            confidence = 0.72;
        } else if (changedPercentage > 0.5) {
            type = 'solo_exposto';
            typeLabel = 'Solo Exposto';
            severity = 'media';
            confidence = 0.65;
        } else {
            type = 'inconclusivo';
            typeLabel = 'Inconclusivo';
            severity: 'normal';
            confidence = 0.45;
        }

        // Ajusta confiança baseado na magnitude
        const magFactor = Math.min(meanNDVIDrop / 0.2, 1.5);
        confidence = Math.min(0.95, confidence * (0.7 + 0.3 * magFactor));

        return {
            type,
            typeLabel,
            severity,
            confidence: Math.round(confidence * 100) / 100
        };
    }

    // ========================================================================
    // 9. UTILITÁRIOS
    // ========================================================================

    /**
     * Calcula estatísticas de um array numérico.
     * @param {TypedArray} arr
     * @returns {{ min, max, mean, std }}
     */
    _arrayStats(arr) {
        let min = Infinity, max = -Infinity, sum = 0, sumSq = 0;
        const len = arr.length;
        for (let i = 0; i < len; i++) {
            const v = arr[i];
            if (v < min) min = v;
            if (v > max) max = v;
            sum += v;
            sumSq += v * v;
        }
        const mean = sum / len;
        const variance = sumSq / len - mean * mean;
        return {
            min: Math.round(min * 1000) / 1000,
            max: Math.round(max * 1000) / 1000,
            mean: Math.round(mean * 1000) / 1000,
            std: Math.round(Math.sqrt(Math.max(0, variance)) * 1000) / 1000
        };
    }

    /**
     * Renderiza array NDVI como imagem Canvas ( colormap RdYlGn ).
     * @param {Float32Array} ndvi
     * @param {number} width
     * @param {number} height
     * @param {number} [canvasWidth=400]
     * @param {number} [canvasHeight=400]
     * @returns {HTMLCanvasElement}
     */
    renderNDVICanvas(ndvi, width, height, canvasWidth = 400, canvasHeight = 400) {
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(canvasWidth, canvasHeight);

        for (let py = 0; py < canvasHeight; py++) {
            for (let px = 0; px < canvasWidth; px++) {
                // Mapeia pixel do canvas para o raster
                const rx = Math.floor((px / canvasWidth) * width);
                const ry = Math.floor((py / canvasHeight) * height);
                const val = ndvi[ry * width + rx] || 0;

                // NDVI [-1, +1] → RGB via colormap RdYlGn
                const rgb = this._ndviToRGB(val);
                const idx = (py * canvasWidth + px) * 4;
                imgData.data[idx] = rgb[0];
                imgData.data[idx + 1] = rgb[1];
                imgData.data[idx + 2] = rgb[2];
                imgData.data[idx + 3] = 255;
            }
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }

    /**
     * Renderiza overlay de mudanças sobre NDVI.
     * @param {Float32Array} ndvi
     * @param {Uint8Array} mask
     * @param {number} width
     * @param {number} height
     * @param {number} [canvasWidth=400]
     * @param {number} [canvasHeight=400]
     * @returns {HTMLCanvasElement}
     */
    renderChangeOverlay(ndvi, mask, width, height, canvasWidth = 400, canvasHeight = 400) {
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(canvasWidth, canvasHeight);

        for (let py = 0; py < canvasHeight; py++) {
            for (let px = 0; px < canvasWidth; px++) {
                const rx = Math.floor((px / canvasWidth) * width);
                const ry = Math.floor((py / canvasHeight) * height);
                const rIdx = ry * width + rx;
                const val = ndvi[rIdx] || 0;
                const changed = mask[rIdx] === 1;

                const rgb = this._ndviToRGB(val);
                const idx = (py * canvasWidth + px) * 4;
                if (changed) {
                    // Vermelho semi-transparente sobre o NDVI
                    imgData.data[idx] = Math.min(255, rgb[0] + 180);
                    imgData.data[idx + 1] = Math.floor(rgb[1] * 0.3);
                    imgData.data[idx + 2] = Math.floor(rgb[2] * 0.3);
                    imgData.data[idx + 3] = 220;
                } else {
                    imgData.data[idx] = rgb[0];
                    imgData.data[idx + 1] = rgb[1];
                    imgData.data[idx + 2] = rgb[2];
                    imgData.data[idx + 3] = 255;
                }
            }
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }

    /**
     * Converte valor NDVI [-1,+1] para RGB [r,g,b] (colormap RdYlGn simplificado).
     * @param {number} val
     * @returns {number[3]}
     * @private
     */
    _ndviToRGB(val) {
        // Clampa para [-1, 1]
        const v = Math.max(-1, Math.min(1, val));
        // Mapeia para [0, 1]
        const t = (v + 1) / 2;

        let r, g, b;
        if (t < 0.25) {
            // Vermelho → Amarelo
            r = 165;
            g = Math.floor(0 + t * 4 * 150);
            b = 0;
        } else if (t < 0.5) {
            // Amarelo → Verde claro
            r = Math.floor(165 - (t - 0.25) * 4 * 100);
            g = Math.floor(150 + (t - 0.25) * 4 * 50);
            b = 0;
        } else if (t < 0.75) {
            // Verde claro → Verde escuro
            r = Math.floor(65 - (t - 0.5) * 4 * 40);
            g = Math.floor(200 - (t - 0.5) * 4 * 50);
            b = Math.floor((t - 0.5) * 4 * 30);
        } else {
            // Verde escuro → Verde muito escuro
            r = Math.floor(25 + (t - 0.75) * 4 * 10);
            g = Math.floor(150 - (t - 0.75) * 4 * 80);
            b = Math.floor(30 - (t - 0.75) * 4 * 20);
        }

        return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))];
    }
}

window.RasterProcessor = RasterProcessor;
