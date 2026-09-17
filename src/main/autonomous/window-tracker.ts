import { execFile } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import fs from 'fs'

export interface ActiveWindowInfo {
  processName: string
  windowTitle: string
  timestamp: number
}

export class WindowTrackerService {
  private isEnabled: boolean = true
  private pollIntervalMs: number = 4000
  private timer: NodeJS.Timeout | null = null
  private currentWindow: ActiveWindowInfo = {
    processName: 'Unknown',
    windowTitle: '',
    timestamp: Date.now()
  }
  private onWindowChangedCallback?: (info: ActiveWindowInfo) => void

  constructor(enabled: boolean = true) {
    this.isEnabled = enabled
  }

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

  public setOnWindowChanged(cb: (info: ActiveWindowInfo) => void): void {
    this.onWindowChangedCallback = cb
  }

  public start(): void {
    if (this.timer) return
    this.poll()
    this.timer = setInterval(() => this.poll(), this.pollIntervalMs)
    console.log('[WindowTracker] Service started (polling every 4s)')
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      console.log('[WindowTracker] Service stopped')
    }
  }

  private getScriptPath(): string {
    // Development vs built asset path
    const devPath = join(__dirname, 'scripts', 'get-active-window.ps1')
    if (fs.existsSync(devPath)) return devPath

    const srcPath = join(app.getAppPath(), 'src', 'main', 'autonomous', 'scripts', 'get-active-window.ps1')
    if (fs.existsSync(srcPath)) return srcPath

    return devPath
  }

  public async getActiveWindow(): Promise<ActiveWindowInfo> {
    return new Promise((resolve) => {
      const scriptPath = this.getScriptPath()
      execFile(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        { timeout: 3500, windowsHide: true },
        (error, stdout) => {
          if (error || !stdout) {
            resolve(this.currentWindow)
            return
          }
          try {
            const parsed = JSON.parse(stdout.trim()) as ActiveWindowInfo
            if (parsed.processName) {
              this.currentWindow = parsed
            }
          } catch {
            // Keep previous window on parse error
          }
          resolve(this.currentWindow)
        }
      )
    })
  }

  private async poll(): Promise<void> {
    if (!this.isEnabled) return

    const prevProcess = this.currentWindow.processName
    const prevTitle = this.currentWindow.windowTitle

    const current = await this.getActiveWindow()

    if (
      current.processName &&
      current.processName !== 'Unknown' &&
      current.processName !== 'Idle' &&
      (current.processName !== prevProcess || current.windowTitle !== prevTitle)
    ) {
      // Don't report self electron window as external context switch
      if (!current.processName.toLowerCase().includes('electron') && !current.windowTitle.toLowerCase().includes('jasper')) {
        this.onWindowChangedCallback?.(current)
      }
    }
  }
}

export const windowTracker = new WindowTrackerService()

