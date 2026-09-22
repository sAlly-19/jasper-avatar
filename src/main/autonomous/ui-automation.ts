import { execFile } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import fs from 'fs'

export interface UIElementInfo {
  name: string
  automationId: string
  controlType: string
  isEnabled: boolean
}

export interface WindowElementsResult {
  windowTitle: string
  processId: number
  elements: UIElementInfo[]
  error?: string
}

export class UIAutomationService {
  private isEnabled: boolean = true

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  public getIsEnabled(): boolean {
    return this.isEnabled
  }

  private getScriptPath(): string {
    try {
      const srcPath = join(app.getAppPath(), 'src', 'main', 'autonomous', 'scripts', 'ui-automation.ps1')
      if (fs.existsSync(srcPath)) return srcPath
    } catch {}

    try {
      if (typeof __dirname !== 'undefined') {
        const devPath = join(__dirname, 'scripts', 'ui-automation.ps1')
        if (fs.existsSync(devPath)) return devPath
      }
    } catch {}

    return join(process.cwd(), 'src', 'main', 'autonomous', 'scripts', 'ui-automation.ps1')
  }

  /**
   * List top-level open windows
   */
  public async listWindows(limit: number = 15): Promise<any[]> {
    return new Promise((resolve) => {
      const scriptPath = this.getScriptPath()
      execFile(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Action', 'list-windows', '-Limit', String(limit)],
        { timeout: 7000, windowsHide: true },
        (error, stdout) => {
          if (error || !stdout) return resolve([])
          try {
            const parsed = JSON.parse(stdout.trim())
            resolve(Array.isArray(parsed) ? parsed : [parsed])
          } catch {
            resolve([])
          }
        }
      )
    })
  }

  /**
   * Inspect buttons and interactive elements in a window
   */
  public async inspectWindow(windowTitle: string, limit: number = 20): Promise<WindowElementsResult> {
    return new Promise((resolve) => {
      const scriptPath = this.getScriptPath()
      execFile(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Action', 'inspect-window', '-WindowTitle', windowTitle, '-Limit', String(limit)],
        { timeout: 8000, windowsHide: true },
        (error, stdout) => {
          if (error || !stdout) {
            return resolve({ windowTitle, processId: 0, elements: [], error: error?.message || 'Falha ao inspecionar janela.' })
          }
          try {
            const parsed = JSON.parse(stdout.trim())
            resolve(parsed)
          } catch {
            resolve({ windowTitle, processId: 0, elements: [], error: 'Falha ao ler dados da janela.' })
          }
        }
      )
    })
  }

  /**
   * Find and click a button or interactive element in a window
   */
  public async clickElement(windowTitle: string, elementName: string): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const scriptPath = this.getScriptPath()
      execFile(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Action', 'click-element', '-WindowTitle', windowTitle, '-ElementName', elementName],
        { timeout: 8000, windowsHide: true },
        (error, stdout) => {
          if (error || !stdout) {
            return resolve({ success: false, message: error?.message || 'Falha ao executar clique UIA.' })
          }
          try {
            const res = JSON.parse(stdout.trim())
            if (res.success) {
              resolve({ success: true, message: `Elemento "${elementName}" clicado/invocado com sucesso na janela "${windowTitle}".` })
            } else {
              resolve({ success: false, message: res.error || 'Não foi possível acionar o elemento.' })
            }
          } catch {
            resolve({ success: false, message: 'Resposta inválida do script UIA.' })
          }
        }
      )
    })
  }

  /**
   * Insert text into an input or edit box in a window
   */
  public async setElementText(windowTitle: string, elementName: string, text: string): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const scriptPath = this.getScriptPath()
      execFile(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Action', 'set-text', '-WindowTitle', windowTitle, '-ElementName', elementName, '-Text', text],
        { timeout: 8000, windowsHide: true },
        (error, stdout) => {
          if (error || !stdout) {
            return resolve({ success: false, message: error?.message || 'Falha ao definir texto UIA.' })
          }
          try {
            const res = JSON.parse(stdout.trim())
            if (res.success) {
              resolve({ success: true, message: `Texto inserido no elemento "${elementName}".` })
            } else {
              resolve({ success: false, message: res.error || 'Não foi possível definir o texto.' })
            }
          } catch {
            resolve({ success: false, message: 'Resposta inválida do script UIA.' })
          }
        }
      )
    })
  }
}

export const uiAutomation = new UIAutomationService()

