/**
 * Function declarations for Gemini Live API
 */
export const SYSTEM_FUNCTION_DECLARATIONS = [
  {
    name: 'check_for_updates',
    description: 'Verifica se existe uma nova versão do aplicativo Jasper disponível para atualização.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'open_app',
    description: 'Abre qualquer aplicativo, programa local ou executável no computador (ex: calculadora, notepad, spotify, chrome, discord, vscode, etc).',
    parameters: {
      type: 'OBJECT',
      properties: {
        appName: { type: 'STRING', description: 'Nome do aplicativo ou programa a abrir (ex: calc, notepad, spotify, chrome, discord)' }
      },
      required: ['appName']
    }
  },
  {
    name: 'search_program',
    description: 'Pesquisa programas instalados no computador via StartApps e Everything CLI por nome ou palavra-chave.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Termo ou nome do programa a buscar (ex: office, steam, player, calculadora)' }
      },
      required: ['query']
    }
  },
  {
    name: 'close_program',
    description: 'Encerra ou fecha um programa ou processo em execução no computador.',
    parameters: {
      type: 'OBJECT',
      properties: {
        processId: { type: 'NUMBER', description: 'PID numérico obtido por list_processes' },
        force: { type: 'BOOLEAN', description: 'Forçar o encerramento imediato (padrão: true)' }
      },
      required: ['processId']
    }
  },
  {
    name: 'list_processes',
    description: 'Lista os programas e processos em execução com maior consumo de memória RAM e CPU.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'NUMBER', description: 'Quantidade máxima de processos a listar (padrão: 8)' }
      }
    }
  },
  {
    name: 'control_media_volume',
    description: 'Controla o volume do som e a reprodução de mídia global do computador (aumentar volume, diminuir volume, mutar som, pausar, avançar faixa).',
    parameters: {
      type: 'OBJECT',
      properties: {
        command: {
          type: 'STRING',
          description: 'Comando de áudio/mídia: "volume_up", "volume_down", "mute", "play_pause", "next", "prev", "stop"'
        },
        value: {
          type: 'NUMBER',
          description: 'Valor opcional do percentual para alterar o volume (ex: 10 para aumentar ou diminuir 10%)'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'automate_ui',
    description: 'Executa ações de automação na interface de janelas do Windows via UI Automation (clicar em botões por nome, digitar textos ou listar janelas/elementos).',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          description: 'Ação: "list_windows" (listar janelas abertas), "inspect" (ver botões de uma janela), "click" (clicar em botão/elemento) ou "set_text" (digitar texto)'
        },
        windowTitle: {
          type: 'STRING',
          description: 'Título ou parte do nome da janela alvo'
        },
        elementName: {
          type: 'STRING',
          description: 'Nome, rótulo ou ID do botão ou campo na janela (obrigatório para click e set_text)'
        },
        text: {
          type: 'STRING',
          description: 'Texto a digitar (obrigatório para set_text)'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'get_detailed_hardware_stats',
    description: 'Obtém diagnóstico completo e detalhado do hardware do computador: modelo de CPU, núcleos, clock, temperatura, GPU, saúde de bateria e discos.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'generate_report_pdf',
    description: 'Gera um relatório executivo profissional em PDF formatado (com gráficos, tabelas e cabeçalho Jasper) e salva na pasta do usuário.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Título principal do relatório' },
        contentHtml: { type: 'STRING', description: 'Conteúdo em HTML formatado (parágrafos <p>, tabelas <table>, listas <ul>, subtítulos <h2>)' },
        fileName: { type: 'STRING', description: 'Nome opcional do arquivo PDF (ex: relatorio_financeiro.pdf)' }
      },
      required: ['title', 'contentHtml']
    }
  },
  {
    name: 'generate_spreadsheet',
    description: 'Cria uma planilha formatada do Excel (.xlsx) com colunas estilizadas e dados tabulados, salvando na pasta do usuário.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Título ou assunto da planilha' },
        columnsJson: { type: 'STRING', description: 'JSON contendo lista de colunas no formato: [{"header":"Nome","key":"name","width":20},{"header":"Valor","key":"val"}]' },
        rowsJson: { type: 'STRING', description: 'JSON contendo array de objetos com os dados das linhas' },
        fileName: { type: 'STRING', description: 'Nome opcional do arquivo (ex: planilha_gastos.xlsx)' }
      },
      required: ['title', 'columnsJson', 'rowsJson']
    }
  },
  {
    name: 'generate_word_document',
    description: 'Cria um documento formatado do Microsoft Word (.docx) com título, seções e parágrafos estruturados, salvando na pasta do usuário.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Título principal do documento' },
        sectionsJson: { type: 'STRING', description: 'JSON contendo lista de seções no formato: [{"heading":"Subtítulo","paragraph":"Texto do parágrafo"}]' },
        fileName: { type: 'STRING', description: 'Nome opcional do arquivo (ex: proposta_comercial.docx)' }
      },
      required: ['title', 'sectionsJson']
    }
  },
  {
    name: 'read_and_summarize_file',
    description: 'Lê e resume o conteúdo de qualquer arquivo local (.pdf, .docx, .txt, .md, .csv, .json, .log), extraindo estatísticas e pontos-chave.',
    parameters: {
      type: 'OBJECT',
      properties: {
        filePath: { type: 'STRING', description: 'Caminho absoluto ou relativo do arquivo a ser lido e sintetizado' }
      },
      required: ['filePath']
    }
  },
  {
    name: 'summarize_clipboard',
    description: 'Lê a área de transferência do usuário (texto, erro copiado, link ou código) e gera um resumo executivo, tradução ou explicação técnica.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', description: 'Ação desejada: "summarize" (resumo executivo), "translate" (traduzir) ou "explain" (explicar)' }
      }
    }
  },
  {
    name: 'generate_qr_code',
    description: 'Gera uma imagem de QR Code de alta resolução para um link, texto, Wi-Fi ou chave PIX e salva na pasta do usuário.',
    parameters: {
      type: 'OBJECT',
      properties: {
        data: { type: 'STRING', description: 'Conteúdo, URL, texto ou chave para codificar no QR Code' },
        fileName: { type: 'STRING', description: 'Nome opcional do arquivo de imagem (ex: qrcode_pix.png)' }
      },
      required: ['data']
    }
  },
  {
    name: 'calculate',
    description: 'Executa um cálculo matemático ou expressão numérica.',
    parameters: {
      type: 'OBJECT',
      properties: {
        expression: { type: 'STRING', description: 'Expressão matemática a ser calculada (ex: 25 * 4, sqrt(144))' }
      },
      required: ['expression']
    }
  },
  {
    name: 'organize_folder',
    description: 'Organiza automaticamente os arquivos de uma pasta do computador (Downloads ou Desktop) por categorias/extensão.',
    parameters: {
      type: 'OBJECT',
      properties: {
        targetFolder: { type: 'STRING', description: 'Pasta a ser organizada: "downloads" ou "desktop"' }
      },
      required: ['targetFolder']
    }
  },
  {
    name: 'remember_fact',
    description: 'Grava na memória permanente um fato, preferência ou detalhe pessoal sobre o usuário para lembrar em conversas futuras (ex: nome, gostos, rotina, preferências de trabalho).',
    parameters: {
      type: 'OBJECT',
      properties: {
        fact: { type: 'STRING', description: 'Informação ou detalhe a ser memorizado' }
      },
      required: ['fact']
    }
  },
  {
    name: 'ocr_screen',
    description: 'Executa OCR local (reconhecimento óptico de caracteres) na tela atual ou em um arquivo de imagem, extraindo textos legíveis com proteção de dados sensíveis.',
    parameters: {
      type: 'OBJECT',
      properties: {
        imagePath: {
          type: 'STRING',
          description: 'Caminho opcional da imagem salva para OCR. Se omitido, captura e lê o monitor principal.'
        },
        languages: {
          type: 'STRING',
          description: 'Idiomas do motor de reconhecimento (padrão: "eng+por")'
        }
      }
    }
  },
  {
    name: 'web_automate',
    description: 'Executa automação web headless avançada (clicar em botões por seletor CSS, preencher campos de formulários, extrair tabelas ou tirar screenshots da página).',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: {
          type: 'STRING',
          description: 'URL do site ou sistema web a automatizar'
        },
        action: {
          type: 'STRING',
          description: 'Ação a executar: "click" (clicar elemento), "fill" (preencher campo), "extract_table" (extrair dados de tabela) ou "screenshot" (capturar imagem)'
        },
        selector: {
          type: 'STRING',
          description: 'Seletor CSS do elemento HTML alvo (ex: "#btn-submit", "input[name=email]", "table.relatorio")'
        },
        value: {
          type: 'STRING',
          description: 'Valor ou texto a ser digitado no campo (obrigatório para a ação "fill")'
        }
      },
      required: ['url', 'action']
    }
  },
  {
    name: 'set_presentation_mode',
    description: 'Ativa ou desativa o Modo Apresentação / Silencioso Inteligente para reuniões, webinars ou apresentações de slides.',
    parameters: {
      type: 'OBJECT',
      properties: {
        active: {
          type: 'BOOLEAN',
          description: 'True para ativar o modo apresentação/silencioso, False para desativar'
        }
      },
      required: ['active']
    }
  },
  {
    name: 'set_focus_mode',
    description: 'Gerencia o Modo Foco e Bloqueador de Distrações (Pomodoro inteligente), silenciando alertas e detectando processos de jogos/redes sociais.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          description: 'Ação: "start" para iniciar sessão de concentração, "stop" para encerrar ou "status" para consultar'
        },
        durationMinutes: {
          type: 'NUMBER',
          description: 'Duração da sessão de foco em minutos (padrão: 25)'
        }
      },
      required: ['action']
    }
  }
]

export const MEDIA_FUNCTION_DECLARATIONS = [
  {
    name: 'search_web',
    description: 'Faz uma pesquisa no Google e abre no navegador padrão da máquina.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Termo de pesquisa a ser buscado no Google' }
      },
      required: ['query']
    }
  },
  {
    name: 'open_link',
    description: 'Abre uma URL ou site específico no navegador.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: { type: 'STRING', description: 'Endereço web ou link a ser aberto' }
      },
      required: ['url']
    }
  },
  {
    name: 'play_music',
    description: 'Toca uma música, artista ou playlist no Spotify ou YouTube.',
    parameters: {
      type: 'OBJECT',
      properties: {
        songName: { type: 'STRING', description: 'Nome da música ou artista' },
        platform: { type: 'STRING', description: 'Plataforma: "spotify" ou "youtube"' }
      },
      required: ['songName']
    }
  }
]

export const AUTONOMY_FUNCTION_DECLARATIONS = [
  {
    name: 'capture_screen',
    description: 'Captura a tela do monitor principal para ver o que o usuário está visualizando ou trabalhando.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'get_active_window',
    description: 'Obtém a janela e o aplicativo ativo no momento em que o usuário está interagindo (ex: VS Code, Chrome, etc).',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'read_clipboard',
    description: 'Lê o texto atual na área de transferência (Ctrl+C) do usuário para analisar erros, códigos ou links.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'create_reminder',
    description: 'Agenda um lembrete ou alarme para o usuário.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Assunto ou mensagem do lembrete' },
        minutesFromNow: { type: 'NUMBER', description: 'Minutos a partir de agora para disparar o lembrete (ex: 5, 30)' },
        recurrence: { type: 'STRING', description: 'Recorrência: "once", "daily" ou "hourly"' }
      },
      required: ['title', 'minutesFromNow']
    }
  },
  {
    name: 'get_system_health',
    description: 'Verifica métricas de saúde do computador (CPU, RAM livre/usada, disco e tempo de atividade).',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'get_daily_briefing',
    description: 'Gera um relatório/briefing diário completo para o usuário com status do dia, saúde do sistema e tarefas agendadas.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'query_semantic_memory',
    description: 'Busca na memória semântica vetorial por fatos ou tópicos usando similaridade de significado.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Assunto, pergunta ou termo a ser pesquisado na memória' }
      },
      required: ['query']
    }
  },
  {
    name: 'query_knowledge_graph',
    description: 'Consulta conexões e entidades relacionadas no Grafo de Conhecimento do usuário.',
    parameters: {
      type: 'OBJECT',
      properties: {
        entity: { type: 'STRING', description: 'Nome da entidade a ser consultada (ex: projeto, pessoa, tecnologia)' }
      },
      required: ['entity']
    }
  },
  {
    name: 'add_knowledge_relation',
    description: 'Cria uma nova relação no Grafo de Conhecimento (ex: "Jasper" "assiste" "Comandante").',
    parameters: {
      type: 'OBJECT',
      properties: {
        source: { type: 'STRING', description: 'Entidade de origem (ex: João)' },
        relation: { type: 'STRING', description: 'Verbo ou relação (ex: trabalha_com, conhece, gosta_de)' },
        target: { type: 'STRING', description: 'Entidade de destino (ex: React)' }
      },
      required: ['source', 'relation', 'target']
    }
  },
  {
    name: 'browse_page',
    description: 'Abre uma página web em segundo plano através de um navegador headless invisível, lê e mastiga seu conteúdo textual ou captura a tela.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: { type: 'STRING', description: 'Endereço web / URL do site a ser consultado' },
        extractType: { type: 'STRING', description: 'Tipo de extração: "text" para ler o conteúdo da página ou "screenshot" para capturar visualmente' }
      },
      required: ['url']
    }
  },
  {
    name: 'git_check_repo',
    description: 'Inspeciona o status atual de um repositório Git local, listando arquivos modificados, branch ativa e último commit.',
    parameters: {
      type: 'OBJECT',
      properties: {
        repoPath: { type: 'STRING', description: 'Caminho do repositório (opcional; se omitido usa o repositório atual)' }
      }
    }
  },
  {
    name: 'git_suggest_commit',
    description: 'Analisa o diff e arquivos alterados em um repositório Git e sugere uma mensagem de commit semântica e padronizada (feat:, fix:, chore:).',
    parameters: {
      type: 'OBJECT',
      properties: {
        repoPath: { type: 'STRING', description: 'Caminho do repositório (opcional)' }
      }
    }
  },
  {
    name: 'git_commit_changes',
    description: 'Executa git add e git commit com a mensagem especificada no repositório informado. Permite especificar a lista restrita de arquivos para comitar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        message: { type: 'STRING', description: 'Mensagem de commit semântica a ser aplicada' },
        repoPath: { type: 'STRING', description: 'Caminho do repositório (opcional)' },
        files: {
          type: 'ARRAY',
          description: 'Lista específica de caminhos de arquivos a serem adicionados e comitados (recomendado para evitar comitar arquivos indesejados)',
          items: { type: 'STRING' }
        }
      },
      required: ['message']
    }
  },
  {
    name: 'scan_duplicates_and_old_files',
    description: 'Varre uma pasta (Downloads ou Desktop) em busca de arquivos duplicados por conteúdo (MD5) e instaladores velhos (.exe/.msi com mais de 30 dias).',
    parameters: {
      type: 'OBJECT',
      properties: {
        target: { type: 'STRING', description: 'Pasta a ser varrida: "downloads" ou "desktop"' }
      },
      required: ['target']
    }
  },
  {
    name: 'organize_directory',
    description: 'Organiza automaticamente os arquivos de uma pasta (Downloads ou Desktop) em categorias (Documentos, Imagens, Instaladores, etc).',
    parameters: {
      type: 'OBJECT',
      properties: {
        target: { type: 'STRING', description: 'Pasta a ser organizada: "downloads" ou "desktop"' },
        dryRun: { type: 'BOOLEAN', description: 'Se true, apenas simula e lista o que seria movido sem alterar arquivos' }
      },
      required: ['target']
    }
  },
  {
    name: 'spawn_subagent',
    description: 'Delega uma tarefa em segundo plano para um subagente especializado (pesquisador, programador, testador ou analista) sem travar a conversa de voz.',
    parameters: {
      type: 'OBJECT',
      properties: {
        role: { type: 'STRING', description: 'Especialidade do subagente: "researcher", "coder", "tester", "analyst" ou "general"' },
        task: { type: 'STRING', description: 'Descrição detalhada do objetivo ou instrução para o subagente' }
      },
      required: ['role', 'task']
    }
  },
  {
    name: 'get_subagent_tasks',
    description: 'Lista o andamento e os resultados de todos os subagentes que estão rodando ou foram finalizados recentemente em segundo plano.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'manage_calendar',
    description: 'Consulta, adiciona ou remove compromissos na agenda/calendário do usuário.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', description: 'Ação: "list" para ver próximos eventos, ou "add" para marcar um compromisso' },
        title: { type: 'STRING', description: 'Título do compromisso ou reunião' },
        startDateTime: { type: 'STRING', description: 'Data/Hora de início (ex: "2026-09-17 14:00" ou minutos a partir de agora)' },
        durationMinutes: { type: 'NUMBER', description: 'Duração em minutos (padrão: 60)' },
        location: { type: 'STRING', description: 'Local ou link da reunião (opcional)' }
      },
      required: ['action']
    }
  },
  {
    name: 'check_emails',
    description: 'Lê e resume os e-mails mais recentes ou urgentes da caixa de entrada do usuário.',
    parameters: {
      type: 'OBJECT',
      properties: {
        unreadOnly: { type: 'BOOLEAN', description: 'Filtrar apenas mensagens não lidas' },
        limit: { type: 'NUMBER', description: 'Quantidade máxima de e-mails a listar (padrão: 5)' }
      }
    }
  },
  {
    name: 'trigger_webhook',
    description: 'Dispara um gatilho HTTP/Webhook para integrar com n8n, Zapier, Make ou Slack.',
    parameters: {
      type: 'OBJECT',
      properties: {
        webhookNameOrUrl: { type: 'STRING', description: 'Nome do webhook cadastrado (ex: "n8n-fluxo", "slack-canal") ou URL completa' },
        payloadJson: { type: 'STRING', description: 'JSON contendo os dados a serem enviados no corpo da requisição' },
        method: { type: 'STRING', description: 'Método HTTP: "POST", "GET" ou "PUT" (padrão: "POST")' }
      },
      required: ['webhookNameOrUrl']
    }
  },
  {
    name: 'control_smart_home',
    description: 'Controla dispositivos inteligentes da casa ou escritório através da API do Home Assistant (iluminação, ar-condicionado, tomadas).',
    parameters: {
      type: 'OBJECT',
      properties: {
        domain: { type: 'STRING', description: 'Tipo do dispositivo: "light", "switch", "climate" ou "cover"' },
        service: { type: 'STRING', description: 'Comando: "turn_on", "turn_off", "toggle", etc.' },
        entityId: { type: 'STRING', description: 'Identificador do dispositivo (ex: "light.escritorio", "climate.ar_condicionado")' }
      },
      required: ['domain', 'service', 'entityId']
    }
  }
]

export function getActiveAutonomyDeclarations(cfg: Record<string, any>): any[] {
  const result: any[] = []
  for (const decl of AUTONOMY_FUNCTION_DECLARATIONS) {
    if (decl.name === 'capture_screen' && cfg.enableScreenAwareness === false) continue
    if (decl.name === 'get_active_window' && cfg.enableWindowTracker === false) continue
    if (decl.name === 'read_clipboard' && cfg.enableClipboardWatcher === false) continue
    if (decl.name === 'create_reminder' && cfg.enableCronEngine === false) continue
    if (decl.name === 'get_system_health' && cfg.enableSystemHealth === false) continue
    if (decl.name === 'get_daily_briefing' && cfg.enableDailyBriefing === false) continue
    if (decl.name === 'query_semantic_memory' && cfg.enableSemanticMemory === false) continue
    if ((decl.name === 'query_knowledge_graph' || decl.name === 'add_knowledge_relation') && cfg.enableKnowledgeGraph === false) continue
    if (decl.name === 'browse_page' && cfg.enableHeadlessBrowser === false) continue
    if (decl.name.startsWith('git_') && cfg.enableGitWatcher === false) continue
    if ((decl.name === 'scan_duplicates_and_old_files' || decl.name === 'organize_directory') && cfg.enableFolderOrganizer === false) continue
    if ((decl.name === 'spawn_subagent' || decl.name === 'get_subagent_tasks') && cfg.enableSubagents === false) continue
    if ((decl.name === 'manage_calendar' || decl.name === 'check_emails') && cfg.enableCalendarEmail === false) continue
    if (decl.name === 'trigger_webhook' && cfg.enableWebhooks === false) continue
    if (decl.name === 'control_smart_home' && cfg.enableSmartHome === false) continue

    result.push(decl)
  }
  return result
}

export function getActiveSystemDeclarations(cfg: Record<string, any>): any[] {
  const result: any[] = []
  for (const decl of SYSTEM_FUNCTION_DECLARATIONS) {
    if (['open_app', 'search_program', 'close_program', 'list_processes'].includes(decl.name) && cfg.enableProcessManager === false) continue
    if (decl.name === 'automate_ui' && cfg.enableUiAutomation === false) continue
    if (decl.name === 'control_media_volume' && cfg.enableMediaController === false) continue
    if (decl.name === 'get_detailed_hardware_stats' && cfg.enableSystemHealth === false) continue
    if (['generate_report_pdf', 'generate_spreadsheet', 'generate_word_document'].includes(decl.name) && cfg.enableReportGenerator === false) continue
    if (decl.name === 'read_and_summarize_file' && cfg.enableFileSummarizer === false) continue
    if (decl.name === 'summarize_clipboard' && cfg.enableClipboardWatcher === false) continue
    if (decl.name === 'generate_qr_code' && cfg.enableQrService === false) continue
    if (decl.name === 'ocr_screen' && cfg.enableOcrService === false) continue
    if (decl.name === 'web_automate' && cfg.enableHeadlessBrowser === false) continue
    if (decl.name === 'set_presentation_mode' && cfg.enablePresentationMode === false) continue
    if (decl.name === 'set_focus_mode' && cfg.enableFocusMode === false) continue
    if (decl.name === 'organize_folder' && cfg.enableFolderOrganizer === false) continue

    result.push(decl)
  }
  return result
}


