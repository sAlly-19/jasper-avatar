import { systemHealth } from './system-health'
import { cronEngine } from './cron-engine'
import { windowTracker } from './window-tracker'

export interface DailyBriefing {
  greeting: string
  period: 'morning' | 'afternoon' | 'evening' | 'night'
  dateFormatted: string
  systemSummary: string
  pendingTasksSummary: string
  activeContextSummary: string
  fullBriefingText: string
  timestamp: number
}

export class BriefingService {
  private isEnabled: boolean = true

  constructor(enabled: boolean = true) {
    this.isEnabled = enabled
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  public getIsEnabled(): boolean {
    return this.isEnabled
  }

  public async generateBriefing(userName: string = 'Comandante'): Promise<DailyBriefing> {
    const now = new Date()
    const hour = now.getHours()

    let period: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning'
    let greeting = `Bom dia, ${userName}!`

    if (hour >= 5 && hour < 12) {
      period = 'morning'
      greeting = `Bom dia, ${userName}!`
    } else if (hour >= 12 && hour < 18) {
      period = 'afternoon'
      greeting = `Boa tarde, ${userName}!`
    } else if (hour >= 18 && hour < 23) {
      period = 'evening'
      greeting = `Boa noite, ${userName}!`
    } else {
      period = 'night'
      greeting = `Boa noite, ${userName}! Já passa da meia-noite.`
    }

    const dateFormatted = now.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    // 1. System Health
    const health = await systemHealth.getHealth()
    const systemSummary = `Sistema online há ${health.uptimeHours} horas. Memória RAM em ${health.ramUsagePercent}% (${health.usedRamGb}GB / ${health.totalRamGb}GB). Uso de CPU em ${health.cpuUsagePercent}%.`

    // 2. Pending Tasks
    const tasks = cronEngine.getTasks().filter((t) => !t.completed)
    let pendingTasksSummary = 'Você não possui lembretes pendentes na fila.'
    if (tasks.length === 1) {
      pendingTasksSummary = `Você tem 1 lembrete pendente: "${tasks[0].title}".`
    } else if (tasks.length > 1) {
      const taskTitles = tasks.slice(0, 3).map((t) => `"${t.title}"`).join(', ')
      pendingTasksSummary = `Você tem ${tasks.length} lembretes pendentes, incluindo: ${taskTitles}.`
    }

    // 3. Active Window
    const currentWin = await windowTracker.getActiveWindow()
    let activeContextSummary = ''
    if (currentWin && currentWin.processName !== 'Unknown' && currentWin.processName !== 'Idle') {
      activeContextSummary = `Seu foco atual está em: ${currentWin.processName} (${currentWin.windowTitle || 'Janela'}).`
    }

    const fullBriefingText = `${greeting} Hoje é ${dateFormatted}. ${systemSummary} ${pendingTasksSummary} ${activeContextSummary}`.trim()

    return {
      greeting,
      period,
      dateFormatted,
      systemSummary,
      pendingTasksSummary,
      activeContextSummary,
      fullBriefingText,
      timestamp: Date.now()
    }
  }
}

export const briefingService = new BriefingService()

