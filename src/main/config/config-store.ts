import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import type { JasperConfig, UpdateConfigPayload, ConfigSummary } from '@shared'

// Load environment variables from .env
dotenv.config()

class ConfigStore {
  private config: JasperConfig = {
    apiKey: process.env.GOOGLE_API_KEY || '',
    voiceName: process.env.GEMINI_VOICE || 'Charon',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-native-audio-latest',
    enableSystemTools: true,
    enableMediaTools: true,
    agentName: process.env.AGENT_NAME || 'Jasper',
    enableWakeWord: true,
    enableBloom: true,
    enableNeuralBg: true,
    enableEyeTracking: true,
    // Autonomy services
    enableScreenAwareness: true,
    enableWindowTracker: true,
    enableClipboardWatcher: true,
    enableCronEngine: true,
    enableDailyBriefing: true,
    enableSystemHealth: true,
    enableSemanticMemory: true,
    enableKnowledgeGraph: true,
    enableCodeInterpreter: true,
    enableHeadlessBrowser: true,
    enableGitWatcher: true,
    enableFolderOrganizer: true,
    enableSubagents: true,
    enableReflexionLoop: true,
    enableCalendarEmail: true,
    enableWebhooks: true,
    enableSmartHome: true
  }

  constructor() {
    this.loadPersistedConfig()
  }

  private getConfigFilePath(): string {
    return join(app.getPath('userData'), 'jasper-config.json')
  }

  public loadPersistedConfig(): JasperConfig {
    // 1. .env defaults
    this.config.apiKey = process.env.GOOGLE_API_KEY || ''
    this.config.voiceName = process.env.GEMINI_VOICE || 'Charon'
    this.config.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-native-audio-latest'
    this.config.agentName = process.env.AGENT_NAME || 'Jasper'

    // 2. Overlay persisted settings from userData
    try {
      const cfgPath = this.getConfigFilePath()
      if (fs.existsSync(cfgPath)) {
        const data = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'))
        if (data.apiKey) this.config.apiKey = data.apiKey
        if (data.voiceName) this.config.voiceName = data.voiceName
        if (data.model) this.config.model = data.model
        if (data.enableSystemTools !== undefined) this.config.enableSystemTools = data.enableSystemTools
        if (data.enableMediaTools !== undefined) this.config.enableMediaTools = data.enableMediaTools
        if (data.agentName) this.config.agentName = data.agentName
        if (data.enableWakeWord !== undefined) this.config.enableWakeWord = data.enableWakeWord
        if (data.enableBloom !== undefined) this.config.enableBloom = data.enableBloom
        if (data.enableNeuralBg !== undefined) this.config.enableNeuralBg = data.enableNeuralBg
        if (data.enableEyeTracking !== undefined) this.config.enableEyeTracking = data.enableEyeTracking
        if (data.enableScreenAwareness !== undefined) this.config.enableScreenAwareness = data.enableScreenAwareness
        if (data.enableWindowTracker !== undefined) this.config.enableWindowTracker = data.enableWindowTracker
        if (data.enableClipboardWatcher !== undefined) this.config.enableClipboardWatcher = data.enableClipboardWatcher
        if (data.enableCronEngine !== undefined) this.config.enableCronEngine = data.enableCronEngine
        if (data.enableDailyBriefing !== undefined) this.config.enableDailyBriefing = data.enableDailyBriefing
        if (data.enableSystemHealth !== undefined) this.config.enableSystemHealth = data.enableSystemHealth
        if (data.enableSemanticMemory !== undefined) this.config.enableSemanticMemory = data.enableSemanticMemory
        if (data.enableKnowledgeGraph !== undefined) this.config.enableKnowledgeGraph = data.enableKnowledgeGraph
        if (data.enableCodeInterpreter !== undefined) this.config.enableCodeInterpreter = data.enableCodeInterpreter
        if (data.enableHeadlessBrowser !== undefined) this.config.enableHeadlessBrowser = data.enableHeadlessBrowser
        if (data.enableGitWatcher !== undefined) this.config.enableGitWatcher = data.enableGitWatcher
        if (data.enableFolderOrganizer !== undefined) this.config.enableFolderOrganizer = data.enableFolderOrganizer
        if (data.enableSubagents !== undefined) this.config.enableSubagents = data.enableSubagents
        if (data.enableReflexionLoop !== undefined) this.config.enableReflexionLoop = data.enableReflexionLoop
        if (data.enableCalendarEmail !== undefined) this.config.enableCalendarEmail = data.enableCalendarEmail
        if (data.enableWebhooks !== undefined) this.config.enableWebhooks = data.enableWebhooks
        if (data.enableSmartHome !== undefined) this.config.enableSmartHome = data.enableSmartHome
        console.log('[ConfigStore] Loaded settings from userData/jasper-config.json')
      }
    } catch (err) {
      console.warn('[ConfigStore] Error reading config from userData:', err)
    }

    return this.config
  }

  public savePersistedConfig(): void {
    try {
      const cfgPath = this.getConfigFilePath()
      const content = JSON.stringify(this.config, null, 2)
      fs.writeFileSync(cfgPath, content, 'utf-8')
      console.log('[ConfigStore] Saved configuration successfully to', cfgPath)
    } catch (err) {
      console.warn('[ConfigStore] Error saving config to userData:', err)
    }
  }

  public getConfig(): JasperConfig {
    return { ...this.config }
  }

  public updateConfig(payload: UpdateConfigPayload): JasperConfig {
    if (payload.apiKey !== undefined) this.config.apiKey = payload.apiKey.trim()
    if (payload.voiceName !== undefined) this.config.voiceName = payload.voiceName.trim()
    if (payload.model !== undefined) this.config.model = payload.model.trim()
    if (payload.enableSystemTools !== undefined) this.config.enableSystemTools = payload.enableSystemTools
    if (payload.enableMediaTools !== undefined) this.config.enableMediaTools = payload.enableMediaTools
    if (payload.agentName !== undefined) this.config.agentName = payload.agentName.trim()
    if (payload.enableWakeWord !== undefined) this.config.enableWakeWord = payload.enableWakeWord
    if (payload.enableBloom !== undefined) this.config.enableBloom = payload.enableBloom
    if (payload.enableNeuralBg !== undefined) this.config.enableNeuralBg = payload.enableNeuralBg
    if (payload.enableEyeTracking !== undefined) this.config.enableEyeTracking = payload.enableEyeTracking
    if (payload.enableScreenAwareness !== undefined) this.config.enableScreenAwareness = payload.enableScreenAwareness
    if (payload.enableWindowTracker !== undefined) this.config.enableWindowTracker = payload.enableWindowTracker
    if (payload.enableClipboardWatcher !== undefined) this.config.enableClipboardWatcher = payload.enableClipboardWatcher
    if (payload.enableCronEngine !== undefined) this.config.enableCronEngine = payload.enableCronEngine
    if (payload.enableDailyBriefing !== undefined) this.config.enableDailyBriefing = payload.enableDailyBriefing
    if (payload.enableSystemHealth !== undefined) this.config.enableSystemHealth = payload.enableSystemHealth
    if (payload.enableSemanticMemory !== undefined) this.config.enableSemanticMemory = payload.enableSemanticMemory
    if (payload.enableKnowledgeGraph !== undefined) this.config.enableKnowledgeGraph = payload.enableKnowledgeGraph
    if (payload.enableCodeInterpreter !== undefined) this.config.enableCodeInterpreter = payload.enableCodeInterpreter
    if (payload.enableHeadlessBrowser !== undefined) this.config.enableHeadlessBrowser = payload.enableHeadlessBrowser
    if (payload.enableGitWatcher !== undefined) this.config.enableGitWatcher = payload.enableGitWatcher
    if (payload.enableFolderOrganizer !== undefined) this.config.enableFolderOrganizer = payload.enableFolderOrganizer
    if (payload.enableSubagents !== undefined) this.config.enableSubagents = payload.enableSubagents
    if (payload.enableReflexionLoop !== undefined) this.config.enableReflexionLoop = payload.enableReflexionLoop
    if (payload.enableCalendarEmail !== undefined) this.config.enableCalendarEmail = payload.enableCalendarEmail
    if (payload.enableWebhooks !== undefined) this.config.enableWebhooks = payload.enableWebhooks
    if (payload.enableSmartHome !== undefined) this.config.enableSmartHome = payload.enableSmartHome

    this.savePersistedConfig()
    return this.getConfig()
  }

  public getConfigSummary(isConnected: boolean): ConfigSummary {
    return {
      apiKey: this.config.apiKey
        ? `${this.config.apiKey.slice(0, 6)}...${this.config.apiKey.slice(-4)}`
        : '',
      hasFullKey: Boolean(this.config.apiKey && this.config.apiKey.length > 10),
      voiceName: this.config.voiceName,
      model: this.config.model,
      enableSystemTools: this.config.enableSystemTools,
      enableMediaTools: this.config.enableMediaTools,
      agentName: this.config.agentName,
      enableWakeWord: this.config.enableWakeWord,
      enableBloom: this.config.enableBloom,
      enableNeuralBg: this.config.enableNeuralBg,
      enableEyeTracking: this.config.enableEyeTracking,
      enableScreenAwareness: this.config.enableScreenAwareness,
      enableWindowTracker: this.config.enableWindowTracker,
      enableClipboardWatcher: this.config.enableClipboardWatcher,
      enableCronEngine: this.config.enableCronEngine,
      enableDailyBriefing: this.config.enableDailyBriefing,
      enableSystemHealth: this.config.enableSystemHealth,
      enableSemanticMemory: this.config.enableSemanticMemory,
      enableKnowledgeGraph: this.config.enableKnowledgeGraph,
      enableCodeInterpreter: this.config.enableCodeInterpreter,
      enableHeadlessBrowser: this.config.enableHeadlessBrowser,
      enableGitWatcher: this.config.enableGitWatcher,
      enableFolderOrganizer: this.config.enableFolderOrganizer,
      enableSubagents: this.config.enableSubagents,
      enableReflexionLoop: this.config.enableReflexionLoop,
      enableCalendarEmail: this.config.enableCalendarEmail,
      enableWebhooks: this.config.enableWebhooks,
      enableSmartHome: this.config.enableSmartHome,
      isConnected
    }
  }
}

export const configStore = new ConfigStore()
