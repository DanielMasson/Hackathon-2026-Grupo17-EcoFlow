/**
 * CONFIGURAÇÃO GLOBAL DO SISTEMA
 * Environmental Intelligence Center - Config
 */

const APP_CONFIG = {
    // Modo de operação: 'DEMO' ou 'REAL'
    MODE: 'REAL',
    
    // URL base da API Python
    API_BASE: 'http://localhost:8000',
    
    // Versão
    VERSION: '1.0.0',
    
    // Nome do sistema
    NAME: 'Environmental Intelligence Center',
    SHORT_NAME: 'EIC',
    
    // Configurações do mapa
    MAP: {
        DEFAULT_CENTER: [-15.7939, -47.8828], // Brasília
        DEFAULT_ZOOM: 5,
        MIN_ZOOM: 3,
        MAX_ZOOM: 18,
        TILE_LAYER: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        TILE_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    
    // Configurações do Storage
    STORAGE: {
        PREFIX: 'eic_',
        AREAS_KEY: 'areas',
        ALERTS_KEY: 'alerts',
        HISTORY_KEY: 'history',
        SETTINGS_KEY: 'settings'
    },
    
    // Configurações de análise
    ANALYSIS: {
        NDVI_THRESHOLD: 0.2,
        MIN_AFFECTED_AREA: 0.5, // hectares
        CONFIDENCE_WEIGHTS: {
            imageQuality: 0.3,
            cloudCoverage: 0.25,
            changeMagnitude: 0.3,
            temporalConsistency: 0.15
        }
    },
    
    // Configurações de alerta
    ALERTS: {
        LEVELS: {
            CRITICAL: { label: 'Crítico', emoji: '🔴', priority: 4 },
            HIGH: { label: 'Alto', emoji: '🟠', priority: 3 },
            MEDIUM: { label: 'Médio', emoji: '🟡', priority: 2 },
            NORMAL: { label: 'Normal', emoji: '🟢', priority: 1 }
        },
        STATUS: {
            DETECTED: 'Detectado',
            ANALYZING: 'Em análise',
            CONFIRMED: 'Confirmado',
            FALSE_POSITIVE: 'Falso positivo',
            CLOSED: 'Encerrado'
        }
    },
    
    // Categorias disponíveis
    CATEGORIES: [
        { value: 'preservacao', label: 'Área de Preservação', group: 'Proteção Ambiental' },
        { value: 'reserva', label: 'Reserva', group: 'Proteção Ambiental' },
        { value: 'floresta', label: 'Floresta', group: 'Proteção Ambiental' },
        { value: 'rural', label: 'Área Rural', group: 'Proteção Ambiental' },
        { value: 'risco', label: 'Área de Risco', group: 'Proteção Ambiental' },
        { value: 'denunciada', label: 'Área Denunciada', group: 'Fiscalização' },
        { value: 'desmatamento', label: 'Suspeita de Desmatamento', group: 'Fiscalização' },
        { value: 'queimada', label: 'Suspeita de Queimada', group: 'Fiscalização' },
        { value: 'recuperacao', label: 'Área de Recuperação', group: 'Monitoramento Geral' },
        { value: 'pesquisa', label: 'Área de Pesquisa', group: 'Monitoramento Geral' }
    ],
    
    // Frequências
    FREQUENCIES: [
        { value: 'quando_nova', label: 'Quando houver nova imagem' },
        { value: 'diaria', label: 'Diária' },
        { value: '3_dias', label: 'A cada 3 dias' },
        { value: 'semanal', label: 'Semanal' },
        { value: 'quinzenal', label: 'Quinzenal' },
        { value: 'mensal', label: 'Mensal' },
        { value: 'manual', label: 'Manual' }
    ],
    
    // Prioridades
    PRIORITIES: [
        { value: 'baixa', label: 'Baixa', level: 1 },
        { value: 'media', label: 'Média', level: 2 },
        { value: 'alta', label: 'Alta', level: 3 },
        { value: 'critica', label: 'Crítica', level: 4 }
    ],
    
    // Status
    STATUSES: [
        { value: 'ativo', label: 'Ativo' },
        { value: 'pausado', label: 'Pausado' },
        { value: 'analise', label: 'Em Análise' },
        { value: 'encerrado', label: 'Encerrado' }
    ],
    
    // Análise - tipos de alteração
    CHANGE_TYPES: [
        { value: 'normal', label: 'Normal', severity: 'normal' },
        { value: 'possivel_desmatamento', label: 'Possível Desmatamento', severity: 'high' },
        { value: 'possivel_queimada', label: 'Possível Queimada', severity: 'high' },
        { value: 'alteracao_vegetacao', label: 'Alteração de Vegetação', severity: 'medium' },
        { value: 'solo_exposto', label: 'Solo Exposto', severity: 'medium' },
        { value: 'agua', label: 'Água', severity: 'normal' },
        { value: 'alteracao_urbana', label: 'Alteração Urbana', severity: 'medium' },
        { value: 'inconclusivo', label: 'Inconclusivo', severity: 'normal' }
    ]
};

// Exportar para uso global
window.APP_CONFIG = APP_CONFIG;