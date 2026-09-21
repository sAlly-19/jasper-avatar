import {
  ConfigSummary,
  UpdateConfigPayload,
  JasperMemory,
  SystemHealthData,
  ScheduledTask,
  KnowledgeGraphData,
  AutonomyNotification,
  CodeExecutionResult,
  BrowserScrapeResult,
  GitStatusResult,
  FolderScanResult,
  FolderOrganizeResult,
  SubagentTask,
  SubagentRole,
  CalendarEvent,
  EmailSummary,
  type WebhookConfig,
  type WebhookTriggerResult,
  type SmartHomeEntity,
  type SmartHomeActionResult,
  type LicenseInfo,
  type LicenseValidationResult
} from '@shared'

export interface ElectronAPI {
  // Audio & Text streaming
  sendAudioChunk: (chunk: ArrayBuffer) => void
  sendAudioStreamEnd: () => void
  sendTextMessage: (text: string) => void
  onAudioChunk: (callback: (base64Audio: string) => void) => () => void
  onInterrupted: (callback: () => void) => () => void
  onTurnComplete: (callback: () => void) => () => void
  onTextChunk: (callback: (text: string) => void) => () => void
  onStatusChange: (callback: (status: string, message?: string) => void) => () => void

  // Gemini connection & configuration
  connectGemini: (config?: UpdateConfigPayload) => Promise<{ success: boolean; error?: string }>
  disconnectGemini: () => Promise<void>
  getConfig: () => Promise<ConfigSummary>
  saveConfig: (config: UpdateConfigPayload) => Promise<{ success: boolean }>
  onAgentNameUpdated: (callback: (name: string) => void) => () => void

  // Memory APIs
  getMemory: () => Promise<JasperMemory>
  clearMemory: () => Promise<boolean>

  // Frameless window controls & PIP
  windowMinimize: () => void
  windowMaximize: () => void
  windowClose: () => void
  togglePip: () => Promise<boolean>
  onPipChange: (callback: (isPip: boolean) => void) => () => void
  toggleFullscreen: () => Promise<boolean>
  onFullscreenChange: (callback: (isFullscreen: boolean) => void) => () => void

  // Autonomy & Proactive Services
  getSystemHealth: () => Promise<SystemHealthData>
  getSchedules: () => Promise<ScheduledTask[]>
  addSchedule: (title: string, minutesFromNow: number, recurrence?: 'once' | 'daily' | 'hourly') => Promise<ScheduledTask>
  removeSchedule: (id: string) => Promise<boolean>
  captureScreen: () => Promise<{ success: boolean; base64Image?: string; error?: string }>
  getActiveWindow: () => Promise<{ processName: string; windowTitle: string }>
  getKnowledgeGraph: () => Promise<KnowledgeGraphData>
  getBriefing: () => Promise<any>
  executeCode: (language: 'python' | 'javascript', code: string, timeoutMs?: number) => Promise<CodeExecutionResult>
  browsePage: (url: string, options?: any) => Promise<BrowserScrapeResult>
  gitCheck: (repoPath?: string) => Promise<GitStatusResult>
  gitSuggestCommit: (repoPath?: string) => Promise<{ suggestion: string; diffSummary: string; branch: string }>
  scanFolder: (target?: string) => Promise<FolderScanResult>
  organizeFolder: (target?: string, dryRun?: boolean) => Promise<FolderOrganizeResult>
  spawnSubagent: (role: SubagentRole, task: string) => Promise<SubagentTask>
  getSubagentTasks: () => Promise<SubagentTask[]>
  addCalendarEvent: (title: string, startDateTime: any, durationMinutes?: number, description?: string, location?: string) => Promise<CalendarEvent>
  getCalendarEvents: (withinHours?: number) => Promise<CalendarEvent[]>
  checkEmails: (options?: any) => Promise<EmailSummary[]>
  triggerWebhook: (nameOrUrl: string, payload?: any, method?: any) => Promise<WebhookTriggerResult>
  listWebhooks: () => Promise<WebhookConfig[]>
  getSmartHomeDevices: (domain?: string) => Promise<SmartHomeEntity[]>
  executeSmartHome: (domain: string, service: string, entityId: string, serviceData?: any) => Promise<SmartHomeActionResult>
  confirmReflexionAction: (confirmationId: string) => Promise<boolean>
  testSmartHomeConnection: (url?: string, token?: string) => Promise<{ success: boolean; message: string }>
  testWebhook: (url: string) => Promise<WebhookTriggerResult>
  selectDirectory: () => Promise<string | null>
  onAutonomyNotification: (callback: (notif: AutonomyNotification) => void) => () => void

  // License & Node-Locking
  getLicenseStatus: () => Promise<LicenseInfo>
  activateLicense: (key: string) => Promise<LicenseValidationResult>
  getHwid: () => Promise<{ machineId: string; machineName: string; platform: string }>
  onLicenseRevoked: (callback: (payload: { status: string; message: string }) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
