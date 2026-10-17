import type { AutonomyNotification } from '@shared'
import { windowTracker } from './window-tracker'

export interface FocusSessionStatus {
  isActive: boolean
  remainingMinutes: number
  totalDurationMinutes: number
  startTime?: number
  endTime?: number
  distractionsBlockedCount: number
}

const DEFAULT_DISTRACTION_APPS = new Set([
  'steam',
  'epicgameslauncher',
  'discord',
  'telegram',
  'riotclientservices',
  'leagueclient',
  'battlenet',
  'spotify'
])

export class FocusModeService {
  private isEnabled: boolean = true
  private isActive: boolean = false
  private durationMinutes: number = 25
  private startTimestamp: number = 0
  private endTimestamp: number = 0
  private timer: NodeJS.Timeout | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private distractionsCount: number = 0
  private lastAlertedApp: string = ''
  private onNotification?: (notif: AutonomyNotification) => void

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    if (!enabled && this.isActive) {
      this.stopFocus()
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled
  }

  public setOnNotification(cb: (notif: AutonomyNotification) => void): void {
    this.onNotification = cb
  }

  public startFocus(durationMinutes: number = 25): FocusSessionStatus {
    this.durationMinutes = Math.max(1, Math.min(240, durationMinutes))
    this.isActive = true
    this.startTimestamp = Date.now()
    this.endTimestamp = this.startTimestamp + this.durationMinutes * 60 * 1000
    this.distractionsCount = 0
    this.lastAlertedApp = ''

    if (this.timer) clearTimeout(this.timer)
    if (this.pollTimer) clearInterval(this.pollTimer)

    // Main session end timer
    this.timer = setTimeout(() => {
      this.completeSession()
    }, this.durationMinutes * 60 * 1000)

    // Distraction monitor loop every 6 seconds
    this.pollTimer = setInterval(() => {
      this.checkDistractions()
    }, 6000)

    return this.getStatus()
  }

  public stopFocus(): FocusSessionStatus {
    this.isActive = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    return this.getStatus()
  }

  private completeSession(): void {
    this.stopFocus()
    const notif: AutonomyNotification = {
      id: `focus-complete-${Date.now()}`,
      type: 'info',
      title: 'Sessão de Foco Concluída!',
      message: `Parabéns! Você completou ${this.durationMinutes} minutos de concentração ininterrupta. Hora de fazer uma pausa!`,
      timestamp: Date.now()
    }
    this.onNotification?.(notif)
  }

  private async checkDistractions(): Promise<void> {
    if (!this.isActive) return

    try {
      const activeWin = windowTracker.getCurrentCachedWindow()
      const proc = (activeWin.processName || '').toLowerCase().replace(/\.exe$/, '')

      if (DEFAULT_DISTRACTION_APPS.has(proc) && proc !== this.lastAlertedApp) {
        this.distractionsCount++
        this.lastAlertedApp = proc

        const notif: AutonomyNotification = {
          id: `focus-distraction-${Date.now()}`,
          type: 'warning',
          title: 'Distração Detectada no Modo Foco',
          message: `O aplicativo "${activeWin.processName}" foi detectado. Mantenha a concentração na sua tarefa principal!`,
          timestamp: Date.now()
        }
        this.onNotification?.(notif)
      }
    } catch {
      // Non-critical monitor
    }
  }

  public getStatus(): FocusSessionStatus {
    if (!this.isActive) {
      return {
        isActive: false,
        remainingMinutes: 0,
        totalDurationMinutes: this.durationMinutes,
        distractionsBlockedCount: this.distractionsCount
      }
    }

    const now = Date.now()
    const remainingMs = Math.max(0, this.endTimestamp - now)
    const remainingMinutes = Math.round(remainingMs / 60000)

    return {
      isActive: true,
      remainingMinutes,
      totalDurationMinutes: this.durationMinutes,
      startTime: this.startTimestamp,
      endTime: this.endTimestamp,
      distractionsBlockedCount: this.distractionsCount
    }
  }
}

export const focusMode = new FocusModeService()

