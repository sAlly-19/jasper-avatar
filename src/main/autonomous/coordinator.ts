import { IPC_CHANNELS, type AutonomyNotification } from '@shared'
import { safeSend } from '../windows/main-window'
import { configStore } from '../config/config-store'

import { screenAwareness } from './screen-awareness'
import { windowTracker } from './window-tracker'
import { clipboardWatcher } from './clipboard-watcher'
import { cronEngine } from './cron-engine'
import { systemHealth } from './system-health'
import { briefingService } from './briefing-service'
import { semanticMemory } from './semantic-memory'
import { knowledgeGraph } from './knowledge-graph'
import { headlessBrowser } from './headless-browser'
import { gitWatcher } from './git-watcher'
import { folderOrganizer } from './folder-organizer'
import { subagentOrchestrator } from './subagent-orchestrator'
import { reflexionEngine } from './reflexion-engine'
import { calendarEmail } from './calendar-email'
import { webhookManager } from './webhook-manager'
import { smartHome } from './smart-home'
import { processManager } from './process-manager'
import { mediaController } from './media-controller'
import { uiAutomation } from './ui-automation'
import { presentationMode } from './presentation-mode'
import { focusMode } from './focus-mode'

export class AutonomyCoordinator {
  private isInitialized: boolean = false

  public init(): void {
    if (this.isInitialized) return
    this.isInitialized = true

    console.log('[AutonomyCoordinator] Initializing autonomous services...')
    const cfg = configStore.getConfig()

    // 1. Screen Awareness
    screenAwareness.setEnabled(cfg.enableScreenAwareness !== false)

    // 2. Active Window Tracker
    windowTracker.setEnabled(cfg.enableWindowTracker !== false)
    windowTracker.setOnWindowChanged((win) => {
      console.log('[Autonomy] Active process changed.')
    })

    // 3. Clipboard Watcher
    clipboardWatcher.setEnabled(cfg.enableClipboardWatcher !== false)
    clipboardWatcher.setOnInterestingContent((notif) => {
      this.dispatchNotification(notif)
    })

    // 4. Cron Engine (Schedules & Reminders)
    cronEngine.setEnabled(cfg.enableCronEngine !== false)
    cronEngine.setOnTaskTriggered((notif) => {
      this.dispatchNotification(notif)
    })

    // 5. System Health Watcher
    systemHealth.setEnabled(cfg.enableSystemHealth !== false)
    systemHealth.setOnHealthWarning((notif) => {
      this.dispatchNotification(notif)
    })

    // 6. Daily Briefing Service
    briefingService.setEnabled(cfg.enableDailyBriefing !== false)

    // 7. Semantic Memory
    semanticMemory.setEnabled(cfg.enableSemanticMemory !== false)

    // 8. Knowledge Graph
    knowledgeGraph.setEnabled(cfg.enableKnowledgeGraph !== false)

    // 9. Headless Browser (Electron Chromium Worker)
    headlessBrowser.setEnabled(cfg.enableHeadlessBrowser !== false)

    // 11. Git Watcher & Commit Assistant
    gitWatcher.setEnabled(cfg.enableGitWatcher !== false)
    if (cfg.gitRepoPath) {
      gitWatcher.setDefaultRepoPath(cfg.gitRepoPath)
    }
    gitWatcher.setOnNotification((notif) => {
      this.dispatchNotification(notif)
    })

    // 12. Folder Organizer (Downloads & Desktop)
    folderOrganizer.setEnabled(cfg.enableFolderOrganizer !== false)

    // 13. Subagent Orchestrator (Parallel Background Workers)
    subagentOrchestrator.setEnabled(cfg.enableSubagents !== false)
    subagentOrchestrator.setOnNotification((notif) => {
      this.dispatchNotification(notif)
    })

    // 14. Reflexion Engine (Pre-execution Safety & Post-critique)
    reflexionEngine.setEnabled(cfg.enableReflexionLoop !== false)
    reflexionEngine.setOnNotification((notif) => {
      this.dispatchNotification(notif)
    })

    // 15. Calendar & Email (iCal, Meeting Reminder & Inbox)
    calendarEmail.setEnabled(cfg.enableCalendarEmail !== false)
    calendarEmail.setOnNotification((notif) => {
      this.dispatchNotification(notif)
    })

    // 16. Webhook Manager (n8n, Zapier, Make, Slack)
    webhookManager.setEnabled(cfg.enableWebhooks !== false)

    // 17. Smart Home Integration (Home Assistant REST/WebSocket)
    smartHome.setEnabled(cfg.enableSmartHome !== false)
    smartHome.setConfig(cfg.hassUrl || '', cfg.hassToken || '')

    // 18. Process Manager, Media Controller & UI Automation
    processManager.setEnabled(cfg.enableProcessManager !== false)
    mediaController.setEnabled(cfg.enableMediaController !== false)
    uiAutomation.setEnabled(cfg.enableUiAutomation !== false)

    // 19. Presentation / Smart Silent Mode
    presentationMode.setEnabled(cfg.enablePresentationMode !== false)
    presentationMode.setOnStateChange((status) => {
      if (status.isActive) {
        this.dispatchNotification({
          id: `presentation-${status.timestamp}`,
          type: 'info',
          title: 'Modo Apresentação Ativado',
          message: status.detectedReason || 'Jasper silenciou saídas de áudio durante a apresentação.',
          timestamp: status.timestamp,
          silentAudio: true
        })
      }
    })

    // 20. Smart Focus Session & Distraction Blocker
    focusMode.setEnabled(cfg.enableFocusMode !== false)
    focusMode.setOnNotification((notif) => {
      this.dispatchNotification(notif)
    })

    console.log('[AutonomyCoordinator] All autonomous services initialized successfully.')
  }

  public dispatchNotification(notif: AutonomyNotification): void {
    if (presentationMode.getStatus().isSilentAudio) {
      notif.silentAudio = true
    }
    console.log(`[Autonomy Notification] Event dispatched: ${notif.type} (silentAudio: ${Boolean(notif.silentAudio)})`)
    safeSend(IPC_CHANNELS.AUTONOMY_NOTIFICATION, notif)
  }

  public updateServicesConfig(): void {
    const cfg = configStore.getConfig()
    screenAwareness.setEnabled(cfg.enableScreenAwareness !== false)
    windowTracker.setEnabled(cfg.enableWindowTracker !== false)
    clipboardWatcher.setEnabled(cfg.enableClipboardWatcher !== false)
    cronEngine.setEnabled(cfg.enableCronEngine !== false)
    systemHealth.setEnabled(cfg.enableSystemHealth !== false)
    briefingService.setEnabled(cfg.enableDailyBriefing !== false)
    semanticMemory.setEnabled(cfg.enableSemanticMemory !== false)
    knowledgeGraph.setEnabled(cfg.enableKnowledgeGraph !== false)
    headlessBrowser.setEnabled(cfg.enableHeadlessBrowser !== false)
    gitWatcher.setEnabled(cfg.enableGitWatcher !== false)
    if (cfg.gitRepoPath) {
      gitWatcher.setDefaultRepoPath(cfg.gitRepoPath)
    }
    folderOrganizer.setEnabled(cfg.enableFolderOrganizer !== false)
    subagentOrchestrator.setEnabled(cfg.enableSubagents !== false)
    reflexionEngine.setEnabled(cfg.enableReflexionLoop !== false)
    calendarEmail.setEnabled(cfg.enableCalendarEmail !== false)
    webhookManager.setEnabled(cfg.enableWebhooks !== false)
    smartHome.setEnabled(cfg.enableSmartHome !== false)
    smartHome.setConfig(cfg.hassUrl || '', cfg.hassToken || '')
    processManager.setEnabled(cfg.enableProcessManager !== false)
    mediaController.setEnabled(cfg.enableMediaController !== false)
    uiAutomation.setEnabled(cfg.enableUiAutomation !== false)
    presentationMode.setEnabled(cfg.enablePresentationMode !== false)
    focusMode.setEnabled(cfg.enableFocusMode !== false)
  }

  public stopAll(): void {
    windowTracker.stop()
    clipboardWatcher.stop()
    cronEngine.stop()
    systemHealth.stop()
    gitWatcher.stop()
    calendarEmail.stop()
    presentationMode.stop()
    focusMode.stopFocus()
  }
}

export const autonomyCoordinator = new AutonomyCoordinator()

