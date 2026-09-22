import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS, type UpdateConfigPayload } from '@shared'
import { GeminiLiveClient } from '../gemini-live'
import { configStore } from '../config/config-store'
import { loadMemory, saveMemory } from '../memory'
import {
  getMainWindow,
  togglePipMode,
  toggleFullScreenMode,
  minimizeWindow,
  maximizeWindow,
  closeWindow,
  safeSend
} from '../windows/main-window'
import { licenseManager } from '../services/license-manager'
import { getHardwareInfo } from '../services/hwid'
import {
  autonomyCoordinator,
  systemHealth,
  cronEngine,
  screenAwareness,
  windowTracker,
  knowledgeGraph,
  briefingService,
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

export function registerIpcHandlers(getGeminiClient: () => GeminiLiveClient | null): void {
  // 1. Audio streaming from user mic to Gemini
  ipcMain.on(IPC_CHANNELS.AUDIO_CHUNK, (_event, chunk: ArrayBuffer) => {
    getGeminiClient()?.sendAudioChunk(chunk)
  })

  // 2. Audio stream end (turn finalization)
  ipcMain.on(IPC_CHANNELS.AUDIO_STREAM_END, () => {
    getGeminiClient()?.sendAudioStreamEnd()
  })

  // 3. Text prompt sending to Gemini
  ipcMain.on(IPC_CHANNELS.CHAT_SEND, (_event, text: string) => {
    getGeminiClient()?.sendTextPrompt(text)
  })

  // 4. Gemini connection controls
  ipcMain.handle(
    IPC_CHANNELS.GEMINI_CONNECT,
    async (_event, payload?: UpdateConfigPayload) => {
      if (payload) {
        configStore.updateConfig(payload)
      }
      const cfg = configStore.getConfig()
      if (cfg.licenseStatus !== 'active') {
        return {
          success: false,
          error: 'Esta estação Jasper requer uma chave de licença vitalícia ativa.'
        }
      }

      const client = getGeminiClient()

      try {
        await client?.connect(
          cfg.apiKey,
          cfg.voiceName,
          cfg.model,
          cfg.enableSystemTools,
          cfg.enableMediaTools,
          cfg.agentName
        )
        return { success: true }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.GEMINI_DISCONNECT, async () => {
    getGeminiClient()?.disconnect()
    return true
  })

  // 5. Configuration handlers
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, () => {
    const status = getGeminiClient()?.getStatus()
    return configStore.getConfigSummary(Boolean(status?.isConnected))
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_SAVE, (_event, payload: UpdateConfigPayload) => {
    const updated = configStore.updateConfig(payload)

    if (payload.agentName) {
      safeSend(IPC_CHANNELS.CONFIG_AGENT_NAME_UPDATED, updated.agentName)
    }

    if (payload.apiKey !== undefined && payload.apiKey.trim() === '') {
      getGeminiClient()?.disconnect()
    }

    getGeminiClient()?.updateConfig(
      updated.apiKey,
      updated.voiceName,
      updated.model,
      updated.enableSystemTools,
      updated.enableMediaTools,
      updated.agentName
    )

    autonomyCoordinator.updateServicesConfig()

    return { success: true }
  })

  // 6. Memory handlers
  ipcMain.handle(IPC_CHANNELS.MEMORY_GET, () => {
    return loadMemory()
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_CLEAR, () => {
    saveMemory({ userName: '', userPreferences: [], facts: [] })
    return true
  })

  // 7. Window controls & PIP
  ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_PIP, () => {
    return togglePipMode()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_FULLSCREEN, () => {
    return toggleFullScreenMode()
  })

  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    minimizeWindow()
  })

  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    maximizeWindow()
  })

  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, () => {
    closeWindow()
  })

  // 8. Autonomy & Proactive Services
  ipcMain.handle(IPC_CHANNELS.AUTONOMY_GET_SYSTEM_HEALTH, async () => {
    return systemHealth.getHealth()
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_GET_SCHEDULES, () => {
    return cronEngine.getTasks()
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_ADD_SCHEDULE, (_event, title: string, minutesFromNow: number, recurrence?: 'once' | 'daily' | 'hourly') => {
    return cronEngine.addTask(title, minutesFromNow, recurrence)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_REMOVE_SCHEDULE, (_event, id: string) => {
    return cronEngine.removeTask(id)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_CAPTURE_SCREEN, async () => {
    return screenAwareness.captureScreen()
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_GET_ACTIVE_WINDOW, async () => {
    return windowTracker.getActiveWindow()
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_GET_KNOWLEDGE_GRAPH, () => {
    return knowledgeGraph.getGraphData()
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_GET_BRIEFING, async () => {
    return briefingService.generateBriefing()
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_EXECUTE_CODE, async (_event, language: 'python' | 'javascript', code: string, timeoutMs?: number) => {
    return codeInterpreter.execute(language, code, timeoutMs)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_BROWSE_PAGE, async (_event, url: string, options?: any) => {
    return headlessBrowser.browse(url, options)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_GIT_CHECK, async (_event, repoPath?: string) => {
    return gitWatcher.checkRepo(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_GIT_SUGGEST_COMMIT, async (_event, repoPath?: string) => {
    return gitWatcher.suggestCommit(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_SCAN_FOLDER, async (_event, target?: string) => {
    return folderOrganizer.scanDuplicatesAndOldFiles(target)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_ORGANIZE_FOLDER, async (_event, target?: string, dryRun?: boolean) => {
    return folderOrganizer.organizeDirectory(target, dryRun)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_SPAWN_SUBAGENT, async (_event, role: any, task: string) => {
    return subagentOrchestrator.spawnSubagent(role, task)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_GET_SUBAGENTS, () => {
    return subagentOrchestrator.getTasks()
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_CALENDAR_ADD_EVENT, (_event, title: string, startDateTime: any, durationMinutes?: number, description?: string, location?: string) => {
    return calendarEmail.addEvent(title, startDateTime, durationMinutes, description, location)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_CALENDAR_GET_EVENTS, (_event, withinHours?: number) => {
    return calendarEmail.getEvents(withinHours)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_EMAIL_CHECK, async (_event, options?: any) => {
    return calendarEmail.checkEmails(options)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_WEBHOOK_TRIGGER, async (_event, nameOrUrl: string, payload?: any, method?: any) => {
    return webhookManager.triggerWebhook(nameOrUrl, payload, method)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_WEBHOOK_LIST, () => {
    return webhookManager.listWebhooks()
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_SMART_HOME_GET_DEVICES, async (_event, domain?: string) => {
    return smartHome.getEntities(domain)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_SMART_HOME_EXECUTE, async (_event, domain: string, service: string, entityId: string, serviceData?: any) => {
    return smartHome.executeCommand(domain, service, entityId, serviceData)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_REFLEXION_CONFIRMATION, (_event, confirmationId: string) => {
    return reflexionEngine.confirmAction(confirmationId)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_SMART_HOME_TEST_CONNECTION, async (_event, url?: string, token?: string) => {
    return smartHome.testConnection(url, token)
  })

  ipcMain.handle(IPC_CHANNELS.AUTONOMY_WEBHOOK_TEST, async (_event, url: string) => {
    return webhookManager.triggerWebhook(url, { test: true, ping: 'Jasper HUD AI' }, 'POST')
  })

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY, async () => {
    const win = getMainWindow()
    const result = await dialog.showOpenDialog(win || (undefined as any), {
      properties: ['openDirectory'],
      title: 'Selecionar Diretório do Repositório Git'
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  // License & Node-Locking Handlers
  ipcMain.handle(IPC_CHANNELS.LICENSE_GET_STATUS, () => {
    return licenseManager.getLicenseInfo()
  })

  ipcMain.handle(IPC_CHANNELS.LICENSE_ACTIVATE, async (_event, key: string) => {
    return licenseManager.activateLicense(key)
  })

  ipcMain.handle(IPC_CHANNELS.LICENSE_GET_HWID, () => {
    return getHardwareInfo()
  })
}
