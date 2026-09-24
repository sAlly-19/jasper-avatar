import test from 'node:test'
import assert from 'node:assert/strict'
import { ocrService } from '../src/main/autonomous/ocr-service'
import { headlessBrowser } from '../src/main/autonomous/headless-browser'
import { presentationMode } from '../src/main/autonomous/presentation-mode'
import { focusMode } from '../src/main/autonomous/focus-mode'
import { executeSystemTool } from '../src/main/tools/system-tools'
import { SYSTEM_FUNCTION_DECLARATIONS } from '../src/main/tools/declarations'

test('Parte 3: Inteligência de Ambiente, OCR, Headless Web & Modos Foco/Apresentação', async (t) => {
  await t.test('SYSTEM_FUNCTION_DECLARATIONS inclui ferramentas da Parte 3', () => {
    const names = SYSTEM_FUNCTION_DECLARATIONS.map((d: any) => d.name)
    assert.ok(names.includes('ocr_screen'), 'ocr_screen deve estar declarado')
    assert.ok(names.includes('web_automate'), 'web_automate deve estar declarado')
    assert.ok(names.includes('set_presentation_mode'), 'set_presentation_mode deve estar declarado')
    assert.ok(names.includes('set_focus_mode'), 'set_focus_mode deve estar declarado')
  })

  await t.test('OcrService: ativação e configuração de estado', () => {
    assert.equal(ocrService.getIsEnabled(), true)
    ocrService.setEnabled(false)
    assert.equal(ocrService.getIsEnabled(), false)
    ocrService.setEnabled(true)
    assert.equal(ocrService.getIsEnabled(), true)
  })

  await t.test('OcrService: tratamento seguro de imagem inexistente ou vazia', async () => {
    const res = await ocrService.recognize('caminho_inexistente_12345.png')
    assert.equal(res.success, false)
    assert.ok(res.message.length > 0)
  })

  await t.test('HeadlessBrowser: execução de ações web (click, fill, extract_table, screenshot)', async () => {
    // 1. Click action
    const clickRes = await headlessBrowser.executeAction('https://example.com', 'click', '#btn-submit')
    assert.equal(clickRes.success, true)
    assert.ok(clickRes.message.includes('clicado com sucesso'))

    // 2. Fill action
    const fillRes = await headlessBrowser.executeAction('https://example.com', 'fill', 'input[name="user"]', 'jasper_tester')
    assert.equal(fillRes.success, true)
    assert.ok(fillRes.message.includes('preenchido'))

    // 3. Extract table action
    const tableRes = await headlessBrowser.executeAction('https://example.com', 'extract_table', 'table.precos')
    assert.equal(tableRes.success, true)
    assert.ok(tableRes.result)
    assert.ok(Array.isArray(tableRes.result.headers))
    assert.ok(Array.isArray(tableRes.result.rows))

    // 4. Screenshot action
    const shotRes = await headlessBrowser.executeAction('https://example.com', 'screenshot')
    assert.equal(shotRes.success, true)
    assert.ok(shotRes.result.startsWith('data:image/'))
  })

  await t.test('HeadlessBrowser: bloqueio Zero-Trust para URLs proibidas (SSRF)', async () => {
    const res = await headlessBrowser.executeAction('http://169.254.169.254/latest/meta-data', 'click', '#test')
    assert.equal(res.success, false)
    assert.ok(res.message.includes('ZERO-TRUST') || res.message.includes('BLOQUEIO'))
  })

  await t.test('HeadlessBrowser: bloqueia preenchimento de credenciais e nao ecoa o segredo', async () => {
    const secret = 'senha-super-secreta-123'
    const res = await headlessBrowser.executeAction('https://example.com', 'fill', 'input[type="password"]', secret)
    assert.equal(res.success, false)
    assert.match(res.message, /senha|credenciais/i)
    assert.equal(res.message.includes(secret), false)
  })

  await t.test('PresentationModeService: ativação e desativação manual', () => {
    let notifiedState = false
    presentationMode.setOnStateChange((st) => {
      notifiedState = st.isActive
    })

    // Ativação
    const activeStatus = presentationMode.setPresentationMode(true)
    assert.equal(activeStatus.isActive, true)
    assert.equal(activeStatus.isSilentAudio, true)
    assert.equal(activeStatus.source, 'manual')
    assert.equal(notifiedState, true)

    // Consulta status
    const current = presentationMode.getStatus()
    assert.equal(current.isActive, true)

    // Desativação
    const inactiveStatus = presentationMode.setPresentationMode(false)
    assert.equal(inactiveStatus.isActive, false)
    assert.equal(inactiveStatus.isSilentAudio, false)
    assert.equal(inactiveStatus.source, 'none')
    assert.equal(notifiedState, false)
  })

  await t.test('FocusModeService: ciclo completo de sessão de foco (Pomodoro)', () => {
    let receivedNotification = false
    focusMode.setOnNotification((notif) => {
      if (notif.title.includes('Foco')) {
        receivedNotification = true
      }
    })

    // Iniciar sessão de 30 minutos
    const startStatus = focusMode.startFocus(30)
    assert.equal(startStatus.isActive, true)
    assert.equal(startStatus.totalDurationMinutes, 30)
    assert.ok(startStatus.remainingMinutes <= 30)

    // Consultar status durante a sessão
    const runningStatus = focusMode.getStatus()
    assert.equal(runningStatus.isActive, true)
    assert.equal(runningStatus.totalDurationMinutes, 30)

    // Encerrar sessão
    const stoppedStatus = focusMode.stopFocus()
    assert.equal(stoppedStatus.isActive, false)
    assert.equal(stoppedStatus.remainingMinutes, 0)
  })

  await t.test('executeSystemTool: despacho das ferramentas da Parte 3', async () => {
    // 1. web_automate
    const webRes = await executeSystemTool('web_automate', {
      url: 'https://example.com',
      action: 'extract_table',
      selector: 'table'
    })
    assert.ok(webRes.includes('Tabela extraída com sucesso') || webRes.includes('Colunas:'))

    // 2. set_presentation_mode (ativar)
    const presOnRes = await executeSystemTool('set_presentation_mode', { active: true })
    assert.ok(presOnRes.includes('Modo Apresentação ATIVADO'))

    // 3. set_presentation_mode (desativar)
    const presOffRes = await executeSystemTool('set_presentation_mode', { active: false })
    assert.ok(presOffRes.includes('Modo Apresentação DESATIVADO'))

    // 4. set_focus_mode (iniciar)
    const focusStartRes = await executeSystemTool('set_focus_mode', { action: 'start', durationMinutes: 45 })
    assert.ok(focusStartRes.includes('Modo Foco INICIADO') && focusStartRes.includes('45'))

    // 5. set_focus_mode (status)
    const focusStatRes = await executeSystemTool('set_focus_mode', { action: 'status' })
    assert.ok(focusStatRes.includes('Modo Foco em andamento'))

    // 6. set_focus_mode (parar)
    const focusStopRes = await executeSystemTool('set_focus_mode', { action: 'stop' })
    assert.ok(focusStopRes.includes('Modo Foco ENCERRADO'))

    // 7. ocr_screen (com caminho de arquivo inválido como teste de tolerância)
    const ocrRes = await executeSystemTool('ocr_screen', { imagePath: 'inexistente.png' })
    assert.ok(ocrRes.length > 0)
  })

  await t.test('Lista de Módulos: persistência e controle no ConfigStore', async () => {
    const { configStore } = await import('../src/main/config/config-store')
    const cfg = configStore.getConfig()

    // Verifica que todas as novas opções de módulos existem com valor booleano
    assert.equal(typeof cfg.enableProcessManager, 'boolean')
    assert.equal(typeof cfg.enableUiAutomation, 'boolean')
    assert.equal(typeof cfg.enableMediaController, 'boolean')
    assert.equal(typeof cfg.enableReportGenerator, 'boolean')
    assert.equal(typeof cfg.enableFileSummarizer, 'boolean')
    assert.equal(typeof cfg.enableQrService, 'boolean')
    assert.equal(typeof cfg.enableOcrService, 'boolean')
    assert.equal(typeof cfg.enablePresentationMode, 'boolean')
    assert.equal(typeof cfg.enableFocusMode, 'boolean')

    // Atualização dinâmica
    configStore.updateConfig({
      enableProcessManager: false,
      enableQrService: false
    })

    const updated = configStore.getConfig()
    assert.equal(updated.enableProcessManager, false)
    assert.equal(updated.enableQrService, false)

    // Ferramenta rejeita com mensagem amigável quando o módulo está desativado
    const blockedProcess = await executeSystemTool('open_app', { appName: 'calc' })
    assert.ok(blockedProcess.includes('módulo de Gerenciamento de Processos está desativado'))

    const blockedQr = await executeSystemTool('generate_qr_code', { data: 'teste' })
    assert.ok(blockedQr.includes('módulo de Geração de QR Code está desativado'))

    // Reativa os módulos
    configStore.updateConfig({
      enableProcessManager: true,
      enableQrService: true
    })
    const restored = configStore.getConfig()
    assert.equal(restored.enableProcessManager, true)
    assert.equal(restored.enableQrService, true)
  })

  await t.test('Lista de Módulos: getActiveSystemDeclarations filtra dinamicamente', async () => {
    const { getActiveSystemDeclarations } = await import('../src/main/tools/declarations')
    
    // Todos ativados
    const allActive = getActiveSystemDeclarations({
      enableProcessManager: true,
      enableUiAutomation: true,
      enableMediaController: true,
      enableReportGenerator: true,
      enableFileSummarizer: true,
      enableQrService: true,
      enableOcrService: true,
      enablePresentationMode: true,
      enableFocusMode: true
    })
    const allNames = allActive.map((d: any) => d.name)
    assert.ok(allNames.includes('open_app'))
    assert.ok(allNames.includes('automate_ui'))
    assert.ok(allNames.includes('generate_report_pdf'))
    assert.ok(allNames.includes('generate_qr_code'))
    assert.ok(allNames.includes('ocr_screen'))

    // Módulos desativados são removidos da lista de ferramentas do Gemini Live
    const filtered = getActiveSystemDeclarations({
      enableProcessManager: false,
      enableReportGenerator: false,
      enableOcrService: false
    })
    const filteredNames = filtered.map((d: any) => d.name)
    assert.equal(filteredNames.includes('open_app'), false)
    assert.equal(filteredNames.includes('generate_report_pdf'), false)
    assert.equal(filteredNames.includes('ocr_screen'), false)
    assert.ok(filteredNames.includes('automate_ui'), 'automate_ui ainda deve estar ativa')
  })

  await t.test('MODULE_INFO_DATA: contém documentação completa dos 9 novos módulos', async () => {
    const { MODULE_INFO_DATA } = await import('../src/renderer/ui/module-info-modal')
    const expectedModules = [
      'process-manager',
      'ui-automation',
      'media-controller',
      'report-generator',
      'file-summarizer',
      'qr-service',
      'ocr-service',
      'presentation-mode',
      'focus-mode'
    ]

    for (const mod of expectedModules) {
      const data = MODULE_INFO_DATA[mod]
      assert.ok(data, `Módulo "${mod}" deve estar registrado em MODULE_INFO_DATA`)
      assert.ok(data.title.length > 0, `Módulo "${mod}" deve ter título`)
      assert.ok(data.overview.length > 0, `Módulo "${mod}" deve ter visão geral`)
      assert.ok(data.howItWorks.length > 0, `Módulo "${mod}" deve ter howItWorks`)
      assert.ok(Array.isArray(data.examples) && data.examples.length > 0, `Módulo "${mod}" deve ter exemplos`)
      assert.ok(data.requirements.length > 0, `Módulo "${mod}" deve ter requisitos`)
    }
  })
})


