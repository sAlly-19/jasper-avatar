import { execFile } from 'child_process'
import { resolvePowerShellScript } from './script-path'
import { securityBroker } from '../services/security-broker'

const SENSITIVE_WINDOW_PATTERN = /(?:windows security|seguran[cç]a do windows|user account control|controle de conta de usu[aá]rio|credential|credencial|secure desktop|powershell|prompt de comando|command prompt|windows terminal|regedit|taskmgr|gerenciador de tarefas|bitwarden|1password|keepass|lastpass|jasper)/i
const SENSITIVE_FIELD_PATTERN = /(?:password|passwd|senha|pin|token|secret|segredo|credential|credencial|api[ _-]?key|chave[ _-]?(?:api|privada)|terminal|console|powershell|prompt de comando)/i

function validateTarget(windowTitle: string, elementName?: string): string | null {
  if (!windowTitle.trim() || windowTitle.length > 240 || /[\r\n\0]/.test(windowTitle)) {
    return 'Título de janela inválido.'
  }
  if (SENSITIVE_WINDOW_PATTERN.test(windowTitle)) {
    return 'Automação bloqueada em janelas de segurança ou credenciais.'
  }
  if (elementName !== undefined) {
    if (!elementName.trim() || elementName.length > 240 || /[\r\n\0]/.test(elementName)) {
      return 'Nome de elemento inválido.'
    }
    if (SENSITIVE_FIELD_PATTERN.test(elementName)) {
      return 'Automação bloqueada para campos de senha, token ou credenciais.'
    }
  }
  return null
}

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
    return resolvePowerShellScript('ui-automation.ps1')
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
    const validationError = validateTarget(windowTitle)
    if (validationError) {
      return { windowTitle, processId: 0, elements: [], error: validationError }
    }
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20))
    return new Promise((resolve) => {
      const scriptPath = this.getScriptPath()
      execFile(
        'powershell',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          scriptPath,
          '-Action',
          'inspect-window',
          '-WindowTitle',
          windowTitle,
          '-Limit',
          String(safeLimit),
          '-JasperPid',
          String(process.pid)
        ],
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
    const validationError = validateTarget(windowTitle, elementName)
    if (validationError) return { success: false, message: validationError }

    const approved = await securityBroker.confirmOperation({
      title: 'Autorizar clique na interface',
      message: `Permitir um clique em "${elementName}"?`,
      detail: `Janela de destino: ${windowTitle}. Confirme somente se esta ação corresponde ao que você solicitou.`,
      confirmLabel: 'Executar clique',
      risk: 'elevated'
    })
    if (!approved) return { success: false, message: 'Clique cancelado pelo usuário.' }

    return new Promise((resolve) => {
      const scriptPath = this.getScriptPath()
      execFile(
        'powershell',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          scriptPath,
          '-Action',
          'click-element',
          '-WindowTitle',
          windowTitle,
          '-ElementName',
          elementName,
          '-JasperPid',
          String(process.pid)
        ],
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
    const validationError = validateTarget(windowTitle, elementName)
    if (validationError) return { success: false, message: validationError }
    if (!text || text.length > 10000 || text.includes('\0')) {
      return { success: false, message: 'Texto vazio ou acima do limite permitido.' }
    }

    const approved = await securityBroker.confirmOperation({
      title: 'Autorizar preenchimento de campo',
      message: `Permitir que o Jasper preencha o campo "${elementName}"?`,
      detail: `Janela de destino: ${windowTitle}. O conteúdo digitado não é exibido nesta confirmação nem no log.`,
      confirmLabel: 'Preencher campo',
      risk: 'elevated'
    })
    if (!approved) return { success: false, message: 'Preenchimento cancelado pelo usuário.' }

    return new Promise((resolve) => {
      const scriptPath = this.getScriptPath()
      execFile(
        'powershell',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          scriptPath,
          '-Action',
          'set-text',
          '-WindowTitle',
          windowTitle,
          '-ElementName',
          elementName,
          '-Text',
          text,
          '-JasperPid',
          String(process.pid)
        ],
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
