/**
 * DADOS DEMONSTRATIVOS
 * Environmental Intelligence Center - Demo Data
 */

const DEMO_DATA = {
    areas: [
        {
            id: 'AREA_001',
            nome: 'Reserva Sul',
            descricao: 'Área de preservação permanente localizada na região sul, com vegetação nativa bem preservada.',
            categoria: 'reserva',
            prioridade: 'media',
            status: 'ativo',
            responsavel: 'Dr. Carlos Silva',
            frequency: 'semanal',
            createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            areaHa: 1245.8,
            perimeterKm: 18.32,
            municipality: 'Bonito',
            state: 'MS',
            lastAnalysis: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            imageDates: {
                before: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
                after: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            geojson: {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [-56.5, -21.2],
                        [-56.3, -21.2],
                        [-56.3, -21.4],
                        [-56.5, -21.4],
                        [-56.5, -21.2]
                    ]]
                }
            },
            analysis: {
                status: 'normal',
                type: 'normal',
                severity: 'normal',
                confidence: 0.95,
                affectedAreaHa: 0,
                affectedPercentage: 0,
                previousDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                currentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
            },
            history: []
        },
        {
            id: 'AREA_002',
            nome: 'Área Rural 034',
            descricao: 'Propriedade rural com histórico de atividade agrícola, apresentando alterações recentes na cobertura vegetal.',
            categoria: 'rural',
            prioridade: 'alta',
            status: 'ativo',
            responsavel: 'Eng. Ana Paula',
            frequency: '3_dias',
            createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
            areaHa: 856.3,
            perimeterKm: 14.7,
            municipality: 'Rio Verde',
            state: 'GO',
            lastAnalysis: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            imageDates: {
                before: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
                after: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            geojson: {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [-50.2, -17.5],
                        [-50.0, -17.5],
                        [-50.0, -17.7],
                        [-50.2, -17.7],
                        [-50.2, -17.5]
                    ]]
                }
            },
            analysis: {
                status: 'alteracao',
                type: 'possivel_desmatamento',
                severity: 'alta',
                confidence: 0.87,
                affectedAreaHa: 12.8,
                affectedPercentage: 1.49,
                previousDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                currentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            history: []
        },
        {
            id: 'AREA_003',
            nome: 'Reserva Norte',
            descricao: 'Reserva ambiental de grande porte, com sinais de degradação recente detectados por satélite.',
            categoria: 'reserva',
            prioridade: 'critica',
            status: 'ativo',
            responsavel: 'Dr. Marcos Costa',
            frequency: 'diaria',
            createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
            areaHa: 3200.5,
            perimeterKm: 28.6,
            municipality: 'Alta Floresta',
            state: 'MT',
            lastAnalysis: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            imageDates: {
                before: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
                after: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            geojson: {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [-55.8, -10.0],
                        [-55.5, -10.0],
                        [-55.5, -10.3],
                        [-55.8, -10.3],
                        [-55.8, -10.0]
                    ]]
                }
            },
            analysis: {
                status: 'alteracao',
                type: 'possivel_queimada',
                severity: 'alta',
                confidence: 0.91,
                affectedAreaHa: 18.4,
                affectedPercentage: 0.57,
                previousDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
                currentDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            history: []
        },
        {
            id: 'AREA_004',
            nome: 'Fazenda Santa Clara',
            descricao: 'Propriedade agropecuária monitorada para verificação de conformidade ambiental.',
            categoria: 'rural',
            prioridade: 'media',
            status: 'pausado',
            responsavel: 'Eng. João Mendes',
            frequency: 'mensal',
            createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            areaHa: 1800.0,
            perimeterKm: 22.4,
            municipality: 'Rondonópolis',
            state: 'MT',
            lastAnalysis: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
            imageDates: {
                before: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
                after: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            geojson: {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [-54.6, -16.4],
                        [-54.3, -16.4],
                        [-54.3, -16.7],
                        [-54.6, -16.7],
                        [-54.6, -16.4]
                    ]]
                }
            },
            analysis: {
                status: 'normal',
                type: 'normal',
                severity: 'normal',
                confidence: 0.96,
                affectedAreaHa: 0,
                affectedPercentage: 0,
                previousDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                currentDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
            },
            history: []
        }
    ],
    
    alerts: [
        {
            id: 'ALT_001',
            areaId: 'AREA_002',
            areaName: 'Área Rural 034',
            type: 'possivel_desmatamento',
            severity: 'alta',
            status: 'Detectado',
            confidence: 0.87,
            affectedAreaHa: 12.8,
            description: 'Detectada redução significativa no NDVI, indicando possível desmatamento na região.',
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            resolvedAt: null,
            history: [
                {
                    status: 'Detectado',
                    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                    user: 'Sistema'
                }
            ]
        },
        {
            id: 'ALT_002',
            areaId: 'AREA_003',
            areaName: 'Reserva Norte',
            type: 'possivel_queimada',
            severity: 'alta',
            status: 'Detectado',
            confidence: 0.91,
            affectedAreaHa: 18.4,
            description: 'Alteração espectral compatível com área queimada recente.',
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            resolvedAt: null,
            history: [
                {
                    status: 'Detectado',
                    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                    user: 'Sistema'
                }
            ]
        },
        {
            id: 'ALT_003',
            areaId: 'AREA_002',
            areaName: 'Área Rural 034',
            type: 'alteracao_vegetacao',
            severity: 'media',
            status: 'Em análise',
            confidence: 0.72,
            affectedAreaHa: 3.2,
            description: 'Possível alteração na vegetação, necessita de verificação adicional.',
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            resolvedAt: null,
            history: [
                {
                    status: 'Detectado',
                    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                    user: 'Sistema'
                }
            ]
        }
    ],
    
    history: [
        {
            id: 'HIST_001',
            areaId: 'AREA_002',
            action: 'Análise detectada',
            type: 'possivel_desmatamento',
            severity: 'alta',
            confidence: 0.87,
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            user: 'Sistema'
        },
        {
            id: 'HIST_002',
            areaId: 'AREA_003',
            action: 'Análise detectada',
            type: 'possivel_queimada',
            severity: 'alta',
            confidence: 0.91,
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            user: 'Sistema'
        },
        {
            id: 'HIST_003',
            areaId: 'AREA_001',
            action: 'Análise concluída',
            type: 'normal',
            severity: 'normal',
            confidence: 0.95,
            timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            user: 'Sistema'
        },
        {
            id: 'HIST_004',
            areaId: 'AREA_002',
            action: 'Análise detectada',
            type: 'alteracao_vegetacao',
            severity: 'media',
            confidence: 0.72,
            timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            user: 'Sistema'
        }
    ]
};

// Exportar para uso global
window.DEMO_DATA = DEMO_DATA;