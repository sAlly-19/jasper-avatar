import { DOM } from './dom'
import { AvatarController, MoodType } from '../scene/avatar'
import { WakeTrainerUI } from './wake-trainer-ui'

export interface SettingsModalOptions {
  getAgentName: () => string
  setAgentName: (name: string) => void
  getAvatar: () => AvatarController | null
  setBloomEnabled: (enabled: boolean) => void
  setNeuralBgEnabled: (enabled: boolean) => void
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
      btnClearMemory
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
      if (config.hasFullKey) {
        inputApiKey.placeholder = 'Chave salva (digite para alterar)'
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

      settingsStatus.textContent = config.isConnected ? 'Conectado ao Gemini Live.' : 'Desconectado.'
      settingsStatus.className = 'modal-status'

      // Refresh memory items
      await this.refreshMemoryUI()

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

    btnSaveSettings.addEventListener('click', async () => {
      const newName = inputAgentName?.value.trim() || this.options.getAgentName() || 'Jasper'
      const apiKey = inputApiKey.value.trim()
      const voiceName = selectVoice.value
      const model = selectModel.value
      const enableWakeWord = checkWakeWord ? checkWakeWord.checked : true
      const enableBloom = checkBloom ? checkBloom.checked : true
      const enableNeuralBg = checkNeuralBg ? checkNeuralBg.checked : true
      const enableSystemTools = checkSystemTools ? checkSystemTools.checked : true
      const enableMediaTools = checkMediaTools ? checkMediaTools.checked : true

      // Immediately apply new name, bloom and neural background
      this.options.setAgentName(newName)
      this.options.setIsWakeWordEnabled(enableWakeWord)
      this.options.setBloomEnabled(enableBloom)
      this.options.setNeuralBgEnabled(enableNeuralBg)

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
        enableSmartHome: checkSmartHome ? checkSmartHome.checked : true
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

