/**
 * COPERNICUS SERVICE
 * Integração com Copernicus Data Space Ecosystem (CDSE).
 * Busca Sentinel-2 L2A via STAC + download de bandas B04/B08 via geotiff.js.
 */

class CopernicusService {
    constructor() {
        this._initialized = false;
        this.config = {
            stacUrl: 'https://stac.dataspace.copernicus.eu/v1/search',
            collection: 'sentinel-2-l2a',
            maxCloudCoverage: 20,
            bandMap: { red: 'B04', nir: 'B08' }
        };
        this.rasterProcessor = null;
    }

    init() {
        if (this._initialized) return;
        this.rasterProcessor = new RasterProcessor();
        this.rasterProcessor.init();
        this._initialized = true;
        console.log('[CopernicusService] Inicializado');
    }

    // ========================================================================
    // 1. BUSCA DE IMAGENS VIA STAC
    // ========================================================================

    /**
     * Busca imagens Sentinel-2 L2A disponíveis para uma AOI e período.
     * @param {Object} params
     * @param {number[]} params.bbox - [lonMin, latMin, lonMax, latMax] (WGS84)
     * @param {string} params.startDate - 'YYYY-MM-DD'
     * @param {string} params.endDate - 'YYYY-MM-DD'
     * @param {number} [params.maxCloud=20] - cobertura máxima de nuvens (%)
     * @param {number} [params.limit=10] - máximo de resultados
     * @returns {Promise<Object>} { items[], count }
     */
    async search(params) {
        const { bbox, startDate, endDate, maxCloud, limit } = params;
        const cloudLimit = maxCloud || this.config.maxCloudCoverage;
        const maxResults = limit || 10;

        const startISO = startDate + 'T00:00:00Z';
        const endISO = endDate + 'T23:59:59Z';

        const body = {
            collections: [this.config.collection],
            datetime: `${startISO}/${endISO}`,
            bbox: bbox,
            limit: maxResults,
            filter: {
                op: 'and',
                args: [
                    { op: '<=', args: [{ property: 'eo:cloud_cover' }, cloudLimit] }
                ]
            }
        };

        console.log(`[CopernicusService] Buscando imagens: ${startDate} → ${endDate}, bbox=${bbox}, cloud≤${cloudLimit}%`);

        try {
            const resp = await fetch(this.config.stacUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!resp.ok) {
                throw new Error(`STAC search falhou: ${resp.status} ${resp.statusText}`);
            }

            const data = await resp.json();
            const items = (data.features || []).map(item => this._parseSTACItem(item));

            console.log(`[CopernicusService] ${items.length} cena(s) encontrada(s)`);

            return { items, count: items.length };
        } catch (err) {
            console.error('[CopernicusService] Erro na busca STAC:', err);
            throw err;
        }
    }

    /**
     * Parseia um item STAC em formato amigável.
     * @param {Object} item
     * @returns {Object}
     * @private
     */
    _parseSTACItem(item) {
        const props = item.properties || {};
        const assets = item.assets || {};
        return {
            id: item.id,
            datetime: props.datetime,
            date: props.datetime ? props.datetime.slice(0, 10) : null,
            cloudCover: props['eo:cloud_cover'] ?? null,
            platform: props.platform ?? 'sentinel-2',
            constellation: props.constellation ?? 'sentinel-2',
            gsd: props.gsd ?? 10,
            bands: Object.keys(assets).filter(k => /^B\d/.test(k)),
            assets: {
                B04: assets.B04 ? { href: assets.B04.href, title: assets.B04.title } : null,
                B08: assets.B08 ? { href: assets.B08.href, title: assets.B08.title } : null
            },
            raw: item
        };
    }

    // ========================================================================
    // 2. DOWNLOAD DE BANDAS
    // ========================================================================

    /**
     * Carrega uma banda GeoTIFF a partir de uma URL (S3 do Copernicus).
     * Usa geotiff.js: fromUrl() → readRasters().
     * @param {string} url
     * @param {Object|null} window - [left, top, right, bottom] em pixels (opcional, recorta)
     * @returns {Promise<{ data: Float32Array, width: number, height: number, geoKeys: Object }>}
     */
    async loadBandFromUrl(url, window = null) {
        if (typeof GeoTIFF === 'undefined') {
            throw new Error('geotiff.js não está carregado. Adicione o CDN ao HTML.');
        }

        console.log(`[CopernicusService] Carregando banda de: ${url.substring(0, 80)}...`);

        const tiff = await GeoTIFF.fromUrl(url);
        const image = await tiff.getImage();

        const width = image.getWidth();
        const height = image.getHeight();

        // Extrai affine transform
        const geoKeys = this._extractGeoKeys(image);

        // Lê raster
        const readOpts = {};
        if (window) readOpts.window = window;
        const [rasterData] = await image.readRasters(readOpts);

        // Normaliza
        const data = this.rasterProcessor.normalizeBand(rasterData);

        const readWidth = window ? window[2] - window[0] : width;
        const readHeight = window ? window[3] - window[1] : height;

        console.log(`[CopernicusService] Banda carregada: ${readWidth}x${readHeight}`);

        return {
            data,
            width: readWidth,
            height: readHeight,
            fullWidth: width,
            fullHeight: height,
            geoKeys
        };
    }

    /**
     * Carrega uma banda a partir de um arquivo local (upload).
     * @param {File} file
     * @returns {Promise<{ data: Float32Array, width: number, height: number, geoKeys: Object }>}
     */
    async loadBandFromFile(file) {
        if (typeof GeoTIFF === 'undefined') {
            throw new Error('geotiff.js não está carregado. Adicione o CDN ao HTML.');
        }

        console.log(`[CopernicusService] Carregando arquivo local: ${file.name}`);

        const tiff = await GeoTIFF.fromBlob(file);
        const image = await tiff.getImage();

        const width = image.getWidth();
        const height = image.getHeight();
        const geoKeys = this._extractGeoKeys(image);

        const [rasterData] = await image.readRasters();
        const data = this.rasterProcessor.normalizeBand(rasterData);

        console.log(`[CopernicusService] Arquivo carregado: ${width}x${height}`);

        return { data, width, height, geoKeys };
    }

    /**
     * Carrega par de bandas B04+B08 de um item STAC.
     * @param {Object} stacItem - item parseado do STAC
     * @returns {Promise<{ red: Float32Array, nir: Float32Array, width: number, height: number, geoKeys: Object }>}
     */
    async loadPairFromSTAC(stacItem) {
        const redUrl = stacItem.assets.B04?.href;
        const nirUrl = stacItem.assets.B08?.href;

        if (!redUrl || !nirUrl) {
            throw new Error(`Item STAC ${stacItem.id} não possui B04/B08`);
        }

        const [redResult, nirResult] = await Promise.all([
            this.loadBandFromUrl(redUrl),
            this.loadBandFromUrl(nirUrl)
        ]);

        // Valida dimensões
        if (redResult.width !== nirResult.width || redResult.height !== nirResult.height) {
            throw new Error(
                `B04 (${redResult.width}x${redResult.height}) e B08 (${nirResult.width}x${nirResult.height}) têm tamanhos diferentes.`
            );
        }

        return {
            red: redResult.data,
            nir: nirResult.data,
            width: redResult.width,
            height: redResult.height,
            geoKeys: redResult.geoKeys
        };
    }

    /**
     * Carrega pares de bandas de arquivos locais.
     * Aceita 2 arquivos (B04+B08 da mesma cena) ou 4 arquivos (B04/B08 antes + B04/B08 depois).
     * @param {File[]} files
     * @returns {Promise<Object>} { before: {red,nir,w,h,gk}, after: {red,nir,w,h,gk} }
     */
    async loadPairFromFiles(files) {
        if (files.length === 2) {
            // 2 arquivos: B04 + B08 (mesma cena — compara com si mesma como "antes/depois")
            const redResult = await this.loadBandFromFile(files[0]);
            const nirResult = await this.loadBandFromFile(files[1]);
            if (redResult.width !== nirResult.width || redResult.height !== nirResult.height) {
                throw new Error('B04 e B08 têm tamanhos diferentes.');
            }
            const pair = {
                red: redResult.data,
                nir: nirResult.data,
                width: redResult.width,
                height: redResult.height,
                geoKeys: redResult.geoKeys
            };
            return { before: pair, after: null };

        } else if (files.length === 4) {
            // 4 arquivos: B04 antes, B08 antes, B04 depois, B08 depois
            const redBefore = await this.loadBandFromFile(files[0]);
            const nirBefore = await this.loadBandFromFile(files[1]);
            const redAfter = await this.loadBandFromFile(files[2]);
            const nirAfter = await this.loadBandFromFile(files[3]);

            if (redBefore.width !== nirBefore.width || redBefore.height !== nirBefore.height) {
                throw new Error('Bandas antes (B04/B08) têm tamanhos diferentes.');
            }
            if (redAfter.width !== nirAfter.width || redAfter.height !== nirAfter.height) {
                throw new Error('Bandas depois (B04/B08) têm tamanhos diferentes.');
            }

            return {
                before: {
                    red: redBefore.data, nir: nirBefore.data,
                    width: redBefore.width, height: redBefore.height,
                    geoKeys: redBefore.geoKeys
                },
                after: {
                    red: redAfter.data, nir: nirAfter.data,
                    width: redAfter.width, height: redAfter.height,
                    geoKeys: redAfter.geoKeys
                }
            };
        } else {
            throw new Error('Selecione 2 arquivos (B04+B08) ou 4 arquivos (B04/B08 antes + B04/B08 depois).');
        }
    }

    // ========================================================================
    // 3. GE KEYS / AFFINE TRANSFORM
    // ========================================================================

    /**
     * Extrai affine transform (origin + resolution) de uma imagem GeoTIFF.
     * @param {GeoTIFFImage} image
     * @returns {Object}
     * @private
     */
    _extractGeoKeys(image) {
        try {
            const origin = image.getOrigin();        // [lon, lat]
            const resolution = image.getResolution(); // [resX, resY]
            if (origin && resolution) {
                return {
                    originLon: origin[0],
                    originLat: origin[1],
                    resX: resolution[0],
                    resY: resolution[1]
                };
            }
        } catch (e) {
            // fallback
        }

        // Tenta extrair de ModelPixelScale + ModelTiepoint
        try {
            const pixelScale = image.fileDirectory?.getValue?.('ModelPixelScale');
            const tiepoint = image.fileDirectory?.getValue?.('ModelTiepoint');
            if (pixelScale && tiepoint) {
                return {
                    originLon: tiepoint[3],
                    originLat: tiepoint[4],
                    resX: pixelScale[0],
                    resY: pixelScale[1]
                };
            }
        } catch (e) {
            // fallback
        }

        return null;
    }

    // ========================================================================
    // 4. UTILITÁRIOS
    // ========================================================================

    /**
     * Calcula bounding box WGS84 de um GeoJSON polygon.
     * @param {Object} geojson
     * @returns {number[]} [lonMin, latMin, lonMax, latMax]
     */
    geojsonToBBox(geojson) {
        if (typeof turf !== 'undefined' && turf.bbox) {
            return turf.bbox(geojson);
        }
        // Fallback manual
        const coords = geojson.geometry?.coordinates?.[0] || geojson.coordinates?.[0] || [];
        let lonMin = Infinity, latMin = Infinity, lonMax = -Infinity, latMax = -Infinity;
        for (const [lon, lat] of coords) {
            if (lon < lonMin) lonMin = lon;
            if (lon > lonMax) lonMax = lon;
            if (lat < latMin) latMin = lat;
            if (lat > latMax) latMax = lat;
        }
        return [lonMin, latMin, lonMax, latMax];
    }

    /**
     * Lista bandas disponíveis em um item STAC.
     * @param {Object} stacItem
     * @returns {string[]}
     */
    listBands(stacItem) {
        return Object.keys(stacItem.raw?.assets || {}).filter(k => /^B\d/.test(k)).sort();
    }
}

window.CopernicusService = CopernicusService;
