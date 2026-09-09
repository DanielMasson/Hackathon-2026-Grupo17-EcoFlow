# Documento de Escopo do Projeto
## Ecoflow

**Versão do documento:** 1.0
**Tipo de documento:** Escopo e Planejamento Funcional (Pré-desenvolvimento)
**Status do projeto:** A ser desenvolvido

---

## 1. Introdução

Este documento descreve o escopo funcional planejado para o **EcoFlow**, uma plataforma web voltada ao monitoramento ambiental de áreas de interesse (reservas, propriedades rurais, áreas de preservação, entre outras), com apoio de imagens de satélite e análise automatizada de alterações na cobertura vegetal e do solo.

O sistema deverá permitir que operadores cadastrem áreas geográficas, acompanhem seu status ao longo do tempo, recebam alertas automáticos de possíveis alterações (desmatamento, queimadas, exposição de solo, entre outras) e gerem relatórios consolidados para fins de fiscalização, gestão ambiental ou compliance.

Este documento tem caráter de planejamento: descreve **o que o sistema deverá fazer**, os módulos que o compõem e as decisões de arquitetura previstas, servindo como referência para o time de desenvolvimento antes do início da implementação.

---

## 2. Objetivos do Sistema

- Centralizar o monitoramento de múltiplas áreas geográficas de interesse ambiental em um único painel.
- Automatizar a detecção de alterações ambientais por meio da comparação de imagens de satélite em diferentes períodos.
- Gerar alertas classificados por severidade quando alterações forem detectadas.
- Fornecer visualização geoespacial (mapa interativo) das áreas monitoradas e dos alertas ativos.
- Manter um histórico auditável de todas as análises e ações realizadas no sistema.
- Permitir a geração de relatórios para embasar decisões e ações de fiscalização.
- Operar inicialmente em um **modo de demonstração (DEMO)**, com dados simulados, preparando a arquitetura para uma futura integração real com provedores de imagens de satélite (ex.: Copernicus/Sentinel-2).

---

## 3. Público-alvo

- Órgãos ambientais e equipes de fiscalização.
- Gestores de propriedades rurais e áreas de preservação.
- Pesquisadores e analistas ambientais.
- Operadores responsáveis pelo monitoramento contínuo de território.

---

## 4. Escopo Funcional

O sistema será estruturado em módulos (telas/views) acessíveis por meio de um menu lateral de navegação, com um cabeçalho fixo contendo busca global, atalho para criação de áreas e central de notificações.

### 4.1 Dashboard (Painel Geral)

Tela inicial do sistema, com visão consolidada do estado geral do monitoramento.

Deverá exibir:
- Cartões de estatísticas: total de áreas monitoradas, áreas normais, áreas com alterações detectadas e alertas críticos ativos.
- Gráfico de linha com a evolução de análises "normais" versus "com alteração" ao longo dos últimos 30 dias.
- Gráfico de rosca (doughnut) com a distribuição dos alertas por tipo de alteração (desmatamento, queimada, alteração de vegetação, solo exposto, alteração urbana, etc.).
- Linha do tempo com as atividades/alertas mais recentes.

### 4.2 Mapa Interativo

Módulo central de visualização geoespacial, baseado em uma biblioteca de mapas (Leaflet), com suporte a desenho de polígonos (Leaflet Draw) e cálculos geométricos (Turf.js).

Funcionalidades previstas:
- Exibição de todas as áreas monitoradas como polígonos, com cor definida pelo status (normal, alteração leve/média/alta/crítica).
- Camada de alertas ativos, exibidos como marcadores sobre o centroide da área afetada.
- Camada de "áreas alteradas" (changes) para destaque visual das ocorrências detectadas.
- Controle de camadas: mapa base (OpenStreetMap), camada satélite, áreas monitoradas, alertas e alterações — cada uma podendo ser ligada/desligada individualmente.
- Popups informativos ao clicar em uma área ou alerta, com atalho para a tela de detalhes.
- Exibição de coordenadas em tempo real conforme o cursor se move sobre o mapa.
- Foco/zoom automático em uma área específica a partir de outras telas (ex.: ao clicar em "Ver no Mapa").

### 4.3 Cadastro de Áreas Monitoradas

Módulo de criação e gestão das áreas de interesse.

O cadastro de uma nova área deverá conter:
- Nome e descrição da área.
- Categoria (ex.: área de preservação, reserva, floresta, área rural, área de risco, área denunciada, área de recuperação, área de pesquisa).
- Prioridade (baixa, média, alta, crítica).
- Status operacional (ativo, pausado, em análise, encerrado).
- Frequência de monitoramento desejada (diária, a cada 3 dias, semanal, quinzenal, mensal, manual, ou "quando houver nova imagem").
- Responsável pela área.
- Delimitação geográfica por meio de desenho de polígono no mapa, com cálculo automático de área (hectares), perímetro (km) e centroide.

Após criado, o sistema deverá calcular automaticamente a área em hectares a partir da geometria desenhada, utilizando bibliotecas de geoprocessamento.

### 4.4 Painel de Áreas (Listagem e Gestão)

Tela de listagem em formato de cartões (grid), exibindo cada área monitorada com:
- Nome, categoria, prioridade e status visual (normal / alteração, com cor conforme severidade).
- Área em hectares, data da última análise, responsável e nível de confiança da última análise (quando houver).
- Ações rápidas por cartão:
  - **Analisar**: dispara uma nova análise da área.
  - **Comparar**: abre o comparador de imagens antes/depois.
  - **Ver**: exibe um modal com detalhes completos da área.
  - **Editar**: abertura do formulário de edição (funcionalidade prevista para evolução futura).
  - **Excluir**: remove a área, mediante confirmação.
- Campo de busca/filtro por nome ou descrição da área, integrado à busca global do sistema.
- Estado vazio (empty state) amigável, orientando o usuário a cadastrar a primeira área.

### 4.5 Módulo de Análise

Tela dedicada à execução de análises sob demanda, permitindo:
- Seleção de uma área monitorada por meio de um combobox.
- Execução de uma análise, exibida como um processo com etapas visuais (ex.: localização da área de interesse, consulta de imagens, validação de qualidade, seleção de imagens anterior/atual, processamento, cálculo de índices, comparação de períodos, detecção e classificação de alterações, geração de alerta).
- Exibição do resultado da análise, contendo:
  - Status (normal / alteração detectada) e tipo de alteração.
  - Nível de confiança da análise (percentual).
  - Área afetada (hectares) e percentual da área total afetada, quando aplicável.
  - Severidade da ocorrência.
  - Datas das imagens "anterior" e "atual" utilizadas na comparação.
  - Aviso de que se trata de uma análise automatizada, recomendando validação humana em campo.
- Cálculo de índices espectrais como suporte técnico da análise:
  - **NDVI** (Índice de Vegetação por Diferença Normalizada).
  - **NBR** (Razão de Queima Normalizada) e **dNBR** (variação do NBR entre períodos).
- Classificação automática do tipo de alteração com base na magnitude de variação dos índices (ex.: possível desmatamento, possível queimada, alteração de vegetação, inconclusivo), com thresholds configuráveis.
- Geração automática de alerta quando o resultado indicar alteração, e registro da análise no histórico/auditoria do sistema.

### 4.6 Comparador de Imagens (Antes × Depois)

Componente interativo para visualização comparativa de imagens de satélite de uma mesma área em dois períodos distintos.

Deverá conter:
- Um slider horizontal interativo (arrastável e clicável) que revela progressivamente a imagem "antes" sobre a imagem "depois".
- Indicação textual das datas de cada imagem.
- Indicador visual de status (alteração detectada ou normal), com percentual de confiança quando houver alteração.
- Painel de métricas complementares quando houver alteração: área afetada, percentual afetado e tipo de alteração.
- Atalhos para iniciar nova análise, visualizar a área no mapa ou gerar relatório diretamente a partir do comparador.

### 4.7 Central de Alertas

Módulo de gestão dos alertas gerados pelo sistema (automaticamente pelas análises ou manualmente).

Deverá permitir:
- Listagem de todos os alertas, com filtros rápidos por severidade (crítico, alto, médio, normal).
- Exibição de cada alerta com: área relacionada, tipo de alteração, severidade, nível de confiança, área afetada, status e data.
- Visualização detalhada do alerta em modal, incluindo histórico de mudanças de status.
- Fluxo de status do alerta: *Detectado* → *Em análise* → *Confirmado* / *Falso positivo* → *Encerrado*.
- Ações rápidas: atualizar status, marcar como resolvido, visualizar análise relacionada ou localizar a área no mapa.
- Atualização automática do contador de notificações/alertas críticos no cabeçalho do sistema.

### 4.8 Histórico / Auditoria

Módulo de rastreabilidade de todas as ações relevantes realizadas no sistema (criação de áreas, execuções de análise, mudanças de status de alertas, exclusões, etc.).

Deverá conter:
- Linha do tempo cronológica com ícones e cores por severidade.
- Filtro por área monitorada específica.
- Registro estruturado de cada entrada: ação realizada, detalhes, usuário responsável, área relacionada (quando aplicável) e timestamp.
- Suporte a política de retenção/limpeza de registros antigos (ex.: manter os últimos 90 dias ou um número máximo de registros).

### 4.9 Relatórios

Módulo de geração de relatórios consolidados sobre o estado das áreas monitoradas.

Deverá permitir:
- Geração de um relatório com resumo executivo (total de áreas, áreas com alteração, áreas críticas) e detalhamento individual de cada área (categoria, hectares, status, prioridade, confiança, área afetada, última análise).
- Visualização do relatório em modal, com opções de impressão e exportação.
- Exportação do relatório como arquivo HTML autônomo, pronto para download/compartilhamento.
- Indicação clara quando os dados exibidos forem provenientes do modo de demonstração.

### 4.10 Configurações

Tela administrativa para parametrização do sistema.

Deverá conter:
- Indicação do modo de operação atual (DEMO ou REAL) e da fonte de dados em uso.
- Área de configuração da integração com provedor de imagens de satélite (ex.: Copernicus), incluindo endpoint e status de configuração — preparada para uso futuro, mas não obrigatória no MVP.
- Ações de manutenção de dados:
  - Resetar os dados para o conjunto de demonstração original.
  - Exportar todas as áreas cadastradas em formato GeoJSON.

### 4.11 Sistema de Notificações

Componente transversal, presente em todas as telas, responsável por exibir notificações temporárias (toast) para o usuário em eventos como: criação/exclusão de áreas, novos alertas, conclusão de análises, erros de operação e mensagens de boas-vindas ao iniciar o sistema.

---

## 5. Modos de Operação

O sistema deverá suportar dois modos de operação, controlados por uma configuração central:

- **Modo DEMO**: utiliza dados simulados (áreas, alertas, imagens e resultados de análise gerados artificialmente), permitindo apresentar e validar todo o fluxo do sistema sem depender de uma integração real com provedores de imagens de satélite.
- **Modo REAL** *(preparado para evolução futura)*: destinado à integração com serviços reais de imagens de satélite (ex.: Copernicus/Sentinel-2), substituindo a geração simulada de imagens e análises por processamento sobre dados reais. Este modo não faz parte do escopo de implementação inicial, mas a arquitetura do sistema deverá already prever os pontos de extensão necessários (camada de abstração de serviço de satélite).

---

## 6. Arquitetura Técnica Prevista

O sistema deverá ser construído como uma aplicação web client-side (HTML, CSS e JavaScript), organizada em camadas bem definidas:

### 6.1 Camada de Configuração
- Um módulo central de configuração, responsável por armazenar parâmetros globais do sistema: modo de operação, definições do mapa, categorias, prioridades, status, frequências e limiares de análise.

### 6.2 Camada de Serviços (lógica de negócio e persistência)
- **Serviço de Armazenamento**: responsável pela persistência local dos dados (inicialmente via armazenamento no navegador), com estrutura pensada para permitir futura migração para um banco de dados ou API REST.
- **Serviço de Áreas**: operações de CRUD sobre as áreas monitoradas, cálculo de estatísticas e exportação em GeoJSON.
- **Serviço de Alertas**: criação, atualização de status e consulta de alertas.
- **Serviço de Análise**: execução do fluxo de análise (simulado em modo DEMO), cálculo de índices espectrais e classificação de alterações.
- **Serviço de Satélite**: camada de abstração para busca de imagens e cálculo de índices, com implementação simulada no modo DEMO e ponto de extensão para integração real.
- **Serviço de Imagens**: geração de imagens ilustrativas (antes/depois) para o comparador, e atualização das imagens após cada análise.
- **Serviço de Relatórios**: geração do conteúdo HTML dos relatórios e exportação/download.
- **Serviço de Auditoria**: registro estruturado de eventos do sistema.
- **Serviço de Mapa**: encapsula a inicialização e atualização do mapa interativo e de suas camadas.

### 6.3 Camada de Interface (UI)
- Componentes de interface dedicados a cada módulo (Dashboard, Painel de Áreas, Central de Alertas, Linha do Tempo, Comparador de Imagens), responsáveis por renderizar os dados fornecidos pelos serviços e capturar interações do usuário.

### 6.4 Orquestrador da Aplicação
- Um módulo principal responsável por inicializar todos os serviços e componentes de interface, gerenciar a navegação entre telas, manipular os modais do sistema e centralizar o fluxo de eventos globais (criação de área, execução de análise, geração de relatório, etc.).

### 6.5 Bibliotecas de Terceiros Previstas
- **Leaflet** e **Leaflet Draw**: mapa interativo e desenho de polígonos.
- **Turf.js**: cálculos geoespaciais (área, perímetro, centroide).
- **Chart.js**: gráficos do dashboard.

---

## 7. Requisitos Não Funcionais

- **Idioma**: interface em português do Brasil.
- **Responsividade**: a interface deverá se adaptar a diferentes tamanhos de tela (desktop, tablet e dispositivos móveis), incluindo um menu lateral recolhível em telas menores.
- **Persistência local**: no MVP, os dados deverão ser mantidos no navegador do usuário, sem dependência de backend.
- **Modularidade**: cada funcionalidade deverá ser implementada em módulos independentes (serviços e componentes de UI), favorecendo manutenção e evolução futura.
- **Transparência do modo demonstração**: sempre que dados simulados forem exibidos, o sistema deverá sinalizar isso claramente ao usuário (selo de "modo demonstração").
- **Auditabilidade**: toda ação relevante deverá ser passível de rastreamento por meio do módulo de histórico.

---

## 8. Fora do Escopo (nesta fase)

Os itens a seguir são reconhecidos como necessários para a evolução do produto, porém **não fazem parte do escopo inicial** de desenvolvimento:

- Integração real com provedores de imagens de satélite (Copernicus/Sentinel ou similares).
- Autenticação de usuários, perfis de acesso e controle de permissões.
- Edição completa de áreas já cadastradas (previsto apenas como placeholder na versão inicial).
- Backend/API própria e banco de dados persistente em servidor.
- Notificações por e-mail, SMS ou push.
- Processamento real de imagens de satélite (o cálculo de índices espectrais utilizará dados simulados nesta fase).

---

## 9. Considerações Finais

Este documento estabelece o escopo funcional de referência para o desenvolvimento do Ecoflow. A arquitetura proposta busca equilibrar a simplicidade de um MVP operando com dados simulados (modo DEMO) com a preparação necessária para uma futura evolução rumo a um sistema de monitoramento ambiental real, integrado a fontes de dados de satélite e a processos formais de fiscalização.

Alterações neste escopo deverão ser formalizadas em revisões subsequentes deste documento.

Matriz de Responsabilidades de Desenvolvimento — Projeto EcoflowAbaixo está o detalhamento estruturado das responsabilidades e atribuições de cada integrante da equipe, alinhado com o escopo e a arquitetura técnica previstos para o Ecoflow.  1. Time de Desenvolvimento e TecnologiaDaniel Masson (Developer)Camada de Dados e Persistência: Implementação da estrutura de armazenamento local (localStorage) e operações de CRUD do Serviço de Áreas.  Interface do Usuário (UI Core): Desenvolvimento do Dashboard (integrando cartões estatísticos e gráficos do Chart.js) e do formulário de Cadastro de Áreas.  Gestão da Listagem: Construção do Painel de Áreas (cards em grid, busca global/filtros e empty states).  Rastreabilidade e Notificações: Criação do módulo de Histórico/Auditoria com filtro por área e política de retenção, além do sistema transversal de Notificações (toasts).  Jonathan Barufke (Developer)Engenharia Geoespacial: Integração e manipulação do mapa com Leaflet, cálculo de áreas e perímetros via Turf.js e renderização de polígonos/centroides.  Motor de Análise Ambiental: Implementação do Módulo de Análise, incluindo o fluxo de execução por etapas, cálculo dos índices espectrais (NDVI, NBR, dNBR) e cálculo da área afetada.  Comparação Visual e Alertas: Criação do Comparador de Imagens (slider interativo antes/depois) e da Central de Alertas (gestão do ciclo de vida dos alertas e contadores no cabeçalho).  Relatórios Executivos: Implementação do gerador de relatórios e exportador em formato HTML autônomo.  Pietro Verzeletti Martiori (Organização e Tecnologias)Arquitetura Client-Side: Estruturação da arquitetura modular do sistema, definindo o padrão de comunicação entre a camada de serviços, componentes UI e o orquestrador.  Seleção de Tecnologias: Escolha e validação das bibliotecas de terceiros (Leaflet, Leaflet Draw, Turf.js e Chart.js).  Abstração e Extensibilidade: Estruturação da camada de serviços para garantir a transição do modo DEMO (dados simulados) para a futura integração real com fontes de satélite (ex.: Copernicus).  Módulo Administrativo: Implementação da tela de Configurações (alternância de modos, reset do banco local e exportação em GeoJSON).  2. Time de Gestão, Organização e QualidadeGabriel Bessegato Vanz (Gestão de equipe e Gerador de Ideias)Liderança de Projeto: Condução geral da equipe para garantir o cumprimento dos objetivos do sistema (centralização de monitoramento, automação de alertas e auditoria).  Direcionamento Estratégico: Priorização do escopo funcional para garantir a entrega de um MVP consistente e funcional em modo DEMO.  Cassiano Antônio Manfrin (Organizador)Gestão de Cronograma e Sprints: Mapeamento dos 11 módulos funcionais (4.1 a 4.11) em tarefas e acompanhamento do progresso de desenvolvimento.  Documentação Executiva: Organização das atas, prazos e controle das versões do documento de escopo.  Paula da Conceição Pastore (Organizadora)Garantia da Qualidade (QA): Validação dos requisitos não funcionais, garantindo interface responsiva, operação em português e correta exibição dos selos de modo DEMO.  Validação de Fluxos: Testes integrados ponta a ponta (cadastro de área -> execução de análise -> geração de alerta -> atualização de status -> emissão de relatório).  3. Time de Ideação, Negócio e ComunicaçãoPedro Spagnol (Gerador de ideias)Modelagem de Dados Simulados: Criação e estruturação da base de dados mock para o modo DEMO (coordenadas de áreas brasileiras, estatísticas e históricos).  Cenários de Teste: Proposição de casos de uso e eventos realistas para validação do mapa, dos alertas e das notificações informativas.  João Araldi (Gerador de ideias)Regras de Negócio e Limiares (Thresholds): Definição dos parâmetros técnicos de variação dos índices espectrais (NDVI e NBR) para classificação de desmatamento, queimadas e alteração de solo.  Design de Experiência (UX): Proposição da hierarquia visual dos cartões, cores por nível de severidade e legibilidade das métricas.  Gabriel Resmini (Apresentador)Estratégia de Comunicação: Elaboração da narrativa e do pitch focado nas dores dos públicos-alvo (órgãos ambientais, gestores rurais e pesquisadores).  Demonstração Prática (Live Demo): Condução das apresentações operando o sistema no modo DEMO e destacando o comparador de imagens e os relatórios exportáveis

