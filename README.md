# 🌿 EcoFlow — Environmental Intelligence Center

**Hackathon IFC × Concordia — Grupo 17**

EcoFlow é uma plataforma web de inteligência ambiental voltada para **monitoramento de áreas via imagens de satélite Sentinel-2**, com foco em **detecção de mudanças** (desmatamento, queimadas, alteração de vegetação, exposição de solo) através de comparação **antes × depois** usando NDVI (Índice de Vegetação por Diferença Normalizada).

O sistema permite cadastrar áreas de interesse (AOIs) desenhando polígonos diretamente no mapa, buscar cenas Sentinel-2 disponíveis via catálogo STAC (Copernicus/Earth Search), processar as bandas espectrais no próprio navegador e gerar alertas automáticos quando uma alteração significativa é detectada.

---
## ⚠️ Adendo importante — Consistência dos dados de demonstração

As áreas que já vêm **pré-cadastradas** no sistema (dados demo: *Reserva Sul*, *Área Rural 034*, *Reserva Norte*) foram criadas apenas como exemplo de estrutura de dados e **apresentam inconsistências nas análises** (geometrias/bboxes não necessariamente correspondentes a alterações reais detectáveis via Sentinel-2, resultados desatualizados, etc.).

A **única área pré-cadastrada com análise consistente e confiável é a "Fazenda Santa Clara"**. As demais devem ser tratadas apenas como exemplos de UI, não como referência de resultado de análise real.

### ✅ Recomendação para melhor visualização

Para testar o pipeline de análise real com um resultado **visualmente rico e consistente**, recomendamos **criar uma nova área na região da Usina de Itá** (represa/UHE Itá, na divisa entre Santa Catarina e Rio Grande do Sul). A região possui boa disponibilidade de cenas Sentinel-2 com baixa cobertura de nuvens e contraste claro entre água/vegetação/solo, o que favorece a visualização do NDVI e da detecção de mudanças.

Passos sugeridos:
1. Vá em **Nova Área** e desenhe um polígono ao redor do reservatório/margens da Usina de Itá.
2. Salve a área.
3. Vá até **Análises**, selecione a área criada.
4. Use **"Buscar Cenas Disponíveis"** para escolher manualmente duas cenas (antes/depois) com baixa cobertura de nuvens.
5. Clique em **Analisar Área** e explore o comparador de satélite real (aba **Verificação Visual**).

---

## ✨ Funcionalidades

- **🗺️ Mapa interativo (Leaflet)** — visualização de áreas monitoradas, alertas ativos e camadas de satélite.
- **📍 Cadastro de áreas** — desenho de polígonos (AOI) direto no mapa, com cálculo automático de área (ha) e perímetro (km) via Turf.js.
- **🔍 Análise de mudanças (NDVI)** — pipeline completo rodando 100% no navegador (JS puro): cálculo de NDVI, diferença entre cenas, limiarização, operações morfológicas, componentes conectados e classificação de severidade.
- **📅 Seleção manual de cenas** — busca de cenas Sentinel-2 disponíveis para um período/filtro de nuvens e escolha manual de qual imagem usar como "antes" e "depois" (em vez de depender apenas da seleção automática mais antiga/mais recente dos últimos 60 dias).
- **🛰️ Verificação visual** — comparação da detecção de NDVI com a imagem real (true color) da cena, para reduzir falsos positivos.
- **📸 Comparador deslizante** — slider interativo antes/depois (satélite real, NDVI ou simulação demonstrativa).
- **⚠️ Central de alertas** — geração automática de alertas por severidade, com fluxo de status (Detectado → Em análise → Confirmado/Falso positivo → Encerrado).
- **📜 Histórico e auditoria** — timeline de eventos e log de auditoria por área.
- **📄 Relatórios** — geração de relatório HTML exportável/imprimível.
- **💾 Persistência local** — LocalStorage (áreas/alertas/histórico) e IndexedDB (imagens de resultado das análises reais), sem necessidade de backend.

---

## 🧱 Stack Técnica

- HTML5 / CSS3 / JavaScript puro (vanilla, sem framework/build step)
- [Leaflet](https://leafletjs.com/) + [Leaflet.draw](https://github.com/Leaflet/Leaflet.draw) — mapa e desenho de polígonos
- [Turf.js](https://turfjs.org/) — geometria e cálculos geoespaciais
- [Chart.js](https://www.chartjs.org/) — gráficos do dashboard
- [geotiff.js](https://geotiffjs.github.io/) — leitura das bandas Sentinel-2 (GeoTIFF/COG) no navegador
- [proj4js](http://proj4js.org/) — reprojeção de coordenadas (UTM ↔ WGS84)
- **Copernicus / Earth Search STAC API** — catálogo de cenas Sentinel-2 L2A
- LocalStorage + IndexedDB — persistência client-side

---

## 🚀 Como rodar o projeto

O EcoFlow é uma aplicação **front-end estática**, mas o `index.html` **não deve ser aberto diretamente pelo navegador via `file://`** — isso quebra requisições `fetch`/CORS necessárias para consultar o catálogo STAC e carregar as imagens do satélite. É necessário servir os arquivos através de um servidor HTTP local.

### Opção 1 — VS Code Live Server (recomendado)

1. Abra a pasta do projeto (`site/geo`) no VS Code.
2. Instale a extensão **Live Server** (se ainda não tiver).
3. Clique com o botão direito em `index.html` → **"Open with Live Server"**.
4. O navegador abrirá automaticamente em algo como `http://127.0.0.1:5500/`.

### Opção 2 — Servidor Python embutido

Já existe um script pronto (`start.sh`) na raiz do projeto:

```bash
cd site/geo
./start.sh
```

Isso inicia um servidor em `http://localhost:8080`.

Ou, manualmente:

```bash
cd site/geo
python3 -m http.server 8080
```

Depois acesse **http://localhost:8080** no navegador.

### Opção 3 — Qualquer outro servidor estático

Node (`npx serve`), PHP (`php -S localhost:8000`), etc. — qualquer servidor HTTP estático funciona, desde que sirva a pasta `site/geo` como raiz.

> 💡 Não é necessário backend, banco de dados externo ou variáveis de ambiente para rodar em modo padrão — todo o processamento (NDVI, detecção de mudanças, persistência) acontece no navegador.

---

## 📁 Estrutura de pastas (resumo)

```
site/
├── firebase.json          # config de deploy (Firebase Hosting)
└── geo/                    # aplicação principal (EcoFlow)
    ├── index.html
    ├── start.sh
    ├── css/
    │   └── style.css
    └── js/
        ├── config.js       # configurações globais (modo, mapa, Copernicus, thresholds)
        ├── app.js           # orquestrador principal
        └── ui/
            ├── AreaPanel.js
            ├── AlertPanel.js
            ├── Dashboard.js
            ├── Timeline.js
            ├── VerificationPanel.js
            ├── ImageComparator.js
            ├── data/demoData.js
            └── services/
                ├── AreaService.js
                ├── AlertService.js
                ├── AnalysisService.js
                ├── CopernicusService.js
                ├── RasterProcessor.js
                ├── SatelliteService.js
                ├── ImageService.js
                ├── ReportService.js
                ├── ResultImageStore.js
                ├── StorageService.js
                └── AuditService.js
```

---

## ⚙️ Modo DEMO × Modo REAL

O modo de operação é definido em `js/config.js` (`APP_CONFIG.MODE`):

- **`DEMO`** — dados e imagens simulados, útil para navegar pela interface sem depender de conexão com o catálogo STAC.
- **`REAL`** — busca cenas Sentinel-2 reais via STAC (Earth Search/Copernicus) e processa as bandas B04/B08 no navegador para gerar o NDVI e a detecção de mudanças de verdade.

Por padrão o projeto já está configurado em modo `REAL`.

---

## 👥 Equipe

Projeto desenvolvido para o **Hackathon IFC × Concordia — Grupo 17**.

---

## 📄 Licença

Projeto acadêmico/hackathon, sem licença comercial definida.
