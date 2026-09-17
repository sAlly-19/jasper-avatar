export interface JasperConfig {
  apiKey: string
  voiceName: string
  model: string
  enableSystemTools: boolean
  enableMediaTools: boolean
  agentName: string
  enableWakeWord: boolean
  enableBloom: boolean
  enableNeuralBg: boolean
  enableEyeTracking: boolean
  // Autonomy services
  enableScreenAwareness: boolean
  enableWindowTracker: boolean
  enableClipboardWatcher: boolean
  enableCronEngine: boolean
  enableDailyBriefing: boolean
  enableSystemHealth: boolean
  enableSemanticMemory: boolean
  enableKnowledgeGraph: boolean
  enableCodeInterpreter: boolean
  enableHeadlessBrowser: boolean
  enableGitWatcher: boolean
  enableFolderOrganizer: boolean
  enableSubagents: boolean
  enableReflexionLoop: boolean
  enableCalendarEmail: boolean
  enableWebhooks: boolean
  enableSmartHome: boolean
  // Module specific configurations
  hassUrl?: string
  hassToken?: string
  gitRepoPath?: string
  webhookDefaultUrl?: string
  emailUser?: string
  emailImapHost?: string
  emailImapPort?: number
  emailPassword?: string
  folderDefaultTarget?: string
}

export interface UpdateConfigPayload {
  apiKey?: string
  voiceName?: string
  model?: string
  enableSystemTools?: boolean
  enableMediaTools?: boolean
  agentName?: string
  enableWakeWord?: boolean
  enableBloom?: boolean
  enableNeuralBg?: boolean
  enableEyeTracking?: boolean
  // Autonomy services
  enableScreenAwareness?: boolean
  enableWindowTracker?: boolean
  enableClipboardWatcher?: boolean
  enableCronEngine?: boolean
  enableDailyBriefing?: boolean
  enableSystemHealth?: boolean
  enableSemanticMemory?: boolean
  enableKnowledgeGraph?: boolean
  enableCodeInterpreter?: boolean
  enableHeadlessBrowser?: boolean
  enableGitWatcher?: boolean
  enableFolderOrganizer?: boolean
  enableSubagents?: boolean
  enableReflexionLoop?: boolean
  enableCalendarEmail?: boolean
  enableWebhooks?: boolean
  enableSmartHome?: boolean
  // Module specific configurations
  hassUrl?: string
  hassToken?: string
  gitRepoPath?: string
  webhookDefaultUrl?: string
  emailUser?: string
  emailImapHost?: string
  emailImapPort?: number
  emailPassword?: string
  folderDefaultTarget?: string
}

export interface ConfigSummary {
  apiKey: string
  hasFullKey: boolean
  voiceName: string
  model: string
  enableSystemTools: boolean
  enableMediaTools: boolean
  agentName: string
  enableWakeWord: boolean
  enableBloom: boolean
  enableNeuralBg: boolean
  enableEyeTracking: boolean
  // Autonomy services
  enableScreenAwareness: boolean
  enableWindowTracker: boolean
  enableClipboardWatcher: boolean
  enableCronEngine: boolean
  enableDailyBriefing: boolean
  enableSystemHealth: boolean
  enableSemanticMemory: boolean
  enableKnowledgeGraph: boolean
  enableCodeInterpreter: boolean
  enableHeadlessBrowser: boolean
  enableGitWatcher: boolean
  enableFolderOrganizer: boolean
  enableSubagents: boolean
  enableReflexionLoop: boolean
  enableCalendarEmail: boolean
  enableWebhooks: boolean
  enableSmartHome: boolean
  // Module specific configurations
  hassUrl?: string
  hasHassToken?: boolean
  gitRepoPath?: string
  webhookDefaultUrl?: string
  emailUser?: string
  emailImapHost?: string
  emailImapPort?: number
  hasEmailPassword?: boolean
  folderDefaultTarget?: string
  isConnected: boolean
}

