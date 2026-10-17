import os from 'os'
import si from 'systeminformation'
import type { SystemHealthData, AutonomyNotification } from '@shared'

export interface DetailedHardwareStats {
  cpu: {
    brand: string
    cores: number
    speedGhz: number
    loadPercent: number
  }
  memory: {
    totalGb: number
    usedGb: number
    freeGb: number
    usagePercent: number
  }
  disks: Array<{
    mount: string
    totalGb: number
    freeGb: number
    usePercent: number
  }>
  battery?: {
    hasBattery: boolean
    percent: number
    isCharging: boolean
  }
  graphics: Array<{
    model: string
    vramMb?: number
  }>
  osInfo: {
    platform: string
    distro: string
    uptimeHours: number
  }
}

export class SystemHealthService {
  private isEnabled: boolean = true
  private pollIntervalMs: number = 8000
  private timer: NodeJS.Timeout | null = null
  private lastCpuSample: { idle: number; total: number } | null = null
  private currentHealth: SystemHealthData
  private onHealthWarning?: (notification: AutonomyNotification) => void
  private highRamAlertSent: boolean = false
  private diskCache: { diskFreeGb?: number; diskTotalGb?: number; timestamp: number } = { timestamp: 0 }
  private staticHardwareCache: {
    cpuBrand?: string
    cpuCores?: number
    cpuSpeed?: number
    graphics?: Array<{ model: string; vramMb?: number }>
    osDistro?: string
  } = {}

  constructor(enabled: boolean = true) {
    this.isEnabled = enabled
    this.currentHealth = this.getBasicMetrics(0)
    this.sampleCpu()
    this.preloadStaticInfo()
  }

  private async preloadStaticInfo(): Promise<void> {
    try {
      const [cpu, gfx, osInfo] = await Promise.all([
        si.cpu(),
        si.graphics(),
        si.osInfo()
      ])
      this.staticHardwareCache = {
        cpuBrand: cpu.brand,
        cpuCores: cpu.cores,
        cpuSpeed: cpu.speed,
        graphics: gfx.controllers.map((c) => ({ model: c.model, vramMb: c.vram || undefined })),
        osDistro: `${osInfo.distro} ${osInfo.release}`
      }
    } catch {
      // Non-critical background cache
    }
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

  public async getHealth(): Promise<SystemHealthData> {
    const cpu = this.sampleCpu()
    const base = this.getBasicMetrics(cpu)

    try {
      const now = Date.now()
      // Cache fsSize for 5 minutes (300,000 ms) to avoid expensive WMI queries every 8 seconds
      if (now - this.diskCache.timestamp > 300_000 || !this.diskCache.diskTotalGb) {
        const disks = await si.fsSize().catch(() => [])
        const primaryDisk = disks.find((d) => d.mount.toLowerCase().startsWith('c:')) || disks[0]
        if (primaryDisk) {
          this.diskCache = {
            diskFreeGb: Math.round(primaryDisk.available / (1024 ** 3)),
            diskTotalGb: Math.round(primaryDisk.size / (1024 ** 3)),
            timestamp: now
          }
        }
      }

      base.diskFreeGb = this.diskCache.diskFreeGb
      base.diskTotalGb = this.diskCache.diskTotalGb

      const battery = await si.battery().catch(() => null)
      if (battery && battery.hasBattery) {
        base.batteryPercent = battery.percent
        base.isCharging = battery.isCharging
      }
    } catch {
      // Fallback already populated
    }

    this.currentHealth = base
    return this.currentHealth
  }

  public async getDetailedHardwareStats(): Promise<DetailedHardwareStats> {
    const [load, mem, disks, battery, gfx, cpuInfo] = await Promise.all([
      si.currentLoad().catch(() => ({ currentLoad: this.sampleCpu() })),
      si.mem().catch(() => ({
        total: os.totalmem(),
        used: os.totalmem() - os.freemem(),
        free: os.freemem()
      })),
      si.fsSize().catch(() => []),
      si.battery().catch(() => null),
      si.graphics().catch(() => ({ controllers: [] })),
      si.cpu().catch(() => ({ brand: 'Processador Windows', cores: os.cpus().length, speed: 0 }))
    ])

    const totalRamGb = Number((mem.total / (1024 ** 3)).toFixed(1))
    const usedRamGb = Number((mem.used / (1024 ** 3)).toFixed(1))
    const freeRamGb = Number((mem.free / (1024 ** 3)).toFixed(1))
    const ramPercent = Math.round((mem.used / mem.total) * 100)

    const diskList = disks.map((d) => ({
      mount: d.mount,
      totalGb: Math.round(d.size / (1024 ** 3)),
      freeGb: Math.round(d.available / (1024 ** 3)),
      usePercent: Math.round(d.use)
    }))

    return {
      cpu: {
        brand: cpuInfo.brand || this.staticHardwareCache.cpuBrand || 'Processador Windows',
        cores: cpuInfo.cores || this.staticHardwareCache.cpuCores || os.cpus().length,
        speedGhz: cpuInfo.speed || this.staticHardwareCache.cpuSpeed || 0,
        loadPercent: Math.round(load.currentLoad)
      },
      memory: {
        totalGb: totalRamGb,
        usedGb: usedRamGb,
        freeGb: freeRamGb,
        usagePercent: ramPercent
      },
      disks: diskList,
      battery: battery && battery.hasBattery ? {
        hasBattery: true,
        percent: battery.percent,
        isCharging: battery.isCharging
      } : undefined,
      graphics: gfx.controllers.map((c) => ({ model: c.model, vramMb: c.vram || undefined })),
      osInfo: {
        platform: 'Windows',
        distro: this.staticHardwareCache.osDistro || os.version() || 'Windows',
        uptimeHours: Number((os.uptime() / 3600).toFixed(1))
      }
    }
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
        title: 'Atenção: Memória RAM Crítica',
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
