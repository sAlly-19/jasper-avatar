import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import os from 'os'

// Importações REAIS dos 23 módulos sem configurações externas
import { screenAwareness } from '../src/main/autonomous/screen-awareness'
import { windowTracker } from '../src/main/autonomous/window-tracker'
import { clipboardWatcher, redactSecrets } from '../src/main/autonomous/clipboard-watcher'
import { cronEngine } from '../src/main/autonomous/cron-engine'
import { systemHealth } from '../src/main/autonomous/system-health'
import { briefingService } from '../src/main/autonomous/briefing-service'
import { semanticMemory } from '../src/main/autonomous/semantic-memory'
import { knowledgeGraph } from '../src/main/autonomous/knowledge-graph'
import { codeInterpreter } from '../src/main/autonomous/code-interpreter'
import { headlessBrowser } from '../src/main/autonomous/headless-browser'
import { gitWatcher } from '../src/main/autonomous/git-watcher'
import { folderOrganizer } from '../src/main/autonomous/folder-organizer'
import { subagentOrchestrator } from '../src/main/autonomous/subagent-orchestrator'
import { reflexionEngine } from '../src/main/autonomous/reflexion-engine'
import { toolPolicyEngine } from '../src/main/autonomous/policy-engine'
import { processManager } from '../src/main/autonomous/process-manager'
import { uiAutomation } from '../src/main/autonomous/ui-automation'
import { mediaController } from '../src/main/autonomous/media-controller'
import { reportGenerator } from '../src/main/autonomous/report-generator'
import { fileSummarizer } from '../src/main/autonomous/file-summarizer'
import { qrService } from '../src/main/autonomous/qr-service'
import { ocrService } from '../src/main/autonomous/ocr-service'
import { presentationMode } from '../src/main/autonomous/presentation-mode'
import { focusMode } from '../src/main/autonomous/focus-mode'

test('Validação em Situações Reais de Todos os Módulos Locais (Zero Config)', async (t) => {
  const tempTestDir = path.join(os.tmpdir(), `jasper-real-val-${Date.now()}`)
  await fs.mkdir(tempTestDir, { recursive: true })

  t.after(async () => {
    try {
      await fs.rm(tempTestDir, { recursive: true, force: true })
    } catch {}
  })

  // Módulo 1: Screen Awareness
  await t.test('Módulo 01 - Screen Awareness: captura de display em situação real', async () => {
    const res = await screenAwareness.captureScreen()
    assert.equal(res.success, true, 'Captura de tela deve ter sucesso')
    assert.ok(typeof res.base64Image === 'string' && res.base64Image.length > 0, 'Deve retornar imagem em base64')
    assert.ok(res.width && res.width > 0, 'Largura deve ser detectada')
    assert.ok(res.height && res.height > 0, 'Altura deve ser detectada')
    assert.ok(res.timestamp && res.timestamp > 0, 'Timestamp de captura deve existir')
    assert.ok(screenAwareness.getLastCachedThumbnail()?.startsWith('data:image/jpeg;base64,'))
  })

  // Módulo 2: Window Tracker
  await t.test('Módulo 02 - Window Tracker: identificação de janela ativa via PowerShell nativo', async () => {
    const winInfo = await windowTracker.getActiveWindow()
    assert.ok(winInfo, 'Deve retornar informações de janela ativa')
    assert.ok(typeof winInfo.processName === 'string', 'Nome do processo deve ser string')
    assert.ok(typeof winInfo.windowTitle === 'string', 'Título da janela deve ser string')
    assert.ok(winInfo.timestamp > 0, 'Timestamp deve ser válido')
  })

  // Módulo 3: Clipboard Watcher & Redação de Segredos
  await t.test('Módulo 03 - Clipboard Watcher: resumo e higienização estrita de credenciais', async () => {
    const dirtyText = 'Chave AWS: AKIAIOSFODNN7EXAMPLE e Token Gemini: sk-1234567890abcdef1234567890'
    const cleaned = redactSecrets(dirtyText)
    assert.ok(!cleaned.includes('AKIAIOSFODNN7EXAMPLE'), 'Chave AWS não pode vazar')
    assert.ok(!cleaned.includes('sk-1234567890abcdef'), 'Token Gemini não pode vazar')
    assert.ok(cleaned.includes('[REDACTED_SECRET_KEY]') || cleaned.includes('[REDACTED_CREDENTIAL]'))

    const sumRes = await clipboardWatcher.summarizeClipboard('summarize')
    assert.ok(typeof sumRes === 'string')
    const transRes = await clipboardWatcher.summarizeClipboard('translate')
    assert.ok(typeof transRes === 'string')
  })

  // Módulo 4: Cron Engine & Agendador
  await t.test('Módulo 04 - Cron Engine: agendamento, verificação e ciclo de tarefas locais', async () => {
    let triggered = false
    cronEngine.setOnTaskTriggered(() => {
      triggered = true
    })

    const task = cronEngine.scheduleTask({
      title: 'Auditoria Diária de Sistema',
      cronExpression: '0 8 * * *',
      dueTimestamp: Date.now() + 3600000,
      metadata: { priority: 'high' }
    })

    assert.ok(task.id, 'Tarefa deve receber um ID único')
    assert.equal(task.title, 'Auditoria Diária de Sistema')
    assert.ok(task.nextRun && task.nextRun > Date.now(), 'Próxima execução deve ser futura')

    const allTasks = cronEngine.getTasks()
    assert.ok(allTasks.some((tk) => tk.id === task.id), 'Tarefa agendada deve constar na lista persistente')

    const canceled = cronEngine.cancelTask(task.id)
    assert.equal(canceled, true, 'Cancelamento de tarefa deve ser bem-sucedido')
    assert.ok(!cronEngine.getTasks().some((tk) => tk.id === task.id), 'Tarefa cancelada deve ser removida')
  })

  // Módulo 5: System Health
  await t.test('Módulo 05 - System Health: diagnóstico de hardware com systeminformation', async () => {
    const health = await systemHealth.getHealth()
    assert.ok(typeof health.cpuUsagePercent === 'number')
    assert.ok(health.ramUsagePercent >= 0 && health.ramUsagePercent <= 100)
    assert.ok(health.totalRamGb > 0)
    assert.ok(typeof health.uptimeHours === 'number')

    const detailed = await systemHealth.getDetailedHardwareStats()
    assert.ok(detailed.cpu.cores > 0, 'CPU deve relatar contagem de núcleos físicos/lógicos')
    assert.ok(detailed.memory.totalGb > 0, 'Memória RAM total deve ser superior a zero')
    assert.ok(Array.isArray(detailed.disks) && detailed.disks.length > 0, 'Deve identificar discos de armazenamento')
    assert.ok(detailed.osInfo.platform === 'win32' || detailed.osInfo.platform.length > 0)
  })

  // Módulo 6: Daily Briefing
  await t.test('Módulo 06 - Daily Briefing: geração de relatório matinal/executivo completo', async () => {
    const briefing = await briefingService.generateBriefing('Comandante Alisson')
    assert.ok(briefing.greeting.includes('Alisson'), 'Saudação deve ser personalizada')
    assert.ok(briefing.dateFormatted.length > 0, 'Data em pt-BR deve estar preenchida')
    assert.ok(briefing.systemSummary.includes('Memória RAM'), 'Resumo deve incluir telemetria de hardware')
    assert.ok(briefing.fullBriefingText.length > 50, 'Texto completo do briefing deve ser descritivo')
  })

  // Módulo 7: Semantic Memory
  await t.test('Módulo 07 - Semantic Memory: armazenamento e busca vetorial por similaridade de cosseno', async () => {
    const mem1 = semanticMemory.storeMemory(
      'O usuário prefere trabalhar com o tema Cyberpunk HUD e modelos 3D com iluminação neon.',
      'preference'
    )
    const mem2 = semanticMemory.storeMemory(
      'Servidor de homologação configurado na porta 8080 com banco PostgreSQL local.',
      'infrastructure'
    )

    assert.ok(mem1.id && mem2.id)

    // Busca com termos relacionados ao tema
    const searchResults = semanticMemory.searchMemories('iluminação neon tema visual 3D', 3)
    assert.ok(searchResults.length > 0, 'Deve retornar memórias relevantes')
    assert.equal(searchResults[0].category, 'preference', 'Primeiro resultado deve corresponder ao tema')
    assert.ok(searchResults[0].content.includes('Cyberpunk HUD'))
  })

  // Módulo 8: Knowledge Graph
  await t.test('Módulo 08 - Knowledge Graph: nós, relacionamentos e persistência atômica', async () => {
    const nodeA = knowledgeGraph.addNode('JasperAvatar', 'Project', { version: '2.0.0' })
    const nodeB = knowledgeGraph.addNode('ThreeJS', 'Technology', { type: '3D Library' })
    assert.ok(nodeA.id && nodeB.id)

    const edge = knowledgeGraph.addEdge('JasperAvatar', 'ThreeJS', 'renders_with')
    assert.ok(edge, 'Relação deve ser criada')

    const neighbors = knowledgeGraph.queryNeighbors('JasperAvatar')
    assert.ok(neighbors.some((n) => n.id === 'ThreeJS'), 'ThreeJS deve ser vizinho de JasperAvatar')

    const found = knowledgeGraph.findEntity('JasperAvatar')
    assert.equal(found?.type, 'Project')
  })

  // Módulo 9: Code Interpreter
  await t.test('Módulo 09 - Code Interpreter: execução sandboxed de script local Node.js', async () => {
    const code = `
      const a = 15;
      const b = 27;
      console.log('JASPER_CALC_RESULT=' + (a * b));
    `
    const result = await codeInterpreter.executeCode('node', code)
    assert.equal(result.success, true, 'Execução de código sandboxed deve ser bem-sucedida')
    assert.ok(result.stdout.includes('JASPER_CALC_RESULT=405'), 'Resultado do cálculo deve estar correto')
    assert.ok(result.executionTimeMs >= 0)

    // Limpeza de sandbox
    codeInterpreter.clearSandbox()
    assert.equal(codeInterpreter.listSandboxFiles().length, 0, 'Sandbox deve estar limpo após a execução')
  })

  // Módulo 10: Headless Browser
  await t.test('Módulo 10 - Headless Browser: ações web e blindagem Zero-Trust SSRF', async () => {
    // 1. Ação de Screenshot
    const shot = await headlessBrowser.executeAction('https://example.com', 'screenshot')
    assert.equal(shot.success, true)
    assert.ok(shot.result.startsWith('data:image/'))

    // 2. Extração de Tabela
    const table = await headlessBrowser.executeAction('https://example.com', 'extract_table', 'table')
    assert.equal(table.success, true)
    assert.ok(Array.isArray(table.result.headers))

    // 3. Bloqueio Zero-Trust SSRF (IP de Metadados de Nuvem)
    const ssrfRes = await headlessBrowser.executeAction('http://169.254.169.254/latest/meta-data', 'click', '#btn')
    assert.equal(ssrfRes.success, false)
    assert.match(ssrfRes.message, /ZERO-TRUST|BLOQUEIO/i)
  })

  // Módulo 11: Git Watcher
  await t.test('Módulo 11 - Git Watcher: inspeção do repositório local e status de versionamento', async () => {
    const gitStatus = await gitWatcher.checkRepo(process.cwd())
    assert.equal(gitStatus.isGit, true, 'O diretório do projeto deve ser um repositório Git')
    assert.ok(gitStatus.branch.length > 0, 'Branch atual deve ser identificada')
    assert.ok(Array.isArray(gitStatus.modifiedFiles), 'modifiedFiles deve ser um array')
    assert.ok(Array.isArray(gitStatus.untrackedFiles), 'untrackedFiles deve ser um array')
    assert.ok(typeof gitStatus.changesSummary === 'string', 'Deve fornecer resumo de mudanças')
  })

  // Módulo 12: Folder Organizer
  await t.test('Módulo 12 - Folder Organizer: detecção de duplicatas e categorização de arquivos', async () => {
    // Criação de arquivos de teste no diretório temporário
    const docOriginal = path.join(tempTestDir, 'proposta_comercial.pdf')
    const docCopia = path.join(tempTestDir, 'proposta_comercial_copia.pdf')
    const imagem = path.join(tempTestDir, 'foto_avatar.png')
    const executavel = path.join(tempTestDir, 'setup_driver.exe')

    const pdfBuffer = Buffer.from('%PDF-1.4 Conteúdo idêntico para teste de hash MD5 de duplicatas')
    await fs.writeFile(docOriginal, pdfBuffer)
    await fs.writeFile(docCopia, pdfBuffer)
    await fs.writeFile(imagem, Buffer.from('fake-png-image-data-stream'))
    await fs.writeFile(executavel, Buffer.from('fake-exe-binary-stream'))

    // Escanear pasta por duplicatas e arquivos antigos
    const scanResult = await folderOrganizer.scanDuplicatesAndOldFiles(tempTestDir, 0)
    assert.equal(scanResult.totalScannedFiles, 4, 'Deve escanear todos os 4 arquivos criados')
    assert.ok(scanResult.duplicates.length >= 1, 'Deve detectar a duplicata idêntica')
    assert.equal(scanResult.duplicates[0].files.length, 2, 'O grupo duplicado deve ter 2 arquivos')

    // Verificação de categorização dry-run
    const organizeResult = await folderOrganizer.organizeFolder(tempTestDir, true)
    assert.equal(organizeResult.success, true)
    assert.equal(organizeResult.dryRun, true)
    assert.ok(organizeResult.movedFiles.length >= 3, 'Deve planejar a organização em pastas por categoria')
    assert.ok(organizeResult.summary.includes('Dry-run finalizado'))
  })

  // Módulo 13: Subagents Orchestrator
  await t.test('Módulo 13 - Subagents Orchestrator: ciclo de vida e cancelamento de subagentes', async () => {
    const subTask = await subagentOrchestrator.spawnSubagent(
      'analyst',
      'Analisar telemetria de CPU e picos de memória da última hora'
    )

    assert.ok(subTask.id.startsWith('sub-'))
    assert.equal(subTask.role, 'analyst')
    assert.equal(subTask.status, 'running')

    const taskLookup = subagentOrchestrator.getTask(subTask.id)
    assert.ok(taskLookup)
    assert.equal(taskLookup.id, subTask.id)

    // Cancelamento limpo pelo orquestrador
    const canceled = subagentOrchestrator.cancelTask(subTask.id)
    assert.equal(canceled, true, 'Subagente deve ser cancelado com sucesso')
    assert.equal(subagentOrchestrator.getTask(subTask.id)?.status, 'failed')
  })

  // Módulo 14: Reflexion Guard & Policy Engine
  await t.test('Módulo 14 - Reflexion Guard: checagem de risco pré-voo e bloqueio preventivo', () => {
    // Comando perigoso deve disparar alerta de alto risco e exigir confirmação
    const dangerousCheck = reflexionEngine.preExecutionCheck('execute_terminal_command', {
      command: 'rmdir /s /q C:\\Windows'
    })
    assert.equal(dangerousCheck.allowed, false, 'Comando destrutivo deve ser bloqueado por padrão')
    assert.equal(dangerousCheck.riskLevel, 'CRITICAL')
    assert.equal(dangerousCheck.requiresConfirmation, true)

    // Comando seguro deve ser aprovado sem confirmação
    const safeCheck = reflexionEngine.preExecutionCheck('system_health', {})
    assert.equal(safeCheck.allowed, true)
    assert.equal(safeCheck.riskLevel, 'SAFE')
    assert.equal(safeCheck.requiresConfirmation, false)

    // Validação de caminhos no ToolPolicyEngine
    assert.equal(toolPolicyEngine.validatePath('..\\..\\Windows\\System32').isAllowed, false)
  })

  // Módulo 18: Process Manager
  await t.test('Módulo 18 - Process Manager: busca StartApps, listagem de processos e bloqueio de injeção', async () => {
    // 1. Busca por executáveis instalados
    const foundCalc = await processManager.searchPrograms('calc', 3)
    assert.ok(Array.isArray(foundCalc))
    assert.ok(foundCalc.length > 0, 'Deve localizar calculadora do Windows')

    // 2. Listagem de processos ativos
    const activeProcs = await processManager.listRunningProcesses(5)
    assert.ok(Array.isArray(activeProcs) && activeProcs.length > 0)
    assert.ok(activeProcs[0].pid > 0)

    // 3. Bloqueio de injeção de comandos
    const injectionAttempt = await processManager.launchProgram('calc & whoami')
    assert.equal(injectionAttempt.success, false)
    assert.match(injectionAttempt.message, /caracteres inválidos/i)

    // 4. Bloqueio de encerramento de processos essenciais do Windows
    const killCritical = await processManager.terminateProgram('explorer.exe')
    assert.equal(killCritical.success, false)
    assert.match(killCritical.message, /crítico para o sistema operacional/i)
  })

  // Módulo 19: UI Automation
  await t.test('Módulo 19 - UI Automation: inspeção de janela e validação de comandos UIA', async () => {
    const invalidInspect = await uiAutomation.inspectWindow('')
    assert.ok(invalidInspect.error, 'Título de janela vazio deve retornar erro')

    // Inspeção real com tratamento seguro
    const inspectResult = await uiAutomation.inspectWindow('explorer')
    assert.ok(inspectResult.windowTitle.length >= 0)
    assert.ok(Array.isArray(inspectResult.elements))
  })

  // Módulo 20: Media Controller
  await t.test('Módulo 20 - Media Controller: execução de comandos CoreAudio / multimídia', async () => {
    const muteRes = await mediaController.executeCommand('mute')
    assert.ok(muteRes.includes('VOLUME_MUTE_OK') || muteRes.includes('sucesso'))

    const volDown = await mediaController.executeCommand('volume_down')
    assert.ok(volDown.includes('VOLUME_DOWN_OK') || volDown.includes('sucesso'))

    const invalidCmd = await mediaController.executeCommand('acao_invalida_xyz')
    assert.match(invalidCmd, /desconhecido/i)
  })

  // Módulo 21: Report Generator
  await t.test('Módulo 21 - Report Generator: criação real de relatórios PDF, Excel e Word em disco', async () => {
    // 1. Relatório PDF
    const pdfPath = path.join(tempTestDir, 'relatorio_executivo_real.pdf')
    const pdfRes = await reportGenerator.generatePdfReport(
      'Auditoria de Autonomia Jasper',
      '<h2>Status dos Módulos</h2><p>Todos os 23 módulos locais foram validados com 100% de integridade.</p>',
      pdfPath
    )
    assert.equal(pdfRes.success, true)
    assert.ok(pdfRes.filePath)
    const pdfStat = await fs.stat(pdfRes.filePath)
    assert.ok(pdfStat.size > 0, 'O arquivo PDF gerado deve ter tamanho > 0')

    // 2. Planilha Excel (.xlsx)
    const xlsxPath = path.join(tempTestDir, 'faturamento_jasper_real.xlsx')
    const xlsxRes = await reportGenerator.generateExcelSpreadsheet(
      'Licenças e Desempenho',
      [
        { header: 'Plano', key: 'plano', width: 25 },
        { header: 'Preço', key: 'preco', width: 15 },
        { header: 'Status', key: 'status', width: 15 }
      ],
      [
        { plano: 'Jasper Avatar Pro', preco: 'R$ 197,00', status: 'Ativo' },
        { plano: 'Módulo Autonomia Total', preco: 'R$ 0,00', status: 'Incluso' }
      ],
      xlsxPath
    )
    assert.equal(xlsxRes.success, true)
    const xlsxStat = await fs.stat(xlsxRes.filePath!)
    assert.ok(xlsxStat.size > 0, 'O arquivo Excel gerado deve ter tamanho > 0')

    // 3. Documento Word (.docx)
    const docxPath = path.join(tempTestDir, 'manual_jasper_real.docx')
    const docxRes = await reportGenerator.generateWordDocument(
      'Manual Operacional Jasper',
      [
        {
          heading: 'Visão Geral do Sistema',
          paragraph: 'O Jasper opera como uma estação autônoma completa para Windows, com 23 módulos locais gratuitos.'
        },
        {
          heading: 'Garantia Zero-Cost',
          paragraph: 'Nenhum serviço pago ou RPA externo é necessário para a execução das automações.'
        }
      ],
      docxPath
    )
    assert.equal(docxRes.success, true)
    const docxStat = await fs.stat(docxRes.filePath!)
    assert.ok(docxStat.size > 0, 'O arquivo Word gerado deve ter tamanho > 0')
  })

  // Módulo 22: File Summarizer
  await t.test('Módulo 22 - File Summarizer: leitura de arquivo Word gerado e higienização de texto', async () => {
    const docxPath = path.join(tempTestDir, 'manual_jasper_real.docx')
    const summary = await fileSummarizer.analyzeFile(docxPath)
    assert.ok(summary.includes('Análise do Arquivo') || summary.includes('manual_jasper_real.docx'))

    // Leitura e redação em arquivo de texto
    const textPath = path.join(tempTestDir, 'credenciais_auditoria.txt')
    await fs.writeFile(
      textPath,
      'Linha 1: Dados do Servidor\nLinha 2: Senha: super_secret_password_123\nLinha 3: Fim do arquivo.',
      'utf-8'
    )

    const textRead = await fileSummarizer.readFileContent(textPath)
    assert.equal(textRead.success, true)
    assert.equal(textRead.totalLines, 3)
    assert.ok(textRead.extractedText.includes('[REDACTED_CREDENTIAL]'))
    assert.ok(!textRead.extractedText.includes('super_secret_password_123'))
  })

  // Módulo 23: QR Service
  await t.test('Módulo 23 - QR Service: geração de arquivo PNG físico e string DataURL', async () => {
    const qrFilePath = path.join(tempTestDir, 'qrcode_jasper_real.png')
    const fileRes = await qrService.generateQrCode('https://jasper.ai/portal', qrFilePath, 'png')
    assert.equal(fileRes.success, true)
    const qrStat = await fs.stat(fileRes.filePath!)
    assert.ok(qrStat.size > 0, 'Arquivo PNG do QR Code deve existir no disco')

    const dataRes = await qrService.generateQrCode('PIX:TESTE_CHAVE_ALEATORIA', undefined, 'dataUrl')
    assert.equal(dataRes.success, true)
    assert.ok(dataRes.dataUrl?.startsWith('data:image/png;base64,'))
  })

  // Módulo 24: OCR Service
  await t.test('Módulo 24 - OCR Service: processamento de imagem e ciclo de ativação', async () => {
    assert.equal(ocrService.getIsEnabled(), true)

    // Tratamento seguro de arquivo inexistente
    const missingRes = await ocrService.recognize(path.join(tempTestDir, 'imagem_inexistente.png'))
    assert.equal(missingRes.success, false)
    assert.ok(missingRes.message.length > 0)

    // Processamento do QR code gerado no Módulo 23 como imagem válida
    const qrFilePath = path.join(tempTestDir, 'qrcode_jasper_real.png')
    const ocrRes = await ocrService.recognize(qrFilePath)
    assert.equal(typeof ocrRes.success, 'boolean')
    assert.ok(typeof ocrRes.text === 'string')
  })

  // Módulo 25: Presentation Mode
  await t.test('Módulo 25 - Presentation Mode: detecção de conferências e silenciamento inteligente', async () => {
    let notifiedActive = false
    presentationMode.setOnStateChange((st) => {
      notifiedActive = st.isActive
    })

    // Ativação do modo apresentação
    const activeStatus = presentationMode.setPresentationMode(true)
    assert.equal(activeStatus.isActive, true)
    assert.equal(activeStatus.isSilentAudio, true)
    assert.equal(notifiedActive, true)

    // Verificação de status
    assert.equal(presentationMode.getStatus().isActive, true)

    // Verificação de processos ativos em busca de softwares de reunião (Zoom, Teams, etc.)
    const checkRes = await presentationMode.checkRunningProcesses()
    assert.equal(typeof checkRes.detected, 'boolean')
    assert.ok(Array.isArray(checkRes.matchedApps))

    // Desativação
    const offStatus = presentationMode.setPresentationMode(false)
    assert.equal(offStatus.isActive, false)
    assert.equal(offStatus.isSilentAudio, false)
    assert.equal(notifiedActive, false)
  })

  // Módulo 26: Focus Mode
  await t.test('Módulo 26 - Focus Mode: temporizador Pomodoro e rastreamento de distrações', async () => {
    let alertCount = 0
    focusMode.setOnNotification(() => {
      alertCount++
    })

    // Iniciar sessão de foco de 20 minutos
    const startRes = focusMode.startFocus(20)
    assert.equal(startRes.isActive, true)
    assert.equal(startRes.totalDurationMinutes, 20)
    assert.ok(startRes.remainingMinutes <= 20)

    // Checagem de processos distratores (Steam, Discord, jogos, etc.)
    const distractCheck = await focusMode.checkDistractions()
    assert.equal(typeof distractCheck.distracted, 'boolean')
    assert.ok(Array.isArray(distractCheck.distractions))

    // Interromper sessão de foco
    const stopRes = focusMode.stopFocus()
    assert.equal(stopRes.isActive, false)
    assert.equal(stopRes.remainingMinutes, 0)
  })
})

