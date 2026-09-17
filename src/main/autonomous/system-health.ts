import os from 'os'
import { exec } from 'child_process'
import type { SystemHealthData, AutonomyNotification } from '@shared'

export class SystemHealthService {
  private isEnabled: boolean = true
  private pollIntervalMs: number = 8000
  private timer: NodeJS.Timeout | null = null
  private lastCpuSample: { idle: number; total: number } | null = null
  private currentHealth: SystemHealthData
  private onHealthWarning?: (notification: AutonomyNotification) => void
  private highRamAlertSent: boolean = false
  private cachedDisk: { freeGb?: number; totalGb?: number; timestamp: number } | null = null

  constructor(enabled: boolean = true) {
    this.isEnabled = enabled
    this.currentHealth = this.getBasicMetrics(0)
    this.sampleCpu()
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

  public setOnHealthWarning(cb: (notification: AutonomyNotification) => void): void {
    this.onHealthWarning = cb
  }

  public start(): void {
    if (this.timer) return
    this.poll()
    this.timer = setInterval(() => this.poll(), this.pollIntervalMs)
    console.log('[SystemHealth] Service started (monitoring every 8s)')
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      console.log('[SystemHealth] Service stopped')
    }
  }

  private sampleCpu(): number {
    const cpus = os.cpus()
    let idle = 0
    let total = 0

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += (cpu.times as any)[type]
      }
      idle += cpu.times.idle
    }

    if (!this.lastCpuSample) {
      this.lastCpuSample = { idle, total }
      return 0
    }

    const idleDiff = idle - this.lastCpuSample.idle
    const totalDiff = total - this.lastCpuSample.total
    this.lastCpuSample = { idle, total }

    if (totalDiff <= 0) return 0
    const usage = 100 - Math.round((idleDiff / totalDiff) * 100)
    return Math.max(0, Math.min(100, usage))
  }

  private getBasicMetrics(cpuUsage: number): SystemHealthData {
    const totalMemBytes = os.totalmem()
    const freeMemBytes = os.freemem()
    const usedMemBytes = totalMemBytes - freeMemBytes

    const totalRamGb = Number((totalMemBytes / (1024 ** 3)).toFixed(1))
    const freeRamGb = Number((freeMemBytes / (1024 ** 3)).toFixed(1))
    const usedRamGb = Number((usedMemBytes / (1024 ** 3)).toFixed(1))
    const ramUsagePercent = Math.round((usedMemBytes / totalMemBytes) * 100)
    const uptimeHours = Number((os.uptime() / 3600).toFixed(1))

    return {
      cpuUsagePercent: cpuUsage,
      totalRamGb,
      usedRamGb,
      freeRamGb,
      ramUsagePercent,
      uptimeHours,
      timestamp: Date.now()
    }
  }

  private async fetchDiskInfo(): Promise<{ freeGb?: number; totalGb?: number }> {
    if (this.cachedDisk && Date.now() - this.cachedDisk.timestamp < 60000) {
      return { freeGb: this.cachedDisk.freeGb, totalGb: this.cachedDisk.totalGb }
    }

    return new Promise((resolve) => {
      exec(
        'powershell -NoProfile -Command "(Get-PSDrive C).Free; (Get-PSDrive C).Used + (Get-PSDrive C).Free"',
        { timeout: 3000, windowsHide: true },
        (error, stdout) => {
          if (error || !stdout) {
            resolve(this.cachedDisk ? { freeGb: this.cachedDisk.freeGb, totalGb: this.cachedDisk.totalGb } : {})
            return
          }
          const lines = stdout.trim().split(/\r?\n/).map((l) => Number(l.trim()))
          if (lines.length >= 2 && !isNaN(lines[0]) && !isNaN(lines[1])) {
            const freeGb = Math.round(lines[0] / (1024 ** 3))
            const totalGb = Math.round(lines[1] / (1024 ** 3))
            this.cachedDisk = { freeGb, totalGb, timestamp: Date.now() }
            resolve({ freeGb, totalGb })
            return
          }
          resolve(this.cachedDisk ? { freeGb: this.cachedDisk.freeGb, totalGb: this.cachedDisk.totalGb } : {})
        }
      )
    })
  }

  public async getHealth(): Promise<SystemHealthData> {
    const cpu = this.sampleCpu()
    const base = this.getBasicMetrics(cpu)
    try {
      const disk = await this.fetchDiskInfo()
      base.diskFreeGb = disk.freeGb
      base.diskTotalGb = disk.totalGb
    } catch {}

    this.currentHealth = base
    return this.currentHealth
  }

  private async poll(): Promise<void> {
    if (!this.isEnabled) return

    const health = await this.getHealth()

    // Alert if RAM > 92%
    if (health.ramUsagePercent >= 92 && !this.highRamAlertSent) {
      this.highRamAlertSent = true
      const notif: AutonomyNotification = {
        id: `ram-warning-${Date.now()}`,
        type: 'warning',
        title: '⚠️ Atenção: Memória RAM Crítica',
        message: `O uso de memória atingiu ${health.ramUsagePercent}% (${health.usedRamGb}GB de ${health.totalRamGb}GB). Considere fechar abas ou programas pesados.`,
        timestamp: Date.now(),
        data: health
      }
      this.onHealthWarning?.(notif)
    } else if (health.ramUsagePercent < 85) {
      this.highRamAlertSent = false
    }
  }
}

export const systemHealth = new SystemHealthService()

