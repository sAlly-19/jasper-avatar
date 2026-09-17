import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_CHANNELS,
  type UpdateConfigPayload,
  type ConfigSummary,
  type JasperMemory,
  type SystemHealthData,
  type ScheduledTask,
  type KnowledgeGraphData,
  type AutonomyNotification,
  type CodeExecutionResult,
  type BrowserScrapeResult,
  type GitStatusResult,
  type FolderScanResult,
  type FolderOrganizeResult,
  type SubagentTask,
  type SubagentRole,
  type CalendarEvent,
  type EmailSummary,
  type WebhookConfig,
  type WebhookTriggerResult,
  type SmartHomeEntity,
  type SmartHomeActionResult
} from '@shared'

contextBridge.exposeInMainWorld('electronAPI', {
  // Audio & Text streaming
  sendAudioChunk: (chunk: ArrayBuffer): void => {
    ipcRenderer.send(IPC_CHANNELS.AUDIO_CHUNK, chunk)
  },
  sendAudioStreamEnd: (): void => {
    ipcRenderer.send(IPC_CHANNELS.AUDIO_STREAM_END)
  },
  sendTextMessage: (text: string): void => {
    ipcRenderer.send(IPC_CHANNELS.CHAT_SEND, text)
  },
  onAudioChunk: (callback: (base64Audio: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: string): void => callback(data)
    ipcRenderer.on(IPC_CHANNELS.GEMINI_AUDIO_CHUNK, handler)
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.GEMINI_AUDIO_CHUNK, handler)
    }
  },
  onInterrupted: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on(IPC_CHANNELS.GEMINI_INTERRUPTED, handler)
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.GEMINI_INTERRUPTED, handler)
    }
  },
  onTurnComplete: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on(IPC_CHANNELS.GEMINI_TURN_COMPLETE, handler)
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.GEMINI_TURN_COMPLETE, handler)
    }
  },
  onTextChunk: (callback: (text: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, text: string): void => callback(text)
    ipcRenderer.on(IPC_CHANNELS.GEMINI_TEXT_CHUNK, handler)
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.GEMINI_TEXT_CHUNK, handler)
    }
  },
  onStatusChange: (callback: (status: string, message?: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: string, message?: string): void => callback(status, message)
    ipcRenderer.on(IPC_CHANNELS.GEMINI_STATUS, handler)
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.GEMINI_STATUS, handler)
    }
  },

  // Gemini & Configuration
  connectGemini: (config?: UpdateConfigPayload): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GEMINI_CONNECT, config)
  },
  disconnectGemini: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GEMINI_DISCONNECT)
  },
  getConfig: (): Promise<ConfigSummary> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET)
  },
  saveConfig: (config: UpdateConfigPayload): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SAVE, config)
  },
  onAgentNameUpdated: (callback: (name: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, name: string): void => callback(name)
    ipcRenderer.on(IPC_CHANNELS.CONFIG_AGENT_NAME_UPDATED, handler)
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.CONFIG_AGENT_NAME_UPDATED, handler)
    }
  },

  // Memory APIs
  getMemory: (): Promise<JasperMemory> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEMORY_GET)
  },
  clearMemory: (): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEMORY_CLEAR)
  },

  // Window & PIP Controls
  windowMinimize: (): void => {
    ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE)
  },
  windowMaximize: (): void => {
    ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE)
  },
  windowClose: (): void => {
    ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE)
  },
  togglePip: (): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_TOGGLE_PIP)
  },
  onPipChange: (callback: (isPip: boolean) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, isPip: boolean): void => callback(isPip)
    ipcRenderer.on(IPC_CHANNELS.WINDOW_PIP_CHANGE, handler)
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_PIP_CHANGE, handler)
    }
  },
  toggleFullscreen: (): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_TOGGLE_FULLSCREEN)
  },
  onFullscreenChange: (callback: (isFullscreen: boolean) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, isFullscreen: boolean): void => callback(isFullscreen)
    ipcRenderer.on(IPC_CHANNELS.WINDOW_FULLSCREEN_CHANGE, handler)
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_FULLSCREEN_CHANGE, handler)
    }
  },

  // Autonomy & Proactive Services
  getSystemHealth: (): Promise<SystemHealthData> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_GET_SYSTEM_HEALTH)
  },
  getSchedules: (): Promise<ScheduledTask[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_GET_SCHEDULES)
  },
  addSchedule: (title: string, minutesFromNow: number, recurrence?: 'once' | 'daily' | 'hourly'): Promise<ScheduledTask> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_ADD_SCHEDULE, title, minutesFromNow, recurrence)
  },
  removeSchedule: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_REMOVE_SCHEDULE, id)
  },
  captureScreen: (): Promise<{ success: boolean; base64Image?: string; error?: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_CAPTURE_SCREEN)
  },
  getActiveWindow: (): Promise<{ processName: string; windowTitle: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_GET_ACTIVE_WINDOW)
  },
  getKnowledgeGraph: (): Promise<KnowledgeGraphData> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_GET_KNOWLEDGE_GRAPH)
  },
  getBriefing: (): Promise<any> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_GET_BRIEFING)
  },
  executeCode: (language: 'python' | 'javascript', code: string, timeoutMs?: number): Promise<CodeExecutionResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_EXECUTE_CODE, language, code, timeoutMs)
  },
  browsePage: (url: string, options?: any): Promise<BrowserScrapeResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_BROWSE_PAGE, url, options)
  },
  gitCheck: (repoPath?: string): Promise<GitStatusResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_GIT_CHECK, repoPath)
  },
  gitSuggestCommit: (repoPath?: string): Promise<{ suggestion: string; diffSummary: string; branch: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_GIT_SUGGEST_COMMIT, repoPath)
  },
  scanFolder: (target?: string): Promise<FolderScanResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_SCAN_FOLDER, target)
  },
  organizeFolder: (target?: string, dryRun?: boolean): Promise<FolderOrganizeResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_ORGANIZE_FOLDER, target, dryRun)
  },
  spawnSubagent: (role: SubagentRole, task: string): Promise<SubagentTask> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_SPAWN_SUBAGENT, role, task)
  },
  getSubagentTasks: (): Promise<SubagentTask[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_GET_SUBAGENTS)
  },
  addCalendarEvent: (title: string, startDateTime: any, durationMinutes?: number, description?: string, location?: string): Promise<CalendarEvent> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_CALENDAR_ADD_EVENT, title, startDateTime, durationMinutes, description, location)
  },
  getCalendarEvents: (withinHours?: number): Promise<CalendarEvent[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_CALENDAR_GET_EVENTS, withinHours)
  },
  checkEmails: (options?: any): Promise<EmailSummary[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_EMAIL_CHECK, options)
  },
  triggerWebhook: (nameOrUrl: string, payload?: any, method?: any): Promise<WebhookTriggerResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_WEBHOOK_TRIGGER, nameOrUrl, payload, method)
  },
  listWebhooks: (): Promise<WebhookConfig[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_WEBHOOK_LIST)
  },
  getSmartHomeDevices: (domain?: string): Promise<SmartHomeEntity[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_SMART_HOME_GET_DEVICES, domain)
  },
  executeSmartHome: (domain: string, service: string, entityId: string, serviceData?: any): Promise<SmartHomeActionResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_SMART_HOME_EXECUTE, domain, service, entityId, serviceData)
  },
  confirmReflexionAction: (confirmationId: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_REFLEXION_CONFIRMATION, confirmationId)
  },
  testSmartHomeConnection: (url?: string, token?: string): Promise<{ success: boolean; message: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_SMART_HOME_TEST_CONNECTION, url, token)
  },
  testWebhook: (url: string): Promise<WebhookTriggerResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_WEBHOOK_TEST, url)
  },
  selectDirectory: (): Promise<string | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY)
  },
  onAutonomyNotification: (callback: (notif: AutonomyNotification) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, notif: AutonomyNotification): void => callback(notif)
    ipcRenderer.on(IPC_CHANNELS.AUTONOMY_NOTIFICATION, handler)
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.AUTONOMY_NOTIFICATION, handler)
    }
  }
})
