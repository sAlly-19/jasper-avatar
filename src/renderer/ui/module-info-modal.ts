export interface ModuleInfo {
  icon: string
  title: string
  category: string
  overview: string
  howItWorks: string
  examples: string[]
  requirements: string
  badgeText?: string
}

export const MODULE_INFO_DATA: Record<string, ModuleInfo> = {
  'screen-awareness': {
    icon: '👁️',
    title: '1. Visão de Tela (Screen Awareness)',
    category: 'Visão Computacional Multimodal',
    overview: 'Permite que o assistente "veja" o que está no seu monitor no momento exato em que você pedir ajuda. Ideal para analisar linhas de código, gráficos, relatórios, documentos ou mensagens de erro.',
    howItWorks: 'Utiliza a API nativa do Electron (desktopCapturer) para gerar uma captura instantânea em memória do monitor principal, sem salvar arquivos no disco. A imagem é enviada para a inteligência multimodal do Gemini analisar visualmente.',
    examples: [
      '"Jasper, olhe para a minha tela e veja onde está o erro nesse código."',
      '"Veja o gráfico aberto no meu navegador e resuma os principais dados."',
      '"O que significa a mensagem de alerta que apareceu na tela agora?"'
    ],
    requirements: 'Nenhum software externo. Funciona de forma 100% nativa no Windows.',
    badgeText: 'Disparo sob demanda • Sem gravação em disco'
  },

  'window-tracker': {
    icon: '🪟',
    title: '2. Rastreador de Janela em Foco (Context Switcher)',
    category: 'Consciência de Contexto do SO',
    overview: 'Mantém o Jasper ciente de qual aplicativo você está utilizando ativamente (ex: VS Code, Chrome, Figma, Spotify, Terminal), adaptando o tom e o assunto das respostas ao que você está fazendo.',
    howItWorks: 'Um script leve consulta periodicamente a API do Windows (GetForegroundWindow) para capturar o nome do processo e o título da janela ativa. Quando você muda de tarefa, o contexto da conversa é atualizado automaticamente.',
    examples: [
      '"Jasper, qual projeto ou arquivo eu estou editando agora?"',
      '"Com base no programa que estou usando, qual é o próximo passo recomendado?"',
      '"Resuma o contexto do que estou fazendo hoje."'
    ],
    requirements: 'PowerShell 5.1+ (nativo e padrão em todo Windows 10 e 11).',
    badgeText: 'Levíssimo • 100% Local'
  },

  'clipboard-watcher': {
    icon: '📋',
    title: '3. Monitor de Clipboard (Ctrl+C Proativo)',
    category: 'Produtividade Proativa',
    overview: 'Auxilia você antes mesmo de você pedir! Ao copiar qualquer texto com erro de programação (stack trace), URL ou objeto JSON, o Jasper detecta e oferece ajuda imediatamente na tela.',
    howItWorks: 'Observa a área de transferência a cada 1,5 segundo. Se o texto contiver padrões como "TypeError", "Exception", "Traceback" ou links, o HUD emite um Toast holográfico interativo perguntando se deseja uma análise ou correção.',
    examples: [
      'Você pressiona Ctrl + C em um erro no terminal -> O Jasper exibe um alerta no HUD: "Detectei um erro copiado. Quer que eu explique e sugira a correção?"',
      '"Jasper, analise o texto que acabei de copiar na área de transferência."',
      '"O que significa esse JSON que copiei?"'
    ],
    requirements: 'Nenhum software externo.',
    badgeText: 'Detecção Inteligente • 100% Local'
  },

  'cron-engine': {
    icon: '⏰',
    title: '4. Motor de Agendamentos & Despertador Persistente',
    category: 'Gerenciamento de Tempo',
    overview: 'Permite criar alarmes, avisos e rotinas com horário marcado. Os lembretes são salvos no computador e nunca são esquecidos, mesmo se você fechar e reabrir o aplicativo.',
    howItWorks: 'Uma fila persistida em JSON (jasper-schedules.json) verifica os prazos a cada 10 segundos. Suporta lembretes únicos, horários ou diários, com proteção contra notificações duplicadas após suspensão do computador.',
    examples: [
      '"Jasper, me lembre de tirar a pizza do forno daqui a 20 minutos."',
      '"Me lembre todo dia às 18:00 de salvar e commitar minhas alterações."',
      '"Quais são os meus lembretes pendentes na fila?"'
    ],
    requirements: 'Nenhum software externo.',
    badgeText: 'Persistência em Disco • Alerta Visual e Sonoro'
  },

  'daily-briefing': {
    icon: '☀️',
    title: '5. Briefing Matinal & Noturno Proativo',
    category: 'Assistente Executivo',
    overview: 'Gera um relatório rápido e motivador do seu dia ao estilo "JARVIS": saudação conforme o horário (manhã, tarde, noite), data completa, saúde do computador, compromissos na agenda e sua janela de trabalho em foco.',
    howItWorks: 'Consolida informações dos módulos de saúde do sistema, do calendário de compromissos e do rastreador de janelas em uma síntese verbal elegante e direta.',
    examples: [
      '"Bom dia, Jasper!"',
      '"Jasper, qual é o meu briefing diário para hoje?"',
      '"Me dê um resumo do meu status atual."'
    ],
    requirements: 'Nenhum software externo.',
    badgeText: 'Saudação Dinâmica • Relatório Geral'
  },

  'system-health': {
    icon: '📊',
    title: '6. Monitor de Saúde do Sistema & Hardware',
    category: 'Diagnóstico de Recursos',
    overview: 'Acompanha a temperatura e o uso dos componentes da sua máquina (processador, memória RAM e espaço em disco C:). Caso a memória atinja níveis perigosos (>90%), ele te alerta para evitar lentidão.',
    howItWorks: 'Mede a cada 8 segundos os ciclos de CPU e a memória livre nativamente pelo Node.js. O espaço em disco é verificado com cache de 60 segundos para poupar energia e bateria do seu notebook.',
    examples: [
      '"Jasper, como está a saúde do computador agora?"',
      '"Quanta memória RAM está sendo usada neste momento?"',
      'Caso a memória ultrapasse 92%, o Jasper emite um aviso: "Atenção: Uso de memória RAM em 94%. Considere fechar abas pesadas."'
    ],
    requirements: 'Nenhum software externo.',
    badgeText: 'Alerta de RAM Crítica • Baixo Consumo de CPU'
  },

  'semantic-memory': {
    icon: '🧠',
    title: '7. Memória Semântica Vetorial (RAG Local)',
    category: 'Inteligência e Aprendizado Contínuo',
    overview: 'Permite ao Jasper lembrar do significado e do contexto de conversas e fatos passados, mesmo quando você pesquisa usando palavras diferentes daquelas que usou quando conversou.',
    howItWorks: 'Algoritmo vetorial local implementado em Node.js utilizando TF-IDF e Similaridade por Cosseno. Sem custos com bancos de vetores pagos em nuvem e sem envio de dados para servidores de terceiros.',
    examples: [
      '"Jasper, pesquise na memória o que eu comentei sobre o banco de dados do novo projeto."',
      '"Quais são as minhas preferências de trabalho gravadas?"',
      '"Você lembra qual linguagem eu prefiro para desenvolvimento frontend?"'
    ],
    requirements: 'Nenhum software externo nem APIs pagas de embeddings.',
    badgeText: 'Busca Semântica Local • 100% Gratuito'
  },

  'knowledge-graph': {
    icon: '🕸️',
    title: '8. Grafo de Conhecimento Relacional',
    category: 'Estruturação de Dados',
    overview: 'Mapeia relações e conexões lógicas entre pessoas, projetos, linguagens e ferramentas para que o assistente compreenda como as peças da sua vida profissional e pessoal se conectam.',
    howItWorks: 'Cria uma teia de nós e arestas direcionadas persistidas em JSON (jasper-knowledge-graph.json). Permite consultas cruzadas como: "Quem trabalha com o quê?" ou "Quais tecnologias pertencem a este projeto?".',
    examples: [
      '"Adicione no grafo que o Alisson é o desenvolvedor líder do projeto HUD AI."',
      '"Quais são as conexões e pessoas associadas ao projeto HUD AI?"',
      '"Conecte que o Jasper auxilia o Comandante nas tarefas diárias."'
    ],
    requirements: 'Nenhum software externo.',
    badgeText: 'Navegação por Nós • Persistência Local'
  },

  'code-interpreter': {
    icon: '💻',
    title: '9. Interpretador de Código Sandboxed Local',
    category: 'Automação & Processamento de Dados',
    overview: 'Capacidade de escrever e rodar scripts Python e JavaScript em uma área isolada do computador para manipular planilhas, gerar gráficos, calcular equações ou processar dados complexos.',
    howItWorks: 'Gera scripts temporários em uma pasta sandbox segura (%APPDATA%/jasper-avatar/sandbox/). Executa os scripts com limite de tempo (timeout de 30s) e monitora arquivos recém-criados para avisar você.',
    examples: [
      '"Jasper, faça um script em Python para calcular a média de uma lista de valores e mostre o resultado."',
      '"Crie um gráfico de barras com números aleatórios e salve a imagem."',
      '"Escreva um script para converter uma tabela de dados em CSV."'
    ],
    requirements: 'Python 3.9+ instalado e adicionado ao PATH (para scripts .py) ou Node.js (para scripts .js).',
    badgeText: 'Sandbox Isolado • Timeout de Segurança'
  },

  'headless-browser': {
    icon: '🌐',
    title: '10. Navegador Headless Invisível (Chromium Worker)',
    category: 'Automação Web & Extração de Dados',
    overview: 'Abre um navegador web invisível em segundo plano para consultar documentações, pesquisar preços ou ler artigos online, devolvendo as informações já resumidas sem abrir abas na sua tela.',
    howItWorks: 'Cria uma janela off-screen silenciosa com o motor Chromium do Electron. Carrega páginas web, remove anúncios e scripts desnecessários e extrai o texto limpo ou tira capturas da página.',
    examples: [
      '"Jasper, acesse https://news.ycombinator.com e me diga os 3 principais tópicos."',
      '"Acesse a documentação do Three.js e resuma o método de carregar modelos glTF."',
      '"Navegue no site de notícias e tire uma captura de tela para eu ver."'
    ],
    requirements: 'Nenhum software externo (utiliza o Chromium interno do próprio Electron).',
    badgeText: 'Navegação Silenciosa • Sem Janelas Visíveis'
  },

  'git-watcher': {
    icon: '🐙',
    title: '11. Git Watcher & Assistente de Commits Semânticos',
    category: 'Desenvolvimento de Software',
    overview: 'Monitora repositórios Git no seu computador, lista arquivos alterados não commitados, sugere mensagens de commit padronizadas (Conventional Commits) e executa baterias de testes unitários.',
    howItWorks: 'Comunica-se diretamente com o executável git do Windows, lê o status porcelain e diffs, e identifica padrões de alteração para formular sugestões semânticas com prefixos (feat:, fix:, chore:, style:).',
    examples: [
      '"Jasper, veja quais arquivos eu alterei no meu repositório e sugira um commit."',
      '"Faça o commit das alterações com a mensagem sugerida."',
      '"Rode a suíte de testes unitários do projeto para ver se algo quebrou."'
    ],
    requirements: 'Git for Windows instalado e configurado no PATH.',
    badgeText: 'Conventional Commits • Execução de Testes'
  },

  'folder-organizer': {
    icon: '📁',
    title: '12. Organizador de Downloads & Área de Trabalho',
    category: 'Manutenção do Sistema Operacional',
    overview: 'Elimina a bagunça nas suas pastas! Localiza arquivos duplicados, identifica instaladores velhos esquecidos (>30 dias) e organiza arquivos soltos em pastas por categoria.',
    howItWorks: 'Calcula hash MD5 rápido de blocos parciais para encontrar duplicados idênticos. Move arquivos para pastas como Documentos, Imagens, Instaladores e Vídeos, com opção de simulação prévia (dryRun) para total segurança.',
    examples: [
      '"Verifique se tenho instaladores velhos ou arquivos duplicados na pasta Downloads."',
      '"Organize a minha Área de Trabalho em categorias sem apagar nada."',
      '"Faça uma simulação de organização na pasta de Downloads."'
    ],
    requirements: 'Nenhum software externo.',
    badgeText: 'Modo Simulação Seguro • Detecção por Hash MD5'
  },

  'subagents': {
    icon: '👥',
    title: '13. Orquestrador de Subagentes Paralelos',
    category: 'Arquitetura Multi-Agente',
    overview: 'Permite ao assistente instanciar "subagentes" em segundo plano para realizar tarefas pesadas e demoradas (pesquisa web, execução de testes, análise de hardware) sem congelar a interface ou travar a conversa de voz.',
    howItWorks: 'Cria tarefas assíncronas dedicadas com papéis especializados (pesquisador, programador, testador, analista). Ao terminar a tarefa, o subagente notifica o HUD e disponibiliza o resultado consolidado.',
    examples: [
      '"Jasper, coloque um subagente para pesquisar as novidades do Electron 33 enquanto conversamos."',
      '"Mande um subagente rodar os testes do projeto em segundo plano."',
      '"Quais subagentes estão trabalhando neste momento?"'
    ],
    requirements: 'Nenhum software externo.',
    badgeText: 'Multitarefa • Conversa de Voz Ininterrupta'
  },

  'reflexion-loop': {
    icon: '🛡️',
    title: '14. Loop de Auto-Reflexão & Bloqueio de Alto Risco',
    category: 'Segurança & Validação Preventiva',
    overview: 'O guarda-costas digital do seu sistema operacional! Audita todos os comandos antes da execução e bloqueia qualquer operação potencialmente perigosa ou destrutiva, exigindo sua confirmação expressa na tela.',
    howItWorks: 'Mecanismo em duas etapas: Pre-flight Check (inspeciona código procurando por exclusão recursiva, pastas do Windows ou commits forçados) e Post-flight Critique (detecta erros de sintaxe). Ações de risco abrem um botão interativo "Autorizar Execução" no HUD.',
    examples: [
      'Se um script tentar deletar uma pasta inteira do computador -> O Jasper bloqueia na hora e exibe um botão interativo na tela com contagem regressiva para você autorizar ou negar.',
      '"Operação bloqueada por motivos de segurança. Deseja autorizar a execução?"'
    ],
    requirements: 'Nenhum software externo.',
    badgeText: 'Blindagem Ativa • Confirmação na Tela'
  },

  'calendar-email': {
    icon: '📅',
    title: '15. Agenda de Compromissos (iCal) & E-mails',
    category: 'Produtividade & Gestão Pessoal',
    overview: 'Gerencia sua agenda localmente, cria arquivos de calendário padrão compatíveis com Google Agenda e Outlook, e dispara um alarme no HUD exatamente 10 minutos antes de cada compromisso marcado.',
    howItWorks: 'Exporta arquivos padrão iCalendar (.ics) em %APPDATA%/jasper-avatar/calendars/. Um temporizador de segundo plano monitora os horários minuto a minuto e emite notificações de lembrete antes do início das reuniões.',
    examples: [
      '"Jasper, agende uma reunião de Alinhamento com a equipe amanhã às 14 horas com duração de 45 minutos."',
      '"Quais são os meus compromissos agendados para as próximas 24 horas?"',
      '10 minutos antes da reunião, o Jasper avisa na tela e por voz: "Sua reunião de Alinhamento começará em 10 minutos!"'
    ],
    requirements: 'Nenhum software externo.',
    badgeText: 'Padrão iCal (.ics) • Alarme de 10 Minutos'
  },

  'webhooks': {
    icon: '⚡',
    title: '16. Gatilhos de Webhook (n8n, Zapier, Make, Slack)',
    category: 'Automação Corporativa & Integrações',
    overview: 'Conecta o Jasper a centenas de plataformas de automação (n8n, Zapier, Make, canais do Slack e Discord), permitindo disparar fluxos inteiros com uma única instrução falada.',
    howItWorks: 'Envia requisições HTTP REST (POST, GET, PUT) com payloads JSON estruturados e carimbo de data/hora para os endpoints cadastrados no catálogo local do assistente.',
    examples: [
      '"Jasper, dispare o webhook n8n-fluxo avisando que a rotina foi concluída."',
      '"Envie uma notificação para o canal do Slack da equipe."',
      '"Dispare o webhook de alerta para acionar a automação no Zapier."'
    ],
    requirements: 'Instância local do n8n (pode rodar de graça com npx n8n) ou conta no Zapier, Make ou Slack.',
    badgeText: 'HTTP REST • Integração com n8n Local'
  },

  'smart-home': {
    icon: '🏠',
    title: '17. Controle de Casa Inteligente (Home Assistant)',
    category: 'Internet das Coisas (IoT)',
    overview: 'Permite controlar iluminação, ar-condicionado, tomadas e persianas por comando de voz direto através da API oficial do Home Assistant (a maior plataforma open-source de automação residencial).',
    howItWorks: 'Conecta-se à API REST local do Home Assistant via rede Wi-Fi/Ethernet. Caso não haja um servidor Home Assistant configurado, opera em modo simulado inteligente para demonstração imediata.',
    examples: [
      '"Jasper, apague a luz do escritório."',
      '"Ligue o ar condicionado em 22 graus no modo refrigeração."',
      '"Desligue a tomada do computador."'
    ],
    requirements: 'Servidor Home Assistant local (opcional; sem ele, opera em modo simulado contextual).',
    badgeText: 'Home Assistant REST API • Modo Simulado'
  },

  'system-tools': {
    icon: '⚙️',
    title: 'Ações de Sistema & Utilitários Locais',
    category: 'Ferramentas de Sistema',
    overview: 'Permite ao assistente interagir com aplicativos e utilitários instalados no seu computador, como calculadora, bloco de notas, terminal e organizador de pastas.',
    howItWorks: 'Dispara executáveis nativos permitidos (calc.exe, notepad.exe, code.cmd, explorer.exe) e realiza cálculos numéricos por meio de um avaliador matemático local.',
    examples: [
      '"Jasper, abra a calculadora."',
      '"Abra o VS Code para mim."',
      '"Quanto é a raiz quadrada de 144 vezes 12?"'
    ],
    requirements: 'Softwares comuns do Windows.',
    badgeText: 'Controle de Aplicativos • Avaliação Matemática'
  },

  'media-tools': {
    icon: '🎵',
    title: 'Mídia & Pesquisas na Web',
    category: 'Mídia & Entretenimento',
    overview: 'Permite controlar reprodução musical no Spotify Desktop, abrir buscas de vídeo no YouTube e realizar pesquisas diretas no Google.',
    howItWorks: 'Interage com os protocolos de URI do Spotify (spotify:search:...) e aciona o navegador padrão do Windows para pesquisas externas.',
    examples: [
      '"Jasper, toque Daft Punk no Spotify."',
      '"Pesquise no Google as últimas notícias sobre inteligência artificial."',
      '"Abra o site do GitHub no meu navegador."'
    ],
    requirements: 'Navegador web padrão e Spotify Desktop (opcional; caso não tenha Spotify, abre no YouTube).',
    badgeText: 'Spotify & YouTube • Google Search'
  }
}

export class ModuleInfoModal {
  private backdrop: HTMLElement | null = null
  private iconEl: HTMLElement | null = null
  private titleEl: HTMLElement | null = null
  private subtitleEl: HTMLElement | null = null
  private categoryEl: HTMLElement | null = null
  private overviewEl: HTMLElement | null = null
  private howEl: HTMLElement | null = null
  private examplesEl: HTMLElement | null = null
  private reqsEl: HTMLElement | null = null
  private badgeEl: HTMLElement | null = null

  constructor() {
    this.initElements()
    this.attachEventListeners()
  }

  private initElements(): void {
    this.backdrop = document.getElementById('modal-module-detail')
    this.iconEl = document.getElementById('module-detail-icon')
    this.titleEl = document.getElementById('module-detail-title')
    this.subtitleEl = document.getElementById('module-detail-subtitle')
    this.categoryEl = document.getElementById('module-detail-category')
    this.overviewEl = document.getElementById('module-detail-overview')
    this.howEl = document.getElementById('module-detail-how')
    this.examplesEl = document.getElementById('module-detail-examples')
    this.reqsEl = document.getElementById('module-detail-requirements')
    this.badgeEl = document.getElementById('module-detail-badge')
  }

  public show(moduleId: string): void {
    const data = MODULE_INFO_DATA[moduleId]
    if (!data) return

    if (this.iconEl) this.iconEl.textContent = data.icon
    if (this.titleEl) this.titleEl.textContent = data.title
    if (this.subtitleEl) this.subtitleEl.textContent = data.category
    if (this.categoryEl) this.categoryEl.textContent = data.category
    if (this.overviewEl) this.overviewEl.textContent = data.overview
    if (this.howEl) this.howEl.textContent = data.howItWorks
    if (this.reqsEl) this.reqsEl.textContent = data.requirements

    if (this.badgeEl) {
      this.badgeEl.textContent = data.badgeText || '100% Gratuito & Local'
    }

    if (this.examplesEl) {
      this.examplesEl.innerHTML = data.examples
        .map((ex) => `<li class="detail-example-item"><span>${ex}</span></li>`)
        .join('')
    }

    if (this.backdrop) {
      this.backdrop.classList.remove('hidden')
    }
  }

  public hide(): void {
    if (this.backdrop) {
      this.backdrop.classList.add('hidden')
    }
  }

  private attachEventListeners(): void {
    const closeBtn = document.getElementById('btn-close-module-detail')
    const ackBtn = document.getElementById('btn-ack-module-detail')

    closeBtn?.addEventListener('click', () => this.hide())
    ackBtn?.addEventListener('click', () => this.hide())

    this.backdrop?.addEventListener('click', (e) => {
      if (e.target === this.backdrop) {
        this.hide()
      }
    })

    // Listen to Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.backdrop && !this.backdrop.classList.contains('hidden')) {
        this.hide()
      }
    })

    // Global listener for info buttons
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const btn = target.closest('.btn-module-info') as HTMLElement | null
      if (btn) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        const moduleId = btn.getAttribute('data-module')
        if (moduleId) {
          this.show(moduleId)
        }
      }
    })
  }
}

export let moduleInfoModal: ModuleInfoModal | null = null

export function initModuleInfoModal(): ModuleInfoModal {
  if (!moduleInfoModal) {
    moduleInfoModal = new ModuleInfoModal()
  }
  return moduleInfoModal
}

