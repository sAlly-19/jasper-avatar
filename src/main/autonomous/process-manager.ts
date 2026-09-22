import { spawn, execFile } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import fs from 'fs'
import { toolPolicyEngine } from './policy-engine'

export interface ProgramSearchResult {
  name: string
  appId: string
  source: string
  path: string
}

export interface RunningProcessInfo {
  name: string
  pid: number
  cpuPercent?: number
  memoryMb: number
}

// Critical system processes protected from termination
const PROTECTED_PROCESSES = new Set([
  'system',
  'system idle process',
  'idle',
  'smss',
  'csrss',
  'wininit',
  'services',
  'lsass',
  'winlogon',
  'explorer',
  'dwm',
  'fontdrvhost',
  'svchost',
  'securityhealthservice',
  'antigravity',
  'electron'
])

export class ProcessManagerService {
  private isEnabled: boolean = true

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  public getIsEnabled(): boolean {
    return this.isEnabled
  }

  private getScriptPath(scriptName: string): string {
    try {
      const srcPath = join(app.getAppPath(), 'src', 'main', 'autonomous', 'scripts', scriptName)
      if (fs.existsSync(srcPath)) return srcPath
    } catch {}

    try {
      if (typeof __dirname !== 'undefined') {
        const devPath = join(__dirname, 'scripts', scriptName)
        if (fs.existsSync(devPath)) return devPath
      }
    } catch {}

    return join(process.cwd(), 'src', 'main', 'autonomous', 'scripts', scriptName)
  }

  /**
   * Search installed programs via Get-StartApps, Everything CLI (es.exe) and Start Menu
   */
  public async searchPrograms(query: string, limit: number = 10): Promise<ProgramSearchResult[]> {
    if (!query || !query.trim()) return []
    const cleanQuery = query.trim()

    return new Promise((resolve) => {
      const scriptPath = this.getScriptPath('search-programs.ps1')
      execFile(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Query', cleanQuery, '-Limit', String(limit)],
        { timeout: 15000, windowsHide: true },
        (error, stdout) => {
          if (error || !stdout) {
            console.warn('[ProcessManager] Program search warning/error:', error?.message)
            resolve([])
            return
          }
          try {
            const raw = stdout.trim()
            if (!raw) {
              resolve([])
              return
            }
            const parsed = JSON.parse(raw)
            const list = Array.isArray(parsed) ? parsed : [parsed]
            resolve(list)
          } catch (e) {
            console.warn('[ProcessManager] Failed to parse search-programs output:', e)
            resolve([])
          }
        }
      )
    })
  }

  /**
   * Launch any program, app or file
   */
  public async launchProgram(target: string, args: string[] = []): Promise<{ success: boolean; message: string }> {
    if (!target || !target.trim()) {
      return { success: false, message: 'Nome do programa ou comando não informado.' }
    }

    const trimmed = target.trim()

    // 1. Security validation: prevent command chaining / malicious injection
    if (/[;&|`$><]/.test(trimmed)) {
      return { success: false, message: 'Entrada contém caracteres inválidos de injeção de comando.' }
    }

    // 2. Check if target is a known app ID or needs fuzzy search
    let launchTarget = trimmed
    let isAppId = false

    // If it looks like a UWP App ID (e.g. Contains '!' or '_')
    if (trimmed.includes('!') || trimmed.includes('_8wekyb3d8bbwe')) {
      isAppId = true
    } else if (!trimmed.toLowerCase().endsWith('.exe') && !trimmed.includes('\\') && !trimmed.includes('/')) {
      // Try searching for the exact app in StartApps
      const matches = await this.searchPrograms(trimmed, 3)
      if (matches.length > 0) {
        const bestMatch = matches[0]
        if (bestMatch.appId.includes('!')) {
          launchTarget = bestMatch.appId
          isAppId = true
        } else if (bestMatch.path) {
          launchTarget = bestMatch.path
        }
      }
    }

    return new Promise((resolve) => {
      try {
        if (isAppId) {
          // Launch modern Windows app via shell:AppsFolder
          const child = spawn('explorer.exe', [`shell:AppsFolder\\${launchTarget}`], {
            detached: true,
            stdio: 'ignore'
          })
          child.unref()
          resolve({ success: true, message: `Aplicativo "${trimmed}" iniciado com sucesso via shell:AppsFolder.` })
        } else {
          // Standard Win32 or Shell executable
          const child = spawn(launchTarget, args, {
            detached: true,
            stdio: 'ignore',
            shell: true
          })

          let resolved = false
          child.on('error', (err) => {
            if (!resolved) {
              resolved = true
              resolve({ success: false, message: `Não foi possível iniciar "${trimmed}": ${err.message}` })
            }
          })

          setTimeout(() => {
            if (!resolved) {
              resolved = true
              child.unref()
              resolve({ success: true, message: `Programa "${trimmed}" iniciado com sucesso.` })
            }
          }, 400)
        }
      } catch (err: any) {
        resolve({ success: false, message: `Erro ao iniciar "${trimmed}": ${err.message}` })
      }
    })
  }

  /**
   * Terminate a program/process safely
   */
  public async terminateProgram(target: string, force: boolean = true): Promise<{ success: boolean; message: string }> {
    if (!target || !target.trim()) {
      return { success: false, message: 'Nome do processo não informado.' }
    }

    const cleanTarget = target.trim().replace(/\.exe$/i, '').toLowerCase()

    // Safety guard against killing critical Windows or Jasper processes
    if (PROTECTED_PROCESSES.has(cleanTarget)) {
      return {
        success: false,
        message: `[PROTEÇÃO DE SEGURANÇA]: O processo "${cleanTarget}" é crítico para o sistema operacional e não pode ser encerrado.`
      }
    }

    const exeTarget = `${cleanTarget}.exe`

    return new Promise((resolve) => {
      // Use taskkill for reliable Windows termination
      const flag = force ? '/F' : ''
      const cmd = `taskkill /IM "${exeTarget}" ${flag}`

      execFile('cmd.exe', ['/c', cmd], { timeout: 5000, windowsHide: true }, (error, stdout, stderr) => {
        if (error) {
          // Check if process was simply not found
          if (stderr.includes('não encontrado') || stderr.includes('not found')) {
            resolve({ success: false, message: `Nenhum processo em execução encontrado com o nome "${cleanTarget}".` })
          } else {
            resolve({ success: false, message: `Erro ao encerrar processo "${cleanTarget}": ${stderr || error.message}` })
          }
          return
        }
        resolve({ success: true, message: `Processo "${cleanTarget}" encerrado com sucesso.` })
      })
    })
  }

  /**
   * List top running processes by memory usage
   */
  public async listRunningProcesses(limit: number = 10): Promise<RunningProcessInfo[]> {
    return new Promise((resolve) => {
      const psCommand = `Get-Process | Sort-Object -Descending WS | Select-Object -First ${limit} Name, Id, WS | ForEach-Object { [PSCustomObject]@{ name = $_.Name; pid = $_.Id; memoryMb = [Math]::Round($_.WS / 1MB, 1) } } | ConvertTo-Json -Compress`
      execFile(
        'powershell',
        ['-NoProfile', '-Command', psCommand],
        { timeout: 15000, windowsHide: true },
        (error, stdout) => {
          if (error || !stdout) {
            resolve([])
            return
          }
          try {
            const raw = stdout.trim()
            if (!raw) return resolve([])
            const parsed = JSON.parse(raw)
            const list = Array.isArray(parsed) ? parsed : [parsed]
            resolve(list)
          } catch {
            resolve([])
          }
        }
      )
    })
  }
}

export const processManager = new ProcessManagerService()

