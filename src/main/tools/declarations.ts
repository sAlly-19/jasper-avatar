/**
 * Function declarations for Gemini Live API
 */
export const SYSTEM_FUNCTION_DECLARATIONS = [
  {
    name: 'open_app',
    description: 'Abre um aplicativo ou programa local no computador (ex: calculadora, notepad, vscode, explorer).',
    parameters: {
      type: 'OBJECT',
      properties: {
        appName: { type: 'STRING', description: 'Nome do aplicativo (ex: calc, notepad, explorer, code)' }
      },
      required: ['appName']
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
    name: 'execute_code',
    description: 'Escreve e executa código Python ou Node.js em ambiente isolado (sandbox local) para calcular dados, manipular arquivos, gerar relatórios ou processar lógicas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        language: { type: 'STRING', description: 'Linguagem do script: "python" ou "javascript"' },
        code: { type: 'STRING', description: 'Código fonte completo a ser executado' }
      },
      required: ['language', 'code']
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
    description: 'Executa git add e git commit com a mensagem especificada no repositório informado.',
    parameters: {
      type: 'OBJECT',
      properties: {
        message: { type: 'STRING', description: 'Mensagem de commit semântica a ser aplicada' },
        repoPath: { type: 'STRING', description: 'Caminho do repositório (opcional)' }
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


