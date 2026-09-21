import { DOM } from './dom'
import { AvatarController, MoodType } from '../scene/avatar'
import { WakeTrainerUI } from './wake-trainer-ui'
import { SVG_ICONS } from './icons'
import { showHudToast } from './toast'
import { updateStatusBadge } from './status-badge'

export interface SettingsModalOptions {
  getAgentName: () => string
  setAgentName: (name: string) => void
  getAvatar: () => AvatarController | null
  setBloomEnabled: (enabled: boolean) => void
  setNeuralBgEnabled: (enabled: boolean) => void
  setEyeTrackingEnabled: (enabled: boolean) => void
  setIsWakeWordEnabled: (enabled: boolean) => void
  reinitWakeWord: () => Promise<void>
  wakeTrainerUI: WakeTrainerUI
}

export class SettingsModal {
  private options: SettingsModalOptions

  constructor(options: SettingsModalOptions) {
    this.options = options
    this.setupListeners()
  }

  public async refreshMemoryUI(): Promise<void> {
    const { memoryFactsList, memoryCountBadge } = DOM
    if (!memoryFactsList) return

    try {
      const mem = await window.electronAPI.getMemory()
      const facts = mem?.facts || []
      if (memoryCountBadge) {
        memoryCountBadge.textContent = `${facts.length} ${facts.length === 1 ? 'fato' : 'fatos'}`
      }
      if (facts.length === 0) {
        memoryFactsList.innerHTML = '<span class="memory-empty">Nenhum fato memorizado ainda. Converse com o agente para ele aprender sobre você.</span>'
        return
      }
      memoryFactsList.innerHTML = facts
        .map((f) => `<div class="memory-fact-item">${f.fact}</div>`)
        .join('')
    } catch {
      memoryFactsList.innerHTML = '<span class="memory-empty">Erro ao carregar memórias.</span>'
    }
  }

  public async refreshLicenseUI(): Promise<void> {
    const {
      tabLicenseHwid,
      tabLicenseBadgeStatus,
      tabLicenseClientName,
      tabLicenseActivatedAt,
      tabLicenseKey,
      tabLicenseFeedback
    } = DOM

    try {
      const info = await window.electronAPI.getLicenseStatus()
      if (tabLicenseHwid) {
        tabLicenseHwid.textContent = info.currentHwid || 'N/A'
      }
      if (tabLicenseClientName) {
        tabLicenseClientName.textContent = info.clientName || 'Não Registrado'
      }
      if (tabLicenseActivatedAt) {
        tabLicenseActivatedAt.textContent = info.activatedAt
          ? new Date(info.activatedAt).toLocaleString()
          : '-'
      }
      if (tabLicenseBadgeStatus) {
        tabLicenseBadgeStatus.className = `license-status-badge ${info.status || 'unlicensed'}`
        if (info.isLicensed) {
          tabLicenseBadgeStatus.textContent = 'VITALÍCIA ATIVA'
        } else if (info.status === 'disabled') {
          tabLicenseBadgeStatus.textContent = 'NODE BLOQUEADO'
        } else if (info.status === 'revoked') {
          tabLicenseBadgeStatus.textContent = 'REVOGADA'
        } else {
          tabLicenseBadgeStatus.textContent = 'NÃO ATIVADO'
        }
      }
      if (tabLicenseKey && info.keyMasked) {
        tabLicenseKey.placeholder = `Chave atual: ${info.keyMasked}`
      }
      if (tabLicenseFeedback) {
        tabLicenseFeedback.style.display = 'none'
      }
    } catch (err) {
      console.warn('[SettingsModal] Erro ao carregar status da licença:', err)
    }
  }

  private setupListeners(): void {
    const {
      btnSettings,
      settingsModal,
      btnCloseSettings,
      btnCancelSettings,
      btnSaveSettings,
      settingsStatus,
      inputAgentName,
      agentNamePreview,
      inputApiKey,
      btnToggleKey,
      selectVoice,
      selectModel,
      checkWakeWord,
      checkBloom,
      checkNeuralBg,
      checkEyeTracking,
      checkSystemTools,
      checkMediaTools,
      checkScreenAwareness,
      checkWindowTracker,
      checkClipboardWatcher,
      checkCronEngine,
      checkDailyBriefing,
      checkSystemHealth,
      checkSemanticMemory,
      checkKnowledgeGraph,
      checkCodeInterpreter,
      checkHeadlessBrowser,
      checkGitWatcher,
      checkFolderOrganizer,
      checkSubagents,
      checkReflexionLoop,
      checkCalendarEmail,
      checkWebhooks,
      checkSmartHome,
      btnClearMemory,
      inputGitRepoPath,
      btnBrowseGitRepo,
      selectFolderTarget,
      inputEmailHost,
      inputEmailPort,
      inputEmailUser,
      inputEmailPassword,
      btnToggleEmailPw,
      inputWebhookUrl,
      btnTestWebhook,
      webhookTestFeedback,
      inputHassUrl,
      inputHassToken,
      btnToggleHassToken,
      btnTestHass,
      hassTestFeedback
    } = DOM

    // Live update of agent name preview badge
    inputAgentName?.addEventListener('input', () => {
      const val = inputAgentName.value.trim() || this.options.getAgentName() || 'Jasper'
      if (agentNamePreview) {
        agentNamePreview.textContent = `ID: ${val.toUpperCase()}`
      }
    })

    // Settings Tabs switching
    document.querySelectorAll('.settings-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab')
        if (!tab) return

        document.querySelectorAll('.settings-tab-btn').forEach((b) => b.classList.remove('active'))
        document.querySelectorAll('.settings-tab-pane').forEach((p) => p.classList.remove('active'))

        btn.classList.add('active')
        const targetId = tab.startsWith('tab-') ? tab : `tab-${tab}`
        const targetPane = document.getElementById(targetId)
        if (targetPane) {
          targetPane.classList.add('active')
        }
      })
    })

    // Emotion Preset Buttons (instant avatar mood preview)
    document.querySelectorAll('.emotion-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.emotion-btn').forEach((b) => b.classList.remove('active'))
        btn.classList.add('active')
        const mood = (btn.getAttribute('data-mood') || 'neutral') as MoodType
        this.options.getAvatar()?.setMood(mood)
      })
    })

    btnSettings.addEventListener('click', async () => {
      const config = await window.electronAPI.getConfig()
      const currentName = this.options.getAgentName()

      if (inputAgentName) {
        inputAgentName.value = config.agentName || currentName || 'Jasper'
      }
      if (agentNamePreview) {
        agentNamePreview.textContent = `ID: ${(inputAgentName?.value || currentName).toUpperCase()}`
      }
      if (DOM.geminiKeyMaskedDisplay) {
        if (config.apiKey && config.hasFullKey) {
          DOM.geminiKeyMaskedDisplay.textContent = config.apiKey
          DOM.geminiKeyMaskedDisplay.style.color = '#00f0ff'
          inputApiKey.placeholder = `Chave ativa: ${config.apiKey} (digite para alterar)`
        } else {
          DOM.geminiKeyMaskedDisplay.textContent = 'NENHUMA CHAVE CONFIGURADA'
          DOM.geminiKeyMaskedDisplay.style.color = '#f87171'
          inputApiKey.placeholder = 'Digite sua chave do Gemini (AIzaSy...)'
        }
      }
      selectVoice.value = config.voiceName || 'Charon'
      selectModel.value = config.model || 'gemini-2.5-flash-native-audio-latest'

      if (checkWakeWord) {
        checkWakeWord.checked = config.enableWakeWord !== false
      }
      if (checkBloom) {
        checkBloom.checked = config.enableBloom !== false
      }
      if (checkNeuralBg) {
        checkNeuralBg.checked = config.enableNeuralBg !== false
      }
      if (checkEyeTracking) {
        checkEyeTracking.checked = config.enableEyeTracking !== false
      }
      if (checkSystemTools) {
        checkSystemTools.checked = config.enableSystemTools !== false
      }
      if (checkMediaTools) {
        checkMediaTools.checked = config.enableMediaTools !== false
      }
      if (checkScreenAwareness) {
        checkScreenAwareness.checked = config.enableScreenAwareness !== false
      }
      if (checkWindowTracker) {
        checkWindowTracker.checked = config.enableWindowTracker !== false
      }
      if (checkClipboardWatcher) {
        checkClipboardWatcher.checked = config.enableClipboardWatcher !== false
      }
      if (checkCronEngine) {
        checkCronEngine.checked = config.enableCronEngine !== false
      }
      if (checkDailyBriefing) {
        checkDailyBriefing.checked = config.enableDailyBriefing !== false
      }
      if (checkSystemHealth) {
        checkSystemHealth.checked = config.enableSystemHealth !== false
      }
      if (checkSemanticMemory) {
        checkSemanticMemory.checked = config.enableSemanticMemory !== false
      }
      if (checkKnowledgeGraph) {
        checkKnowledgeGraph.checked = config.enableKnowledgeGraph !== false
      }
      if (checkCodeInterpreter) {
        checkCodeInterpreter.checked = config.enableCodeInterpreter !== false
      }
      if (checkHeadlessBrowser) {
        checkHeadlessBrowser.checked = config.enableHeadlessBrowser !== false
      }
      if (checkGitWatcher) {
        checkGitWatcher.checked = config.enableGitWatcher !== false
      }
      if (checkFolderOrganizer) {
        checkFolderOrganizer.checked = config.enableFolderOrganizer !== false
      }
      if (checkSubagents) {
        checkSubagents.checked = config.enableSubagents !== false
      }
      if (checkReflexionLoop) {
        checkReflexionLoop.checked = config.enableReflexionLoop !== false
      }
      if (checkCalendarEmail) {
        checkCalendarEmail.checked = config.enableCalendarEmail !== false
      }
      if (checkWebhooks) {
        checkWebhooks.checked = config.enableWebhooks !== false
      }
      if (checkSmartHome) {
        checkSmartHome.checked = config.enableSmartHome !== false
      }

      // Populate module specific settings
      if (inputGitRepoPath) {
        inputGitRepoPath.value = config.gitRepoPath || ''
      }
      if (selectFolderTarget) {
        selectFolderTarget.value = config.folderDefaultTarget || 'downloads'
      }
      if (inputEmailHost) {
        inputEmailHost.value = config.emailImapHost || ''
      }
      if (inputEmailPort) {
        inputEmailPort.value = config.emailImapPort ? String(config.emailImapPort) : '993'
      }
      if (inputEmailUser) {
        inputEmailUser.value = config.emailUser || ''
      }
      if (inputEmailPassword) {
        inputEmailPassword.value = ''
        inputEmailPassword.placeholder = config.hasEmailPassword ? 'Senha salva (digite para alterar)' : 'Senha do app'
      }
      if (inputWebhookUrl) {
        inputWebhookUrl.value = config.webhookDefaultUrl || ''
      }
      if (inputHassUrl) {
        inputHassUrl.value = config.hassUrl || ''
      }
      if (inputHassToken) {
        inputHassToken.value = ''
        inputHassToken.placeholder = config.hasHassToken ? 'Token salvo (digite para alterar)' : 'Cole o token gerado no perfil'
      }
      if (hassTestFeedback) {
        hassTestFeedback.textContent = ''
        hassTestFeedback.className = 'config-test-feedback'
      }
      if (webhookTestFeedback) {
        webhookTestFeedback.textContent = ''
        webhookTestFeedback.className = 'config-test-feedback'
      }

      settingsStatus.textContent = config.isConnected ? 'Conectado ao Gemini Live.' : 'Desconectado.'
      settingsStatus.className = 'modal-status'

      // Refresh memory items
      await this.refreshMemoryUI()

      // Refresh license status
      await this.refreshLicenseUI()

      // Reset to first tab on open
      document.querySelectorAll('.settings-tab-btn').forEach((b, idx) => b.classList.toggle('active', idx === 0))
      document.querySelectorAll('.settings-tab-pane').forEach((p, idx) => p.classList.toggle('active', idx === 0))

      this.options.wakeTrainerUI.updateUI()
      settingsModal.classList.remove('hidden')
    })

    btnCloseSettings.addEventListener('click', () => {
      settingsModal.classList.add('hidden')
    })

    btnCancelSettings?.addEventListener('click', () => {
      settingsModal.classList.add('hidden')
    })

    // License Tab event listeners
    DOM.tabBtnCopyHwid?.addEventListener('click', () => {
      const hwid = DOM.tabLicenseHwid?.textContent
      if (hwid && hwid !== 'HWID-CALCULANDO...') {
        navigator.clipboard.writeText(hwid)
        showHudToast('Hardware ID', 'Hardware ID copiado com sucesso!', 'info', 3000)
      }
    })

    DOM.tabLicenseKey?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement
      target.value = target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')
    })

    DOM.tabBtnActivateKey?.addEventListener('click', async () => {
      const key = DOM.tabLicenseKey?.value.trim().toUpperCase()
      if (!key) {
        if (DOM.tabLicenseFeedback) {
          DOM.tabLicenseFeedback.textContent = 'Informe sua chave de licença vitalícia.'
          DOM.tabLicenseFeedback.className = 'license-feedback error'
          DOM.tabLicenseFeedback.style.display = 'block'
        }
        return
      }

      if (DOM.tabBtnActivateKey) {
        DOM.tabBtnActivateKey.disabled = true
        DOM.tabBtnActivateKey.textContent = 'VALIDANDO...'
      }

      try {
        const res = await window.electronAPI.activateLicense(key)
        if (DOM.tabLicenseFeedback) {
          DOM.tabLicenseFeedback.textContent = res.message || (res.valid ? 'Licença ativada com sucesso!' : 'Erro na ativação.')
          DOM.tabLicenseFeedback.className = `license-feedback ${res.valid ? 'success' : 'error'}`
          DOM.tabLicenseFeedback.style.display = 'block'
        }

        if (res.valid) {
          showHudToast('Licença Ativada', 'Estação Jasper Desbloqueada com Sucesso!', 'info', 5000)
          updateStatusBadge('online', 'Jasper Pronto')
          await this.refreshLicenseUI()
        }
      } catch (err: any) {
        if (DOM.tabLicenseFeedback) {
          DOM.tabLicenseFeedback.textContent = 'Erro ao conectar ao servidor de autenticação.'
          DOM.tabLicenseFeedback.className = 'license-feedback error'
          DOM.tabLicenseFeedback.style.display = 'block'
        }
      } finally {
        if (DOM.tabBtnActivateKey) {
          DOM.tabBtnActivateKey.disabled = false
          DOM.tabBtnActivateKey.textContent = 'Ativar Chave'
        }
      }
    })

    btnToggleKey.addEventListener('click', () => {
      if (inputApiKey.type === 'password') {
        inputApiKey.type = 'text'
        btnToggleKey.textContent = 'Ocultar'
      } else {
        inputApiKey.type = 'password'
        btnToggleKey.textContent = 'Mostrar'
      }
    })

    checkBloom?.addEventListener('change', () => {
      this.options.setBloomEnabled(checkBloom.checked)
    })

    checkNeuralBg?.addEventListener('change', () => {
      this.options.setNeuralBgEnabled(checkNeuralBg.checked)
    })

    btnClearMemory?.addEventListener('click', async () => {
      if (confirm('Tem certeza de que deseja apagar a memória acumulada do agente?')) {
        await window.electronAPI.clearMemory()
        await this.refreshMemoryUI()
      }
    })

    // Module-specific interactive handlers
    btnBrowseGitRepo?.addEventListener('click', async () => {
      try {
        const dir = await window.electronAPI.selectDirectory()
        if (dir && inputGitRepoPath) {
          inputGitRepoPath.value = dir
        }
      } catch (err) {
        console.warn('Error selecting directory:', err)
      }
    })

    btnToggleEmailPw?.addEventListener('click', () => {
      if (!inputEmailPassword) return
      if (inputEmailPassword.type === 'password') {
        inputEmailPassword.type = 'text'
        btnToggleEmailPw.textContent = 'Ocultar'
      } else {
        inputEmailPassword.type = 'password'
        btnToggleEmailPw.textContent = 'Mostrar'
      }
    })

    btnToggleHassToken?.addEventListener('click', () => {
      if (!inputHassToken) return
      if (inputHassToken.type === 'password') {
        inputHassToken.type = 'text'
        btnToggleHassToken.textContent = 'Ocultar'
      } else {
        inputHassToken.type = 'password'
        btnToggleHassToken.textContent = 'Mostrar'
      }
    })

    btnTestHass?.addEventListener('click', async () => {
      if (!hassTestFeedback) return
      const url = inputHassUrl?.value.trim()
      const token = inputHassToken?.value.trim() || undefined
      hassTestFeedback.textContent = 'Testando...'
      hassTestFeedback.className = 'config-test-feedback loading'

      try {
        const res = await window.electronAPI.testSmartHomeConnection(url, token)
        if (res.success) {
          hassTestFeedback.innerHTML = `${SVG_ICONS.check} ${res.message}`
          hassTestFeedback.className = 'config-test-feedback success'
        } else {
          hassTestFeedback.innerHTML = `${SVG_ICONS.error} ${res.message}`
          hassTestFeedback.className = 'config-test-feedback error'
        }
      } catch (err: any) {
        hassTestFeedback.innerHTML = `${SVG_ICONS.error} Erro: ${err.message || 'Falha'}`
        hassTestFeedback.className = 'config-test-feedback error'
      }
    })

    btnTestWebhook?.addEventListener('click', async () => {
      if (!webhookTestFeedback) return
      const url = inputWebhookUrl?.value.trim()
      if (!url) {
        webhookTestFeedback.innerHTML = `${SVG_ICONS.error} Informe uma URL primeiro`
        webhookTestFeedback.className = 'config-test-feedback error'
        return
      }

      webhookTestFeedback.textContent = 'Disparando teste...'
      webhookTestFeedback.className = 'config-test-feedback loading'

      try {
        const res = await window.electronAPI.testWebhook(url)
        if (res.success) {
          webhookTestFeedback.innerHTML = `${SVG_ICONS.check} Sucesso! (HTTP ${res.status} em ${res.executionTimeMs}ms)`
          webhookTestFeedback.className = 'config-test-feedback success'
        } else {
          webhookTestFeedback.innerHTML = `${SVG_ICONS.error} Falha: ${res.error || `HTTP ${res.status}`}`
          webhookTestFeedback.className = 'config-test-feedback error'
        }
      } catch (err: any) {
        webhookTestFeedback.innerHTML = `${SVG_ICONS.error} Erro: ${err.message || 'Falha'}`
        webhookTestFeedback.className = 'config-test-feedback error'
      }
    })

    btnSaveSettings.addEventListener('click', async () => {
      const newName = inputAgentName?.value.trim() || this.options.getAgentName() || 'Jasper'
      const apiKey = inputApiKey.value.trim()
      const voiceName = selectVoice.value
      const model = selectModel.value
      const enableWakeWord = checkWakeWord ? checkWakeWord.checked : true
      const enableBloom = checkBloom ? checkBloom.checked : true
      const enableNeuralBg = checkNeuralBg ? checkNeuralBg.checked : true
      const enableEyeTracking = checkEyeTracking ? checkEyeTracking.checked : true
      const enableSystemTools = checkSystemTools ? checkSystemTools.checked : true
      const enableMediaTools = checkMediaTools ? checkMediaTools.checked : true

      // Immediately apply new name, bloom and neural background
      this.options.setAgentName(newName)
      this.options.setIsWakeWordEnabled(enableWakeWord)
      this.options.setBloomEnabled(enableBloom)
      this.options.setNeuralBgEnabled(enableNeuralBg)
      this.options.setEyeTrackingEnabled(enableEyeTracking)

      settingsStatus.textContent = 'Salvando e conectando...'
      settingsStatus.className = 'modal-status'

      await window.electronAPI.saveConfig({
        agentName: newName,
        apiKey: apiKey || undefined,
        voiceName,
        model,
        enableWakeWord,
        enableBloom,
        enableNeuralBg,
        enableEyeTracking,
        enableSystemTools,
        enableMediaTools,
        enableScreenAwareness: checkScreenAwareness ? checkScreenAwareness.checked : true,
        enableWindowTracker: checkWindowTracker ? checkWindowTracker.checked : true,
        enableClipboardWatcher: checkClipboardWatcher ? checkClipboardWatcher.checked : true,
        enableCronEngine: checkCronEngine ? checkCronEngine.checked : true,
        enableDailyBriefing: checkDailyBriefing ? checkDailyBriefing.checked : true,
        enableSystemHealth: checkSystemHealth ? checkSystemHealth.checked : true,
        enableSemanticMemory: checkSemanticMemory ? checkSemanticMemory.checked : true,
        enableKnowledgeGraph: checkKnowledgeGraph ? checkKnowledgeGraph.checked : true,
        enableCodeInterpreter: checkCodeInterpreter ? checkCodeInterpreter.checked : true,
        enableHeadlessBrowser: checkHeadlessBrowser ? checkHeadlessBrowser.checked : true,
        enableGitWatcher: checkGitWatcher ? checkGitWatcher.checked : true,
        enableFolderOrganizer: checkFolderOrganizer ? checkFolderOrganizer.checked : true,
        enableSubagents: checkSubagents ? checkSubagents.checked : true,
        enableReflexionLoop: checkReflexionLoop ? checkReflexionLoop.checked : true,
        enableCalendarEmail: checkCalendarEmail ? checkCalendarEmail.checked : true,
        enableWebhooks: checkWebhooks ? checkWebhooks.checked : true,
        enableSmartHome: checkSmartHome ? checkSmartHome.checked : true,
        // Module specific configurations
        gitRepoPath: inputGitRepoPath?.value.trim() || undefined,
        folderDefaultTarget: selectFolderTarget?.value || 'downloads',
        emailImapHost: inputEmailHost?.value.trim() || undefined,
        emailImapPort: inputEmailPort?.value ? Number(inputEmailPort.value) : undefined,
        emailUser: inputEmailUser?.value.trim() || undefined,
        emailPassword: inputEmailPassword?.value.trim() || undefined,
        webhookDefaultUrl: inputWebhookUrl?.value.trim() || undefined,
        hassUrl: inputHassUrl?.value.trim() || undefined,
        hassToken: inputHassToken?.value.trim() || undefined
      })

      // Reinitialize TensorFlow.js Speech Commands engine with updated settings
      await this.options.reinitWakeWord()

      const result = await window.electronAPI.connectGemini({
        agentName: newName,
        apiKey: apiKey || undefined,
        voiceName,
        model,
        enableSystemTools,
        enableMediaTools
      })

      if (result.success) {
        settingsStatus.textContent = 'Conectado com sucesso!'
        settingsStatus.className = 'modal-status success'
        setTimeout(() => {
          settingsModal.classList.add('hidden')
        }, 800)
      } else {
        settingsStatus.textContent = 'Configurações salvas. (Offline: ' + (result.error || 'sem conexão') + ')'
        settingsStatus.className = 'modal-status'
        setTimeout(() => {
          settingsModal.classList.add('hidden')
        }, 1400)
      }
    })
  }
}

