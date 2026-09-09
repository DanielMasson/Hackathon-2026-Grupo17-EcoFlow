# Detecção automática de mudanças por satélite — teste de conceito

Valida a lógica do pipeline (NDVI → diferença → limiar → regiões →
ordem de serviço) usando dados **sintéticos**, sem depender de
internet ou credenciais de satélite. Serve para provar que o algoritmo
funciona antes de conectar a fonte de imagem real.

## Como rodar

```bash
pip install numpy scipy scikit-image matplotlib rasterio
python3 main.py
```

Gera:
- `ordens_de_servico.json` — lista de ocorrências detectadas
- `resultado_deteccao.png` — painel visual (NDVI antes/depois + máscara)

## Estrutura

| Arquivo | Responsabilidade |
|---|---|
| `synthetic_data.py` | Gera bandas RED/NIR sintéticas (substituir por dado real) |
| `ndvi.py` | Calcula NDVI = (NIR-RED)/(NIR+RED) |
| `detect_changes.py` | Diferença de NDVI, limiar, regiões conectadas |
| `visualize.py` | Painel de imagens para inspeção visual |
| `main.py` | Orquestra o pipeline ponta a ponta |

## Onde conseguir imagens reais do Sentinel-2

O antigo Copernicus Open Access Hub foi descontinuado — hoje o acesso
gratuito é pelo **Copernicus Data Space Ecosystem**
(dataspace.copernicus.eu):

1. Criar conta gratuita em dataspace.copernicus.eu (aprovação quase
   instantânea)
2. Abrir o **Copernicus Browser** (dataspace.copernicus.eu/browser)
3. Buscar a área de interesse, produto **Sentinel-2 L2A**, baixa
   cobertura de nuvens
4. Baixar as bandas **B04 (red)** e **B08 (nir)** como GeoTIFF
   (opção "Analytical"/"Custom", não a imagem colorida "Visual")
5. Repetir para a data "depois"

Alternativas: Google Earth Engine (processa na nuvem, evita download,
mas requer conta aprovada), Microsoft Planetary Computer (API STAC,
sem OAuth complicado).

## Usando dados reais no pipeline

Depois de baixar os 4 arquivos (`antes_B04.tif`, `antes_B08.tif`,
`depois_B04.tif`, `depois_B08.tif`) numa pasta `dados/`:

```bash
pip install rasterio
python3 main_dados_reais.py
```

`real_data.py` lê os GeoTIFFs com `rasterio`, normaliza a reflectância
e já georreferencia as ocorrências detectadas (troca a conversão
fictícia de `detect_changes.pixel_para_coordenada()` por coordenadas
reais). O resto do pipeline (`ndvi.py`, `detect_changes.py`,
`visualize.py`) é o mesmo usado no teste sintético.

Imagem real tem mais ruído que a sintética (sombra de nuvem, variação
sazonal de vegetação) — se aparecerem muitos falsos positivos,
aumentem `limiar` e/ou `area_minima_pixels` em `detectar_mudancas()`.


## Ainda usando GeoJSON e polígonos de verdade (opcional)

Se quiserem os polígonos das ocorrências prontos para importar direto
no WebGIS/Power BI (em vez de só bbox + centroide), troquem
`skimage.measure.label` em `detect_changes.py` por
`rasterio.features.shapes()` + `shapely` — geram polígonos
georreferenciados a partir da mesma máscara binária que o script já
produz. A matemática de NDVI/diferença/limiar não muda.
## Parâmetros para calibrar com o pessoal da área

- `limiar` em `detectar_mudancas()`: quanto maior, menos sensível
  (só pega mudanças bem fortes). Ajustar comparando com uma ocorrência
  real conhecida.
- `area_minima_pixels`: filtra ruído de sensor/nuvem residual.
  Depende da resolução da imagem usada (Sentinel-2 = 10m/pixel).
