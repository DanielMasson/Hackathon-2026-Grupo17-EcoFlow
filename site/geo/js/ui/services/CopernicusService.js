/**
 * COPERNICUS SERVICE
 * Integração com Copernicus Data Space Ecosystem (CDSE).
 * Busca Sentinel-2 L2A via STAC + download de bandas B04/B08 via geotiff.js.
 *
 * CORREÇÕES APLICADAS:
 * 1. Autenticação: adiciona suporte a token OAuth2 (client_credentials) para
 *    endpoints do CDSE que exigem Bearer token no download dos assets.
 * 2. Janela de recorte por AOI: loadPairFromSTAC agora aceita um bbox em
 *    WGS84 e converte para uma janela de pixels antes de ler o raster —
 *    evita baixar a cena Sentinel-2 inteira (~10980x10980 px) para AOIs
 *    pequenas, o que podia travar o navegador por consumo de memória.
 * 3. EPSG: extrai o código EPSG do GeoTIFF (via geoKeys) e o propaga para
 *    RasterProcessor.pixelToGeo(), que agora sabe reprojetar corretamente.
 * 4. Aviso de formato: detecta URLs terminadas em .jp2 (JPEG2000), que o
 *    geotiff.js NÃO consegue decodificar, e lança um erro claro em vez de
 *    falhar silenciosamente / cair no modo demo sem explicação.
 * 5. Busca de assets mais flexível: alguns catálogos STAC do CDSE expõem
 *    as bandas com sufixos de resolução (ex.: "B04_10m") em vez do nome
 *    puro "B04". _parseSTACItem agora procura por variações comuns.
 */

class CopernicusService {
    constructor() {
        this._initialized = false;
        this.config = {
            stacUrl: 'https://stac.dataspace.copernicus.eu/v1/search',
            collection: 'sentinel-2-l2a',
            maxCloudCoverage: 20,
            bandMap: { red: 'B04', nir: 'B08' },
            // Endpoint OAuth2 do Copernicus Data Space Ecosystem (Keycloak).
            // Preencha CLIENT_ID/CLIENT_SECRET (ou USERNAME/PASSWORD) em
            // APP_CONFIG.COPERNICUS.AUTH para habilitar downloads autenticados.
            authUrl: 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token'
        };
        this.rasterProcessor = null;
        this._accessToken = null;
        this._tokenExpiresAt = 0;
    }

    init() {
        if (this._initialized) return;
        this.rasterProcessor = new RasterProcessor();
        this.rasterProcessor.init();

        // Mescla configuração vinda de APP_CONFIG.COPERNICUS, se existir
        if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.COPERNICUS) {
            this.config = {
                ...this.config,
                stacUrl: APP_CONFIG.COPERNICUS.STAC_URL || this.config.stacUrl,
                collection: APP_CONFIG.COPERNICUS.COLLECTION || this.config.collection,
                maxCloudCoverage: APP_CONFIG.COPERNICUS.MAX_CLOUD_COVERAGE ?? this.config.maxCloudCoverage,
                bandMap: APP_CONFIG.COPERNICUS.BAND_MAP || this.config.bandMap,
                authUrl: APP_CONFIG.COPERNICUS.AUTH?.TOKEN_URL || this.config.authUrl
            };
            this._authConfig = APP_CONFIG.COPERNICUS.AUTH || null;
        }

        this._initialized = true;
        console.log('[CopernicusService] Inicializado');
    }

    // ========================================================================
    // 0. AUTENTICAÇÃO (OAuth2 — Copernicus Data Space Ecosystem)
    // ========================================================================

    /**
     * Obtém (e cacheia) um access token OAuth2 do CDSE, se credenciais
     * estiverem configuradas em APP_CONFIG.COPERNICUS.AUTH. Sem credenciais
     * configuradas, retorna null e as requisições seguem sem Authorization
     * header (funciona para a busca STAC pública; pode falhar no download
     * dos assets binários dependendo da política de acesso do CDSE).
     * @returns {Promise<string|null>}
     */
    async _getAccessToken() {
        const auth = this._authConfig;
        if (!auth || (!auth.CLIENT_ID && !auth.USERNAME)) {
            return null; // Sem credenciais configuradas — segue sem auth.
        }

        // Reutiliza token em cache se ainda válido (com margem de 30s)
        if (this._accessToken && Date.now() < this._tokenExpiresAt - 30000) {
            return this._accessToken;
        }

        const body = new URLSearchParams();
        if (auth.CLIENT_ID && auth.CLIENT_SECRET) {
            body.set('grant_type', 'client_credentials');
            body.set('client_id', auth.CLIENT_ID);
            body.set('client_secret', auth.CLIENT_SECRET);
        } else if (auth.USERNAME && auth.PASSWORD) {
            // CDSE também aceita "password" grant com client_id público 'cdse-public'
            body.set('grant_type', 'password');
            body.set('client_id', auth.CLIENT_ID || 'cdse-public');
            body.set('username', auth.USERNAME);
            body.set('password', auth.PASSWORD);
        } else {
            return null;
        }

        try {
            const resp = await fetch(this.config.authUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
            });
            if (!resp.ok) {
                throw new Error(`Falha na autenticação CDSE: ${resp.status} ${resp.statusText}`);
            }
            const data = await resp.json();
            this._accessToken = data.access_token;
            this._tokenExpiresAt = Date.now() + (data.expires_in || 600) * 1000;
            console.log('[CopernicusService] Token OAuth2 obtido com sucesso');
            return this._accessToken;
        } catch (err) {
            console.error('[CopernicusService] Erro ao obter token OAuth2:', err);
            return null;
        }
    }

    /**
     * Monta headers de autorização (Bearer) se houver token disponível.
     * @returns {Promise<Object>}
     * @private
     */
    async _authHeaders() {
        const token = await this._getAccessToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
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

        // CORREÇÃO: filtro de nuvens trocado do CQL2 'filter' extension
        // (usado pela API da CDSE) para a STAC API 'query' extension, que é
        // o formato documentado e suportado pelo stac-server — o backend por
        // trás da Earth Search (Element84), provedor atual (ver config.js).
        const body = {
            collections: [this.config.collection],
            datetime: `${startISO}/${endISO}`,
            bbox: bbox,
            limit: maxResults,
            query: {
                'eo:cloud_cover': { lte: cloudLimit }
            }
        };

        console.log(`[CopernicusService] Buscando imagens: ${startDate} → ${endDate}, bbox=${bbox}, cloud≤${cloudLimit}%`);

        try {
            const authHeaders = await this._authHeaders();
            const resp = await fetch(this.config.stacUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
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
     * Procura o asset de uma banda por múltiplas variações de nome, já que
     * diferentes provedores STAC usam convenções diferentes:
     * - CDSE: código da banda, às vezes com sufixo de resolução ("B04", "B04_10m")
     * - Earth Search (Element84/AWS): nome comum da banda ("red", "nir") —
     *   CORREÇÃO: adicionado, pois é o provedor usado agora (ver config.js)
     * @param {Object} assets - item.assets do STAC
     * @param {string} bandCode - ex. 'B04'
     * @returns {Object|null} asset encontrado ou null
     * @private
     */
    _findBandAsset(assets, bandCode) {
        // Mapa código de banda -> nome comum (usado pela Earth Search/STAC
        // Common Name extension). Cobre as bandas 10m/20m mais usadas.
        const COMMON_NAME = {
            B02: 'blue', B03: 'green', B04: 'red',
            B05: 'rededge1', B06: 'rededge2', B07: 'rededge3',
            B08: 'nir', B8A: 'nir08', B09: 'nir09',
            B11: 'swir16', B12: 'swir22'
        };
        const commonName = COMMON_NAME[bandCode.toUpperCase()];

        const candidates = [
            bandCode,
            bandCode.toLowerCase(),
            `${bandCode}_10m`,
            `${bandCode.toLowerCase()}_10m`,
            `${bandCode}_20m`,
            commonName
        ].filter(Boolean);

        for (const key of candidates) {
            if (assets[key]) return assets[key];
        }
        // Fallback: procura qualquer chave que comece com o código da banda
        const fuzzyKey = Object.keys(assets).find(k =>
            k.toUpperCase().startsWith(bandCode.toUpperCase())
        );
        return fuzzyKey ? assets[fuzzyKey] : null;
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
        const b04 = this._findBandAsset(assets, 'B04');
        const b08 = this._findBandAsset(assets, 'B08');
        // NOVO: asset "visual" (TCI/true-color) — usado para comparação visual
        // com o NDVI e identificação de falsos positivos.
        const visual = assets.visual || assets.thumbnail || null;
        return {
            id: item.id,
            datetime: props.datetime,
            date: props.datetime ? props.datetime.slice(0, 10) : null,
            cloudCover: props['eo:cloud_cover'] ?? null,
            platform: props.platform ?? 'sentinel-2',
            constellation: props.constellation ?? 'sentinel-2',
            gsd: props.gsd ?? 10,
            bands: Object.keys(assets).filter(k => /^b\d/i.test(k)),
            assets: {
                B04: b04 ? { href: b04.href, title: b04.title } : null,
                B08: b08 ? { href: b08.href, title: b08.title } : null,
                visual: visual ? { href: visual.href, title: visual.title } : null
            },
            bbox: item.bbox || null,
            raw: item
        };
    }

    // ========================================================================
    // 2. DOWNLOAD DE BANDAS
    // ========================================================================

    /**
     * Verifica se a URL do asset é um formato suportado por geotiff.js.
     * Sentinel-2 no CDSE às vezes distribui bandas em JPEG2000 (.jp2), que
     * geotiff.js NÃO decodifica — sem essa checagem, o erro aparecia
     * genérico (ou o pipeline caía silenciosamente em modo demo).
     * @param {string} url
     * @private
     */
    _assertSupportedRasterFormat(url) {
        const lower = url.toLowerCase().split('?')[0];
        if (lower.endsWith('.jp2') || lower.endsWith('.jpeg2000')) {
            throw new Error(
                `Asset em formato JPEG2000 (.jp2) não é suportado pelo geotiff.js: ${url}. ` +
                'Use um catálogo/coleção que ofereça as bandas como Cloud-Optimized GeoTIFF (COG), ' +
                'ou converta o .jp2 para .tif no backend antes de servir ao navegador.'
            );
        }
    }

    /**
     * Converte um bbox em WGS84 para uma janela de pixels [xMin, yMin, xMax, yMax]
     * na imagem do GeoTIFF, usando a origem/resolução/CRS da própria imagem.
     * Isso evita baixar a cena Sentinel-2 inteira quando só uma AOI pequena
     * é necessária.
     * @param {GeoTIFFImage} image
     * @param {number[]} bboxWGS84 - [lonMin, latMin, lonMax, latMax]
     * @returns {number[]|null} [left, top, right, bottom] em pixels, ou null se não for possível calcular
     * @private
     */
    _bboxToPixelWindow(image, bboxWGS84) {
        try {
            const geoKeys = this._extractGeoKeys(image);
            if (!geoKeys) return null;

            const [lonMin, latMin, lonMax, latMax] = bboxWGS84;
            const corners = [[lonMin, latMin], [lonMax, latMin], [lonMax, latMax], [lonMin, latMax]];

            let projCorners = corners;
            if (geoKeys.epsg && geoKeys.epsg !== 4326) {
                if (typeof window === 'undefined' || typeof window.proj4 === 'undefined') {
                    console.warn('[CopernicusService] proj4 indisponível — não é possível recortar por AOI, baixando cena completa.');
                    return null;
                }
                const proj4 = window.proj4;
                const srcDef = `EPSG:${geoKeys.epsg}`;
                if (!proj4.defs(srcDef)) {
                    const utmMatch = /^EPSG:32(6|7)(\d{2})$/.exec(srcDef);
                    if (utmMatch) {
                        const hemisphere = utmMatch[1] === '6' ? 'north' : 'south';
                        const zone = parseInt(utmMatch[2], 10);
                        proj4.defs(srcDef, `+proj=utm +zone=${zone} +${hemisphere === 'south' ? 'south ' : ''}+datum=WGS84 +units=m +no_defs`);
                    }
                }
                projCorners = corners.map(([lon, lat]) => proj4('EPSG:4326', srcDef, [lon, lat]));
            }

            const xs = projCorners.map(c => c[0]);
            const ys = projCorners.map(c => c[1]);
            const xMin = Math.min(...xs), xMax = Math.max(...xs);
            const yMin = Math.min(...ys), yMax = Math.max(...ys);

            const { originLon, originLat, resX, resY } = geoKeys;
            const absResY = Math.abs(resY);

            // pixel = (coord - origem) / resolução
            const left = Math.floor((xMin - originLon) / resX);
            const right = Math.ceil((xMax - originLon) / resX);
            const top = Math.floor((originLat - yMax) / absResY);
            const bottom = Math.ceil((originLat - yMin) / absResY);

            const fullWidth = image.getWidth();
            const fullHeight = image.getHeight();

            // Clampa dentro dos limites da imagem e adiciona uma pequena margem
            const margin = 5;
            const clampedLeft = Math.max(0, left - margin);
            const clampedTop = Math.max(0, top - margin);
            const clampedRight = Math.min(fullWidth, right + margin);
            const clampedBottom = Math.min(fullHeight, bottom + margin);

            if (clampedRight <= clampedLeft || clampedBottom <= clampedTop) {
                console.warn('[CopernicusService] Janela de AOI calculada é inválida/fora da cena, baixando cena completa.');
                return null;
            }

            return [clampedLeft, clampedTop, clampedRight, clampedBottom];
        } catch (e) {
            console.warn('[CopernicusService] Erro ao calcular janela de AOI, baixando cena completa:', e);
            return null;
        }
    }

    /**
     * Carrega uma banda GeoTIFF a partir de uma URL (S3 do Copernicus).
     * Usa geotiff.js: fromUrl() → readRasters().
     * @param {string} url
     * @param {number[]|null} pixelWindow - [left, top, right, bottom] em pixels (opcional, recorta)
     * @returns {Promise<{ data: Float32Array, width: number, height: number, geoKeys: Object }>}
     */
    async loadBandFromUrl(url, pixelWindow = null) {
        if (typeof GeoTIFF === 'undefined') {
            throw new Error('geotiff.js não está carregado. Adicione o CDN ao HTML.');
        }
        this._assertSupportedRasterFormat(url);

        console.log(`[CopernicusService] Carregando banda de: ${url.substring(0, 80)}...`);

        // geotiff.js aceita headers customizados para requisições autenticadas
        const authHeaders = await this._authHeaders();
        const tiff = await GeoTIFF.fromUrl(url, { headers: authHeaders });
        const image = await tiff.getImage();

        const width = image.getWidth();
        const height = image.getHeight();

        // Extrai affine transform + EPSG
        const geoKeys = this._extractGeoKeys(image);

        // Lê raster (com recorte por janela de pixels, se fornecida)
        const readOpts = {};
        if (pixelWindow) readOpts.window = pixelWindow;
        const [rasterData] = await image.readRasters(readOpts);

        // Normaliza
        const data = this.rasterProcessor.normalizeBand(rasterData);

        const readWidth = pixelWindow ? pixelWindow[2] - pixelWindow[0] : width;
        const readHeight = pixelWindow ? pixelWindow[3] - pixelWindow[1] : height;

        // Se recortamos por janela, a origem geográfica efetiva também muda
        // (o pixel (0,0) do array lido corresponde ao canto da janela, não
        // mais ao canto da cena inteira) — ajustamos geoKeys.originLon/Lat.
        let effectiveGeoKeys = geoKeys;
        if (pixelWindow && geoKeys) {
            effectiveGeoKeys = {
                ...geoKeys,
                originLon: geoKeys.originLon + pixelWindow[0] * geoKeys.resX,
                originLat: geoKeys.originLat - pixelWindow[1] * Math.abs(geoKeys.resY)
            };
        }

        console.log(`[CopernicusService] Banda carregada: ${readWidth}x${readHeight}${pixelWindow ? ' (recortada por AOI)' : ' (cena completa)'}`);

        return {
            data,
            width: readWidth,
            height: readHeight,
            fullWidth: width,
            fullHeight: height,
            geoKeys: effectiveGeoKeys
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
        if (/\.jp2$/i.test(file.name)) {
            throw new Error(`Arquivo "${file.name}" está em JPEG2000 (.jp2), formato não suportado pelo geotiff.js. Converta para GeoTIFF (.tif) antes de enviar.`);
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
     * Carrega a imagem "visual" (composição RGB true-color) de um item STAC,
     * recortada pela mesma janela de pixels usada para as bandas NDVI. Serve
     * para comparar visualmente o alerta com a cena real e descartar falsos
     * positivos (sombra de nuvem, variação sazonal, etc. que "parecem"
     * mudança no NDVI mas não são).
     * @param {Object} stacItem - item parseado do STAC
     * @param {number[]|null} bboxWGS84
     * @returns {Promise<string|null>} dataURL PNG, ou null se indisponível
     */
    async loadTrueColorImage(stacItem, bboxWGS84 = null) {
        const visualUrl = stacItem.assets.visual?.href;
        if (!visualUrl || typeof GeoTIFF === 'undefined') return null;

        try {
            this._assertSupportedRasterFormat(visualUrl);
            const authHeaders = await this._authHeaders();
            const tiff = await GeoTIFF.fromUrl(visualUrl, { headers: authHeaders });
            const image = await tiff.getImage();

            const pixelWindow = bboxWGS84 ? this._bboxToPixelWindow(image, bboxWGS84) : null;
            const readOpts = pixelWindow ? { window: pixelWindow } : {};
            const rasters = await image.readRasters(readOpts);

            const width = pixelWindow ? pixelWindow[2] - pixelWindow[0] : image.getWidth();
            const height = pixelWindow ? pixelWindow[3] - pixelWindow[1] : image.getHeight();

            return this._rgbRastersToDataURL(rasters, width, height);
        } catch (e) {
            console.warn('[CopernicusService] Não foi possível carregar imagem true-color:', e);
            return null;
        }
    }

    /**
     * Converte rasters RGB (TypedArrays, um por banda) em dataURL PNG via canvas.
     * @private
     */
    _rgbRastersToDataURL(rasters, width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(width, height);

        const r = rasters[0], g = rasters[1] || rasters[0], b = rasters[2] || rasters[0];
        for (let i = 0; i < width * height; i++) {
            imgData.data[i * 4] = r[i] || 0;
            imgData.data[i * 4 + 1] = g[i] || 0;
            imgData.data[i * 4 + 2] = b[i] || 0;
            imgData.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL('image/png');
    }
    /**
     * Carrega par de bandas B04+B08 de um item STAC.
     * @param {Object} stacItem - item parseado do STAC
     * @param {number[]|null} bboxWGS84 - AOI opcional [lonMin,latMin,lonMax,latMax] para recortar o download
     * @returns {Promise<{ red: Float32Array, nir: Float32Array, width: number, height: number, geoKeys: Object }>}
     */
    async loadPairFromSTAC(stacItem, bboxWGS84 = null) {
        const redUrl = stacItem.assets.B04?.href;
        const nirUrl = stacItem.assets.B08?.href;

        if (!redUrl || !nirUrl) {
            throw new Error(`Item STAC ${stacItem.id} não possui B04/B08 (verifique os nomes de asset expostos pelo catálogo).`);
        }

        // Calcula a janela de pixels a partir da AOI, se fornecida, usando a
        // imagem B04 como referência (assume-se mesma grade que B08 — válido
        // para Sentinel-2 L2A quando ambas as bandas estão na mesma resolução).
        let pixelWindow = null;
        if (bboxWGS84 && typeof GeoTIFF !== 'undefined') {
            try {
                this._assertSupportedRasterFormat(redUrl);
                const authHeaders = await this._authHeaders();
                const tiff = await GeoTIFF.fromUrl(redUrl, { headers: authHeaders });
                const image = await tiff.getImage();
                pixelWindow = this._bboxToPixelWindow(image, bboxWGS84);
            } catch (e) {
                console.warn('[CopernicusService] Não foi possível calcular janela de AOI, baixando cena completa:', e);
            }
        }

        const [redResult, nirResult] = await Promise.all([
            this.loadBandFromUrl(redUrl, pixelWindow),
            this.loadBandFromUrl(nirUrl, pixelWindow)
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
            geoKeys: redResult.geoKeys,
            date: stacItem.date
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
    // 3. GEO KEYS / AFFINE TRANSFORM
    // ========================================================================

    /**
     * Extrai affine transform (origin + resolution) e o código EPSG de uma
     * imagem GeoTIFF.
     * CORREÇÃO: agora também extrai o EPSG (via getGeoKeys()/ProjectedCSTypeGeoKey
     * ou GeographicTypeGeoKey), necessário para RasterProcessor reprojetar
     * corretamente as coordenadas para WGS84 quando o CRS de origem é UTM
     * (caso comum em produtos Sentinel-2).
     * @param {GeoTIFFImage} image
     * @returns {Object|null}
     * @private
     */
    _extractGeoKeys(image) {
        let originLon, originLat, resX, resY, epsg = null;

        try {
            const origin = image.getOrigin();        // [x, y] no CRS nativo da imagem
            const resolution = image.getResolution(); // [resX, resY]
            if (origin && resolution) {
                originLon = origin[0];
                originLat = origin[1];
                resX = resolution[0];
                resY = resolution[1];
            }
        } catch (e) {
            // fallback abaixo
        }

        if (originLon === undefined) {
            // Tenta extrair de ModelPixelScale + ModelTiepoint
            try {
                const pixelScale = image.fileDirectory?.ModelPixelScale;
                const tiepoint = image.fileDirectory?.ModelTiepoint;
                if (pixelScale && tiepoint) {
                    originLon = tiepoint[3];
                    originLat = tiepoint[4];
                    resX = pixelScale[0];
                    resY = pixelScale[1];
                }
            } catch (e) {
                // sem dados suficientes
            }
        }

        if (originLon === undefined) return null;

        // Extrai o EPSG do CRS nativo do GeoTIFF (necessário para reprojeção)
        try {
            const geoKeys = image.getGeoKeys ? image.getGeoKeys() : null;
            if (geoKeys) {
                epsg = geoKeys.ProjectedCSTypeGeoKey || geoKeys.GeographicTypeGeoKey || null;
            }
        } catch (e) {
            // Sem info de CRS explícita — assume-se WGS84 (4326) por segurança,
            // mas isso deve ser tratado como incerto pelo chamador.
        }

        return { originLon, originLat, resX, resY, epsg };
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
        return Object.keys(stacItem.raw?.assets || {}).filter(k => /^B\d/i.test(k)).sort();
    }
}

window.CopernicusService = CopernicusService;