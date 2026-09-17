import {
  screenAwareness,
  windowTracker,
  clipboardWatcher,
  cronEngine,
  systemHealth,
  briefingService,
  semanticMemory,
  knowledgeGraph,
  codeInterpreter,
  headlessBrowser,
  gitWatcher,
  folderOrganizer,
  subagentOrchestrator,
  reflexionEngine,
  calendarEmail,
  webhookManager,
  smartHome
} from '../autonomous'
import { getGlobalGeminiClient } from '../gemini-live'
import type { SubagentRole } from '@shared'

export async function executeAutonomyTool(toolName: string, args: Record<string, any>): Promise<string> {
  // Pre-flight Reflexion & Safety check
  const preCheck = reflexionEngine.preExecutionCheck(toolName, args)
  if (!preCheck.allowed) {
    return `[BLOQUEIO DE AUTO-REFLEXÃO - RISCO ALTO]: ${preCheck.reason} Por motivos de segurança, esta operação foi bloqueada e requer sua confirmação direta na tela.`
  }

  const rawOutput = await executeToolInternal(toolName, args)

  // Post-flight Reflexion critique
  const postCritique = reflexionEngine.postExecutionCritique(toolName, rawOutput)
  if (postCritique.needsCorrection && postCritique.critique) {
    return `${rawOutput}\n\n${postCritique.critique}`
  }

  return rawOutput
}

async function executeToolInternal(toolName: string, args: Record<string, any>): Promise<string> {
  switch (toolName) {
    case 'capture_screen': {
      const res = await screenAwareness.captureScreen()
      if (!res.success) {
        return `Não foi possível capturar a tela: ${res.error}`
      }
      // Inject visual screenshot frame into active Gemini Live session
      const client = getGlobalGeminiClient()
      if (client && res.base64Image) {
        client.sendRealtimeMediaChunk('image/jpeg', res.base64Image)
      }
      return `Tela capturada com sucesso (${res.width}x${res.height}) e enviada para o canal de visão multimodal. Você pode analisar o que está visível.`
    }

    case 'get_active_window': {
      const win = await windowTracker.getActiveWindow()
      if (!win.processName || win.processName === 'Unknown') {
        return 'Não foi possível identificar a janela ativa no momento.'
      }
      return `Janela ativa no momento: Aplicativo "${win.processName}", Título da janela: "${win.windowTitle || 'Sem título'}"`
    }

    case 'read_clipboard': {
      const text = clipboardWatcher.readClipboard()
      if (!text || !text.trim()) {
        return 'A área de transferência (Clipboard) está vazia no momento.'
      }
      const preview = text.length > 500 ? `${text.slice(0, 500)}... [truncado]` : text
      return `Conteúdo da Área de Transferência:\n"""\n${preview}\n"""`
    }

    case 'create_reminder': {
      const title = String(args.title || 'Lembrete')
      const mins = Math.max(1, Number(args.minutesFromNow) || 5)
      const recurrence = (args.recurrence || 'once') as 'once' | 'daily' | 'hourly'
      const task = cronEngine.addTask(title, mins, recurrence)
      const dateStr = new Date(task.dueTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      return `Lembrete agendado com sucesso! Vou te avisar às ${dateStr} sobre: "${title}".`
    }

    case 'get_system_health': {
      const h = await systemHealth.getHealth()
      const diskInfo = h.diskFreeGb ? ` e ${h.diskFreeGb}GB livres no disco C:` : ''
      return `Status do Computador: Uso de CPU em ${h.cpuUsagePercent}%, Memória RAM em ${h.ramUsagePercent}% (${h.usedRamGb}GB usados de ${h.totalRamGb}GB)${diskInfo}. Sistema online há ${h.uptimeHours} horas.`
    }

    case 'get_daily_briefing': {
      const briefing = await briefingService.generateBriefing()
      return briefing.fullBriefingText
    }

    case 'query_semantic_memory': {
      const q = String(args.query || '')
      if (!q.trim()) return 'Por favor, informe um termo para buscar na memória semântica.'
      const results = semanticMemory.search(q, 4)
      if (results.length === 0) {
        return `Nenhuma informação relevante encontrada na memória semântica para "${q}".`
      }
      const formatted = results
        .map((r, i) => `${i + 1}. [Relevância ${Math.round(r.score * 100)}%] ${r.item.content}`)
        .join('\n')
      return `Memórias encontradas sobre "${q}":\n${formatted}`
    }

    case 'query_knowledge_graph': {
      const entity = String(args.entity || '')
      if (!entity.trim()) return 'Por favor, informe uma entidade para pesquisar no Grafo de Conhecimento.'
      const res = knowledgeGraph.queryEntity(entity)
      return res.summaryText
    }

    case 'add_knowledge_relation': {
      const source = String(args.source || '').trim()
      const relation = String(args.relation || '').trim()
      const target = String(args.target || '').trim()
      if (!source || !relation || !target) {
        return 'Origem, relação e destino são obrigatórios para criar uma conexão no grafo.'
      }
      knowledgeGraph.addRelation(source, relation, target)
      return `Conexão salva no Grafo de Conhecimento: (${source}) -[${relation}]-> (${target}).`
    }

    case 'execute_code': {
      const lang = (String(args.language || 'python').toLowerCase()) as 'python' | 'javascript'
      const code = String(args.code || '').trim()
      if (!code) return 'Nenhum código fornecido para execução.'

      const res = await codeInterpreter.execute(lang, code)
      if (!res.success) {
        return `Falha na execução do script ${lang.toUpperCase()} (${res.executionTimeMs}ms):\n${res.stderr || res.error || 'Erro desconhecido'}`
      }

      let outputText = `Script ${lang.toUpperCase()} executado com sucesso em ${res.executionTimeMs}ms.\n`
      if (res.stdout) {
        outputText += `\nSaída:\n${res.stdout}`
      }
      if (res.generatedFiles && res.generatedFiles.length > 0) {
        outputText += `\n\nArquivos gerados no Sandbox:\n- ${res.generatedFiles.join('\n- ')}`
      }
      return outputText
    }

    case 'browse_page': {
      const url = String(args.url || '').trim()
      if (!url) return 'URL não fornecida para navegação.'

      const extractType = (args.extractType || 'text') as 'text' | 'screenshot'
      const res = await headlessBrowser.browse(url, { extractType })

      if (!res.success) {
        return `Não foi possível acessar a página "${url}": ${res.error}`
      }

      let summary = `Página acessada: "${res.title}" (${res.url})\n\n${res.content}`
      if (res.screenshotBase64) {
        summary += '\n[Screenshot da página capturada com sucesso]'
      }
      return summary
    }

    case 'git_check_repo': {
      const repoPath = args.repoPath ? String(args.repoPath).trim() : undefined
      const res = await gitWatcher.checkRepo(repoPath)
      if (!res.isGit) {
        return res.changesSummary
      }

      let text = `Repositório Git (Branch "${res.branch}"):\n${res.changesSummary}\nÚltimo commit: ${res.lastCommit}`
      if (res.suggestedCommitMessage) {
        text += `\nSugestão de commit semântico: "${res.suggestedCommitMessage}"`
      }
      return text
    }

    case 'git_suggest_commit': {
      const repoPath = args.repoPath ? String(args.repoPath).trim() : undefined
      const res = await gitWatcher.suggestCommit(repoPath)
      if (!res.suggestion) {
        return res.diffSummary
      }
      return `Sugestão de commit semântico para a branch "${res.branch}":\n"${res.suggestion}"\n\nResumo das alterações:\n${res.diffSummary}`
    }

    case 'git_commit_changes': {
      const msg = String(args.message || '').trim()
      if (!msg) return 'Por favor, informe a mensagem do commit.'
      const repoPath = args.repoPath ? String(args.repoPath).trim() : undefined
      const res = await gitWatcher.commitChanges(msg, repoPath)
      if (!res.success) {
        return `Erro ao realizar commit: ${res.output}`
      }
      return `Commit realizado com sucesso:\n${res.output}`
    }

    case 'scan_duplicates_and_old_files': {
      const target = String(args.target || 'downloads').trim()
      const res = await folderOrganizer.scanDuplicatesAndOldFiles(target)
      let out = res.summary
      if (res.duplicates.length > 0) {
        out += '\n\nDuplicados encontrados:'
        res.duplicates.slice(0, 5).forEach((d, idx) => {
          out += `\n${idx + 1}. [${Math.round(d.sizeBytes / 1024)} KB] ${d.files.join(' <-> ')}`
        })
      }
      if (res.oldInstallers.length > 0) {
        out += '\n\nInstaladores antigos (>30 dias):'
        res.oldInstallers.slice(0, 5).forEach((inst, idx) => {
          out += `\n${idx + 1}. ${inst.name} (${inst.daysOld} dias atrás, ${inst.sizeMb} MB)`
        })
      }
      return out
    }

    case 'organize_directory': {
      const target = String(args.target || 'downloads').trim()
      const dryRun = args.dryRun !== false
      const res = await folderOrganizer.organizeDirectory(target, dryRun)
      let out = res.summary
      if (res.movedFiles.length > 0) {
        out += '\n\nArquivos mapeados:'
        res.movedFiles.slice(0, 8).forEach((m, idx) => {
          out += `\n${idx + 1}. ${m.from} -> ${m.to}`
        })
        if (res.movedFiles.length > 8) {
          out += `\n... e mais ${res.movedFiles.length - 8} arquivos.`
        }
      }
      return out
    }

    case 'spawn_subagent': {
      const role = (String(args.role || 'general').toLowerCase()) as SubagentRole
      const task = String(args.task || '').trim()
      if (!task) return 'Descrição da tarefa não informada para o subagente.'

      const t = await subagentOrchestrator.spawnSubagent(role, task)
      return `Subagente [${role.toUpperCase()}] instanciado com sucesso (ID: ${t.id}). Ele está executando a tarefa em segundo plano e você será avisado assim que concluir.`
    }

    case 'get_subagent_tasks': {
      const tasks = subagentOrchestrator.getTasks()
      if (tasks.length === 0) return 'Nenhum subagente registrado ou em execução.'
      return 'Subagentes em atividade / histórico recente:\n' +
        tasks.map((t) => `• [${t.status.toUpperCase()}] ${t.role.toUpperCase()} (ID: ${t.id}): ${t.task.slice(0, 60)}...${t.result ? `\n  ↳ Resultado: ${t.result.slice(0, 150)}...` : ''}`).join('\n\n')
    }

    case 'manage_calendar': {
      const action = String(args.action || 'list').toLowerCase().trim()
      if (action === 'add') {
        const title = String(args.title || 'Compromisso').trim()
        const start = args.startDateTime || Date.now() + 60 * 60 * 1000
        const mins = Number(args.durationMinutes) || 60
        const loc = args.location ? String(args.location).trim() : undefined
        const evt = calendarEmail.addEvent(title, start, mins, undefined, loc)
        const dateStr = new Date(evt.startDateTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
        return `Compromisso agendado com sucesso! "${evt.title}" em ${dateStr} (${mins} min). O arquivo iCal (.ics) foi sincronizado e o alarme de 10 minutos está ativo.`
      } else {
        const events = calendarEmail.getEvents(48)
        if (events.length === 0) return 'Você não possui compromissos agendados para as próximas 48 horas.'
        return 'Próximos compromissos na sua agenda:\n' +
          events.map((e) => `• ${new Date(e.startDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${e.title} (${Math.round((e.endDateTime - e.startDateTime) / 60000)} min)${e.location ? ` em ${e.location}` : ''}`).join('\n')
      }
    }

    case 'check_emails': {
      const unreadOnly = args.unreadOnly !== false
      const limit = Number(args.limit) || 5
      const emails = await calendarEmail.checkEmails({ unreadOnly, limit })
      if (emails.length === 0) return 'Nenhum e-mail novo encontrado na sua caixa de entrada.'
      return 'Resumo dos e-mails recentes:\n' +
        emails.map((m) => `• [${m.isUrgent ? 'URGENTE' : 'Normal'}] De: ${m.from}\n  Assunto: ${m.subject}\n  "${m.snippet}"`).join('\n\n')
    }

    case 'trigger_webhook': {
      const nameOrUrl = String(args.webhookNameOrUrl || '').trim()
      if (!nameOrUrl) return 'Destino do webhook não informado.'

      let payload = {}
      if (args.payloadJson) {
        try {
          payload = JSON.parse(args.payloadJson)
        } catch {
          payload = { text: args.payloadJson }
        }
      }

      const res = await webhookManager.triggerWebhook(nameOrUrl, payload, args.method)
      if (!res.success) {
        return `Falha ao disparar webhook para "${nameOrUrl}": ${res.error || `Status HTTP ${res.status}`}`
      }
      return `Webhook disparado com sucesso (${res.status}) em ${res.executionTimeMs}ms! Resposta do servidor:\n${res.responseBody || 'OK'}`
    }

    case 'control_smart_home': {
      const domain = String(args.domain || 'light').trim()
      const service = String(args.service || 'toggle').trim()
      const entityId = String(args.entityId || '').trim()
      if (!entityId) return 'Por favor, informe o ID da entidade (ex: light.escritorio).'

      const res = await smartHome.executeCommand(domain, service, entityId)
      return res.message
    }

    default:
      return `Ferramenta de autonomia "${toolName}" não reconhecida.`
  }
}

