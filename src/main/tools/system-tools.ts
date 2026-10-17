import { addFact } from '../memory'
import { evaluateMathExpression } from './math-evaluator'
import { processManager } from '../autonomous/process-manager'
import { mediaController } from '../autonomous/media-controller'
import { uiAutomation } from '../autonomous/ui-automation'
import { systemHealth } from '../autonomous/system-health'
import { reportGenerator } from '../autonomous/report-generator'
import { fileSummarizer } from '../autonomous/file-summarizer'
import { qrService } from '../autonomous/qr-service'
import { clipboardWatcher } from '../autonomous/clipboard-watcher'
import { ocrService } from '../autonomous/ocr-service'
import { headlessBrowser } from '../autonomous/headless-browser'
import { presentationMode } from '../autonomous/presentation-mode'
import { focusMode } from '../autonomous/focus-mode'
import { folderOrganizer } from '../autonomous/folder-organizer'
import { configStore } from '../config/config-store'
import { updateManager } from '../services/update-manager'
import { semanticMemory } from '../autonomous/semantic-memory'

interface AppConfig {
  cmd: string
  args?: string[]
}

const QUICK_APPS: Record<string, AppConfig> = {
  calculadora: { cmd: 'calc.exe' },
  calc: { cmd: 'calc.exe' },
  calculator: { cmd: 'calc.exe' },
  notepad: { cmd: 'notepad.exe' },
  'bloco de notas': { cmd: 'notepad.exe' },
  explorer: { cmd: 'explorer.exe' },
  arquivos: { cmd: 'explorer.exe' }
}

export async function executeSystemTool(name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    case 'check_for_updates': {
      const state = await updateManager.check(true)
      return state.message
    }

    case 'open_app': {
      if (configStore.getConfig().enableProcessManager === false) {
        return 'O módulo de Gerenciamento de Processos está desativado nas configurações do Jasper.'
      }
      const app = (args.appName || '').toLowerCase().trim()
      if (!app) return 'Nome do aplicativo não especificado.'

      // Quick alias check for common desktop apps
      const quick = QUICK_APPS[app]
      const res = await processManager.launchProgram(quick?.cmd || app, quick?.args || [])
      return res.message
    }

    case 'search_program': {
      if (configStore.getConfig().enableProcessManager === false) {
        return 'O módulo de Gerenciamento de Processos está desativado nas configurações do Jasper.'
      }
      const q = (args.query || '').trim()
      if (!q) return 'Por favor, forneça o nome ou termo do programa que deseja pesquisar.'
      const results = await processManager.searchPrograms(q, 8)
      if (results.length === 0) {
        return `Nenhum programa ou aplicativo correspondente a "${q}" foi encontrado no sistema.`
      }
      const lines = results.map((r, i) => `${i + 1}. **${r.name}** (${r.source}) - \`${r.appId}\``)
      return `Encontrei ${results.length} programa(s) para "${q}":\n${lines.join('\n')}`
    }

    case 'close_program': {
      if (configStore.getConfig().enableProcessManager === false) {
        return 'O módulo de Gerenciamento de Processos está desativado nas configurações do Jasper.'
      }
      const processId = String(args.processId ?? args.programName ?? '').trim()
      if (!processId) return 'Informe o PID numérico do processo a ser encerrado.'
      const force = args.force !== false
      const res = await processManager.terminateProgram(processId, force)
      return res.message
    }

    case 'list_processes': {
      if (configStore.getConfig().enableProcessManager === false) {
        return 'O módulo de Gerenciamento de Processos está desativado nas configurações do Jasper.'
      }
      const limit = Math.max(1, Math.min(25, Number(args.limit) || 8))
      const procs = await processManager.listRunningProcesses(limit)
      if (procs.length === 0) {
        return 'Não foi possível obter a lista de processos ativos no momento.'
      }
      const lines = procs.map((p, i) => `${i + 1}. **${p.name}** (PID ${p.pid}) - ${p.memoryMb} MB RAM`)
      return `Top ${procs.length} processos ativos por uso de memória:\n${lines.join('\n')}`
    }

    case 'control_media_volume': {
      if (configStore.getConfig().enableMediaController === false) {
        return 'O módulo de Controle de Mídia e Volume está desativado nas configurações do Jasper.'
      }
      const cmd = (args.command || '').trim()
      if (!cmd) return 'Comando de controle de áudio/mídia não informado.'
      const val = Number(args.value) || undefined
      return await mediaController.executeCommand(cmd, val)
    }

    case 'automate_ui': {
      if (configStore.getConfig().enableUiAutomation === false) {
        return 'O módulo de Automação de Interface (UIA) está desativado nas configurações do Jasper.'
      }
      const action = (args.action || '').toLowerCase().trim()
      const winTitle = (args.windowTitle || '').trim()
      const elName = (args.elementName || '').trim()
      const text = (args.text || '').trim()

      switch (action) {
        case 'list_windows': {
          const windows = await uiAutomation.listWindows(10)
          if (windows.length === 0) return 'Nenhuma janela interativa identificada no momento.'
          const lines = windows.map((w: any, i: number) => `${i + 1}. "${w.title}" (Processo: ${w.processName}, PID: ${w.processId})`)
          return `Janelas abertas identificadas via UIA:\n${lines.join('\n')}`
        }

        case 'inspect': {
          if (!winTitle) return 'Informe o título da janela a ser inspecionada.'
          const inspectRes = await uiAutomation.inspectWindow(winTitle, 15)
          if (inspectRes.error) return `Erro na inspeção: ${inspectRes.error}`
          if (!inspectRes.elements || inspectRes.elements.length === 0) {
            return `Janela "${inspectRes.windowTitle}" encontrada, mas nenhum elemento interativo foi listado.`
          }
          const elementsList = inspectRes.elements
            .map((el) => `- [${el.controlType.replace('ControlType.', '')}] "${el.name || el.automationId}" (${el.isEnabled ? 'habilitado' : 'desabilitado'})`)
            .join('\n')
          return `Elementos interativos em "${inspectRes.windowTitle}":\n${elementsList}`
        }

        case 'click': {
          if (!winTitle || !elName) return 'Informe o título da janela e o nome do elemento/botão a ser clicado.'
          const clickRes = await uiAutomation.clickElement(winTitle, elName)
          return clickRes.message
        }

        case 'set_text': {
          if (!winTitle || !elName || !text) return 'Informe o título da janela, o nome do campo e o texto a ser digitado.'
          const textRes = await uiAutomation.setElementText(winTitle, elName, text)
          return textRes.message
        }

        default:
          return `Ação de automação de interface "${action}" desconhecida. Use "list_windows", "inspect", "click" ou "set_text".`
      }
    }

    case 'get_detailed_hardware_stats': {
      const stats = await systemHealth.getDetailedHardwareStats()
      const diskStr = stats.disks.map((d) => `  - Disco ${d.mount}: ${d.freeGb} GB livres de ${d.totalGb} GB (${d.usePercent}% em uso)`).join('\n')
      const gpuStr = stats.graphics.length > 0 ? stats.graphics.map((g) => g.model).join(', ') : 'GPU Integrada/Padrão'
      const batStr = stats.battery?.hasBattery
        ? `\n- Bateria: ${stats.battery.percent}% (${stats.battery.isCharging ? 'Carregando' : 'Na bateria'})`
        : '\n- Bateria: Computador conectado diretamente à tomada (Desktop/Sem bateria)'

      return `Diagnóstico Detalhado do Sistema:
- Processador: ${stats.cpu.brand} (${stats.cpu.cores} núcleos, carga atual: ${stats.cpu.loadPercent}%)
- Placa de Vídeo: ${gpuStr}
- Memória RAM: ${stats.memory.usedGb} GB usados de ${stats.memory.totalGb} GB (${stats.memory.usagePercent}%) - ${stats.memory.freeGb} GB livres${batStr}
- Discos e Armazenamento:
${diskStr}
- Sistema Operacional: ${stats.osInfo.distro} (Online há ${stats.osInfo.uptimeHours} horas)`
    }

    case 'generate_report_pdf': {
      if (configStore.getConfig().enableReportGenerator === false) {
        return 'O módulo de Geração de Relatórios Executivos está desativado nas configurações do Jasper.'
      }
      const title = (args.title || 'Relatório Executivo').trim()
      const html = (args.contentHtml || '<p>Nenhum conteúdo informado.</p>').trim()
      const fileName = args.fileName ? String(args.fileName).trim() : undefined
      const res = await reportGenerator.generatePdfReport(title, html, fileName)
      return res.message
    }

    case 'generate_spreadsheet': {
      if (configStore.getConfig().enableReportGenerator === false) {
        return 'O módulo de Geração de Relatórios Executivos está desativado nas configurações do Jasper.'
      }
      const title = (args.title || 'Planilha de Dados').trim()
      let cols: any[] = []
      let rows: any[] = []

      try {
        cols = typeof args.columnsJson === 'string' ? JSON.parse(args.columnsJson) : (args.columnsJson || [])
      } catch {
        cols = [{ header: 'Item', key: 'item' }, { header: 'Valor', key: 'valor' }]
      }

      try {
        rows = typeof args.rowsJson === 'string' ? JSON.parse(args.rowsJson) : (args.rowsJson || [])
      } catch {
        rows = []
      }

      const fileName = args.fileName ? String(args.fileName).trim() : undefined
      const res = await reportGenerator.generateExcelSpreadsheet(title, cols, rows, fileName)
      return res.message
    }

    case 'generate_word_document': {
      if (configStore.getConfig().enableReportGenerator === false) {
        return 'O módulo de Geração de Relatórios Executivos está desativado nas configurações do Jasper.'
      }
      const title = (args.title || 'Documento Oficial').trim()
      let sections: any[] = []

      try {
        sections = typeof args.sectionsJson === 'string' ? JSON.parse(args.sectionsJson) : (args.sectionsJson || [])
      } catch {
        sections = [{ paragraph: String(args.sectionsJson || 'Sem conteúdo.') }]
      }

      const fileName = args.fileName ? String(args.fileName).trim() : undefined
      const res = await reportGenerator.generateWordDocument(title, sections, fileName)
      return res.message
    }

    case 'read_and_summarize_file': {
      if (configStore.getConfig().enableFileSummarizer === false) {
        return 'O módulo de Leitura e Resumo de Arquivos está desativado nas configurações do Jasper.'
      }
      const filePath = (args.filePath || '').trim()
      if (!filePath) return 'Por favor, informe o caminho do arquivo a ser lido.'
      return await fileSummarizer.analyzeFile(filePath)
    }

    case 'summarize_clipboard': {
      if (configStore.getConfig().enableClipboardWatcher === false) {
        return 'O módulo de Leitura e Resumo da Área de Transferência está desativado nas configurações do Jasper.'
      }
      const action = (args.action || 'summarize') as 'summarize' | 'translate' | 'explain'
      return await clipboardWatcher.summarizeClipboard(action)
    }

    case 'generate_qr_code': {
      if (configStore.getConfig().enableQrService === false) {
        return 'O módulo de Geração de QR Code está desativado nas configurações do Jasper.'
      }
      const data = (args.data || '').trim()
      if (!data) return 'Por favor, informe o texto, link ou chave para gerar o QR Code.'
      const fileName = args.fileName ? String(args.fileName).trim() : undefined
      const res = await qrService.generateQrCode(data, fileName)
      return res.message
    }

    case 'calculate': {
      const expr = (args.expression || '').trim()
      if (!expr) {
        return 'Nenhuma expressão informada para cálculo.'
      }
      try {
        const result = evaluateMathExpression(expr)
        const formatted = Number.isInteger(result) ? result.toString() : result.toFixed(6).replace(/\.?0+$/, '')
        return `O resultado do cálculo de ${expr} é ${formatted}.`
      } catch (err: any) {
        return `Erro ao calcular a expressão "${expr}": ${err.message}`
      }
    }

    case 'organize_folder': {
      const folderAlias = String(args.targetFolder || 'downloads').trim()
      const result = await folderOrganizer.organizeDirectory(folderAlias, false)
      return result.summary
    }

    case 'remember_fact': {
      const fact = (args.fact || '').trim()
      if (!fact) return 'Nenhum fato fornecido para memorização.'
      semanticMemory.addMemory(fact, 'fact')
      return addFact(fact)
    }

    case 'ocr_screen': {
      if (configStore.getConfig().enableOcrService === false) {
        return 'O módulo de OCR Local está desativado nas configurações do Jasper.'
      }
      const imgPath = args.imagePath ? String(args.imagePath).trim() : undefined
      const langs = args.languages ? String(args.languages).trim() : 'eng+por'
      if (imgPath) {
        const res = await ocrService.recognize(imgPath, langs)
        if (!res.success) return res.message
        return `${res.message}\n\nTexto extraído via OCR:\n${res.text}`
      } else {
        const res = await ocrService.recognizeScreen(langs)
        if (!res.success) return res.message
        return `${res.message}\n\nTexto extraído da tela via OCR:\n${res.text}`
      }
    }

    case 'web_automate': {
      if (configStore.getConfig().enableHeadlessBrowser === false) {
        return 'O módulo de Navegador Headless está desativado nas configurações do Jasper.'
      }
      const url = (args.url || '').trim()
      const action = (args.action || '').trim() as 'click' | 'fill' | 'extract_table' | 'screenshot'
      const selector = args.selector ? String(args.selector).trim() : undefined
      const value = args.value !== undefined ? String(args.value) : undefined

      if (!url) return 'Por favor, informe a URL do site para automação.'
      if (!action) return 'Por favor, informe a ação a ser executada ("click", "fill", "extract_table", "screenshot").'

      const res = await headlessBrowser.executeAction(url, action, selector, value)
      if (!res.success) {
        return `Falha na automação web (${res.url}): ${res.message}`
      }
      if (action === 'extract_table' && res.result) {
        const t = res.result
        const headersStr = t.headers.length > 0 ? `Colunas: ${t.headers.join(' | ')}\n` : ''
        const rowsStr = t.rows.slice(0, 10).map((r: string[]) => r.join(' | ')).join('\n')
        return `${res.message}\n${headersStr}${rowsStr}`
      }
      return res.message
    }

    case 'set_presentation_mode': {
      if (configStore.getConfig().enablePresentationMode === false) {
        return 'O módulo de Modo Apresentação está desativado nas configurações do Jasper.'
      }
      const active = Boolean(args.active)
      presentationMode.setPresentationMode(active)
      return active
        ? `Modo Apresentação ATIVADO. Áudios invasivos e notificações foram silenciados para sua apresentação/reunião.`
        : `Modo Apresentação DESATIVADO. Notificações normais e alertas do Jasper foram restaurados.`
    }

    case 'set_focus_mode': {
      if (configStore.getConfig().enableFocusMode === false) {
        return 'O módulo de Modo Foco está desativado nas configurações do Jasper.'
      }
      const action = (args.action || 'status').toLowerCase().trim()
      if (action === 'start') {
        const mins = Number(args.durationMinutes) || 25
        const st = focusMode.startFocus(mins)
        return `Modo Foco INICIADO por ${st.totalDurationMinutes} minutos! O Jasper manterá vigilância contra distrações (jogos, mensageiros) para você manter máxima produtividade.`
      } else if (action === 'stop') {
        const st = focusMode.stopFocus()
        return `Modo Foco ENCERRADO. Você completou sua sessão com ${st.distractionsBlockedCount} tentativa(s) de distração filtradas.`
      } else {
        const st = focusMode.getStatus()
        if (st.isActive) {
          return `Modo Foco em andamento: ${st.remainingMinutes} minutos restantes de ${st.totalDurationMinutes} min programados. Distrações detectadas até agora: ${st.distractionsBlockedCount}.`
        } else {
          return `O Modo Foco não está ativo no momento. Deseja iniciar uma sessão de 25 minutos (Pomodoro)?`
        }
      }
    }

    default:
      return `Ferramenta ${name} não reconhecida.`
  }
}
