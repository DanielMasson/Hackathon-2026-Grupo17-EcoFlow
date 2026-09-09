/**
 * SATELLITE PANEL
 * Interface para busca e seleção de imagens satélite
 */

class SatellitePanel {
    constructor() {
        this._selectedImageAntes = null;
        this._selectedImageDepois = null;
        this._currentResults = [];
    }

    init() {
        this._bindEvents();
        this._loadAreas();
        this._setDefaultDates();
    }

    _bindEvents() {
        const searchBtn = document.getElementById('searchSatelliteBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this._searchImages());
        }

        const downloadBtn = document.getElementById('downloadAndAnalyzeBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this._downloadAndAnalyze());
        }
    }

    _loadAreas() {
        const areas = window.StorageService ? StorageService.getAreas() : [];
        const select = document.getElementById('satelliteAreaSelect');
        if (!select) return;

        select.innerHTML = '<option value="">Selecionar área...</option>';
        areas.forEach(area => {
            const opt = document.createElement('option');
            opt.value = area.id;
            opt.textContent = area.nome;
            select.appendChild(opt);
        });
    }

    _setDefaultDates() {
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 3);

        const startDate = document.getElementById('satelliteStartDate');
        const endDate = document.getElementById('satelliteEndDate');

        if (startDate) startDate.value = start.toISOString().slice(0, 10);
        if (endDate) endDate.value = end.toISOString().slice(0, 10);
    }

    async _searchImages() {
        const areaId = document.getElementById('satelliteAreaSelect')?.value;
        const startDate = document.getElementById('satelliteStartDate')?.value;
        const endDate = document.getElementById('satelliteEndDate')?.value;
        const cloudCover = document.getElementById('satelliteCloudCover')?.value || 30;

        if (!startDate || !endDate) {
            alert('Selecione o período de busca');
            return;
        }

        const resultsDiv = document.getElementById('satelliteResults');
        resultsDiv.innerHTML = '<div class="loading">🔍 Buscando imagens...</div>';

        let aoi = null;
        if (areaId) {
            const areas = StorageService.getAreas();
            const area = areas.find(a => a.id === areaId);
            if (area?.geojson) {
                aoi = area.geojson;
            }
        }

        try {
            const result = await window.SatelliteService.searchImages({
                aoi: aoi,
                startDate: startDate,
                endDate: endDate,
                cloudCoverage: parseInt(cloudCover)
            });

            this._currentResults = result.images || [];
            this._renderResults(result);
        } catch (e) {
            resultsDiv.innerHTML = `<div class="error">Erro ao buscar imagens: ${e.message}</div>`;
        }
    }

    _renderResults(result) {
        const resultsDiv = document.getElementById('satelliteResults');

        if (!result.images || result.images.length === 0) {
            resultsDiv.innerHTML = '<div class="empty">Nenhuma imagem encontrada para os filtros selecionados</div>';
            return;
        }

        let html = `<div class="results-count">${result.images.length} imagens encontradas</div>`;
        html += '<div class="images-grid">';

        result.images.forEach((img, idx) => {
            const date = new Date(img.date).toLocaleDateString('pt-BR');
            const clouds = img.cloudCoverage;
            const quality = clouds < 15 ? 'EXCELENTE' : clouds < 30 ? 'ADEQUADA' : 'PREJUDICADA';
            const qualityClass = clouds < 15 ? 'excellent' : clouds < 30 ? 'good' : 'poor';

            html += `
                <div class="image-card" data-index="${idx}">
                    <div class="image-thumb">
                        ${img.thumbnail ? `<img src="${img.thumbnail}" alt="Thumbnail">` : '<div class="no-thumb">🛰️</div>'}
                    </div>
                    <div class="image-info">
                        <div class="image-date">${date}</div>
                        <div class="image-meta">
                            <span class="cloud-badge ${qualityClass}">${clouds}% nuvens</span>
                            <span class="quality-badge ${qualityClass}">${quality}</span>
                        </div>
                        <div class="image-bands">${(img.bands || []).join(', ')}</div>
                    </div>
                    <div class="image-actions">
                        <button class="btn-select btn-antes" data-idx="${idx}">Selecionar como ANTES</button>
                        <button class="btn-select btn-depois" data-idx="${idx}">Selecionar como DEPOIS</button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        resultsDiv.innerHTML = html;

        resultsDiv.querySelectorAll('.btn-antes').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                this._selectImage('antes', idx);
            });
        });

        resultsDiv.querySelectorAll('.btn-depois').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                this._selectImage('depois', idx);
            });
        });
    }

    _selectImage(tipo, idx) {
        const img = this._currentResults[idx];
        if (!img) return;

        if (tipo === 'antes') {
            this._selectedImageAntes = img;
            const el = document.getElementById('selectedImageAntes');
            if (el) {
                el.querySelector('.image-info').textContent = `${new Date(img.date).toLocaleDateString('pt-BR')} - ${img.cloudCoverage}% nuvens`;
            }
        } else {
            this._selectedImageDepois = img;
            const el = document.getElementById('selectedImageDepois');
            if (el) {
                el.querySelector('.image-info').textContent = `${new Date(img.date).toLocaleDateString('pt-BR')} - ${img.cloudCoverage}% nuvens`;
            }
        }

        const section = document.getElementById('satelliteDownloadSection');
        if (section) {
            section.style.display = (this._selectedImageAntes && this._selectedImageDepois) ? 'block' : 'none';
        }
    }

    async _downloadAndAnalyze() {
        if (!this._selectedImageAntes || !this._selectedImageDepois) {
            alert('Selecione duas imagens (antes e depois)');
            return;
        }

        const downloadBtn = document.getElementById('downloadAndAnalyzeBtn');
        if (downloadBtn) {
            downloadBtn.disabled = true;
            downloadBtn.textContent = '⏳ Baixando...';
        }

        try {
            const result = await window.SatelliteService.downloadBands({
                imageAntes: this._selectedImageAntes,
                imageDepois: this._selectedImageDepois
            });

            if (window.SatelliteService.searchAndDownload) {
                const areaId = document.getElementById('satelliteAreaSelect')?.value;
                if (areaId) {
                    window.location.hash = '#analysis';
                    setTimeout(() => {
                        if (window.AnalysisService) {
                            window.AnalysisService.analyzeArea(areaId);
                        }
                    }, 500);
                }
            }

            alert('Download concluído! As imagens estão prontas para análise.');
        } catch (e) {
            alert(`Erro no download: ${e.message}`);
        } finally {
            if (downloadBtn) {
                downloadBtn.disabled = false;
                downloadBtn.textContent = '⬇️ Baixar e Analisar';
            }
        }
    }

    refresh() {
        this._loadAreas();
        this._selectedImageAntes = null;
        this._selectedImageDepois = null;
        this._currentResults = [];

        const section = document.getElementById('satelliteDownloadSection');
        if (section) section.style.display = 'none';
    }
}

window.SatellitePanel = new SatellitePanel();
