import { spawn, execFile } from 'child_process'
import { toolPolicyEngine } from './policy-engine'
import { resolvePowerShellScript } from './script-path'
import { securityBroker } from '../services/security-broker'

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

const BLOCKED_INTERPRETERS = new Set([
  'cmd', 'powershell', 'pwsh', 'wscript', 'cscript', 'mshta', 'rundll32', 'regsvr32',
  'wt', 'terminal', 'windows terminal', 'python', 'pythonw', 'node', 'bash', 'wsl',
  'git', 'certutil', 'bitsadmin', 'msiexec', 'conhost', 'forfiles', 'pcalua'
])

const DANGEROUS_EXTENSIONS = /\.(bat|cmd|vbs|js|ps1|hta|msi|reg|wsf|scr|pif)$/i

function isBlockedInterpreter(target: string): boolean {
  const fileName = target.split(/[\\/]/).pop()?.replace(/\.(exe|com)$/i, '').trim().toLowerCase() || ''
  return BLOCKED_INTERPRETERS.has(fileName)
}

export class ProcessManagerService {
  private isEnabled: boolean = true
  private launchedPids = new Set<number>()

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  public getIsEnabled(): boolean {
    return this.isEnabled
  }

  private getScriptPath(scriptName: string): string {
    return resolvePowerShellScript(scriptName)
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
   * Launch any program, app or file with strict containment and validation
   */
  public async launchProgram(target: string, args: string[] = []): Promise<{ success: boolean; message: string }> {
    if (!target || !target.trim()) {
      return { success: false, message: 'Nome do programa ou comando não informado.' }
    }

    const trimmed = target.trim()

    if (isBlockedInterpreter(trimmed)) {
      return { success: false, message: 'Interpretadores de comando nao podem ser abertos pelo assistente.' }
    }

    // 1. Security validation: prevent command chaining, UNC paths, and dangerous extensions
    if (/[;&|`$><\r\n\0]/.test(trimmed) || trimmed.length > 512 || trimmed.startsWith('\\\\')) {
      return { success: false, message: 'Entrada contém caracteres inválidos de injeção de comando.' }
    }

    if (DANGEROUS_EXTENSIONS.test(trimmed)) {
      return { success: false, message: 'Execução de scripts (.bat, .cmd, .vbs, .ps1, etc.) é bloqueada por segurança.' }
    }

    if (args.some((arg) => typeof arg !== 'string' || arg.length > 2048 || /[\r\n\0]/.test(arg))) {
      return { success: false, message: 'Um ou mais argumentos do programa são inválidos.' }
    }

    // 2. Resolve launchTarget BEFORE asking for user confirmation (avoids UI TOCTOU)
    let launchTarget = trimmed
    let isAppId = false

    if (trimmed.includes('!') || trimmed.includes('_8wekyb3d8bbwe')) {
      isAppId = true
    } else if (!trimmed.toLowerCase().endsWith('.exe') && !trimmed.toLowerCase().endsWith('.com') && !trimmed.includes('\\') && !trimmed.includes('/')) {
      const matches = await this.searchPrograms(trimmed, 3)
      if (matches.length > 0) {
        const bestMatch = matches[0]
        if (bestMatch.appId && bestMatch.appId.includes('!')) {
          launchTarget = bestMatch.appId
          isAppId = true
        } else if (bestMatch.path) {
          launchTarget = bestMatch.path
        }
      }
    }

    if (isBlockedInterpreter(launchTarget)) {
      return { success: false, message: 'Interpretadores de comando nao podem ser abertos pelo assistente.' }
    }

    if (DANGEROUS_EXTENSIONS.test(launchTarget) || launchTarget.startsWith('\\\\')) {
      return { success: false, message: 'O arquivo resolvido possui extensão de script perigosa e foi bloqueado.' }
    }

    const isLnk = /\.lnk$/i.test(launchTarget)
    const isDirectExecutable = /\.(exe|com)$/i.test(launchTarget)

    if (!isAppId && !isDirectExecutable && !isLnk) {
      // If it's a bare command name (e.g. 'calc', 'notepad') without path, check if it's safe
      if (!launchTarget.includes('\\') && !launchTarget.includes('/')) {
        launchTarget = `${launchTarget}.exe`
      } else {
        return { success: false, message: 'Execução permitida apenas para arquivos .exe ou atalhos do Menu Iniciar.' }
      }
    }

    if (isLnk && !/Microsoft\\Windows\\Start Menu\\Programs/i.test(launchTarget)) {
      return { success: false, message: 'Atalhos .lnk só podem ser executados se estiverem no Menu Iniciar oficial.' }
    }

    const isStandardPath = /^(C:\\Program Files|C:\\Program Files \(x86\)|C:\\Windows\\System32)/i.test(launchTarget)
    const requiresCriticalRisk = args.length > 0 || (!isStandardPath && !isAppId)

    // 3. User confirmation showing resolved path and appropriate risk escalation
    const approved = await securityBroker.confirmOperation({
      title: 'Autorizar abertura de programa',
      message: `Permitir que o Jasper execute "${launchTarget.slice(0, 160)}"?`,
      detail: `Alvo resolvido: ${launchTarget}${args.length ? `\nArgumentos: ${args.join(' ')}` : ''}`,
      confirmLabel: 'Executar programa',
      risk: requiresCriticalRisk ? 'critical' : 'common'
    })
    if (!approved) return { success: false, message: 'Abertura de programa cancelada pelo usuário.' }

    return new Promise((resolve) => {
      try {
        if (isAppId) {
          const child = spawn('explorer.exe', [`shell:AppsFolder\\${launchTarget}`], {
            detached: true,
            stdio: 'ignore'
          })
          child.unref()
          resolve({ success: true, message: `Aplicativo "${trimmed}" iniciado com sucesso via shell:AppsFolder.` })
        } else if (isLnk) {
          const child = spawn('explorer.exe', [launchTarget], {
            detached: true,
            stdio: 'ignore'
          })
          child.unref()
          resolve({ success: true, message: `Atalho "${trimmed}" aberto com sucesso.` })
        } else {
          const child = spawn(launchTarget, args, {
            detached: true,
            stdio: 'ignore',
            shell: false,
            windowsHide: true
          })

          if (child.pid) {
            this.launchedPids.add(child.pid)
            child.once('exit', () => this.launchedPids.delete(child.pid!))
          }

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
  public async terminateProgram(target: string | number, force: boolean = true): Promise<{ success: boolean; message: string }> {
    const rawTarget = String(target ?? '').trim()
    if (!rawTarget) {
      return { success: false, message: 'Nome do processo não informado.' }
    }

    const cleanTarget = rawTarget.replace(/\.exe$/i, '').toLowerCase()

    if (!/^[a-z0-9][a-z0-9._ -]{0,127}$/i.test(cleanTarget)) {
      return { success: false, message: 'Nome de processo inválido.' }
    }

    // Safety guard against killing critical Windows or Jasper processes
    if (PROTECTED_PROCESSES.has(cleanTarget)) {
      return {
        success: false,
        message: `[PROTEÇÃO DE SEGURANÇA]: O processo "${cleanTarget}" é crítico para o sistema operacional e não pode ser encerrado.`
      }
    }

    if (!/^\d{1,10}$/.test(rawTarget)) {
      return { success: false, message: 'Encerramento por nome foi desativado. Informe o PID numérico exibido por list_processes.' }
    }
    const pid = Number(rawTarget)
    if (!Number.isSafeInteger(pid) || pid <= 4 || pid === process.pid) {
      return { success: false, message: 'PID inválido ou protegido.' }
    }

    if (!this.launchedPids.has(pid)) {
      const approved = await securityBroker.confirmOperation({
        title: 'Autorizar encerramento de processo',
        message: `Encerrar o processo externo PID ${pid}?`,
        detail: 'Este processo não foi iniciado pelo Jasper. Salve seu trabalho antes de autorizar.',
        confirmLabel: 'Encerrar processo',
        risk: 'elevated'
      })
      if (!approved) return { success: false, message: 'Encerramento cancelado pelo usuário.' }
    }

    return new Promise((resolve) => {
      const taskkillArgs = ['/PID', String(pid)]
      if (force) taskkillArgs.push('/F')

      execFile('taskkill.exe', taskkillArgs, { timeout: 5000, windowsHide: true }, (error, stdout, stderr) => {
        if (error) {
          // Check if process was simply not found
          if (stderr.includes('não encontrado') || stderr.includes('not found')) {
            resolve({ success: false, message: `Nenhum processo em execução encontrado com o PID ${pid}.` })
          } else {
            resolve({ success: false, message: `Erro ao encerrar o PID ${pid}: ${stderr || error.message}` })
          }
          return
        }
        this.launchedPids.delete(pid)
        resolve({ success: true, message: `Processo PID ${pid} encerrado com sucesso.` })
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

