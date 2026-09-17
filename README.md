# 🌐 Jasper AI HUD - Assistente de Voz 3D & Estação de Autonomia

O **Jasper AI HUD** é uma estação de comando e assistente de inteligência artificial futurista para desktop (Windows), projetada no estilo HUD holográfico/sci-fi. Ele integra um **Avatar 3D interativo com sincronização labial (Lip Sync)** em tempo real, **comunicação de voz bidirecional ultra-rápida via Gemini Multimodal Live**, **ativação por voz local (Wake Word)** e uma suíte completa de **17 módulos de autonomia e automação do sistema operacional**.

O assistente permite que você converse naturalmente por voz, compartilhe sua tela em tempo real, execute códigos, gerencie tarefas, controle periféricos e automatize fluxos de trabalho sem custo de serviços pagos e sem depender de APIs externas pagas.

---

## 📑 Sumário

- [Visão Geral e Para Que Serve](#-visão-geral-e-para-que-serve)
- [Como o Programa Funciona (Arquitetura)](#-como-o-programa-funciona-arquitetura)
- [Aplicativos e Requisitos Externos Necessários](#-aplicativos-e-requisitos-externos-necessários)
- [Matriz de Status Operacional dos Módulos](#-matriz-de-status-operacional-dos-módulos)
- [Painéis de Configuração Avançada dos Módulos](#-painéis-de-configuração-avançada-dos-módulos)
- [Guia Rápido de Instalação e Execução](#-guia-rápido-de-instalação-e-execução)
- [Controles e Modos de Visualização](#-controles-e-modos-de-visualização)
- [Catálogo Completo das Ferramentas do Sistema](#-catálogo-completo-das-ferramentas-do-sistema)
- [Os 17 Módulos de Autonomia Explicados com Exemplos](#-os-17-módulos-de-autonomia-explicados-com-exemplos)
- [Loop de Auto-Reflexão e Segurança (Reflexion Guard)](#-loop-de-auto-reflexão-e-segurança-reflexion-guard)
- [Privacidade, Segurança e Criptografia Local (Zero-Trust)](#-privacidade-segurança-e-criptografia-local-zero-trust)
- [Perguntas Frequentes (FAQ)](#-perguntas-frequentes-faq)

---

## 🎯 Visão Geral e Para Que Serve

O Jasper AI HUD transforma seu computador em uma estação operacional inteligente (estilo J.A.R.V.I.S.):

1. **Assistente de Voz Conversacional Contínuo**: Fala e escuta simultaneamente em tempo real com baixa latência, usando a API Multimodal Live do Gemini da Google via WebSocket direto.
2. **Avatar 3D com Lip Sync & Efeitos Sci-Fi**: Renderizado em Three.js a 60 FPS com pós-processamento Bloom, malha neural animada em background e visualizador de espectro de áudio.
3. **Visão Computacional Multimodal**: O assistente pode "enxergar" sua tela a qualquer momento para te ajudar a programar, analisar gráficos, revisar textos ou encontrar erros.
4. **Automação Completa do Sistema**: Executa códigos Python e Node.js em sandbox, organiza pastas desordenadas, monitora repositórios Git, dispara webhooks no n8n e controla dispositivos inteligentes via Home Assistant.
5. **Produtividade Proativa**: Avisa sobre reuniões 10 minutos antes, alerta sobre picos críticos de memória RAM, lê dados copiados na área de transferência e oferece briefings matinais.

---

## 🏗️ Como o Programa Funciona (Arquitetura)

O sistema foi construído sob o ecossistema **Electron + Vite + TypeScript**, dividido em três camadas:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RENDERER PROCESS (UI)                           │
│  Three.js Avatar 3D  │  Web Audio FFT LipSync  │  TensorFlow Wake Word │
│  HUD Holográfico     │  Audio Visualizer       │  Settings Modal (Tabs)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (IPC Seguro via Preload ContextBridge)
┌───────────────────────────────────▼────────────────────────────────────┐
│                         MAIN PROCESS (Node.js)                         │
│  Gemini Live WebSocket Client (PCM 16-bit 24kHz / 16kHz)               │
│  Config Store & Memory Engine (Persistência JSON Local)                │
│  Autonomy Coordinator (17 Módulos em Background)                       │
│  Reflexion Engine (Pre-execution Safety & Post-flight Critique)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Chamadas de Sistema e Automações)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    SISTEMA OPERACIONAL & HARDWARE                      │
│  Microfone / Caixas de Som  │  Desktop Capturer  │  PowerShell Script  │
│  Sandbox Python / Node.js   │  Git CLI           │  Home Assistant/n8n │
└────────────────────────────────────────────────────────────────────────┘
```

- **Processo Principal (`src/main`)**: Gerencia o ciclo de vida do Electron, streaming de áudio PCM via WebSocket para a API do Gemini, execução de chamadas de sistema, orquestração assíncrona dos módulos de autonomia e persistência local.
- **Preload (`src/preload`)**: Camada de isolamento de contexto (`contextBridge`) que expõe métodos tipados e seguros para a interface web, impedindo injeções maliciosas.
- **Renderizador (`src/renderer`)**: Interface gráfica com tema Cyberpunk/HUD, cena Three.js do avatar com materiais customizados, analisador de frequência de áudio para movimento labial síncrono e detecção de Wake Word com TensorFlow.js.

---

## 📦 Aplicativos e Requisitos Externos Necessários

Para que **todas** as ferramentas e módulos funcionem perfeitamente, veja abaixo os softwares e dependências necessárias. **Todos são 100% gratuitos e funcionam localmente**:

| Software / Ferramenta | Obrigatório? | Finalidade | Como Obter / Configurar |
| :--- | :---: | :--- | :--- |
| **Node.js (v18+ ou v20+ LTS)** | **SIM** | Executar a aplicação Electron, gerenciar pacotes e rodar scripts JS no Code Interpreter. | Baixe no site oficial: [nodejs.org](https://nodejs.org/). Marque a opção de adicionar ao PATH. |
| **Chave de API do Google Gemini** | **SIM** | Cérebro multimodal e processamento de voz em tempo real. | Grátis no [Google AI Studio](https://aistudio.google.com/). O plano gratuito oferece cotas generosas sem necessidade de cartão de crédito. |
| **Microfone e Caixas de Som** | **SIM** | Entrada e saída de áudio para a conversa em tempo real. | Dispositivo padrão configurado no Windows. |
| **PowerShell (v5.1+)** | **SIM** | Identificar a janela ativa em foco e ler estatísticas do disco rígido. | Já vem instalado e ativado por padrão em todo Windows 10 e 11. |
| **Python (v3.9+)** | *Recomendado* | Executar scripts de análise de dados, gráficos e rotinas matemáticas no **Code Interpreter**. | Baixe em [python.org](https://www.python.org/) ou via Microsoft Store. **Importante**: Marque a caixa *"Add python.exe to PATH"*. |
| **Git for Windows** | *Recomendado* | Módulo **Git Watcher** (monitorar branches, diffs, sugerir commits semânticos e rodar testes). | Baixe em [git-scm.com](https://git-scm.com/). Adicione ao PATH do Windows. |
| **Visual Studio Code** | *Opcional* | Abrir o editor rapidamente através do comando `open_app`. | Baixe em [code.visualstudio.com](https://code.visualstudio.com/). Certifique-se de habilitar *"Adicionar ao PATH"*. |
| **Spotify (Desktop)** | *Opcional* | Tocar faixas, artistas e playlists pelo comando de mídia `play_music`. | Caso não use Spotify, o assistente abre automaticamente a busca no YouTube. |
| **n8n / Zapier / Make** | *Opcional* | Disparar fluxos de automação através do **Webhook Manager**. | O [n8n](https://n8n.io/) é 100% open source e pode ser executado localmente de graça com o comando `npx n8n`. |
| **Home Assistant** | *Opcional* | Controlar lâmpadas inteligentes, ar-condicionado e tomadas via **Smart Home**. | Caso você não possua um servidor Home Assistant na sua rede, o assistente opera em modo de simulação contextual. |

---

## 📊 Matriz de Status Operacional dos Módulos

O Jasper AI HUD opera sob o princípio de **Transparência Operacional Total**. Cada ferramenta executada pelo assistente indica explicitamente se a ação foi realizada de maneira real no sistema operacional ou se operou em modo de demonstração/simulação segura caso algum serviço externo não esteja configurado:

| Nº | Módulo | Tipo de Operação | Sem Configuração Externa | Com Configuração no Painel | Proteção / Segurança |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **01** | **Visão de Tela** | **100% Nativo** | Captura frame real via `desktopCapturer` | Totalmente autônomo | Frame JPEG base64 enviado diretamente via WebSocket |
| **02** | **Rastreador de Janelas** | **100% Nativo** | Lê a janela em foco via API do Windows | Totalmente autônomo | Leitura somente-leitura com polling de 4s |
| **03** | **Observador do Clipboard** | **100% Nativo** | Monitora texto copiado localmente | Totalmente autônomo | Redação automática de credenciais e chaves de API |
| **04** | **Motor Cron & Lembretes** | **100% Nativo** | Fila de timers em JSON local | Totalmente autônomo | Proteção contra disparos duplicados pós-suspensão |
| **05** | **Monitor de Saúde** | **100% Nativo** | Mede CPU, RAM e Disco C: | Totalmente autônomo | Cache de métricas de disco por 60s (zero lag) |
| **06** | **Briefing Diário** | **100% Nativo** | Agrega turno, agenda, hardware e janela | Totalmente autônomo | Leitura consolidada em memória |
| **07** | **Memória Semântica** | **100% Nativo** | TF-IDF e Similaridade por Cosseno | Totalmente autônomo | 100% matemático local, sem banco vetorial pago |
| **08** | **Grafo de Conhecimento** | **100% Nativo** | Estrutura de grafos persistida em JSON | Totalmente autônomo | Gravação atômica em disco |
| **09** | **Code Interpreter** | **100% Nativo** | Execução sandboxed Python/Node.js | Habilitado sob demanda | Desativado por padrão; sanitização total de env vars |
| **10** | **Navegador Headless** | **100% Nativo** | Instância Chromium off-screen Electron | Totalmente autônomo | Limpeza de scripts e timeout com liberação de memória |
| **11** | **Git Watcher** | **100% Nativo** | Usa diretório de execução atual | Repositório específico via Seletor | Executa apenas comandos seguros (`git add -u`, etc.) |
| **12** | **Organizador de Pastas** | **100% Nativo** | Organiza pasta Downloads padrão | Pasta personalizada via Seletor | Modo dry-run prévio; proteção de arquivos travados |
| **13** | **Subagentes Paralelos** | **100% Nativo** | Pool assíncrono em segundo plano | Totalmente autônomo | Ciclo de vida com cancelamento via AbortController |
| **14** | **Reflexion Guard** | **100% Nativo** | Motor heurístico de segurança ativo | Totalmente autônomo | Bloqueia comandos destrutivos; requer autorização no HUD |
| **15** | **Agenda & E-mails** | **Híbrido** | iCal nativo; E-mails com tag `[Demonstração Local]` | Conecta ao servidor IMAP informado | Senha do e-mail criptografada via DPAPI do Windows |
| **16** | **Disparador de Webhooks**| **Híbrido** | Requer URL de destino fornecida no comando | Endpoint salvo com botão "Testar" | Bloqueio rigoroso de SSRF (loopback/RFC1918 restritos) |
| **17** | **Casa Inteligente (HA)** | **Híbrido** | Retorna simulação contextual com `[SIMULADO]` | Executa chamadas reais via REST API | Token criptografado via DPAPI; Domain Allowlist ativo |

> 🏷️ **Tags de Transparência do Sistema**:
> - **`[EXECUTADO]`**: Confirmação de que a chamada HTTP ou comando de sistema foi enviado e aceito com sucesso pelo serviço real.
> - **`[SIMULADO]`**: Informa ao usuário e ao modelo que a ação foi simulada localmente porque o serviço externo (ex: Home Assistant) não foi configurado.
> - **`[REQUER CONFIGURAÇÃO]`**: Alerta amigável indicando qual campo de credencial precisa ser preenchido no painel de configurações.

---

## ⚙️ Painéis de Configuração Avançada dos Módulos

Na aba **Autonomia** do Painel de Configurações, os módulos que aceitam caminhos locais ou credenciais externas contam com sub-painéis integrados com design sci-fi e botões de ação nativos:

### 🏠 1. Casa Inteligente (Home Assistant)
- **URL da Instância**: Insira a URL do seu servidor Home Assistant (ex: `http://homeassistant.local:8123` ou `http://192.168.1.100:8123`).
- **Token de Acesso (Bearer)**: Gere um Token de Acesso de Longa Duração no seu perfil do Home Assistant. O token é **criptografado via DPAPI do Windows** antes de ser salvo no disco.
- **Botão "Testar Conexão"**: Testa imediatamente o endpoint `/api/` com o token informado, exibindo o status de conexão em tempo real sem precisar reiniciar o app.

### 🐙 2. Git Watcher (Repositório de Trabalho)
- **Caminho do Repositório**: Define qual pasta de projeto o Git Watcher deve inspecionar.
- **Botão "Procurar"**: Abre a janela de seleção nativa de diretórios do Windows Explorer (`dialog.showOpenDialog`) para selecionar qualquer repositório com um clique.

### 📁 3. Organizador de Pastas (Pasta Alvo Padrão)
- **Caminho da Pasta**: Permite apontar uma pasta customizada para organização periódica (ex: `D:\Triagem`, `C:\Users\...\Desktop`).
- **Botão "Procurar"**: Seletor nativo de diretórios do Windows Explorer.

### ⚡ 4. Disparador de Webhooks (Endpoint Padrão)
- **URL Padrão**: Define a URL base para envios de webhooks (ex: seu webhook de entrada no n8n: `http://localhost:5678/webhook/jasper`).
- **Botão "Testar Disparo"**: Dispara um payload JSON de teste (`{"event":"test_ping","source":"jasper_hud"}`) para confirmar a conectividade com o seu webhook.

### 📅 5. Agenda & E-mails (Servidor IMAP)
- **Host IMAP**: Endereço do servidor de e-mail (ex: `imap.gmail.com`, `outlook.office365.com`).
- **Porta**: Porta segura SSL/TLS (padrão `993`).
- **Usuário**: Seu endereço de e-mail de login.
- **Senha de Aplicativo**: Senha de app específica (como as geradas pelo Google ou Microsoft). **Criptografada via DPAPI do Windows**.

---

## 🚀 Guia Rápido de Instalação e Execução

### 1. Clonar ou Baixar o Projeto
Abra o terminal (PowerShell ou Command Prompt) na pasta do projeto:
```powershell
cd jasper-avatar
```

### 2. Instalar Dependências
```powershell
npm install
```
*(O script de pós-instalação configura automaticamente os modelos e texturas 3D locais).*

### 3. Iniciar o Assistente em Modo de Desenvolvimento
```powershell
npm run dev
```

### 4. Configurar a Chave da API Gemini
1. Ao abrir o aplicativo, clique no ícone de **Engrenagem** (Configurações) no canto superior direito.
2. Na aba **Geral**, cole sua chave de API do Google Gemini.
3. Escolha a voz desejada (ex: `Puck`, `Charon`, `Aoede`, `Fenrir`, `Kore`) e o nome do assistente (ex: *Jasper*).
4. Clique em **Salvar Configurações**. O assistente se conectará automaticamente e o status exibirá `Jasper Online`.

### 5. Compilar para Produção (Opcional)
Para gerar os pacotes finais otimizados:
```powershell
npm run build
```

---

## 🖥️ Controles e Modos de Visualização

O Jasper AI HUD foi desenhado para acompanhar seu dia a dia sem atrapalhar seu espaço de trabalho:

- **Modo Normal (HUD Expandido)**: Interface completa com avatar 3D, chat drawer lateral, histórico de conversas e visualizador de ondas sonoras.
- **Modo Tela Cheia (Tecla `F12`)**: Pressione **F12** a qualquer momento para entrar ou sair do modo tela cheia imersiva.
- **Modo Picture-in-Picture / Mini HUD (Ícone PiP ou Botão)**: Reduz o assistente para um widget flutuante compacto e sempre no topo (*Always on Top*), ideal para deixar no canto da tela enquanto você programa ou joga.
- **Palavra de Ativação (Wake Word)**: Diga *"Jasper"* para ativar o microfone sem precisar clicar no botão.
- **Botão de Microfone**: Pressione para iniciar ou encerrar a fala manualmente.
- **Gaveta de Chat Lateral (Ícone de Chat)**: Abra para ver a transcrição em texto da conversa e enviar prompts digitados.

---

## 🛠️ Catálogo Completo das Ferramentas do Sistema

O assistente possui um conjunto de ferramentas nativas que a IA executa em resposta aos seus pedidos de voz:

### 1. `open_app` (Abrir Aplicativos Locais)
- **O que faz**: Inicia softwares autorizados no Windows de forma segura (`calc.exe`, `notepad.exe`, `explorer.exe`, `cmd.exe`, `wt.exe`, `powershell.exe`, `code.cmd`).
- **Exemplo de comando**:
  > *"Jasper, abra a calculadora"* ou *"Abra o VS Code para mim"*.

### 2. `calculate` (Calculadora Matemática de Alta Precisão)
- **O que faz**: Executa cálculos numéricos no motor de matemática local, eliminando alucinações de modelos de linguagem em operações complexas.
- **Exemplo de comando**:
  > *"Quanto é a raiz quadrada de 256 vezes 18?"*.

### 3. `organize_folder` (Organização Rápida de Pastas)
- **O que faz**: Separa arquivos soltos da pasta Downloads ou Desktop em pastas categorizadas (`Documentos`, `Imagens`, `Instaladores_Compactados`, `Midia`, `Outros`).
- **Exemplo de comando**:
  > *"Jasper, organize a minha pasta de Downloads"*.

### 4. `remember_fact` (Memorização Permanente)
- **O que faz**: Salva preferências, detalhes pessoais ou notas de trabalho na memória permanente local (`jasper-memory.json`), que é lida e relembrada em conversas futuras.
- **Exemplo de comando**:
  > *"Lembre-se de que meu café favorito é espresso sem açúcar e que prefiro código em TypeScript"*.

### 5. `search_web` (Pesquisa no Google)
- **O que faz**: Abre o navegador padrão diretamente na página de pesquisa do Google com a consulta formatada.
- **Exemplo de comando**:
  > *"Pesquise no Google o que é o framework Astro"*.

### 6. `open_link` (Abertura de URLs)
- **O que faz**: Abre links diretos no navegador padrão do sistema operacional.
- **Exemplo de comando**:
  > *"Abra o site do GitHub"*.

### 7. `play_music` (Controle de Música)
- **O que faz**: Busca e inicia reprodução de faixas ou artistas no Spotify Desktop. Se o Spotify não estiver aberto ou falhar, abre no YouTube.
- **Exemplo de comando**:
  > *"Toque Bohemian Rhapsody no Spotify"*.

---

## 🤖 Os 17 Módulos de Autonomia Explicados com Exemplos

Na aba **Autonomia** do Painel de Configurações, você pode ligar ou desligar individualmente qualquer um dos 17 módulos inteligentes:

```
Painel de Controle -> Aba 5 [Autonomia]
 ├─ 01. Visão de Tela (Screen Awareness)               [Ativo]
 ├─ 02. Rastreador de Janelas (Active Window Tracker)  [Ativo]
 ├─ 03. Observador do Clipboard (Clipboard Watcher)    [Ativo]
 ├─ 04. Motor de Lembretes & Tarefas (Cron Engine)     [Ativo]
 ├─ 05. Monitor de Saúde do Sistema (System Health)    [Ativo]
 ├─ 06. Briefing Diário (Daily Briefing Service)       [Ativo]
 ├─ 07. Memória Semântica Vetorial (Semantic Memory)   [Ativo]
 ├─ 08. Grafo de Conhecimento (Knowledge Graph)        [Ativo]
 ├─ 09. Interpretador de Código Sandboxed Local        [Ativo]
 ├─ 10. Automação de Navegador Headless                [Ativo]
 ├─ 11. Git Watcher & Assistente de Commits            [Ativo]
 ├─ 12. Organizador da Área de Trabalho & Downloads    [Ativo]
 ├─ 13. Orquestrador de Subagentes Paralelos           [Ativo]
 ├─ 14. Loop de Auto-Reflexão (Reflexion Guard)        [Ativo]
 ├─ 15. Agenda de Compromissos (iCal) & E-mails        [Ativo]
 ├─ 16. Disparador de Webhooks (n8n / Zapier / Make)   [Ativo]
 └─ 17. Casa Inteligente (Home Assistant)              [Ativo]
```

---

### Módulo 01: 👁️ Visão de Tela (Screen Awareness)
- **Arquivo**: [`src/main/autonomous/screen-awareness.ts`](file:///c:/Users/alisson.santos/Documents/Arquivos/hud%20ai/src/main/autonomous/screen-awareness.ts)
- **Como funciona**: Utiliza o módulo nativo `desktopCapturer` do Electron para capturar o frame do monitor primário e codificar em JPEG em memória (sem gravar lixo no disco). A imagem é enviada para análise visual do Gemini.
- **Exemplo de uso**:
  > *"Jasper, olhe para minha tela e me diga onde está o erro de sintaxe nesse código que estou editando."*
- **Resultado**: O assistente analisa visualmente o editor de código e responde apontando a linha e o erro.

---

### Módulo 02: 🪟 Rastreador de Janelas Ativas (Window Tracker)
- **Arquivo**: [`src/main/autonomous/window-tracker.ts`](file:///c:/Users/alisson.santos/Documents/Arquivos/hud%20ai/src/main/autonomous/window-tracker.ts)
- **Como funciona**: Executa um script em background que consulta o Windows via API do usuário (`GetForegroundWindow`) a cada 4 segundos, identificando qual software está em foco (ex: Chrome, VS Code, Figma, Terminal) e o título da janela.
- **Exemplo de uso**:
  > *"Jasper, qual janela eu estou usando agora?"* ou quando ele monta seu resumo: *"Vejo que você está trabalhando no arquivo `calendar-email.ts` dentro do VS Code."*

---

### Módulo 03: 📋 Observador do Clipboard (Clipboard Watcher)
- **Arquivo**: [`src/main/autonomous/clipboard-watcher.ts`](file:///c:/Users/alisson.santos/Documents/Arquivos/hud%20ai/src/main/autonomous/clipboard-watcher.ts)
- **Como funciona**: Monitora a área de transferência do Windows a cada 1,5s. Caso você copie um texto contendo **stack trace de erro** (`NullReferenceException`, `TypeError`, `Traceback`), uma **URL** ou um **JSON válido**, o Jasper dispara uma notificação no HUD oferecendo ajuda antes mesmo de você perguntar.
- **Exemplo de uso**:
  > Você copia um erro no terminal: `TypeError: Cannot read properties of undefined (reading 'map')`.
  > O HUD exibe imediatamente um Toast no canto superior: *"[Clipboard] Detectei um erro copiado. Deseja que eu explique a causa e a correção?"*

---

### Módulo 04: ⏰ Motor Cron & Lembretes Agendados (Cron Engine)
- **Arquivo**: [`src/main/autonomous/cron-engine.ts`](file:///c:/Users/alisson.santos/Documents/Arquivos/hud%20ai/src/main/autonomous/cron-engine.ts)
- **Como funciona**: Fila de tarefas persistida em `jasper-schedules.json` que verifica a cada 10 segundos tarefas com prazo expirado. Suporta lembretes únicos (`once`), horários (`hourly`) e diários (`daily`), com proteção contra disparos duplicados após retorno de suspensão do PC.
- **Exemplo de uso**:
  > *"Jasper, me lembre de desligar o forno daqui a 25 minutos."*
  > *"Me lembre todo dia de conferir os commits às 18 horas."*
- **Resultado**: Ao vencer o tempo, o Jasper emite um som e exibe uma notificação com o texto do lembrete.

---

### Módulo 05: 📊 Monitor de Saúde do Sistema (System Health Watcher)
- **Arquivo**: [`src/main/autonomous/system-health.ts`](file:///c:/Users/alisson.santos/Documents/Arquivos/hud%20ai/src/main/autonomous/system-health.ts)
- **Como funciona**: Mede a cada 8 segundos os ciclos ociosos da CPU (`os.cpus()`), o uso de memória RAM (`os.totalmem()`, `os.freemem()`), espaço livre em disco (com cache inteligente de 60s) e tempo de atividade do Windows (*uptime*). Caso a RAM ultrapasse 92%, um alerta proativo de sobrecarga é emitido.
- **Exemplo de uso**:
  > *"Jasper, como estão os recursos da máquina?"*
- **Resultado**: *"Seu processador está em 14%, memória RAM em 58% (9.2 GB usados de 16.0 GB) e há 120 GB livres no disco C:. Sistema online há 6 horas."*

---

### Módulo 06: ☀️ Briefing Diário Inteligente (Daily Briefing)
- **Arquivo**: [`src/main/autonomous/briefing-service.ts`](file:///c:/Users/alisson.santos/Documents/Arquivos/hud%20ai/src/main/autonomous/briefing-service.ts)
- **Como funciona**: Consolida a saudação baseada no turno atual (manhã, tarde, noite ou madrugada), data formatada por extenso, saúde dos recursos do computador, tarefas e reuniões pendentes e janela em foco.
- **Exemplo de uso**:
  > *"Jasper, me dê meu resumo diário"* ou *"Bom dia!"*
- **Resultado**: *"Bom dia, Comandante! Hoje é quarta-feira, 16 de setembro. Sistema online há 2 horas com RAM em 45%. Você tem 1 reunião marcada às 15h e 2 lembretes pendentes na fila. Seu foco atual está no VS Code."*

---

### Módulo 07: 🧠 Memória Semântica com Busca Vetorial Local
- **Arquivo**: [`src/main/autonomous/semantic-memory.ts`](file:///c:/Users/alisson.santos/Documents/Arquivos/hud%20ai/src/main/autonomous/semantic-memory.ts)
- **Como funciona**: Implementação 100% matemática em Node.js de **TF-IDF com Similaridade por Cosseno**. Não requer banco vetorial externo (como Pinecone ou ChromaDB) e não faz chamadas a APIs pagas de embeddings. Remove *stopwords* em português e inglês e pontua a relevância semântica de memórias passadas.
- **Exemplo de uso**:
  > *"Jasper, pesquise na memória o que eu comentei sobre o banco de dados do novo projeto."*
- **Resultado**: *"Encontrei 2 memórias: 1. [Relevância 89%] 'Preferência por usar PostgreSQL com Prisma no backend'. 2. [Relevância 65%] 'Configurar backups diários'."*

---

### Módulo 08: 🕸️ Grafo de Conhecimento Relacional (Knowledge Graph)
- **Arquivo**: [`src/main/autonomous/knowledge-graph.ts`](file:///c:/Users/alisson.santos/Documents/Arquivos/hud%20ai/src/main/autonomous/knowledge-graph.ts)
- **Como funciona**: Estrutura persistente de nós e arestas relacionais salva em `jasper-knowledge-graph.json`. Mapeia pessoas, conceitos, softwares e tarefas com conexões direcionadas e pesos.
- **Exemplo de uso**:
  > *"Conecte no grafo que o Alisson é o desenvolvedor líder do projeto HUD AI."*
  > *"Quem está relacionado ao projeto HUD AI?"*
- **Resultado**: `[Grafo: HUD AI (Projeto)] ← lidera ← Alisson (Pessoa).`

---

### Módulo 09: 💻 Interpretador de Código Sandboxed Local (Code Interpreter)
- **Arquivo**: [`src/main/autonomous/code-interpreter.ts`](file:///c:/Users/alisson.santos/Documents/Arquivos/hud%20ai/src/main/autonomous/code-interpreter.ts)
- **Como funciona**: Cria um diretório seguro isolado em `%APPDATA%/jasper-avatar/sandbox/`. A IA pode escrever e executar scripts em **Python** ou **Node.js/JavaScript**, com limite de tempo (timeout de 30s), captura de stdout/stderr e identificação de novos arquivos gerados (gráficos PNG, planilhas CSV, etc.).
- **Exemplo de uso**:
  > *"Jasper, escreva um script em Python para calcular os primeiros 10 números de Fibonacci e me mostre o resultado."*
  > *"Gere um gráfico de dispersão com dados aleatórios e salve a imagem."*
- **Resultado**: O assistente executa o script, devolve a saída do terminal e notifica que a imagem `grafico.png` foi gerada na pasta sandbox.

---

### Módulo 10: 🌐 Automação de Navegador Headless (Worker Chromium)
- **Arquivo**: [`src/main/autonomous/headless-browser.ts`](file:///c:/Users/alisson.santos/Documents/Arquivos/hud%20ai/src/main/autonomous/headless-browser.ts)
- **Como funciona**: Instancia uma janela em segundo plano (*off-screen*) do próprio motor Chromium do Electron. Carrega URLs, remove anúncios, scripts de tracking e tags irrelevantes, e extrai o conteúdo limpo da página ou captura screenshots.
- **Exemplo de uso**:
  > *"Jasper, entre no site https://news.ycombinator.com e me diga quais são os 3 principais tópicos da primeira página."*
- **Resultado**: O assistente navega invisivelmente, extrai os títulos das notícias e responde por voz mastigando a informação.

---

### Módulo 11: 🐙 Git Watcher & Assistente de Commits Autônomos
- **Arquivo**: [`src/main/autonomous/git-watcher.ts`](file:///c:/Users/alisson.santos/Documents/Arquivos/hud%20ai/src/main/autonomous/git-watcher.ts)
- **Como funciona**: Conecta-se diretamente ao executável do Git na sua máquina. Inspeciona branches, status *porcelain*, lista arquivos alterados/não rastreados, elabora mensagens semânticas seguindo o padrão Conventional Commits (`feat:`, `fix:`, `chore:`, `style:`) e executa suítes de testes unitários (`npm test` ou `pytest`).
- **Exemplo de uso**:
  > *"Jasper, veja o que eu alterei no meu repositório e sugira um commit."*
  > *"Rode os testes unitários do projeto."*
- **Resultado**: *"Você modificou 3 arquivos na branch main: `calendar-email.ts`, `toast.ts` e `main.ts`. Sugestão de commit: `feat: implementar botão interativo de autorização no HUD toast`."*

---

### Módulo 12: 📁 Organizador Autônomo da Pasta Downloads & Área de Trabalho
- **Arquivo**: [`src/main/autonomous/folder-organizer.ts`](file:///c:/Users/alisson.santos/Documents/Arquivos/hud%20ai/src/main/autonomous/folder-organizer.ts)
- **Como funciona**: 
  1. **Varredura de Duplicados & Instaladores Velhos**: Calcula hash MD5 parcial rápido de arquivos grandes para encontrar duplicados idênticos e lista instaladores (`.exe`, `.msi`) esquecidos há mais de 30 dias.
  2. **Organização por Extensão**: Move arquivos para subpastas dedicadas (`Documentos`, `Imagens`, `Instaladores`, `Scripts`, `Vídeos`), com proteção de simulação prévia (`dryRun = true`) para evitar movimentações acidentais.
- **Exemplo de uso**:
  > *"Jasper, verifique se tenho arquivos duplicados ou instaladores velhos na pasta de Downloads."*
  > *"Organize minha área de trabalho agora."*
- **Resultado**: *"Foram identificados 4 instaladores antigos ocupando 680 MB e 2 arquivos duplicados. Deseja que eu organize em pastas?"*

---

### Módulo 13: 👥 Orquestrador de Subagentes Paralelos
- **Arquivo**: [`src/main/autonomous/subagent-orchestrator.ts`](file:///c:/Users/alisson.santos/Documents/Arquivos/hud%20ai/src/main/autonomous/subagent-orchestrator.ts)
- **Como funciona**: Pool assíncrono que instancia múltiplos "trabalhadores" em background com papéis especializados:
  - `researcher`: Faz buscas web e navegação off-screen.
  - `coder`: Executa cálculos numéricos ou rotinas em Python/Node.js.
  - `tester`: Executa baterias de testes no repositório.
  - `analyst`: Cruza diagnósticos de recursos de hardware e Git.
- **Exemplo de uso**:
  > *"Jasper, coloque um subagente para pesquisar as novidades do Electron 33 enquanto a gente continua conversando."*
- **Resultado**: O assistente continua falando com você sem travar a interface. Minutos depois, uma notificação avisa: `[Subagente Concluído]: Relatório da pesquisa finalizado.`

---

### Módulo 14: 🛡️ Loop de Auto-Reflexão & Bloqueio de Alto Risco (Reflexion Guard)
- **Arquivo**: [`src/main/autonomous/reflexion-engine.ts`](file:///c:/Users/alisson.santos/Documents/Arquivos/hud%20ai/src/main/autonomous/reflexion-engine.ts)
- **Como funciona**: Mecanismo de segurança ativo que inspeciona todas as chamadas de ferramentas antes de sua execução (*Pre-flight Check*).
  - Comandos inofensivos (`get_active_window`, `calculate`, etc.) passam direto.
  - Scripts que tentam deletar pastas recursivamente (`shutil.rmtree`, `rmdir /s`), commits forçados (`--force`), pastas de sistema do Windows (`System32`) ou destinos de rede anômalos são **bloqueados na hora**.
  - O HUD emite um Toast de alerta com um botão interativo **"Autorizar Execução"** com duração estendida de 25 segundos. O comando só executa se você clicar para autorizar.
- **Exemplo de uso**:
  > A IA tenta rodar um script que deleta uma pasta inteira.
  > O assistente bloqueia imediatamente e avisa: *"Comando de alto risco detectado. Requer sua autorização na tela para prosseguir."*

---

### Módulo 15: 📅 Agenda Local (iCal) & Resumo de E-mails
- **Arquivo**: [`src/main/autonomous/calendar-email.ts`](file:///c:/Users/alisson.santos/Documents/Arquivos/hud%20ai/src/main/autonomous/calendar-email.ts)
- **Como funciona**:
  - **Calendário Padrão iCal**: Salva compromissos localmente e exporta arquivos padrão `.ics` (sincronizáveis com Google Agenda, Outlook ou Calendário do Windows).
  - **Alarme Proativo de 10 Minutos**: Um monitor em background verifica a agenda a cada 60 segundos e avisa visualmente e por voz exatamente 10 minutos antes de cada evento começar.
  - **Resumo de Mensagens**: Lista e-mails recentes filtrando mensagens marcadas como urgentes.
- **Exemplo de uso**:
  > *"Jasper, marque uma reunião de Planejamento amanhã às 14 horas com duração de 45 minutos."*
  > *"Quais compromissos eu tenho nas próximas 24 horas?"*
- **Resultado**: O evento é registrado, o arquivo `.ics` é salvo e o Jasper avisará às 13:50 sobre o início da reunião.

---

### Módulo 16: ⚡ Disparador de Webhooks (n8n / Zapier / Make / Slack)
- **Arquivo**: [`src/main/autonomous/webhook-manager.ts`](file:///c:/Users/alisson.santos/Documents/Arquivos/hud%20ai/src/main/autonomous/webhook-manager.ts)
- **Como funciona**: Motor de requisições HTTP REST (`POST`, `GET`, `PUT`) com timeouts seguros e catálogo persistido de webhooks em `jasper-webhooks.json`. Permite integrar o Jasper com pipelines de automação no **n8n local**, Zapier, Make ou disparar webhooks de canais do Slack e Discord.
- **Exemplo de uso**:
  > *"Jasper, dispare o webhook 'n8n-fluxo' com a mensagem 'relatório diário finalizado'."*
- **Resultado**: Uma requisição HTTP com payload JSON é enviada para o seu endpoint local do n8n (`http://localhost:5678/webhook/jasper`), disparando o fluxo configurado.

---

### Módulo 17: 🏠 Controle de Casa Inteligente (Home Assistant)
- **Arquivo**: [`src/main/autonomous/smart-home.ts`](file:///c:/Users/alisson.santos/Documents/Arquivos/hud%20ai/src/main/autonomous/smart-home.ts)
- **Como funciona**: Integração com a API REST oficial do **Home Assistant** (a maior plataforma open-source e local de automação residencial). Permite ligar, desligar e alternar estados de lâmpadas (`light`), interruptores (`switch`), ar-condicionado (`climate`) e persianas (`cover`). Se nenhuma URL/Token for informada, opera em modo simulado contextual.
- **Exemplo de uso**:
  > *"Jasper, apague a luz do escritório."*
  > *"Ligue o ar condicionado em 22 graus."*
- **Resultado**: *"Dispositivo 'light.escritorio' foi desligado com sucesso."*

---

## 🔒 Privacidade, Segurança e Criptografia Local (Zero-Trust)

O Jasper AI HUD foi desenhado sob princípios rigorosos de **Defesa em Profundidade** e **Zero-Trust**, garantindo que seus dados, arquivos e segredos permaneçam seguros no seu computador:

1. **Criptografia DPAPI de Credenciais (`electron.safeStorage`)**:
   - A sua **Chave de API do Gemini**, o **Token Bearer do Home Assistant** e a **Senha de Aplicativo do IMAP** nunca ficam salvos em texto puro no disco.
   - São cifrados pelo motor nativo de proteção de dados do Windows (`Data Protection API - DPAPI`) com o prefixo `enc:`. Apenas a sua conta de usuário ativa do Windows consegue decifrar os dados em runtime.

2. **Proteção Anti-SSRF (Server-Side Request Forgery) em Webhooks**:
   - O motor de webhooks possui um firewall interno que impede o modelo de enviar requisições para endereços de loopback (`localhost`, `127.0.0.1`), instâncias de metadados em nuvem (`169.254.169.254`) ou sub-redes privadas RFC1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), a menos que o endpoint seja explicitamente registrado e validado por você no painel de configurações.

3. **Zero-Trust Domain Allowlist no Smart Home**:
   - Apenas entidades de conforto e climatização são permitidas para execução (`light`, `switch`, `climate`, `fan`, `media_player`).
   - Dispositivos de segurança física (`lock`, `alarm_control_panel`, `cover`, `garage`, `camera`) possuem **bloqueio total no código**, impedindo que a IA destranque portas, altere alarmes ou abra garagens acidentalmente.

4. **Isolamento e Sanitização do Code Interpreter**:
   - Vem **desativado por padrão**.
   - Ao executar código, cria subprocessos em diretório sandbox isolado com **ambiente limpo**: todas as variáveis de ambiente sensíveis do sistema (`GEMINI_API_KEY`, tokens, senhas) são suprimidas de `process.env`, passando apenas variáveis essenciais do sistema operacional (`PATH`, `SYSTEMROOT`, `TEMP`).

5. **Redação Automática de Segredos no Clipboard**:
   - O observador da área de transferência mascara automaticamente padrões conhecidos de credenciais (`AIzaSy...`, `sk-...`, Bearer tokens) antes de processar ou enviar resumos ao modelo de linguagem.

6. **Injeção Multimodal Direta via WebSocket**:
   - A captura de tela gera frames JPEG em memória e os injeta instantaneamente no canal WebSocket aberto do Gemini Live (`realtimeInput.mediaChunks`), sem gravar arquivos temporários no disco e sem intermediários.

7. **Gravação Atômica de Arquivos**:
   - Arquivos vitais de estado (`config.json`, `jasper-memory.json`, `jasper-knowledge-graph.json`) são escritos primeiro em arquivos temporários (`.tmp`) e depois renomeados atomicamente, prevenindo corrupção em caso de desligamento súbito da máquina.

8. **Armazenamento 100% Local**:
   - Todas as configurações e bancos de conhecimento residem exclusivamente na pasta do usuário:
     `C:\Users\<SEU_USUARIO>\AppData\Roaming\jasper-avatar\`
     - `config.json`: Chaves criptografadas e preferências de voz.
     - `jasper-memory.json`: Fatos e histórico de preferências.
     - `jasper-semantic-memory.json`: Índice semântico TF-IDF local.
     - `jasper-knowledge-graph.json`: Grafo de conhecimento em JSON.
     - `jasper-schedules.json`: Fila de tarefas agendadas.
     - `sandbox/`: Área isolada temporária de execução de código.

---

## ❓ Perguntas Frequentes (FAQ)

#### 1. Preciso pagar por alguma ferramenta ou API para usar o assistente?
> **Não.** A chave de API do Google Gemini é gratuita através do [Google AI Studio](https://aistudio.google.com/) dentro das cotas do free tier. Todos os outros 17 módulos rodam localmente no seu computador sem custos.

#### 2. O assistente funciona sem internet?
> O reconhecimento de voz e raciocínio avançado do Gemini necessitam de conexão com a internet. Porém, ferramentas como execução matemática, monitoramento de hardware, organização de pastas e a palavra de ativação (Wake Word) utilizam rotinas locais.

#### 3. Como posso alternar entre tela cheia e janela flutuante?
> Use a tecla **F12** para tela cheia instantânea. Para deixar o assistente pequeno em um canto da tela enquanto você trabalha, clique no botão **PiP (Picture-in-Picture)** na barra de título do HUD.

#### 4. Como silenciar ou desativar um módulo que não quero usar?
> Abra as **Configurações** (ícone de engrenagem) e vá até a aba **Autonomia**. Lá você pode desligar qualquer uma das 17 opções com um clique. As alterações entram em vigor imediatamente.

---

## 📜 Licença

Projeto desenvolvido para fins educacionais e de automação pessoal sob a licença MIT. Sinta-se livre para customizar avatares, criar novos módulos e expandir os recursos de voz!

