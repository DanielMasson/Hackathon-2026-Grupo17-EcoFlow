/**
 * RESULT IMAGE STORE
 * Persiste localmente (IndexedDB) as imagens geradas em cada análise real
 * (NDVI antes/depois, overlay de mudança, satélite real antes/depois),
 * para reabertura rápida sem precisar reprocessar/rebaixar nada.
 *
 * Usa IndexedDB (não localStorage) porque cada snapshot carrega vários PNGs
 * em base64 — isso estouraria a cota de localStorage (~5-10MB) compartilhada
 * com áreas/alertas/auditoria rapidamente.
 */

class ResultImageStore {
    constructor() {
        this.dbName = 'eic_results_db';
        this.storeName = 'analysis_snapshots';
        this.db = null;
        this._initialized = false;
        this._ready = null;
    }

    init() {
        if (this._initialized) return this._ready;
        this._initialized = true;

        this._ready = new Promise((resolve) => {
            if (!('indexedDB' in window)) {
                console.warn('[ResultImageStore] IndexedDB indisponível — resultados não serão salvos localmente.');
                resolve(false);
                return;
            }

            const req = indexedDB.open(this.dbName, 1);

            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    store.createIndex('areaId', 'areaId', { unique: false });
                }
            };

            req.onsuccess = (e) => {
                this.db = e.target.result;
                console.log('[ResultImageStore] Inicializado');
                resolve(true);
            };

            req.onerror = (e) => {
                console.error('[ResultImageStore] Erro ao abrir IndexedDB:', e);
                resolve(false);
            };
        });

        return this._ready;
    }

    /**
     * Salva um snapshot de resultado (imagens + metadados) para uma área.
     * @param {string} areaId
     * @param {Object} snapshot - { areaName, status, type, type_label, severity,
     *                              confidence, previousDate, currentDate, images, stats }
     * @returns {Promise<Object|null>}
     */
    async save(areaId, snapshot) {
        const ok = await this.init();
        if (!ok || !this.db) return null;

        const record = {
            id: `${areaId}_${Date.now()}`,
            areaId,
            analyzedAt: new Date().toISOString(),
            ...snapshot
        };

        return new Promise((resolve) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            tx.objectStore(this.storeName).put(record);
            tx.oncomplete = () => resolve(record);
            tx.onerror = (e) => {
                console.error('[ResultImageStore] Erro ao salvar snapshot:', e);
                resolve(null);
            };
        });
    }

    /**
     * Retorna o snapshot mais recente salvo para uma área (acesso rápido,
     * sem reprocessar nada).
     * @param {string} areaId
     * @returns {Promise<Object|null>}
     */
    async getLatestForArea(areaId) {
        const list = await this.getHistoryForArea(areaId, 1);
        return list[0] || null;
    }

    /**
     * Retorna até `limit` snapshots de uma área, mais recentes primeiro.
     * @param {string} areaId
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getHistoryForArea(areaId, limit = 10) {
        const ok = await this.init();
        if (!ok || !this.db) return [];

        return new Promise((resolve) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const index = tx.objectStore(this.storeName).index('areaId');
            const req = index.getAll(areaId);
            req.onsuccess = () => {
                const all = (req.result || [])
                    .sort((a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt));
                resolve(all.slice(0, limit));
            };
            req.onerror = () => resolve([]);
        });
    }

    /**
     * Retorna o snapshot mais recente de TODAS as áreas que têm algum
     * resultado salvo. Usado pela aba de Verificação Visual.
     * @returns {Promise<Object[]>} um snapshot (o mais recente) por areaId
     */
    async getLatestPerArea() {
        const ok = await this.init();
        if (!ok || !this.db) return [];

        return new Promise((resolve) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const req = tx.objectStore(this.storeName).getAll();
            req.onsuccess = () => {
                const all = req.result || [];
                const byArea = {};
                all.forEach(r => {
                    if (!byArea[r.areaId] || new Date(r.analyzedAt) > new Date(byArea[r.areaId].analyzedAt)) {
                        byArea[r.areaId] = r;
                    }
                });
                resolve(Object.values(byArea));
            };
            req.onerror = () => resolve([]);
        });
    }

    /**
     * Remove TODOS os snapshots salvos (todas as áreas). Usado ao (re)carregar
     * os dados de demonstração no localStorage, para não deixar snapshots de
     * análises reais de sessões/deploys anteriores (IndexedDB) "sobrando"
     * vinculados aos mesmos IDs fixos de área do demoData.js.
     * @returns {Promise<boolean>}
     */
    async clearAll() {
        const ok = await this.init();
        if (!ok || !this.db) return false;

        return new Promise((resolve) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            tx.objectStore(this.storeName).clear();
            tx.oncomplete = () => {
                console.log('[ResultImageStore] Todos os snapshots removidos');
                resolve(true);
            };
            tx.onerror = () => resolve(false);
        });
    }

    /**
     * Remove snapshots antigos, mantendo só os `maxPerArea` mais recentes
     * por área — evita crescimento ilimitado do IndexedDB.
     * @param {number} maxPerArea
     */
    async cleanup(maxPerArea = 5) {
        const ok = await this.init();
        if (!ok || !this.db) return;

        const tx = this.db.transaction(this.storeName, 'readonly');
        const req = tx.objectStore(this.storeName).getAll();
        req.onsuccess = () => {
            const all = req.result || [];
            const byArea = {};
            all.forEach(r => (byArea[r.areaId] = byArea[r.areaId] || []).push(r));

            const toDelete = [];
            Object.values(byArea).forEach(list => {
                list.sort((a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt));
                toDelete.push(...list.slice(maxPerArea));
            });
            if (toDelete.length === 0) return;

            const delTx = this.db.transaction(this.storeName, 'readwrite');
            const delStore = delTx.objectStore(this.storeName);
            toDelete.forEach(r => delStore.delete(r.id));
        };
    }

    /**
     * Remove todos os snapshots de uma área (ex.: quando a área é excluída).
     * @param {string} areaId
     */
    async deleteForArea(areaId) {
        const list = await this.getHistoryForArea(areaId, 1000);
        if (!this.db || list.length === 0) return;
        const tx = this.db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        list.forEach(r => store.delete(r.id));
    }
}

const resultImageStore = new ResultImageStore();
window.resultImageStore = resultImageStore;
