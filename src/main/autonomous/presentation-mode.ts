import { windowTracker, type ActiveWindowInfo } from './window-tracker'
import { processManager, type RunningProcessInfo } from './process-manager'

export interface PresentationModeStatus {
  isActive: boolean
  isSilentAudio: boolean
  source: 'automatic' | 'manual' | 'none'
  detectedReason?: string
  timestamp: number
}

const MEETING_PROCESSES = new Set([
  'teams',
  'msteams',
  'zoom',
  'webexmta',
  'ciscowebexstart',
  'powerpnt'
])

const MEETING_TITLE_KEYWORDS = [
  'google meet',
  'microsoft teams',
  'zoom meeting',
  'reunião do zoom',
  'apresentação de slides',
  'slideshow',
  'apresentação do powerpoint'
]

export class PresentationModeService {
  private isEnabled: boolean = true
  private isManualActive: boolean = false
  private isAutoActive: boolean = false
  private detectedReason?: string
  private checkIntervalMs: number = 8000
  private timer: NodeJS.Timeout | null = null
  private onStateChange?: (status: PresentationModeStatus) => void

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    if (enabled) {
      this.start()
    } else {
      this.stop()
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled
  }

  public setOnStateChange(cb: (status: PresentationModeStatus) => void): void {
    this.onStateChange = cb
  }

  public start(): void {
    if (this.timer) return
    this.check()
    this.timer = setInterval(() => this.check(), this.checkIntervalMs)
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /**
   * Manually activate or deactivate Presentation / Silent mode
   */
  public setPresentationMode(active: boolean): PresentationModeStatus {
    this.isManualActive = active
    if (!active) {
      this.isAutoActive = false
      this.detectedReason = undefined
    } else {
      this.detectedReason = 'Ativado manualmente pelo usuário'
    }

    const status = this.getStatus()
    this.onStateChange?.(status)
    return status
  }

  public getStatus(): PresentationModeStatus {
    const isActive = this.isManualActive || this.isAutoActive
    return {
      isActive,
      isSilentAudio: isActive,
      source: this.isManualActive ? 'manual' : this.isAutoActive ? 'automatic' : 'none',
      detectedReason: this.detectedReason,
      timestamp: Date.now()
    }
  }

  public async check(): Promise<void> {
    if (!this.isEnabled || this.isManualActive) return

    try {
      // 1. Check active window title from cache
      const win = windowTracker.getCurrentCachedWindow()
      const titleLower = (win.windowTitle || '').toLowerCase()
      const procLower = (win.processName || '').toLowerCase()

      let matchedMeeting = false
      let reason = ''

      for (const kw of MEETING_TITLE_KEYWORDS) {
        if (titleLower.includes(kw)) {
          matchedMeeting = true
          reason = `Janela de reunião ou apresentação ativa: "${win.windowTitle}"`
          break
        }
      }

      if (!matchedMeeting && MEETING_PROCESSES.has(procLower)) {
        matchedMeeting = true
        reason = `Aplicativo de conferência/apresentação em foco: ${win.processName}`
      }

      const previousState = this.isAutoActive
      this.isAutoActive = matchedMeeting
      this.detectedReason = matchedMeeting ? reason : undefined

      if (previousState !== this.isAutoActive) {
        const status = this.getStatus()
        this.onStateChange?.(status)
      }
    } catch {
      // Non-critical background poll
    }
  }
}

export const presentationMode = new PresentationModeService()

